import { h } from "https://unpkg.com/preact@latest?module";
import htm from "https://unpkg.com/htm?module";

// ----------------------------------------------------------------------------

const html = htm.bind(h);

export default function Htop({ hostname, datetime, cpus, memory }) {
  return html`<section class="htop grid-1col">
    <div class="htop-header">
      <span>${hostname}</span><span>${datetime}</span>
    </div>
    <${Memory} memory="${memory}" />
    ${cpus.map((cpu) => {
      return html`<${Cpu} cpu="${cpu}" />`;
    })}
  </section>`;
}

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

function toGB(bytes) {
  const gbs = (1.0 * bytes) / (1024 * 1024 * 1024);

  return gbs.toFixed(2);
}

function MemBar({ memory }) {
  let percentUsed = ((100.0 * toGB(memory.used)) / toGB(memory.total)).toFixed(
    2
  );

  return html`<div class="grid-1col">
    <div class="bar mem-bar place-center">
      <div class="bar-inner mem-bar-inner" style="width: ${percentUsed}%"></div>
      <div
        class="bar-inner mem-bar-inner delayed"
        style="width: ${percentUsed}%"
      ></div>
      <label>${percentUsed}%</label>
    </div>
  </div>`;
}

function Memory({ memory }) {
  return html`<div class="mem-info">
    <pre>
      <div><span>Memory Total     : </span>${toGB(memory.total)}GB</div>
      <div><span>Memory Used      : </span>${toGB(memory.used)}GB</div>
    </pre>
    <${MemBar} memory="${memory}" />
  </div>`;
}
