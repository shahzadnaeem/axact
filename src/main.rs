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
    stream::{SplitSink, SplitStream, StreamExt},
    SinkExt,
};
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    sync::{Arc, Mutex},
    time::Duration,
};
use sysinfo::{CpuExt, System, SystemExt};
use tokio::{
    sync::{broadcast, mpsc},
    task::JoinSet,
};
use tower_http::services::ServeDir;

#[derive(Debug, Clone)]
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

#[derive(Debug)]
struct SharedState {
    req_tx: mpsc::Sender<Requests>,
}

impl SharedState {
    pub fn new(req_tx: mpsc::Sender<Requests>) -> Self {
        SharedState { req_tx }
    }
}

#[derive(Clone)]
struct AppState {
    broadcast_tx: broadcast::Sender<Snapshot>,
    shared_state: Arc<Mutex<SharedState>>,
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

//
// TODO: Our outgoing messages
//

#[derive(Clone, Debug, Serialize)]
struct ChatMessage {
    username: String,
    message: String,
}

#[derive(Clone, Debug, Serialize)]
enum Requests {
    Chat(ChatMessage),
}

type Request = Requests;

#[tokio::main]
async fn main() {
    const BROADCAST_CHANNEL_CAPACITY: usize = 1;

    let (broadcast_tx, _) = broadcast::channel::<Snapshot>(BROADCAST_CHANNEL_CAPACITY);

    // TODO: Need a second channel to receive messages for distribution from the clients
    let (req_tx, mut req_rx) = mpsc::channel::<Requests>(100);

    tracing_subscriber::fmt::init();

    let app_state = AppState {
        broadcast_tx: broadcast_tx.clone(),
        shared_state: Arc::new(Mutex::new(SharedState::new(req_tx))),
        dynamic_state: Arc::new(Mutex::new(DynamicState::default())),
    };

    let router = Router::new()
        // Serve all files in 'src'
        .nest_service("/", ServeDir::new("public"))
        .route("/realtime/cpus", get(realtime_cpus_get))
        .with_state(app_state.clone());

    tokio::task::spawn_blocking(move || cpu_data_gen(app_state, broadcast_tx));

    let server = Server::bind(&"0.0.0.0:7032".parse().unwrap()).serve(router.into_make_service());
    let addr = server.local_addr();
    println!("Listening on http://{addr} ...");

    server.await.unwrap();
}

// ============================================================================
// CPU data generator - sends via broadcast_tx
// NOTE: Will block when the channel is full
//

fn cpu_data_gen(app_state: AppState, broadcast_tx: broadcast::Sender<Snapshot>) {
    let mut sys = System::new();

    loop {
        let num_users = {
            let dynamic_state = app_state.dynamic_state.lock().unwrap();
            dynamic_state.users.len() as u32
        };

        if num_users != 0 {
            sys.refresh_cpu();
            let v: Vec<_> = sys
                .cpus()
                .iter()
                .enumerate()
                .map(|cpu| (cpu.0, cpu.1.cpu_usage()))
                .collect();

            let data = WsData {
                ws_id: 0,
                ws_username: "".to_string(),
                ws_count: num_users,
                cpu_data: v,
            };
            let _ = broadcast_tx.send(data);

            std::thread::sleep(System::MINIMUM_CPU_UPDATE_INTERVAL);
        } else {
            println!("No users, sleeping for 1s");
            std::thread::sleep(Duration::from_secs(1));
        }
    }
}

// ============================================================================
// WS creation endpoint
//

#[axum::debug_handler]
async fn realtime_cpus_get(
    ws: WebSocketUpgrade,
    State(app_state): State<AppState>,
) -> impl IntoResponse {
    let id = get_next_user_id(&app_state);

    ws.on_upgrade(move |ws: WebSocket| async move { realtime_cpus_stream(app_state, id, ws).await })
}

fn get_next_user_id(app_state: &AppState) -> u32 {
    let mut dynamic_state = app_state.dynamic_state.lock().unwrap();

    dynamic_state.client_id += 1u32;

    let id = dynamic_state.client_id;
    dynamic_state.users.insert(id, format!("Unknown-{}", &id));

    id
}

// ============================================================================
// WS handlers
//

async fn realtime_cpus_stream(app_state: AppState, id: u32, ws: WebSocket) {
    let (sender, receiver) = ws.split();

    let mut tasks = JoinSet::new();

    tasks.spawn(rt_cpus_reader(app_state.clone(), id, receiver));
    tasks.spawn(rt_cpus_writer(app_state, id, sender));

    println!("WS STARTED for: ID #{}", id);

    while let Some(_) = tasks.join_next().await {}

    println!("WS DONE for: ID #{}", id);
}

// async fn socket_writer()
async fn rt_cpus_writer(app_state: AppState, id: u32, mut sender: SplitSink<WebSocket, Message>) {
    //
    // Get a receiver for the
    //
    let mut rx = app_state.broadcast_tx.subscribe();

    while let Ok(mut msg) = rx.recv().await {
        msg.ws_id = id;
        msg.ws_username = {
            let dynamic_state = app_state.dynamic_state.lock().unwrap();
            let possible_user = dynamic_state.users.get(&id);
            if let Some(user) = possible_user {
                user.clone()
            } else {
                // Can't find user => gone and we're done
                break;
            }
        };

        let res = sender
            .send(Message::Text(serde_json::to_string(&msg).unwrap()))
            .await;

        match res {
            Ok(_good) => {}
            Err(_) => {
                // Error => WS gone and we're done
                break;
            }
        }
    }
}

async fn rt_cpus_reader(app_state: AppState, id: u32, mut ws: SplitStream<WebSocket>) {
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

                        // TODO: This is where we get any message and use a new Mutex locked shared channel to send it for distribution
                        //       - Get a hold of the channel.tx lock
                        //       - Send the message
                        //       - Maybe update some state to say we've added a message
                        //       - Can check that we are not filling up
                        //
                        // ... eventually the main
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

    // We are done receiving as socket has closed
    let mut dynamic_state = app_state.dynamic_state.lock().unwrap();

    dynamic_state.users.remove(&id);
}
