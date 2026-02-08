// Overview page — landing dashboard (route: #/)
// Shows system status cards, mini topology, station health,
// WAN status, AI performance, and Grafana quick links.

import { fetchMetrics, sendCommand } from "../api.js";
import {
  card,
  cardGrid,
  badge,
  progressBar,
  dataTable,
  statusDot,
  sectionTitle,
  cols2,
  cols3,
  errorBanner,
} from "../components.js";
import { parsePrometheus, getScalar, getAll } from "../prometheus.js";
import { renderTopology } from "../topology.js";
import { fmtDuration, fmtPercent, pctColor, statusClass } from "../utils.js";

// ---- Data fetching ----

async function fetchData() {
  const [metricsText, dashboard] = await Promise.all([
    fetchMetrics(),
    sendCommand("meta:dashboard").catch(() => null),
  ]);
  const metrics = parsePrometheus(metricsText);
  return { metrics, dashboard };
}

// ---- Status cards (top 6) ----

function buildStatusCards(metrics) {
  const uptime = getScalar(metrics, "hivemind_uptime_seconds");
  const stationsAll = getAll(metrics, "hivemind_station_reachable");
  const stationsOnline = stationsAll.filter((s) => s.value === 1).length;
  const stationsTotal = stationsAll.length;
  const failover = getScalar(metrics, "hivemind_wan_failover_active");
  const alertCount = getScalar(metrics, "hivemind_alert_active_count");
  const juliaUp = getScalar(metrics, "hivemind_julia_registered");
  const modelsRunning = getScalar(metrics, "hivemind_model_running_count");
  const modelsInstalled = getScalar(metrics, "hivemind_model_installed_count");

  const wanLabel = failover === 1 ? "FAILOVER" : "NORMAL";
  const wanStatus = failover === 1 ? "crit" : "ok";

  return cardGrid([
    card({
      label: "Uptime",
      value: fmtDuration(uptime),
      status: "info",
    }),
    card({
      label: "Stations Online",
      value: `${stationsOnline} / ${stationsTotal}`,
      status: stationsOnline === stationsTotal ? "ok" : "warn",
    }),
    card({
      label: "WAN Status",
      value: wanLabel,
      sub: failover === 1 ? "Failover active" : "Primary path",
      status: wanStatus,
    }),
    card({
      label: "Active Alerts",
      value: alertCount ?? 0,
      status: (alertCount ?? 0) > 0 ? "crit" : "ok",
    }),
    card({
      label: "JULIA",
      value: juliaUp === 1 ? "Online" : "Offline",
      status: statusClass(juliaUp === 1),
    }),
    card({
      label: "Models Running",
      value: `${modelsRunning ?? 0} / ${modelsInstalled ?? 0}`,
      status: (modelsRunning ?? 0) > 0 ? "ok" : "warn",
    }),
  ]);
}

// ---- Mini topology ----

function buildMiniTopology(metrics) {
  const wrapper = document.createElement("div");
  wrapper.className = "topo-mini-wrapper";

  // Build lightweight scan data from prometheus metrics
  const stations = getAll(metrics, "hivemind_station_reachable");
  const latencies = getAll(metrics, "hivemind_station_latency_ms");
  const latMap = {};
  for (const l of latencies) latMap[l.labels.station] = l.value;

  const scanData = {
    stations: stations.map((s) => ({
      ip: s.labels.station,
      reachable: s.value === 1,
      latency: latMap[s.labels.station] ?? null,
    })),
  };

  const activePath = getAll(metrics, "hivemind_wan_active_path");
  const activeEntry = activePath.find((p) => p.value === 1);
  const dualNet = { activePath: activeEntry?.labels.path_id || "primary" };

  renderTopology(wrapper, {
    scanData,
    dualNet,
    mini: true,
    onNodeClick: (id) => {
      location.hash = `#/stations?id=${id}`;
    },
  });

  return wrapper;
}

// ---- Station health + WAN status (2-col) ----

function buildStationHealth(metrics) {
  const section = document.createElement("div");
  const stations = getAll(metrics, "hivemind_station_reachable");
  const latencies = getAll(metrics, "hivemind_station_latency_ms");
  const latMap = {};
  for (const l of latencies) latMap[l.labels.station] = l.value;

  if (stations.length === 0) {
    section.textContent = "No station data available";
    return section;
  }

  for (const s of stations) {
    const row = document.createElement("div");
    row.className = "station-row";
    const isUp = s.value === 1;
    const lat = latMap[s.labels.station];

    row.appendChild(statusDot(isUp));

    const name = document.createElement("span");
    name.className = "station-name";
    name.textContent = s.labels.station;
    row.appendChild(name);

    const latEl = document.createElement("span");
    latEl.className = "station-latency mono";
    latEl.textContent = lat != null ? lat.toFixed(1) + " ms" : "--";
    row.appendChild(latEl);

    const statusBadge = isUp ? badge("UP", "green") : badge("DOWN", "red");
    row.appendChild(statusBadge);

    section.appendChild(row);
  }

  return section;
}

function buildWanStatus(metrics) {
  const section = document.createElement("div");
  const paths = getAll(metrics, "hivemind_wan_active_path");
  const latencies = getAll(metrics, "hivemind_wan_quality_latency_ms");
  const losses = getAll(metrics, "hivemind_wan_quality_packet_loss_pct");
  const switchCount = getScalar(metrics, "hivemind_wan_switch_count_total");

  const latMap = {};
  for (const l of latencies) latMap[l.labels.path_id] = l.value;
  const lossMap = {};
  for (const l of losses) lossMap[l.labels.path_id] = l.value;

  if (paths.length === 0) {
    section.textContent = "No WAN path data available";
    return section;
  }

  for (const p of paths) {
    const pathCard = document.createElement("div");
    pathCard.className = "wan-path-card" + (p.value === 1 ? " active" : "");

    const header = document.createElement("div");
    header.className = "wan-path-header";
    const nameEl = document.createElement("span");
    nameEl.className = "wan-path-name";
    nameEl.textContent = p.labels.path_id;
    header.appendChild(nameEl);
    header.appendChild(p.value === 1 ? badge("ACTIVE", "green") : badge("STANDBY", "dim"));
    pathCard.appendChild(header);

    const lat = latMap[p.labels.path_id];
    const loss = lossMap[p.labels.path_id];

    const stats = document.createElement("div");
    stats.className = "wan-path-stats";
    stats.innerHTML =
      `<span class="mono">Latency: ${lat != null ? lat.toFixed(1) + " ms" : "--"}</span>` +
      `<span class="mono">Loss: ${loss != null ? loss.toFixed(2) + "%" : "--"}</span>`;
    pathCard.appendChild(stats);

    section.appendChild(pathCard);
  }

  if (switchCount != null) {
    const footer = document.createElement("div");
    footer.className = "wan-switch-count";
    footer.textContent = `Total failover switches: ${switchCount}`;
    section.appendChild(footer);
  }

  return section;
}

// ---- AI Performance table + Execution bar (2-col) ----

function buildAiPerformance(metrics) {
  const perfEntries = getAll(metrics, "hivemind_perf_success_rate");
  const latEntries = getAll(metrics, "hivemind_perf_avg_latency_ms");

  // Build latency map keyed by model_id+task_type
  const latMap = {};
  for (const l of latEntries) {
    latMap[l.labels.model_id + ":" + l.labels.task_type] = l.value;
  }

  // Build rows sorted by success rate descending, take top 5
  const rows = perfEntries
    .map((p) => {
      const key = p.labels.model_id + ":" + p.labels.task_type;
      const successPct = p.value * 100;
      return {
        model: p.labels.model_id || "--",
        task: p.labels.task_type || "--",
        success: fmtPercent(p.value),
        success_raw: p.value,
        latency: latMap[key] != null ? latMap[key].toFixed(0) + " ms" : "--",
        latency_raw: latMap[key] ?? 0,
        bar: progressBar(successPct, 100, pctColor(successPct)),
      };
    })
    .sort((a, b) => b.success_raw - a.success_raw)
    .slice(0, 5);

  if (rows.length === 0) {
    const empty = document.createElement("div");
    empty.textContent = "No model performance data";
    return empty;
  }

  return dataTable({
    columns: [
      { key: "model", label: "Model", sortable: true },
      { key: "task", label: "Task", sortable: true },
      { key: "success", label: "Success", sortable: true, mono: true },
      { key: "latency", label: "Avg Latency", sortable: true, mono: true },
      { key: "bar", label: "" },
    ],
    rows,
  });
}

function buildExecBar(metrics) {
  const section = document.createElement("div");
  const total = getScalar(metrics, "hivemind_exec_total");
  const successRate = getScalar(metrics, "hivemind_exec_success_rate");

  const label = document.createElement("div");
  label.className = "exec-label";
  label.textContent = `Execution Success Rate: ${fmtPercent(successRate)}`;
  section.appendChild(label);

  const pct = successRate != null ? successRate * 100 : 0;
  section.appendChild(progressBar(pct, 100, pctColor(pct)));

  const sub = document.createElement("div");
  sub.className = "exec-sub mono";
  sub.textContent = `Total executions: ${total ?? 0}`;
  section.appendChild(sub);

  return section;
}

// ---- Grafana quick links ----

function buildGrafanaLinks() {
  const links = [
    { label: "Total Overview", href: "/grafana/d/openclaw-00/" },
    { label: "AI Intelligence", href: "/grafana/d/openclaw-02/" },
    { label: "Network Health", href: "/grafana/d/openclaw-03/" },
  ];

  const cards = links.map((link) => {
    const a = document.createElement("a");
    a.className = "grafana-link";
    a.href = link.href;
    a.target = "_blank";
    a.rel = "noopener";
    a.textContent = link.label;
    return a;
  });

  return cols3(cards);
}

// ---- Build full page ----

function buildPage(data) {
  const { metrics } = data;
  const frag = document.createDocumentFragment();

  // Page title
  const title = document.createElement("h1");
  title.className = "page-title";
  title.textContent = "Overview";
  frag.appendChild(title);

  // Status cards
  frag.appendChild(buildStatusCards(metrics));

  // Mini topology
  frag.appendChild(sectionTitle("Topology"));
  frag.appendChild(buildMiniTopology(metrics));

  // 2-col: Station Health + WAN Status
  const stationCol = document.createElement("div");
  stationCol.appendChild(sectionTitle("Station Health"));
  stationCol.appendChild(buildStationHealth(metrics));

  const wanCol = document.createElement("div");
  wanCol.appendChild(sectionTitle("WAN Status"));
  wanCol.appendChild(buildWanStatus(metrics));

  frag.appendChild(cols2(stationCol, wanCol));

  // 2-col: AI Performance + Execution bar
  const perfCol = document.createElement("div");
  perfCol.appendChild(sectionTitle("AI Performance"));
  perfCol.appendChild(buildAiPerformance(metrics));

  const execCol = document.createElement("div");
  execCol.appendChild(sectionTitle("Execution Success"));
  execCol.appendChild(buildExecBar(metrics));

  frag.appendChild(cols2(perfCol, execCol));

  // Grafana quick links
  frag.appendChild(sectionTitle("Grafana Dashboards"));
  frag.appendChild(buildGrafanaLinks());

  return frag;
}

// ---- Exports (page module interface) ----

export async function render(container, query) {
  try {
    const data = await fetchData();
    container.innerHTML = "";
    container.appendChild(buildPage(data));
  } catch (err) {
    console.error("[overview] render error:", err);
    container.innerHTML = "";
    container.appendChild(errorBanner("Failed to load overview: " + err.message));
  }
}

export async function refresh(container, query) {
  // Full re-render for simplicity; data is cheap and DOM is small
  await render(container, query);
}
