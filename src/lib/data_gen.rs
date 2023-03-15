use crate::{app_state::*, data::*};

use std::time::Duration;
use sysinfo::{System, SystemExt};
use tokio::sync::broadcast;

// ============================================================================
// CPU data generator - sends via broadcast_tx
// NOTE: Will block when the channel is full

pub fn cpu_data_gen(app_state: AppState, broadcast_tx: broadcast::Sender<Snapshot>) {
    let mut sys = System::new();

    loop {
        if !have_users(&app_state) {
            println!("No users, sleeping for 1s");
            std::thread::sleep(Duration::from_secs(1));

            // FIXME: This is correct, but seems to prevent detection of final client close
            //        until a new client connects - handlers.rs:54
            //
            //        -- Client ID #1 closed
            //        WS STARTED for: ID #1
            //        No users, sleeping for 1s
            //        No users, sleeping for 1s
            //        No users, sleeping for 1s
            //        No users, sleeping for 1s
            //        No users, sleeping for 1s
            //        No users, sleeping for 1s
            //        No users, sleeping for 1s
            //        WS STARTED for: ID #2
            //        -- This only appears after new Client ID #2 starts
            //        WS DONE for: ID #1

            continue;
        }

        let ws_data = get_ws_data(&app_state, &mut sys);

        let _ = broadcast_tx.send(ws_data);

        std::thread::sleep(System::MINIMUM_CPU_UPDATE_INTERVAL);
    }
}
