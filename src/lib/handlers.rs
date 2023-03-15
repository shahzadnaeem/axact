use crate::{app_state::*, data::*};

use axum::{
    extract::{
        ws::{Message, WebSocket},
        State, WebSocketUpgrade,
    },
    response::IntoResponse,
};
use futures::{
    stream::{SplitSink, SplitStream, StreamExt},
    SinkExt,
};
use tokio::task::JoinSet;

// ----------------------------------------------------------------------------

// WebSocket handler

pub async fn realtime_cpus_get(
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

// ----------------------------------------------------------------------------

// Read and write handlers

async fn realtime_cpus_stream(app_state: AppState, id: u32, ws: WebSocket) {
    let (sender, receiver) = ws.split();

    let mut tasks = JoinSet::new();

    tasks.spawn(rt_cpus_reader(app_state.clone(), id, receiver));
    tasks.spawn(rt_cpus_writer(app_state, id, sender));

    println!("WS STARTED for: ID #{}", id);

    while let Some(_) = tasks.join_next().await {}

    println!("WS DONE for: ID #{}", id);
}

// ----------------------------------------------------------------------------

// Write handler sends out data to a client
//   CPU data and any pending chat message

async fn rt_cpus_writer(app_state: AppState, id: u32, mut sender: SplitSink<WebSocket, Message>) {
    let mut rx = app_state.broadcast_tx.subscribe();

    while let Ok(msg) = rx.recv().await {
        let username = {
            let dynamic_state = app_state.dynamic_state.lock().unwrap();
            let possible_user = dynamic_state.users.get(&id);
            if let Some(user) = possible_user {
                user.clone()
            } else {
                // Can't find user => gone and we're done
                break;
            }
        };

        let msg_out = WsDataOut::new(msg, id, username);

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

// ----------------------------------------------------------------------------

// Read handler deals with input from a client
//     Name change
//     Chat message - to be sent to ALL clients, including the sender.
//                    This allows client to show separate 'sent'/'delivered' status
//                    (not currently implemented)

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
