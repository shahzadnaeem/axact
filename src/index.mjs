import { h, render } from "https://unpkg.com/preact@latest?module";
import {
  useState,
  useEffect,
} from "https://unpkg.com/preact@latest/hooks/dist/hooks.module.js?module";
import htm from "https://unpkg.com/htm?module";

const html = htm.bind(h);

let url = new URL("/realtime/cpus", window.location.href.replace("http", "ws"));

let ws_id = 0;
let ws_events = 0;

let ws = new WebSocket(url.href);

ws.onmessage = (ev) => {
  let json = JSON.parse(ev.data);

  console.log(json);

  ws_id = json.ws_id;
  ws_events++;

  render(
    html`<${App} cpus=${json.cpu_data} wsCount=${json.ws_count} wsId=${json.ws_id} wsUsername=${json.ws_username} wsEvents=${ws_events}></${App}>`,
    document.body
  );
};

function App(props) {
  const [name, setName] = useState(props.wsUsername);
  const [message, setMessage] = useState("");
  const [doSend, setDoSend] = useState(false);

  useEffect(() => {
    let data = {
      id: ws_id,
      name: `${name}`,
      message: "",
    };

    ws.send(JSON.stringify(data));
  }, [name]);

  useEffect(() => {
    if (message !== "") {
      let data = {
        id: ws_id,
        name: `${name}`,
        message: `${message}`,
      };

      ws.send(JSON.stringify(data));
    }
  }, [doSend]);

  const handleName = (ev) => {
    const newName = ev.target.value;

    if (newName !== "" && newName !== name) {
      setName(newName);
    }
  };

  const handleMessage = (ev) => {
    const newMessage = ev.target.value;

    setMessage(newMessage);
  };

  const sendMessage = () => {
    setDoSend(!doSend);
  };

  return html`
    <main>
      <h3>
        WS #${props.wsId} - ${props.wsUsername} - Update #${props.wsEvents} - ${
    props.wsCount
  } Web
        Sockets
      </h3>
      <section class="form">
        <div>
          <label for="name">Name: </label>
          <input id="name" type="text" placeholder="Enter your name" value=${name} onInput=${handleName}></input>
        </div>

        <div>
          <label for="message">Message: </label>
          <input id="message" type="text" placeholder="Enter a message" value=${message} onInput=${handleMessage}></input>
        </div>

        <div>
          <button onClick=${sendMessage}>Send message!</button>
        </div>
      </section>
      <section>
        ${props.cpus.map((cpu) => {
          return html`<div class="cpu-info">
            <div class="cpu-num">${cpu[0] + 1}</div>
            <div class="bar">
              <div class="bar-inner" style="width: ${cpu[1]}%"></div>
              <label>${cpu[1].toFixed(2)}%</label>
            </div>
          </div>`;
        })}
      </section>
    </main>
  `;
}
