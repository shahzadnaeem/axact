import { h } from "https://unpkg.com/preact@latest?module";
import htm from "https://unpkg.com/htm?module";

import Chat from "./chat.mjs";
import Htop from "./htop.mjs";

// ----------------------------------------------------------------------------

const html = htm.bind(h);

export default function App({ ws, data }) {
  const {
    hostname,
    datetime,
    cpu_data,
    ws_count,
    ws_id,
    ws_username,
    message,
  } = data;

  const header = `Client #${ws_id} - ${ws_username} - ${ws_count} ${
    ws_count > 1 ? "Clients" : "Client"
  }`;

  return html`
    <main class="app-base grid-1col">
      <h3>${header}</h3>

      <a href="${window.location.href}" target="_blank">Duplicate</a>

      <section class="app-container grid-2col">
        ${html`<${Chat}
          ws=${ws}
          ws_id=${ws_id}
          ws_username=${ws_username}
          message=${message}
        />`}
        ${html`<${Htop}
          cpus=${cpu_data}
          hostname=${hostname}
          datetime=${datetime}
        />`}
      </section>
    </main>
  `;
}
