import { h, render } from "https://unpkg.com/preact@latest?module";
import htm from "https://unpkg.com/htm?module";

import App from "./components/app.mjs";

// ----------------------------------------------------------------------------

const html = htm.bind(h);

let url = new URL("/realtime/cpus", window.location.href.replace("http", "ws"));

render(html`<${App} url=${url.href} />`, document.body);
