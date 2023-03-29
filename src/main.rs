use axact::{app_state::*, data::*, data_gen::*, handlers::*};

use axum::{routing::get, Router, Server};
use std::sync::{Arc, Mutex};
use sysinfo::{System, SystemExt};
use tokio::sync::broadcast;
use tower_http::services::ServeDir;

// ----------------------------------------------------------------------------

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
        // Serve all files in 'public'
        .nest_service("/", ServeDir::new("public"))
        .route("/realtime/cpus", get(realtime_cpus_get))
        .with_state(app_state.clone());

    tokio::task::spawn_blocking(move || cpu_data_gen(app_state, broadcast_tx));

    const PORT: u16 = 7032;
    let bind_addr = format!("127.0.0.1:{PORT}");

    let server = Server::bind(&bind_addr.parse().unwrap()).serve(router.into_make_service());
    let addr = server.local_addr();

    let system = System::new();
    let sys_name = system.name().unwrap_or("Unknown".to_string());

    println!("Listening on http://{addr}... [{sys_name}]");

    server.await.unwrap();
}
