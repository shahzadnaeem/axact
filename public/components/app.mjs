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
  const [data, setData] = useState(null);

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

  const header = data
    ? `🟢 Client #${data.ws_id} - ${data.ws_username} - ${data.ws_count} ${
        data.ws_count > 1 ? "Clients" : "Client"
      }`
    : "🔴 Please wait ...";

  return html`
    <main class="app-base grid-1col">
      <h3>${header}</h3>
      <button class="close-button" onClick=${() => close()}>❌</button>

      ${data &&
      html`
        <section class="app-container grid-2col">
          ${html`<${Chat}
            ws=${ws.current}
            ws_id=${data.ws_id}
            ws_username=${data.ws_username}
            ws_message=${data.message}
          />`}
          ${html`<${Htop}
            cpus=${data.cpu_data}
            hostname=${data.hostname}
            datetime=${data.datetime}
          />`}
        </section>
      `}
    </main>
  `;
}
