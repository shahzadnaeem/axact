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

  ws_id = json.ws_id;
  ws_events++;

  render(
    html`<${App} cpus=${json.cpu_data} wsCount=${json.ws_count} wsId=${json.ws_id} wsUsername=${json.ws_username} wsEvents=${ws_events}></${App}>`,
    document.body
  );
};

function App(props) {
  const [name, setName] = useState(props.wsUsername);
  const [editName, setEditName] = useState(props.wsUsername);
  const [message, setMessage] = useState("");
  const [messageLog, setMessageLog] = useState([]);
  const [doSend, setDoSend] = useState(false);

  useEffect(() => {
    let data = {
      id: ws_id,
      name: `${name}`,
      message: "",
    };

    ws.send(JSON.stringify(data));

    document.title = name;
  }, [name]);

  useEffect(() => {
    if (message !== "") {
      let data = {
        id: ws_id,
        name: `${name}`,
        message: `${message}`,
      };

      ws.send(JSON.stringify(data));

      const len = messageLog.length;

      setMessageLog([`${len + 1}. ${message}`, ...messageLog]);
      // setMessage("");
    }
  }, [doSend]);

  const handleName = (ev) => {
    const newName = ev.target.value;

    setEditName(newName);
  };

  const handleNameEnter = (ev) => {
    if (ev.key === "Enter" && editName !== "") {
      setName(editName);
    }
  };

  const handleMessage = (ev) => {
    const newMessage = ev.target.value;

    setMessage(newMessage);
  };

  const handleMessageEnter = (ev) => {
    if (ev.key === "Enter" && ev.target.value !== "") {
      setMessage(ev.target.value);
      sendMessage();
    }
  };

  const sendMessage = () => {
    setDoSend(!doSend);
  };

  const header = `Client #${props.wsId} - ${props.wsUsername} - ${
    props.wsCount
  } ${props.wsCount > 1 ? "Clients" : "Client"} - Update #${props.wsEvents}`;

  return html`
    <main class="app-base grid-1col">
      <h3> ${header} </h3>

      <a href="${window.location.href}" target="_blank">Duplicate</a>

      <section class="app-container grid-2col">
        <section class="chat grid-4row-3a-1fr">
          <div class="grid-2col-5em-1fr">
            <label for="name">Name: </label>
            <input id="name" type="text" placeholder="Enter your name" value=${editName} onInput=${handleName} onKeyUp=${handleNameEnter}></input>
          </div>

          <div class="grid-2col-5em-1fr">
            <label for="message">Message: </label>
            <input id="message" type="text" placeholder="Enter a message" value=${message} onInput=${handleMessage} onKeyUp=${handleMessageEnter}></input>
          </div>

          <div>
            <button class="chat-send" onClick=${sendMessage}>Send message!</button>
          </div>

          <section class="message-log grid-1col nogap">
            ${messageLog.map((message, i) => {
              return html`<p key=${i}>${message}</p>`;
            })}
          </section>
        </section>

        <section class="htop grid-1col">
          ${props.cpus.map((cpu) => {
            return html`<div class="cpu-info grid-2col-a-1fr">
              <div class="cpu-num place-center">${cpu[0] + 1}</div>
              <div class="bar place-center">
                <div class="bar-inner" style="width: ${cpu[1]}%"></div>
                <label>${cpu[1].toFixed(2)}%</label>
              </div>
            </div>`;
          })}
        </section>
      </section>
    </main>
  `;
}
