use std::{
    collections::{HashMap, VecDeque},
    sync::{Arc, Mutex},
};

use chrono::prelude::*;
use gethostname::gethostname;
use sysinfo::{CpuExt, System, SystemExt};
use tokio::sync::broadcast;

use crate::data::*;

// ----------------------------------------------------------------------------

#[derive(Debug, Clone)]
pub struct DynamicState {
    pub next_client_id: u32,
    pub users: HashMap<u32, String>,
    pub messages: VecDeque<WsMessage>,
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
pub struct AppState {
    pub broadcast_tx: broadcast::Sender<Snapshot>,
    pub dynamic_state: Arc<Mutex<DynamicState>>,
}

// ----------------------------------------------------------------------------

pub fn have_users(app_state: &AppState) -> bool {
    let dynamic_state = app_state.dynamic_state.lock().unwrap();

    dynamic_state.have_users()
}

pub fn get_ws_data(app_state: &AppState, sys: &mut System) -> WsData {
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

    let data = WsData::new(hostname, datetime, num_users, v, message);

    data
}
