import { h, createContext } from "https://unpkg.com/preact@latest?module";
import {
  useState,
  useEffect,
  useCallback,
} from "https://unpkg.com/preact@latest/hooks/dist/hooks.module.js?module";
import htm from "https://unpkg.com/htm?module";

// ----------------------------------------------------------------------------

const html = htm.bind(h);

// ----------------------------------------------------------------------------

function SendName({ ws, ws_id, ws_username }) {
  const [name, setName] = useState(ws_username);
  const [editName, setEditName] = useState(ws_username);

  useEffect(() => {
    let data = {
      id: ws_id,
      to_id: 0,
      name: `${name}`,
      message: null,
    };

    ws.send(JSON.stringify(data));

    document.title = name;
  }, [name]);

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

  const nameStatus = name !== editName ? "editing" : "";

  return html`<div class="grid-2col-5em-1fr">
    <label for="name">Name: </label>
    <input class="${nameStatus}" id="name" type="text" placeholder="Enter your name" value=${editName} onInput=${handleName} onKeyUp=${handleNameEnter}></input>
  </div>`;
}

// ----------------------------------------------------------------------------

// EXPERIMENTAL: Send message to a specific user...

function SentTo({ users, toId, setToId }) {
  const handleChange = (ev) => {
    const newToId = parseInt(ev.target.value);

    setToId(newToId);
  };

  // TODO: This updates too often due to User info being send with CPU data

  let selected = 0;

  let user = users.forEach((u) => {
    if (u[0] === toId) {
      selected = toId;
    }
  });

  const gen_option = (value, user, selected) => {
    let option = html`<option key="${value}" value="${value}">${user}</option>`;

    return option;
  };

  return html`<div class="grid-2col-5em-1fr">
    <label for="name">To: </label>
    <select onChange=${handleChange} value="${selected}">
      ${gen_option(0, "Everyone", selected)}
      ${users.map((u, _i) => gen_option(u[0], u[1], selected))}
    </select>
  </div>`;
}

// ----------------------------------------------------------------------------

function AutoMessage({ setChatMessage, setAutoMsgId }) {
  const [autoMsg, setAutoMsg] = useState(false);
  const [timeoutId, setTimeoutId] = useState(null);

  // Auto message initiator
  useEffect(() => {
    if (autoMsg) {
      setChatMessage(null);
      setAutoMsgId(0);

      setTimeoutId(
        setInterval(() => {
          setAutoMsgId((curr) => {
            return curr + 1;
          });
        }, 500)
      );

      return () => {
        if (timeoutId) {
          clearInterval(timeoutId);
          setTimeoutId(null);
        }
      };
    } else {
      if (timeoutId) {
        clearInterval(timeoutId);
        setTimeoutId(null);
      }
    }
  }, [autoMsg]);

  const handleAutoMsg = (ev) => {
    setAutoMsg(!autoMsg);
  };

  return html`<div class="grid-cols">
    <label for="auto">Auto Message</label>
    <input type="checkbox" name="auto" checked=${autoMsg} onClick=${handleAutoMsg}></input>
    </div>`;
}

// ----------------------------------------------------------------------------

function SendMessage({ ws, ws_id, ws_username, toId }) {
  const [chatMessage, setChatMessage] = useState(null);
  const [doSend, setDoSend] = useState(false);

  const [autoMsgId, setAutoMsgId] = useState(0);

  // Outputs
  useEffect(() => {
    if (chatMessage) {
      let data = {
        id: ws_id,
        to_id: toId,
        name: `${ws_username}`,
        message: `${chatMessage}`,
      };

      ws.send(JSON.stringify(data));

      setChatMessage(null);
    }
  }, [doSend]);

  // Auto message sender
  useEffect(() => {
    if (autoMsgId > 0) {
      if (chatMessage !== null) {
        toggleDoSend();
      } else {
        setChatMessage(`Auto message ${Math.floor(autoMsgId / 2) + 1} ...`);
      }
    }
  }, [autoMsgId]);

  const handleMessage = (ev) => {
    const newMessage = ev.target.value || null;

    setChatMessage(newMessage);
  };

  const handleMessageEnter = (ev) => {
    if (ev.key === "Enter" && ev.target.value) {
      setChatMessage(ev.target.value);
      toggleDoSend();
    }
  };

  const toggleDoSend = () => {
    setDoSend(!doSend);
  };

  const sendDisabled = chatMessage === null;

  return html`<div class="grid-2col-5em-1fr">
      <label for="message">Message: </label>
      <input id="message" type="text" placeholder="Enter a message" value=${chatMessage} onInput=${handleMessage} onKeyUp=${handleMessageEnter}></input>
    </div>

    <div class="grid-2col">
      <button class="chat-send" disabled=${sendDisabled} onClick=${toggleDoSend}>Send message!</button>
      ${html`<${AutoMessage}
        setChatMessage=${setChatMessage}
        setAutoMsgId=${setAutoMsgId}
      />`}
    </div>`;
}

function ChatControls({ ws, ws_id, ws_username, users }) {
  const [toId, setToId] = useState(0);

  return html`<div class="grid-rows">
    ${html`<${SendName} ws=${ws} ws_id=${ws_id} ws_username=${ws_username} />`}
    ${html`<${SentTo} users=${users} toId=${toId} setToId=${setToId} />`}
    ${html`<${SendMessage}
      ws=${ws}
      ws_id=${ws_id}
      ws_username=${ws_username}
      toId=${toId}
    />`}
  </div>`;
}

// ----------------------------------------------------------------------------

// A simple wrapper around useEffect to prevent re-render triggered inifinite loop
// NOTE: Probably don't need this. A simple useEffect() is probably obvious here :)

function useOnChange(value, callback) {
  useEffect(() => {
    callback();
  }, [value]);
}

function ChatMessagesLog({ ws_id, ws_message }) {
  const [messageLog, setMessageLog] = useState([]);

  useOnChange(ws_message, () => {
    if (ws_message) {
      setMessageLog([...messageLog, ws_message]);
    }
  });

  // How many messages that can be displayed before we show the auto scroll anchor
  const addLastMessageAnchor = messageLog.length > 10;

  return html`<section class="message-log grid-1col">
    ${messageLog.map((message, i) => {
      const msgType = message.id == ws_id ? "message-sent" : "message-received";

      return html`<p class="${msgType}" key=${i}>
        <span>${message.name} [#${message.id}] </span>
        <span>${message.message}</span>
      </p>`;
    })}
    ${addLastMessageAnchor && html`<div class="last-message-anchor"></div>`}
  </section>`;
}

// ----------------------------------------------------------------------------

export default function Chat({ ws, ws_id, ws_username, ws_message, users }) {
  return html`<section class="chat grid-2row-a-1fr">
    ${html`<${ChatControls}
      ws=${ws}
      ws_id=${ws_id}
      ws_username=${ws_username}
      users=${users}
    />`}
    ${html`<${ChatMessagesLog} ws_id=${ws_id} ws_message=${ws_message} />`}
  </section>`;
}
