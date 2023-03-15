use chrono::prelude::*;
use serde::Serialize;

#[derive(Clone, Debug, Serialize)]
struct ResponseHeader {
    now: DateTime<Local>,
    client_id: u32,
    username: String,
    client_count: u32,
}

#[derive(Clone, Debug, Serialize)]
enum ResponseIds {
    CpuLoad = 1,
    Chat = 2,
}

#[derive(Clone, Debug, Serialize)]
struct CpuLoad {
    id: u32,
    load: f32,
}

#[derive(Clone, Debug, Serialize)]
struct CpuLoadMessage {
    hostname: String,
    datetime: String,
    cpu_loads: Vec<CpuLoad>,
}

#[derive(Clone, Debug, Serialize)]
struct ChatMessage {
    from: String,
    message: String,
}

#[derive(Clone, Debug, Serialize)]
enum Responses {
    CpuLoad(CpuLoadMessage),
    Chat(ChatMessage),
}

#[derive(Clone, Debug, Serialize)]
struct ResponseMessage {
    header: ResponseHeader,
    id: ResponseIds,
    response: Responses,
}

impl ResponseHeader {
    pub fn new(client_id: u32, username: String, client_count: u32) -> Self {
        ResponseHeader {
            now: Local::now(),
            client_id,
            username,
            client_count,
        }
    }
}
