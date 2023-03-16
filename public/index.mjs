import { h, render } from "https://unpkg.com/preact@latest?module";
import {
  useState,
  useEffect,
  useRef,
} from "https://unpkg.com/preact@latest/hooks/dist/hooks.module.js?module";
import htm from "https://unpkg.com/htm?module";

import App from "./components/app.mjs";

// ----------------------------------------------------------------------------

const html = htm.bind(h);

let url = new URL("/realtime/cpus", window.location.href.replace("http", "ws"));

// Unique identifier for app - needed as key
let appIdx = 0;

function Wrapper({ url }) {
  const [apps, setApps] = useState([appIdx++]);

  const addApp = () => {
    setApps([...apps, appIdx++]);
  };

  const rmAllApps = () => setApps([]);

  const rmFirstApp = () => {
    setApps(apps.slice(1));
  };

  const rmLastApp = () => {
    setApps(apps.slice(0, -1));
  };

  return html`<div class="wrapper grid-1col">
    <section class="wrapper-controls grid-cols just-middle">
      <button class="wrapper-button" onClick=${addApp}>Add App</button>
      <button class="wrapper-button" onClick=${rmAllApps}>
        Remove All Apps
      </button>
      <button class="wrapper-button" onClick=${rmFirstApp}>
        Remove First App
      </button>
      <button class="wrapper-button" onClick=${rmLastApp}>
        Remove Last App
      </button>
    </section>

    ${apps.length
      ? apps.map((appIdx) => {
          return html`<${App} key=${appIdx} url=${url} />`;
        })
      : html`<section class="warning">No Apps!</section>`}
  </div>`;
}

render(html`<${Wrapper} url=${url.href} />`, document.body);
