import { h } from "https://unpkg.com/preact@latest?module";
import htm from "https://unpkg.com/htm?module";

// ----------------------------------------------------------------------------

const html = htm.bind(h);

export default function Htop({ hostname, datetime, cpus }) {
  return html`<section class="htop grid-1col">
    <div class="htop-header">
      <span>${hostname}</span><span>${datetime}</span>
    </div>
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
