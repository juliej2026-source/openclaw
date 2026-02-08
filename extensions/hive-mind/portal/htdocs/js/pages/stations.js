// Station management page — #/stations
// Displays station cards with status, latency, and expandable detail panels.

import { sendCommand, fetchMetrics } from "../api.js";
import { card, cardGrid, badge, statusDot, sectionTitle, errorBanner, esc } from "../components.js";
import { parsePrometheus, getAll } from "../prometheus.js";
import { fmtDuration } from "../utils.js";

// Role → badge color mapping
const ROLE_COLORS = {
  gateway: "blue",
  modem: "orange",
  ai: "purple",
  hub: "cyan",
  worker: "green",
  device: "dim",
};

/** Track which station card is currently expanded */
let expandedStation = null;

/**
 * Build the summary stat cards row.
 * @param {Array} stations
 * @returns {HTMLElement}
 */
function buildSummaryCards(stations) {
  const total = stations.length;
  const online = stations.filter((s) => s.reachable).length;
  const offline = total - online;
  const latencies = stations.filter((s) => s.latency != null).map((s) => s.latency);
  const avgLatency =
    latencies.length > 0
      ? (latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(1) + " ms"
      : "--";

  return cardGrid([
    card({ label: "Total Stations", value: total, status: "info" }),
    card({ label: "Online", value: online, status: online > 0 ? "ok" : "" }),
    card({ label: "Offline", value: offline, status: offline > 0 ? "crit" : "ok" }),
    card({ label: "Avg Latency", value: avgLatency, status: "" }),
  ]);
}

/**
 * Build the detail panel for an expanded station.
 * @param {Object} station
 * @returns {HTMLElement}
 */
function buildDetailPanel(station) {
  const detail = document.createElement("div");
  detail.className = "station-detail";

  // Role badge
  const roleColor = ROLE_COLORS[station.role] || "dim";
  const roleBadge = badge(station.role, roleColor);
  detail.appendChild(roleBadge);

  // System info rows
  const info = document.createElement("div");
  info.style.marginTop = "8px";
  info.innerHTML =
    `<div style="margin-bottom:4px;"><span style="color:var(--text-dim)">IP:</span> <span style="font-family:var(--font-mono);font-size:12px">${esc(station.ip)}</span></div>` +
    `<div style="margin-bottom:4px;"><span style="color:var(--text-dim)">Status:</span> ${station.reachable ? "Online" : "Offline"}</div>` +
    `<div><span style="color:var(--text-dim)">Latency:</span> ${station.latency != null ? station.latency.toFixed(1) + " ms" : "--"}</div>`;
  detail.appendChild(info);

  return detail;
}

/**
 * Build a single station card element.
 * @param {Object} station
 * @param {boolean} isExpanded
 * @returns {HTMLElement}
 */
function buildStationCard(station, isExpanded) {
  const el = document.createElement("div");
  el.className = "station-card" + (isExpanded ? " expanded" : "");
  el.dataset.station = station.name;

  // Header row: status dot + name + role badge
  const header = document.createElement("div");
  header.className = "station-header";
  header.appendChild(statusDot(station.reachable));

  const nameEl = document.createElement("span");
  nameEl.className = "station-name";
  nameEl.textContent = station.name;
  header.appendChild(nameEl);

  const roleColor = ROLE_COLORS[station.role] || "dim";
  header.appendChild(badge(station.role, roleColor));

  el.appendChild(header);

  // Meta row: IP + latency
  const meta = document.createElement("div");
  meta.className = "station-meta";

  const ipSpan = document.createElement("span");
  ipSpan.className = "station-ip";
  ipSpan.textContent = station.ip;
  meta.appendChild(ipSpan);

  if (station.latency != null) {
    const latSpan = document.createElement("span");
    latSpan.textContent = station.latency.toFixed(1) + " ms";
    meta.appendChild(latSpan);
  }

  el.appendChild(meta);

  // Expanded detail panel
  if (isExpanded) {
    el.appendChild(buildDetailPanel(station));
  }

  // Click handler to toggle expansion
  el.addEventListener("click", () => {
    if (expandedStation === station.name) {
      expandedStation = null;
    } else {
      expandedStation = station.name;
    }
    // Re-render just the grid
    const grid = document.querySelector(".station-grid");
    if (grid) {
      renderStationGrid(grid, station._allStations);
    }
  });

  return el;
}

/**
 * Render station cards into a grid container.
 * @param {HTMLElement} gridEl
 * @param {Array} stations
 */
function renderStationGrid(gridEl, stations) {
  gridEl.innerHTML = "";
  for (const s of stations) {
    // Attach the full list reference so click handler can re-render
    s._allStations = stations;
    gridEl.appendChild(buildStationCard(s, expandedStation === s.name));
  }
}

/**
 * Merge Prometheus metrics into station data for reachability and latency.
 * Prometheus values override command data when available.
 * @param {Array} stations
 * @param {Object} metrics — parsed Prometheus metrics
 * @returns {Array}
 */
function enrichWithMetrics(stations, metrics) {
  const reachEntries = getAll(metrics, "hivemind_station_reachable");
  const latEntries = getAll(metrics, "hivemind_station_latency_ms");

  // Build lookup maps by station label
  const reachMap = {};
  for (const e of reachEntries) {
    if (e.labels.station) reachMap[e.labels.station] = e.value;
  }
  const latMap = {};
  for (const e of latEntries) {
    if (e.labels.station) latMap[e.labels.station] = e.value;
  }

  return stations.map((s) => {
    const copy = { ...s };
    if (reachMap[s.name] !== undefined) {
      copy.reachable = reachMap[s.name] === 1;
    }
    if (latMap[s.name] !== undefined) {
      copy.latency = latMap[s.name];
    }
    return copy;
  });
}

/**
 * Fetch station data and metrics, then render.
 * @param {HTMLElement} container
 * @param {Object} query — parsed query params
 */
async function load(container, query) {
  // If query has ?id=NAME, auto-expand that station
  if (query.id) {
    expandedStation = query.id;
  }

  let stations = [];

  try {
    // Fetch command data and metrics in parallel
    const [cmdResult, metricsText] = await Promise.all([
      sendCommand("network:stations"),
      fetchMetrics().catch(() => null),
    ]);

    stations = cmdResult.stations || [];

    // Enrich with Prometheus metrics if available
    if (metricsText) {
      const metrics = parsePrometheus(metricsText);
      stations = enrichWithMetrics(stations, metrics);
    }
  } catch (err) {
    container.innerHTML = "";
    container.appendChild(errorBanner("Failed to load station data: " + err.message));
    return;
  }

  // Build page
  container.innerHTML = "";

  // Page title
  const title = document.createElement("div");
  title.className = "page-title";
  title.textContent = "Stations";
  container.appendChild(title);

  // Summary cards
  container.appendChild(buildSummaryCards(stations));

  // Section title
  container.appendChild(sectionTitle("Station Overview"));

  // Station grid
  const grid = document.createElement("div");
  grid.className = "card-grid station-grid";
  renderStationGrid(grid, stations);
  container.appendChild(grid);
}

/**
 * Initial render of the stations page.
 * @param {HTMLElement} container
 * @param {Object} query
 */
export async function render(container, query) {
  expandedStation = null;
  await load(container, query);
}

/**
 * Refresh the page data without full re-mount.
 * @param {HTMLElement} container
 * @param {Object} query
 */
export async function refresh(container, query) {
  await load(container, query);
}
