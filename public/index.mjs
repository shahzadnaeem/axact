import { h, render } from "https://unpkg.com/preact@latest?module";
import htm from "https://unpkg.com/htm?module";

import App from "./components/app.mjs";

// ----------------------------------------------------------------------------

const html = htm.bind(h);

let url = new URL("/realtime/cpus", window.location.href.replace("http", "ws"));

let ws = new WebSocket(url.href);

// Render App whenever we get a new WS message...
// TODO: Turn into a standard App and move WS there. Then only a single render will be needed.

ws.onmessage = (ev) => {
  let json = JSON.parse(ev.data);

  if (json.message != null) {
    console.log(`Message in: ${JSON.stringify(json.message)}`);
  }

  render(html`<${App} ws=${ws} data=${json} />`, document.body);
};
