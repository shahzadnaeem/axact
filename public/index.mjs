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
let appId = 0;

function Wrapper({ url }) {
  const [apps, setApps] = useState([appId++]);

  const addApp = () => {
    setApps([...apps, appId++]);
  };

  const rmAllApps = () => setApps([]);

  const rmFirstApp = () => {
    setApps(apps.slice(1));
  };

  const rmLastApp = () => {
    setApps(apps.slice(0, -1));
  };

  const rmAppById = (id) => {
    setApps(apps.filter((i) => i !== id));
  };

  return html`<div class="wrapper grid-1col">
    <section class="wrapper-controls grid-cols just-middle">
      <a class="link-button" href="${window.location.href}" target="_blank"
        >Duplicate ⮵</a
      >

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
      ? apps.map((appId) => {
          return html`<${App}
            key=${appId}
            url=${url}
            close=${() => rmAppById(appId)}
          />`;
        })
      : html`<section class="warning">
          <button onClick=${addApp}>No Apps - Click to Add</button>
        </section>`}
  </div>`;
}

render(html`<${Wrapper} url=${url.href} />`, document.body);
