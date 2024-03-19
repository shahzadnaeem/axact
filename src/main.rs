use axact::{data::*, data_gen::*, handlers::*};

use axum::{routing::get, Router, Server};
use std::error::Error;
use std::net::SocketAddr;
use std::sync::{Arc, Mutex};
use sysinfo::{System, SystemExt};
use tokio::sync::broadcast;
use tokio::sync::broadcast::Sender;
use tower_http::services::ServeDir;

// ----------------------------------------------------------------------------

fn new_app_state() -> (AppState, AppState, Sender<WsData>) {
    const BROADCAST_CHANNEL_CAPACITY: usize = 1;

    let (broadcast_tx, _) = broadcast::channel::<Snapshot>(BROADCAST_CHANNEL_CAPACITY);

    tracing_subscriber::fmt::init();

    let app_state = AppState {
        broadcast_tx: broadcast_tx.clone(),
        dynamic_state: Arc::new(Mutex::new(DynamicState::default())),
    };

    (app_state.clone(), app_state, broadcast_tx)
}

// ----------------------------------------------------------------------------

fn start_data_generator(app_state: AppState, broadcast_tx: Sender<WsData>) {
    // CPU data generator - sends CPU data via 'broadcast_tx'
    tokio::task::spawn_blocking(move || cpu_data_gen(app_state, broadcast_tx));
}

// ----------------------------------------------------------------------------

fn setup_router(app_state: AppState) -> Router {
    Router::new()
        // Serve all files in 'public'
        .nest_service("/", ServeDir::new("public"))
        .route("/realtime/cpus", get(realtime_cpus_get)) // Websocket
        .route("/cpus", get(cpus_get))
        .with_state(app_state)
}

// ----------------------------------------------------------------------------

fn get_system_name() -> String {
    let system = System::new();

    system.name().unwrap_or("Unknown".to_string())
}

fn print_listening_message(addr: SocketAddr, port: u16) {
    let sys_name = get_system_name();

    if sys_name != "Windows" {
        println!("Listening     on http://{addr}... [{sys_name}]");
        println!("Standalone UI on http://0.0.0.0:5173");
    } else {
        // Local connection thing with Windows
        println!("Listening     on http://127.0.0.1:{port}... [{sys_name}]");
        println!("Standalone UI on http://127.0.0.1:5173");
    }
}

// ----------------------------------------------------------------------------

#[tokio::main]
async fn main() -> Result<(), Box<dyn Error>> {
    let (app_state, cloned_app_state, broadcast_tx) = new_app_state();

    start_data_generator(cloned_app_state, broadcast_tx);

    let router = setup_router(app_state);

    const PORT: u16 = 7032;
    let bind_addr = format!("0.0.0.0:{PORT}"); // Addr must be 0.0.0.0 - esp Windows

    let server = Server::bind(&bind_addr.parse()?).serve(router.into_make_service());

    print_listening_message(server.local_addr(), PORT);

    server.await?;

    Ok(())
}
