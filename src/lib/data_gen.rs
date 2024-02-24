use crate::{app_state::*, data::*};

use std::time::Duration;
use sysinfo::{System, SystemExt};
use tokio::sync::broadcast;

// ============================================================================
// CPU data generator - sends via broadcast_tx
// NOTE: Will block when the channel is full

pub fn cpu_data_gen(app_state: AppState, broadcast_tx: broadcast::Sender<Snapshot>) {
    loop {
        if !have_users(&app_state) {
            // println!("No users, sleeping for 1s");
            std::thread::sleep(Duration::from_secs(1));
        }

        // NOTE: Keep doing this even with no users to clean up Web Sockets
        let ws_data = get_ws_data(&app_state);

        let _ = broadcast_tx.send(ws_data);

        std::thread::sleep(System::MINIMUM_CPU_UPDATE_INTERVAL);
    }
}
