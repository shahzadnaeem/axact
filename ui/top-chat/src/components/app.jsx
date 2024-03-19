import { useState, useEffect, useRef } from "preact/hooks";

import Chat from "./chat.jsx";
import Htop from "./htop.jsx";

// ----------------------------------------------------------------------------

export default function App({ url, close }) {
  const ws = useRef(null);
  const [paused, setPaused] = useState(false);
  const [data, setData] = useState(null);
  const [chatData, setChatData] = useState(null);
  const [usersData, setUsersData] = useState([]);
  const [htopData, setHtopData] = useState(null);
  const [pausedCount, setPausedCount] = useState(0);

  useEffect(() => {
    ws.current = new WebSocket(url);

    ws.current.onmessage = (ev) => {
      let d = JSON.parse(ev.data);

      if (d.message != null) {
        console.log(`Message in: ${JSON.stringify(d.message)}`);
      }

      setData(d);
    };

    const _ws = ws.current;

    return () => {
      _ws.close();
    };
  }, []);

  const usersHaveChanged = (users) => {
    let currUsers = JSON.stringify(usersData);
    let newUsers = JSON.stringify(users);
    let changed = currUsers !== newUsers;

    if (changed) {
      console.log(`Changed users: ${newUsers}`);
      console.log(`Current users: ${currUsers}`);
    }

    return changed;
  };

  useEffect(() => {
    if (data) {
      setChatData(data);

      if (usersHaveChanged(data.users)) {
        setUsersData(data.users);
      }

      if (!paused) {
        setHtopData(data);
      } else {
        setPausedCount((c) => c + 1);
      }
    }
  }, [data, paused]);

  useEffect(() => {
    if (!paused) {
      setPausedCount(0);
    }
  }, [paused]);

  const pause_spinner = () => {
    const spinner = ["⚫", "⚫", "⚫", "⚪", "⚪" /*"𝍠", "𝍡", "𝍢", "𝍣", "𝍤",*/];
    let idx = pausedCount % spinner.length;
    return spinner[idx];
  };

  const header = chatData
    ? `🟢 Client #${chatData.ws_id} - ${chatData.ws_username} - ${
        chatData.ws_count
      } ${chatData.ws_count > 1 ? "Clients" : "Client"}`
    : "🔴 Please wait ...";

  return (
    <main class="app-base grid-1col">
      <h3>{header}</h3>
      <section class="grid-2col">
        <div></div>
        <div class="app-controls grid-cols just-middle">
          {htopData && (
            <button
              class={"pause-button" + (paused ? " paused" : "")}
              onClick={() => setPaused((p) => !p)}
            >
              {paused ? `Resume ${pause_spinner()}` : "Pause"}
            </button>
          )}
        </div>
      </section>

      <button class="close-button" onClick={() => close()}>
        ❌
      </button>

      {chatData && (
        <section class="app-container grid-2col">
          <Chat
            ws={ws.current}
            ws_id={chatData.ws_id}
            ws_username={chatData.ws_username}
            ws_message={chatData.message}
            users={usersData}
          />
          <Htop
            hostname={htopData.hostname}
            datetime={htopData.datetime}
            cpus={htopData.cpu_data}
            memory={htopData.mem_data}
          />
        </section>
      )}
    </main>
  );
}
