use axum::{
    extract::{
        ws::{Message, WebSocket},
        State, WebSocketUpgrade,
    },
    response::IntoResponse,
    routing::get,
    Router, Server,
};
use chrono::prelude::*;
use futures::{
    stream::{SplitSink, SplitStream, StreamExt},
    SinkExt,
};
use gethostname::gethostname;
use serde::{Deserialize, Serialize};
use std::{
    collections::{HashMap, VecDeque},
    sync::{Arc, Mutex},
    time::Duration,
};
use sysinfo::{CpuExt, System, SystemExt};
use tokio::{sync::broadcast, task::JoinSet};
use tower_http::services::ServeDir;

#[derive(Debug, Clone)]
struct DynamicState {
    next_client_id: u32,
    users: HashMap<u32, String>,
    messages: VecDeque<WsMessage>,
}

impl DynamicState {
    pub fn num_users(&self) -> u32 {
        self.users.len() as u32
    }

    pub fn have_users(&self) -> bool {
        self.num_users() != 0
    }
}

impl Default for DynamicState {
    fn default() -> Self {
        DynamicState {
            next_client_id: 0,
            users: HashMap::new(),
            messages: VecDeque::new(),
        }
    }
}

#[derive(Clone)]
struct AppState {
    broadcast_tx: broadcast::Sender<Snapshot>,
    dynamic_state: Arc<Mutex<DynamicState>>,
}

#[derive(Debug, Deserialize)]
struct WsDataIn {
    id: u32,
    name: String,
    message: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
struct WsMessage {
    id: u32,
    name: String,
    message: String,
}

#[derive(Clone, Debug, Serialize)]
struct WsData {
    hostname: String,
    datetime: String,
    ws_count: u32,
    cpu_data: Vec<(u32, f32)>,
    message: Option<WsMessage>,
}

type Snapshot = WsData;

#[derive(Clone, Debug, Serialize)]
struct WsDataOut {
    hostname: String,
    datetime: String,
    ws_count: u32,
    ws_id: u32,
    ws_username: String,
    cpu_data: Vec<(u32, f32)>,
    message: Option<WsMessage>,
}

impl From<WsData> for WsDataOut {
    fn from(it: WsData) -> Self {
        WsDataOut {
            hostname: it.hostname,
            datetime: it.datetime,
            ws_count: it.ws_count,
            ws_id: 0,
            ws_username: "".to_string(),
            cpu_data: it.cpu_data,
            message: it.message,
        }
    }
}

#[tokio::main]
async fn main() {
    const BROADCAST_CHANNEL_CAPACITY: usize = 1;

    let (broadcast_tx, _) = broadcast::channel::<Snapshot>(BROADCAST_CHANNEL_CAPACITY);

    tracing_subscriber::fmt::init();

    let app_state = AppState {
        broadcast_tx: broadcast_tx.clone(),
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
        if !have_users(&app_state) {
            println!("No users, sleeping for 1s");
            std::thread::sleep(Duration::from_secs(1));
            continue;
        }

        let ws_data = get_ws_data(&app_state, &mut sys);

        let _ = broadcast_tx.send(ws_data);

        std::thread::sleep(System::MINIMUM_CPU_UPDATE_INTERVAL);
    }
}

fn have_users(app_state: &AppState) -> bool {
    let dynamic_state = app_state.dynamic_state.lock().unwrap();

    dynamic_state.have_users()
}

fn get_ws_data(app_state: &AppState, sys: &mut System) -> WsData {
    let (num_users, message) = {
        let mut dynamic_state = app_state.dynamic_state.lock().unwrap();
        (dynamic_state.num_users(), dynamic_state.messages.pop_back())
    };

    if let Some(msg) = &message {
        eprintln!(
            "out: MESSAGE: from_id: {}, from_name: {}, message: {}",
            msg.id, msg.name, msg.message
        );
    }

    let hostname = gethostname().to_string_lossy().into_owned();

    let datetime = Local::now().format("%a %e %b %T").to_string();

    sys.refresh_cpu();

    let v: Vec<_> = sys
        .cpus()
        .iter()
        .enumerate()
        .map(|cpu| (cpu.0 as u32, cpu.1.cpu_usage()))
        .collect();

    let data = WsData {
        hostname,
        datetime,
        ws_count: num_users,
        cpu_data: v,
        message,
    };

    data
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

    dynamic_state.next_client_id += 1u32;

    let id = dynamic_state.next_client_id;
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

async fn rt_cpus_writer(app_state: AppState, id: u32, mut sender: SplitSink<WebSocket, Message>) {
    //
    // Get a receiver for the
    //
    let mut rx = app_state.broadcast_tx.subscribe();

    while let Ok(msg) = rx.recv().await {
        let mut msg_out = WsDataOut::from(msg);

        msg_out.ws_id = id;
        msg_out.ws_username = {
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
            .send(Message::Text(serde_json::to_string(&msg_out).unwrap()))
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
                        let user_valid = data.id == id;

                        if !user_valid {
                            eprintln!("in: INVALID ID: {}, actual id: {}", data.id, id);

                            continue;
                        }

                        let mut dynamic_state = app_state.dynamic_state.lock().unwrap();
                        let prev_name = dynamic_state.users.insert(id, data.name.clone());

                        if let Some(pname) = prev_name {
                            if data.name != pname {
                                eprintln!(
                                    "in: NAME: id: {}, name: {} => {}",
                                    data.id, &pname, &data.name,
                                );
                            }
                        }

                        // TODO: Clean current implementation up
                        //
                        //   - Process incoming message (by adding type)
                        //   - Update AppState with anything that needs to be stored
                        //   - AppState then get checked in 'main' loop and action taken
                        //     - NOTE: Action can be at 'main' loop or per client handler
                        //             Eg if a client says stop updates
                        //                or status change ...

                        if let Some(message) = data.message {
                            eprintln!(
                                "in: MESSAGE: id: {}, name: {}, message: {}",
                                data.id, &data.name, &message
                            );

                            dynamic_state.messages.push_front(WsMessage {
                                id: data.id,
                                name: data.name,
                                message,
                            });
                        }
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
