// Apache Server Dashboard — route: #/apache
// Displays Apache mod_status metrics: uptime, request rates,
// worker scoreboard, and server info.

import { apiGet } from "../api.js";
import {
  card,
  cardGrid,
  badge,
  progressBar,
  sectionTitle,
  errorBanner,
  emptyState,
  esc,
} from "../components.js";
import { fmtDuration, fmtBytes, fmtNumber } from "../utils.js";

// ---- Scoreboard color mapping ----

const WORKER_COLORS = {
  waiting: { color: "green", label: "Waiting" },
  starting: { color: "blue", label: "Starting" },
  reading: { color: "cyan", label: "Reading" },
  writing: { color: "yellow", label: "Writing" },
  keepalive: { color: "purple", label: "Keep-Alive" },
  dns: { color: "orange", label: "DNS Lookup" },
  closing: { color: "dim", label: "Closing" },
  logging: { color: "dim", label: "Logging" },
  graceful: { color: "dim", label: "Graceful" },
  idle_cleanup: { color: "dim", label: "Idle Cleanup" },
  open: { color: "dim", label: "Open Slot" },
};

const SCOREBOARD_CHAR_COLORS = {
  _: "var(--green)",
  S: "var(--blue)",
  R: "var(--cyan)",
  W: "var(--yellow)",
  K: "var(--purple)",
  D: "var(--orange, #f0883e)",
  C: "var(--text-dim)",
  L: "var(--text-dim)",
  G: "var(--text-dim)",
  I: "var(--text-dim)",
  ".": "var(--border)",
};

// ---- Data fetching ----

async function fetchData() {
  return apiGet("/api/apache/status");
}

// ---- Scoreboard visualization ----

function buildScoreboard(scoreboard) {
  const wrap = document.createElement("div");
  wrap.style.cssText =
    "display:flex;flex-wrap:wrap;gap:2px;font-family:var(--font-mono);font-size:11px;line-height:1;margin-bottom:16px;";

  for (const ch of scoreboard) {
    const cell = document.createElement("span");
    cell.style.cssText = `display:inline-block;width:14px;height:14px;border-radius:2px;background:${SCOREBOARD_CHAR_COLORS[ch] || "var(--border)"};`;
    cell.title = ch;
    wrap.appendChild(cell);
  }

  return wrap;
}

// ---- Scoreboard legend ----

function buildLegend() {
  const wrap = document.createElement("div");
  wrap.style.cssText =
    "display:flex;flex-wrap:wrap;gap:12px;margin-bottom:20px;font-size:12px;color:var(--text-dim);";

  const entries = [
    { ch: "_", label: "Waiting", color: "var(--green)" },
    { ch: "R", label: "Reading", color: "var(--cyan)" },
    { ch: "W", label: "Writing", color: "var(--yellow)" },
    { ch: "K", label: "Keep-Alive", color: "var(--purple)" },
    { ch: "S", label: "Starting", color: "var(--blue)" },
    { ch: ".", label: "Open Slot", color: "var(--border)" },
  ];

  for (const { ch, label, color } of entries) {
    const item = document.createElement("span");
    item.style.cssText = "display:inline-flex;align-items:center;gap:4px;";
    const dot = document.createElement("span");
    dot.style.cssText = `display:inline-block;width:10px;height:10px;border-radius:2px;background:${color};`;
    const txt = document.createElement("span");
    txt.textContent = `${ch} ${label}`;
    item.appendChild(dot);
    item.appendChild(txt);
    wrap.appendChild(item);
  }

  return wrap;
}

// ---- Worker breakdown ----

function buildWorkerBreakdown(workers, total) {
  const wrap = document.createElement("div");
  wrap.style.cssText = "margin-bottom:20px;";

  const order = [
    "waiting",
    "writing",
    "keepalive",
    "reading",
    "starting",
    "dns",
    "closing",
    "logging",
    "graceful",
    "idle_cleanup",
    "open",
  ];

  for (const key of order) {
    const count = workers[key];
    if (count == null || count === 0) continue;

    const meta = WORKER_COLORS[key] || { color: "dim", label: key };
    const row = document.createElement("div");
    row.style.cssText =
      "display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid var(--border);font-size:13px;";

    const labelEl = document.createElement("span");
    labelEl.style.cssText = "width:100px;font-weight:500;color:var(--text);";
    labelEl.textContent = meta.label;

    const barWrap = document.createElement("div");
    barWrap.style.cssText = "flex:1;";
    barWrap.appendChild(progressBar(count, total, meta.color));

    const countEl = document.createElement("span");
    countEl.style.cssText =
      "width:50px;text-align:right;font-family:var(--font-mono);font-size:12px;color:var(--text-dim);";
    countEl.textContent = String(count);

    row.appendChild(labelEl);
    row.appendChild(barWrap);
    row.appendChild(countEl);
    wrap.appendChild(row);
  }

  return wrap;
}

// ---- Server info section ----

function buildServerInfo(data) {
  const wrap = document.createElement("div");
  wrap.style.cssText =
    "display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;";

  const items = [
    { label: "Server Version", value: data.serverVersion || "--" },
    { label: "Server MPM", value: data.serverMPM || "--" },
    {
      label: "Bytes / Request",
      value: data.bytesPerReq != null ? fmtBytes(data.bytesPerReq) : "--",
    },
    {
      label: "Total Traffic",
      value: data.totalKBytes != null ? fmtBytes(data.totalKBytes * 1024) : "--",
    },
  ];

  for (const { label, value } of items) {
    const el = document.createElement("div");
    el.style.cssText =
      "background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:12px 14px;";

    const labelEl = document.createElement("div");
    labelEl.style.cssText =
      "font-size:11px;font-weight:500;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;";
    labelEl.textContent = label;

    const valueEl = document.createElement("div");
    valueEl.style.cssText =
      "font-size:15px;font-weight:600;color:var(--text-bright);font-family:var(--font-mono);";
    valueEl.textContent = value;

    el.appendChild(labelEl);
    el.appendChild(valueEl);
    wrap.appendChild(el);
  }

  return wrap;
}

// ---- Page build ----

function buildPage(container, data) {
  // Status cards
  const totalWorkers = (data.busyWorkers ?? 0) + (data.idleWorkers ?? 0);
  const busyPct = totalWorkers > 0 ? Math.round((data.busyWorkers / totalWorkers) * 100) : 0;

  container.appendChild(
    cardGrid([
      card({
        label: "Uptime",
        value: fmtDuration(data.uptime),
        status: "info",
      }),
      card({
        label: "Requests / sec",
        value: data.reqPerSec != null ? data.reqPerSec.toFixed(2) : "--",
        status: "ok",
      }),
      card({
        label: "Bytes / sec",
        value: data.bytesPerSec != null ? fmtBytes(data.bytesPerSec) : "--",
        status: "ok",
      }),
      card({
        label: "Busy Workers",
        value: String(data.busyWorkers ?? 0),
        sub: busyPct + "% utilization",
        status: busyPct > 80 ? "crit" : busyPct > 50 ? "warn" : "ok",
      }),
      card({
        label: "Idle Workers",
        value: String(data.idleWorkers ?? 0),
        status: "info",
      }),
      card({
        label: "Total Requests",
        value: fmtNumber(data.totalAccesses),
        status: "info",
      }),
    ]),
  );

  // Scoreboard
  if (data.scoreboard) {
    container.appendChild(sectionTitle("Worker Scoreboard"));
    container.appendChild(buildScoreboard(data.scoreboard));
    container.appendChild(buildLegend());
  }

  // Worker breakdown
  if (data.workers && Object.keys(data.workers).length > 0) {
    container.appendChild(sectionTitle("Worker Breakdown"));
    container.appendChild(
      buildWorkerBreakdown(data.workers, data.scoreboard ? data.scoreboard.length : totalWorkers),
    );
  }

  // Server info
  container.appendChild(sectionTitle("Server Info"));
  container.appendChild(buildServerInfo(data));
}

// ---- Exports (page module interface) ----

export async function render(container, query) {
  container.innerHTML = "";

  const title = document.createElement("div");
  title.className = "page-title";
  title.textContent = "Apache Server";
  container.appendChild(title);

  try {
    const data = await fetchData();
    buildPage(container, data);
  } catch (e) {
    container.appendChild(errorBanner("Failed to load Apache status: " + e.message));
  }
}

export async function refresh(container, query) {
  try {
    const data = await fetchData();
    const titleEl = container.querySelector(".page-title");
    container.innerHTML = "";
    if (titleEl) container.appendChild(titleEl);
    buildPage(container, data);
  } catch (e) {
    console.error("[apache] refresh error:", e);
  }
}
