use axum::{
    extract::{
        ws::{Message, WebSocket},
        State, WebSocketUpgrade,
    },
    response::IntoResponse,
    routing::get,
    Router, Server,
};
use futures::{
    sink::SinkExt,
    stream::{SplitStream, StreamExt},
};
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    sync::{Arc, Mutex},
};
use sysinfo::{CpuExt, System, SystemExt};
use tokio::sync::broadcast;
use tower_http::services::ServeDir;

#[derive(Clone)]
struct DynamicState {
    client_id: u32,
    users: HashMap<u32, String>,
}

impl Default for DynamicState {
    fn default() -> Self {
        DynamicState {
            client_id: 0,
            users: HashMap::new(),
        }
    }
}

#[derive(Clone)]
struct AppState {
    tx: broadcast::Sender<Snapshot>,
    dynamic_state: Arc<Mutex<DynamicState>>,
}

#[derive(Debug, Deserialize)]
struct WsDataIn {
    id: u32,
    name: String,
    message: String,
}

#[derive(Clone, Debug, Serialize)]
struct WsData {
    ws_count: u32,
    ws_id: u32,
    ws_username: String,
    cpu_data: Vec<(usize, f32)>,
}

type Snapshot = WsData;

#[tokio::main]
async fn main() {
    let (tx, _) = broadcast::channel::<Snapshot>(1);

    tracing_subscriber::fmt::init();

    let app_state = AppState {
        tx: tx.clone(),
        dynamic_state: Arc::new(Mutex::new(DynamicState::default())),
    };

    let router = Router::new()
        // Serve all files in 'src'
        .nest_service("/", ServeDir::new("public"))
        .route("/realtime/cpus", get(realtime_cpus_get))
        .with_state(app_state.clone());

    // Update CPU usage in the background
    tokio::task::spawn_blocking(move || {
        let mut sys = System::new();
        loop {
            sys.refresh_cpu();
            let v: Vec<_> = sys
                .cpus()
                .iter()
                .enumerate()
                .map(|cpu| (cpu.0, cpu.1.cpu_usage()))
                .collect();

            {
                let dynamic_state = app_state.dynamic_state.lock().unwrap();

                let data = WsData {
                    ws_id: 0,
                    ws_username: "".to_string(),
                    ws_count: dynamic_state.users.len() as u32,
                    cpu_data: v,
                };

                let _ = tx.send(data);
            }

            std::thread::sleep(System::MINIMUM_CPU_UPDATE_INTERVAL);
        }
    });

    let server = Server::bind(&"0.0.0.0:7032".parse().unwrap()).serve(router.into_make_service());
    let addr = server.local_addr();
    println!("Listening on http://{addr} ...");

    server.await.unwrap();
}

// WS creation endpoint

#[axum::debug_handler]
async fn realtime_cpus_get(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
) -> impl IntoResponse {
    let id = {
        let mut dynamic_state = state.dynamic_state.lock().unwrap();

        dynamic_state.client_id += 1u32;

        let id = dynamic_state.client_id;
        dynamic_state.users.insert(id, format!("Unknown-{}", &id));

        eprintln!("Users: {:?}", dynamic_state.users);

        id
    };

    ws.on_upgrade(move |ws: WebSocket| async move { realtime_cpus_stream(state, id, ws).await })
}

// WS handlers

async fn realtime_cpus_stream(app_state: AppState, id: u32, ws: WebSocket) {
    let (mut sender, receiver) = ws.split();

    let cloned_app_state = app_state.clone();

    tokio::spawn(socket_reader(app_state, id, receiver));

    let mut rx = cloned_app_state.tx.subscribe();
    while let Ok(mut msg) = rx.recv().await {
        msg.ws_id = id;
        msg.ws_username = {
            let dynamic_state = cloned_app_state.dynamic_state.lock().unwrap();
            let possible_user = dynamic_state.users.get(&id);
            if let Some(user) = possible_user {
                user.clone()
            } else {
                // User is gone, so we are done
                eprintln!("WS Client #{} gone!", id);
                break;
            }
        };

        let res = sender
            .send(Message::Text(serde_json::to_string(&msg).unwrap()))
            .await;

        match res {
            Ok(_good) => {}
            Err(msg) => {
                eprintln!("WS Client #{} done {:?}", id, msg);
                break;
            }
        }
    }
}

async fn socket_reader(app_state: AppState, id: u32, mut ws: SplitStream<WebSocket>) {
    while let Some(res) = ws.next().await {
        if let Ok(msg) = res {
            match msg {
                Message::Text(s) => {
                    let parsed: Result<WsDataIn, _> = serde_json::from_str(&s);

                    if let Ok(data) = parsed {
                        eprintln!(
                            "Got: id: {} [{}], name: {}, message: {}",
                            data.id,
                            if data.id == id { "Valid" } else { "Invalid!" },
                            data.name,
                            data.message
                        );

                        let mut dynamic_state = app_state.dynamic_state.lock().unwrap();
                        dynamic_state.users.insert(id, data.name);
                    } else {
                        eprintln!("Got: UKNOWN message: {}", s);
                    }
                }
                _ => {}
            }
        } else {
            eprintln!("Got: Error!");
        }
    }

    eprintln!("Done receiving for WS Client #{}", id);

    // We are done receiving as socket has closed
    let mut dynamic_state = app_state.dynamic_state.lock().unwrap();

    dynamic_state.users.remove(&id);
}
