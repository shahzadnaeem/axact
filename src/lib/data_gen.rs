use crate::data::*;

use chrono::prelude::*;
use gethostname::gethostname;
use std::time::Duration;
use sysinfo::{CpuExt, System, SystemExt};
use tokio::sync::broadcast;

pub trait DataGen {
    fn have_users(&self) -> bool;
    fn get_sys_data(&mut self) -> WsData;
    fn get_ws_data(&mut self) -> WsData;
}

impl DataGen for AppState {
    fn have_users(&self) -> bool {
        let dynamic_state = self.dynamic_state.lock().unwrap();

        dynamic_state.have_users()
    }

    fn get_sys_data(&mut self) -> WsData {
        let hostname = gethostname().to_string_lossy().into_owned();
        let datetime = Local::now().format("%a %e %b %T").to_string();

        let sys = &mut self.dynamic_state.lock().unwrap().system;

        sys.refresh_cpu();
        sys.refresh_memory();

        let cpu_data: Vec<_> = sys
            .cpus()
            .iter()
            .enumerate()
            .map(|cpu| (cpu.0 as u32, cpu.1.cpu_usage()))
            .collect();

        let mem_data: MemoryData = MemoryData::new(
            sys.total_memory(),
            sys.free_memory(),
            sys.available_memory(),
            sys.used_memory(),
        );

        let data = WsData::new(hostname, datetime, 0, cpu_data, mem_data, None);

        data
    }

    fn get_ws_data(&mut self) -> WsData {
        let (num_users, message) = {
            let mut dynamic_state = self.dynamic_state.lock().unwrap();
            (dynamic_state.num_users(), dynamic_state.messages.pop_back())
        };

        if let Some(msg) = &message {
            eprintln!(
                "out: MESSAGE: from_id: {}, from_name: {}, message: {}",
                msg.id, msg.name, msg.message
            );
        }

        let mut data = self.get_sys_data();

        data.set_ws_count(num_users);
        data.set_message(message);

        data
    }
}

// ============================================================================
// CPU data generator - sends via broadcast_tx
// NOTE: Will block when the channel is full

pub fn cpu_data_gen(mut app_state: AppState, broadcast_tx: broadcast::Sender<Snapshot>) {
    loop {
        if !app_state.have_users() {
            // println!("No users, sleeping for 1s");
            std::thread::sleep(Duration::from_secs(1));
        }

        // NOTE: Keep doing this even with no users to clean up Web Sockets
        let ws_data = app_state.get_ws_data();
        let _ = broadcast_tx.send(ws_data);

        std::thread::sleep(System::MINIMUM_CPU_UPDATE_INTERVAL);
    }
}
