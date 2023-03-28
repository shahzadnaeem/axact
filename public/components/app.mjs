import { h } from "https://unpkg.com/preact@latest?module";
import {
  useState,
  useEffect,
  useRef,
} from "https://unpkg.com/preact@latest/hooks/dist/hooks.module.js?module";
import htm from "https://unpkg.com/htm?module";

import Chat from "./chat.mjs";
import Htop from "./htop.mjs";

// ----------------------------------------------------------------------------

const html = htm.bind(h);

export default function App({ url, close }) {
  const ws = useRef(null);
  const [paused, setPaused] = useState(false);
  const [data, setData] = useState(null);
  const [chatData, setChatData] = useState(null);
  const [htopData, setHtopData] = useState(null);

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

  useEffect(() => {
    if (data) {
      setChatData(data);
      if (!paused) {
        setHtopData(data);
      }
    }
  }, [data, paused]);

  const header = chatData
    ? `🟢 Client #${chatData.ws_id} - ${chatData.ws_username} - ${
        chatData.ws_count
      } ${chatData.ws_count > 1 ? "Clients" : "Client"}`
    : "🔴 Please wait ...";

  return html`
    <main class="app-base grid-1col">
      <h3>${header}</h3>
      <section class="grid-2col">
        <div></div>
        <div class="app-controls grid-cols just-middle">
          <button
            class=${"pause-button" + (paused ? " paused" : "")}
            onClick=${() => setPaused((p) => !p)}
          >
            ${paused ? "Resume" : "Pause"}
          </button>
        </div>
      </section>

      <button class="close-button" onClick=${() => close()}>❌</button>

      ${chatData &&
      html`
        <section class="app-container grid-2col">
          ${html`<${Chat}
            ws=${ws.current}
            ws_id=${chatData.ws_id}
            ws_username=${chatData.ws_username}
            ws_message=${chatData.message}
          />`}
          ${htopData &&
          html`<${Htop}
            hostname=${htopData.hostname}
            datetime=${htopData.datetime}
            cpus=${htopData.cpu_data}
            memory=${htopData.mem_data}
          />`}
        </section>
      `}
    </main>
  `;
}
