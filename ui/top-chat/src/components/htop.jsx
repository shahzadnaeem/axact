export default function Htop({ hostname, datetime, cpus, memory }) {
  return (
    <section class="htop grid-1col">
      <div class="htop-header">
        <div>{hostname}</div>
        <div>{datetime}</div>
      </div>
      <Memory memory={memory} />
      {cpus.map((cpu) => {
        return <Cpu cpu={cpu} />;
      })}
    </section>
  );
}

function Cpu({ cpu }) {
  return (
    <div class="cpu-info grid-2col-a-1fr">
      <div class="cpu-num place-center">{cpu[0] + 1}</div>
      <div class="bar place-center">
        <div class="bar-inner" style={`width: ${cpu[1]}%`}></div>
        <div class="bar-inner delayed" style={`width: ${cpu[1]}%`}></div>
        <label>{cpu[1].toFixed(1)}%</label>
      </div>
    </div>
  );
}

function toGB(bytes) {
  return ((1.0 * bytes) / (1024 * 1024 * 1024)).toFixed(1);
}

function MemBar({ memory }) {
  let percentUsed = ((100.0 * memory.used) / memory.total).toFixed(1);

  return (
    <div class="grid-1col">
      <div class="bar mem-bar place-center">
        <div
          class="bar-inner mem-bar-inner"
          style={`width: ${percentUsed}%`}
        ></div>
        <div
          class="bar-inner mem-bar-inner delayed"
          style={`width: ${percentUsed}%`}
        ></div>
        <label>{percentUsed}%</label>
      </div>
    </div>
  );
}

function MemoryRow({ name, value }) {
  return (
    <div class="grid-1col place-center">
      <div class="grid-3col-name-value-unit">
        <span>{name}</span>
        <span>{toGB(value)}</span>
        <span>GB</span>
      </div>
    </div>
  );
}

function Memory({ memory }) {
  return (
    <div class="mem-info">
      <MemoryRow name="Memory Total" value={memory.total} />
      <MemoryRow name="Memory Used" value={memory.used} />
      <MemBar memory={memory} />
    </div>
  );
}
