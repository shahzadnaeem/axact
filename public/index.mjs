import { h, render } from "https://unpkg.com/preact@latest?module";
import {
  useState,
  useEffect,
} from "https://unpkg.com/preact@latest/hooks/dist/hooks.module.js?module";
import htm from "https://unpkg.com/htm?module";

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

  render(
    html`<${App} data=${json} hostname=${json.hostname} datetime=${json.datetime} cpus=${json.cpu_data} wsCount=${json.ws_count} wsId=${json.ws_id} wsUsername=${json.ws_username} message=${json.message}></${App}>`,
    document.body
  );
};

//
// Preact function components below -------------------------------------------
//

function Cpu({ cpu }) {
  return html`<div class="cpu-info grid-2col-a-1fr">
    <div class="cpu-num place-center">${cpu[0] + 1}</div>
    <div class="bar place-center">
      <div class="bar-inner" style="width: ${cpu[1]}%"></div>
      <div class="bar-inner delayed" style="width: ${cpu[1]}%"></div>
      <label>${cpu[1].toFixed(2)}%</label>
    </div>
  </div>`;
}

function Htop(props) {
  return html`<section class="htop grid-1col">
    <div class="htop-header">
      <span>${props.hostname}</span><span>${props.datetime}</span>
    </div>
    ${props.cpus.map((cpu) => {
      return html`<${Cpu} cpu="${cpu}" />`;
    })}
  </section>`;
}

function App(props) {
  const [name, setName] = useState(props.wsUsername);
  const [editName, setEditName] = useState(props.wsUsername);
  const [message, setMessage] = useState(null);
  const [messageLog, setMessageLog] = useState([]);
  const [doSend, setDoSend] = useState(false);

  useEffect(() => {
    let data = {
      id: props.wsId,
      name: `${name}`,
      message: null,
    };

    ws.send(JSON.stringify(data));

    document.title = name;
  }, [name]);

  useEffect(() => {
    if (message) {
      let data = {
        id: props.wsId,
        name: `${name}`,
        message: `${message}`,
      };

      ws.send(JSON.stringify(data));

      setMessage(null);
    }
  }, [doSend]);

  // NOTE: Need this effect to add new messages to the log
  useEffect(() => {
    if (props.message) {
      setMessageLog([...messageLog, props.message]);
    }
  }, [props.message]);

  const handleName = (ev) => {
    const newName = ev.target.value;

    setEditName(newName);
  };

  const handleNameEnter = (ev) => {
    if (ev.key === "Enter" && editName !== "") {
      setName(editName);
      ev.target.blur();
    }
  };

  const handleMessage = (ev) => {
    const newMessage = ev.target.value || null;

    setMessage(newMessage);
  };

  const handleMessageEnter = (ev) => {
    if (ev.key === "Enter" && ev.target.value) {
      setMessage(ev.target.value);
      sendMessage();
    }
  };

  const sendMessage = () => {
    setDoSend(!doSend);
  };

  const header = `Client #${props.wsId} - ${props.wsUsername} - ${
    props.wsCount
  } ${props.wsCount > 1 ? "Clients" : "Client"}`; // - Update #${props.wsEvents}`;

  const nameStatus = name !== editName ? "editing" : "";
  const sendDisabled = message === null;

  // How many messages that can be displayed before we show the auto scroll anchor
  const addLastMessageAnchor = messageLog.length > 10;

  return html`
    <main class="app-base grid-1col">
      <h3>${header}</h3>

      <a href="${window.location.href}" target="_blank">Duplicate</a>

      <section class="app-container grid-2col">
        <section class="chat grid-4row-3a-1fr">
          <div class="grid-2col-5em-1fr">
            <label for="name">Name: </label>
            <input class="${nameStatus}" id="name" type="text" placeholder="Enter your name" value=${editName} onInput=${handleName} onKeyUp=${handleNameEnter}></input>
          </div>

          <div class="grid-2col-5em-1fr">
            <label for="message">Message: </label>
            <input id="message" type="text" placeholder="Enter a message" value=${message} onInput=${handleMessage} onKeyUp=${handleMessageEnter}></input>
          </div>

          <div>
            <button class="chat-send" disabled=${sendDisabled} onClick=${sendMessage}>Send message!</button>
          </div>

          <section class="message-log grid-1col">
            ${messageLog.map((message, i) => {
              const msgType =
                message.id == props.wsId ? "message-sent" : "message-received";

              return html`<p class="${msgType}" key=${i}>
                <span>${message.name} [#${message.id}] </span>
                <span>${message.message}</span>
              </p>`;
            })}
            ${
              addLastMessageAnchor &&
              html`<div class="last-message-anchor"></div>`
            }
          </section>
        </section>

        ${html`<${Htop}
          cpus="${props.cpus}"
          hostname=${props.hostname}
          datetime=${props.datetime}
        />`}

      </section>
    </main>
  `;
}
