use serde::{Deserialize, Serialize};

use std::{
    collections::{HashMap, VecDeque},
    mem,
    sync::{Arc, Mutex},
};

use sysinfo::{System, SystemExt};
use tokio::sync::broadcast;

// ----------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
pub struct WsDataIn {
    pub id: u32,
    pub name: String,
    pub to_id: u32,
    pub message: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
pub struct WsMessage {
    pub id: u32,
    pub name: String,
    pub to_id: u32,
    pub message: String,
}

#[derive(Clone, Debug, Serialize)]
pub struct MemoryData {
    total: u64,
    free: u64,
    available: u64,
    used: u64,
}

impl MemoryData {
    pub fn new(total: u64, free: u64, available: u64, used: u64) -> Self {
        MemoryData {
            total,
            free,
            available,
            used,
        }
    }
}

#[derive(Clone, Debug, Serialize)]
pub struct WsData {
    hostname: String,
    datetime: String,
    ws_count: u32,
    cpu_data: Vec<(u32, f32)>,
    mem_data: MemoryData,
    message: Option<WsMessage>,
}

impl WsData {
    pub fn new(
        hostname: String,
        datetime: String,
        ws_count: u32,
        cpu_data: Vec<(u32, f32)>,
        mem_data: MemoryData,
        message: Option<WsMessage>,
    ) -> Self {
        WsData {
            hostname,
            datetime,
            ws_count,
            cpu_data,
            mem_data,
            message,
        }
    }

    pub fn set_ws_count(self: &mut Self, n: u32) {
        self.ws_count = n;
    }

    pub fn set_message(self: &mut Self, msg: Option<WsMessage>) {
        self.message = msg;
    }
}

pub type Snapshot = WsData;

#[derive(Clone, Debug, Serialize)]
pub struct WsDataOut {
    hostname: String,
    datetime: String,
    ws_count: u32,
    ws_id: u32,
    ws_username: String,
    users: Vec<(u32, String)>,
    cpu_data: Vec<(u32, f32)>,
    mem_data: MemoryData,
    message: Option<WsMessage>,
}

impl WsDataOut {
    fn from_with_message_filter(base: WsData, to_id: u32, username: &String) -> Self {
        let mut message = base.message.clone();

        if let Some(msg) = base.message {
            if msg.to_id != 0 && msg.to_id != to_id && msg.id != to_id {
                message = None;

                eprintln!("Not sending messge for {} to {}", msg.to_id, username);
            }
        }

        WsDataOut {
            hostname: base.hostname,
            datetime: base.datetime,
            ws_count: base.ws_count,
            ws_id: 0,
            ws_username: "".to_string(),
            users: vec![],
            cpu_data: base.cpu_data,
            mem_data: base.mem_data,
            message: message,
        }
    }
}

impl WsDataOut {
    pub fn new(base: WsData, id: u32, username: String, users: Vec<(u32, String)>) -> Self {
        let mut res = WsDataOut::from_with_message_filter(base, id, &username);

        res.ws_id = id;
        res.ws_username = username;
        // TODO: Sending this all the time is not good!
        //       Causes rebuilding of users list in UI
        //       Need multiple messages to the UI - CPU, User Update, Chat Message
        res.users = users;

        res
    }
}

// ----------------------------------------------------------------------------

#[derive(Debug)]
pub struct DynamicState {
    pub next_client_id: u32,
    pub users: HashMap<u32, String>,
    pub messages: VecDeque<WsMessage>,
    pub system: System,
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
            system: System::new(),
        }
    }
}

#[derive(Clone, Debug)]
pub struct AppState {
    pub broadcast_tx: broadcast::Sender<Snapshot>,
    pub dynamic_state: Arc<Mutex<DynamicState>>,
}
