import { useState } from "preact/hooks";

import App from "./components/app.jsx";
import { render } from "preact";

// ----------------------------------------------------------------------------

let url = new URL("/realtime/cpus", "ws://0.0.0.0:7032");

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

  return (
    <div class="wrapper grid-1col">
      <section class="wrapper-controls grid-cols just-middle">
        <a class="link-button" href="${window.location.href}" target="_blank">
          Duplicate ⮵
        </a>

        <button class="wrapper-button" onClick={addApp}>
          Add App
        </button>
        <button class="wrapper-button" onClick={rmAllApps}>
          Remove All Apps
        </button>
        <button class="wrapper-button" onClick={rmFirstApp}>
          Remove First App
        </button>
        <button class="wrapper-button" onClick={rmLastApp}>
          Remove Last App
        </button>
      </section>

      {apps.length ? (
        apps.map((appId) => {
          return <App key={appId} url={url} close={() => rmAppById(appId)} />;
        })
      ) : (
        <section class="warning">
          <button onClick={addApp}>No Apps - Click to Add</button>
        </section>
      )}
    </div>
  );
}

render(<Wrapper url={url} />, document.body);
