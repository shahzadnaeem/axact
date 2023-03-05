import { h, render } from "https://unpkg.com/preact?module";
import htm from "https://unpkg.com/htm?module";

const html = htm.bind(h);

function App(props) {
  return html`
    <main>
      <h3>
        WS #${props.wsId} - Update #${props.wsEvents} - ${props.wsCount} Web
        Sockets
      </h3>
      ${props.cpus.map((cpu) => {
        return html`<div class="cpu-info">
          <div class="cpu-num">${cpu[0] + 1}</div>
          <div class="bar">
            <div class="bar-inner" style="width: ${cpu[1]}%"></div>
            <label>${cpu[1].toFixed(2)}%</label>
          </div>
        </div>`;
      })}
    </main>
  `;
}

// let update = async () => {
//   let response = await fetch("/api/cpus");
//   if (response.status !== 200) {
//     throw new Error(`HTTP error! status: ${response.status}`);
//   }

//   let json = await response.json();
//   render(html`<${App} cpus=${json}></${App}>`, document.body);
// };

// update();
// setInterval(update, 200);

let url = new URL("/realtime/cpus", window.location.href);
url.protocol = url.protocol.replace("http", "ws");

let ws_events = 0;

let ws = new WebSocket(url.href);
ws.onmessage = (ev) => {
  let json = JSON.parse(ev.data);

  ws_events++;

  render(
    html`<${App} cpus=${json.cpu_data} wsCount=${json.ws_count} wsId=${json.ws_id} wsEvents=${ws_events}></${App}>`,
    document.body
  );

  ws.send(`WS #${json.ws_id} - Event #${ws_events}`);
};
