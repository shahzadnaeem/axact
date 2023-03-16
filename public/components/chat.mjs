import { h } from "https://unpkg.com/preact@latest?module";
import {
  useState,
  useEffect,
} from "https://unpkg.com/preact@latest/hooks/dist/hooks.module.js?module";
import htm from "https://unpkg.com/htm?module";

// ----------------------------------------------------------------------------

const html = htm.bind(h);

export default function Chat({ ws, ws_id, ws_username, message }) {
  const [name, setName] = useState(ws_username);
  const [editName, setEditName] = useState(ws_username);
  const [chatMessage, setChatMessage] = useState(null);
  const [messageLog, setMessageLog] = useState([]);
  const [doSend, setDoSend] = useState(false);

  const [autoMsg, setAutoMsg] = useState(false);
  const [autoMsgId, setAutoMsgId] = useState(0);
  const [timeoutId, setTimeoutId] = useState(null);

  useEffect(() => {
    let data = {
      id: ws_id,
      name: `${name}`,
      message: null,
    };

    ws.send(JSON.stringify(data));

    document.title = name;
  }, [name]);

  useEffect(() => {
    if (chatMessage) {
      let data = {
        id: ws_id,
        name: `${name}`,
        message: `${chatMessage}`,
      };

      ws.send(JSON.stringify(data));

      setChatMessage(null);
    }
  }, [doSend]);

  // NOTE: This hack is currently needed to add incoming messages to the log
  //       Dependency is the message we add to prevent an infinite loop as
  //       this component will re-render due to the state change.
  useEffect(() => {
    if (message) {
      setMessageLog([...messageLog, message]);
    }
  }, [message]);

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

  // Auto message sender
  useEffect(() => {
    if (autoMsgId > 0) {
      if (message !== null) {
        toggleDoSend();
      } else {
        setChatMessage(`Auto message ${Math.floor(autoMsgId / 2) + 1} ...`);
      }
    }
  }, [autoMsgId]);

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

  const handleAutoMsg = (ev) => {
    setAutoMsg(!autoMsg);
  };

  const nameStatus = name !== editName ? "editing" : "";
  const sendDisabled = message === null;

  // How many messages that can be displayed before we show the auto scroll anchor
  const addLastMessageAnchor = messageLog.length > 10;

  return html`
      <section class="chat grid-4row-3a-1fr">
        <div class="grid-2col-5em-1fr">
          <label for="name">Name: </label>
          <input class="${nameStatus}" id="name" type="text" placeholder="Enter your name" value=${editName} onInput=${handleName} onKeyUp=${handleNameEnter}></input>
        </div>
      
        <div class="grid-2col-5em-1fr">
          <label for="message">Message: </label>
          <input id="message" type="text" placeholder="Enter a message" value=${chatMessage} onInput=${handleMessage} onKeyUp=${handleMessageEnter}></input>
        </div>
      
        <div class="grid-2col">
          <button class="chat-send" disabled=${sendDisabled} onClick=${toggleDoSend}>Send message!</button>
          <div class="grid-cols">
            <label for="auto">Auto Message</label>
            <input type="checkbox" name="auto" checked=${autoMsg} onClick=${handleAutoMsg}></input>
          </div>
        </div>
      
        <section class="message-log grid-1col">
          ${messageLog.map((message, i) => {
            const msgType =
              message.id == ws_id ? "message-sent" : "message-received";

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
      </section>`;
}
