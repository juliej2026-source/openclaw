// Network page — UniFi health, devices, clients, alerts
// Route: #/network

import { apiGetUnifi } from "../api.js";
import {
  card,
  cardGrid,
  badge,
  dataTable,
  statusDot,
  sectionTitle,
  cols3,
  errorBanner,
  emptyState,
} from "../components.js";
import { fmtBytes, fmtDuration, timeAgo } from "../utils.js";

/**
 * Build a health subsystem card.
 * @param {object} h — health entry {subsystem, status, ...}
 * @returns {HTMLElement}
 */
function healthCard(h) {
  const status = h.status === "ok" ? "ok" : "crit";
  const label = h.subsystem.toUpperCase();

  let sub = "";
  switch (h.subsystem) {
    case "wan":
      sub = [h.wan_ip ? "IP: " + h.wan_ip : null, h.isp_name ? "ISP: " + h.isp_name : null]
        .filter(Boolean)
        .join(" | ");
      break;
    case "lan":
      sub = [
        h.num_sw != null ? h.num_sw + " switches" : null,
        h.num_sta != null ? h.num_sta + " stations" : null,
      ]
        .filter(Boolean)
        .join(" | ");
      break;
    case "wlan":
      sub = [
        h.num_ap != null ? h.num_ap + " APs" : null,
        h.num_sta != null ? h.num_sta + " clients" : null,
      ]
        .filter(Boolean)
        .join(" | ");
      break;
    default:
      break;
  }

  return card({
    label: label,
    value: h.status === "ok" ? "OK" : "ERROR",
    sub: sub || undefined,
    status: status,
  });
}

/**
 * Build a devices table.
 * @param {Array} devices — [{name, model, ip, type, uptime, status}]
 * @returns {HTMLElement}
 */
function devicesTable(devices) {
  return dataTable({
    columns: [
      { key: "name", label: "Name", sortable: true },
      { key: "model", label: "Model", sortable: true },
      { key: "ip", label: "IP", sortable: true, mono: true },
      { key: "type", label: "Type", sortable: true },
      { key: "_uptime", label: "Uptime", sortable: true, sortKey: "uptime" },
      { key: "_status", label: "Status", sortable: false },
    ],
    rows: devices.map((d) => ({
      name: d.name || "--",
      model: d.model || "--",
      ip: d.ip || "--",
      type: d.type || "--",
      _uptime: fmtDuration(d.uptime),
      _status: statusDot(d.status === "online" || d.status === "connected" || d.status === 1),
      // Keep raw uptime for sorting
      uptime: d.uptime ?? 0,
    })),
  });
}

/**
 * Build a clients table.
 * @param {Array} clients — [{hostname, ip, mac, is_wired, rx_bytes, tx_bytes, uptime}]
 * @returns {HTMLElement}
 */
function clientsTable(clients) {
  return dataTable({
    columns: [
      { key: "hostname", label: "Hostname", sortable: true },
      { key: "ip", label: "IP", sortable: true, mono: true },
      { key: "mac", label: "MAC", sortable: true, mono: true },
      { key: "_wired", label: "Wired?", sortable: true },
      { key: "_rx", label: "RX", sortable: false },
      { key: "_tx", label: "TX", sortable: false },
      { key: "_uptime", label: "Uptime", sortable: true },
    ],
    rows: clients.map((c) => ({
      hostname: c.hostname || "--",
      ip: c.ip || "--",
      mac: c.mac || "--",
      _wired: c.is_wired ? badge("Wired", "blue") : badge("WiFi", "purple"),
      _rx: fmtBytes(c.rx_bytes),
      _tx: fmtBytes(c.tx_bytes),
      _uptime: fmtDuration(c.uptime),
      // Keep raw values for sorting
      is_wired: c.is_wired ? 1 : 0,
      uptime: c.uptime ?? 0,
    })),
  });
}

/**
 * Build the alerts section.
 * @param {Array} alerts — [{msg, subsystem, datetime, archived}]
 * @returns {HTMLElement}
 */
function alertsList(alerts) {
  if (!alerts || alerts.length === 0) {
    return emptyState("No active alerts");
  }

  const wrap = document.createElement("div");
  for (const alert of alerts) {
    const row = document.createElement("div");
    row.className = "alert-row";

    const severity = document.createElement("div");
    severity.className = "alert-severity";
    severity.appendChild(
      badge((alert.subsystem || "system").toUpperCase(), alert.archived ? "dim" : "red"),
    );

    const msg = document.createElement("div");
    msg.className = "alert-message";
    msg.textContent = alert.msg || "--";

    const time = document.createElement("div");
    time.className = "alert-time";
    time.textContent = alert.datetime ? timeAgo(alert.datetime) : "--";

    row.appendChild(severity);
    row.appendChild(msg);
    row.appendChild(time);
    wrap.appendChild(row);
  }
  return wrap;
}

/**
 * Fetch all UniFi data in parallel.
 * @returns {Promise<{health: Array, devices: Array, clients: Array, alerts: Array, errors: string[]}>}
 */
async function fetchData() {
  const errors = [];

  const [healthRes, devicesRes, clientsRes, alertsRes] = await Promise.allSettled([
    apiGetUnifi("/api/unifi/health"),
    apiGetUnifi("/api/unifi/devices"),
    apiGetUnifi("/api/unifi/clients"),
    apiGetUnifi("/api/unifi/alerts"),
  ]);

  let health = [];
  if (healthRes.status === "fulfilled") {
    health = healthRes.value.health || [];
  } else {
    errors.push("Health: " + healthRes.reason.message);
  }

  let devices = [];
  if (devicesRes.status === "fulfilled") {
    devices = devicesRes.value.devices || [];
  } else {
    errors.push("Devices: " + devicesRes.reason.message);
  }

  let clients = [];
  if (clientsRes.status === "fulfilled") {
    clients = clientsRes.value.clients || [];
  } else {
    errors.push("Clients: " + clientsRes.reason.message);
  }

  let alerts = [];
  if (alertsRes.status === "fulfilled") {
    alerts = alertsRes.value.alerts || [];
  } else {
    errors.push("Alerts: " + alertsRes.reason.message);
  }

  return { health, devices, clients, alerts, errors };
}

/**
 * Render the full Network page into the container.
 * @param {HTMLElement} container
 * @param {object} query — route query params (unused)
 */
export async function render(container, query) {
  container.innerHTML = "";

  const title = document.createElement("div");
  title.className = "page-title";
  title.textContent = "Network";
  container.appendChild(title);

  try {
    const data = await fetchData();
    buildPage(container, data);
  } catch (e) {
    container.appendChild(errorBanner("Failed to load network data: " + e.message));
  }
}

/**
 * Refresh the Network page (re-fetch and rebuild content below the title).
 * @param {HTMLElement} container
 * @param {object} query
 */
export async function refresh(container, query) {
  try {
    const data = await fetchData();

    // Remove everything except the page title
    const titleEl = container.querySelector(".page-title");
    container.innerHTML = "";
    if (titleEl) container.appendChild(titleEl);

    buildPage(container, data);
  } catch (e) {
    console.error("[network] refresh error:", e);
  }
}

/**
 * Build the page content from fetched data.
 * @param {HTMLElement} container
 * @param {object} data — {health, devices, clients, alerts, errors}
 */
function buildPage(container, data) {
  const { health, devices, clients, alerts, errors } = data;

  // Show any fetch errors
  for (const err of errors) {
    container.appendChild(errorBanner(err));
  }

  // Health subsystem cards — 3-column layout
  if (health.length > 0) {
    container.appendChild(sectionTitle("Health"));
    const healthCards = health.map((h) => healthCard(h));
    container.appendChild(cols3(healthCards));
  }

  // Devices table
  container.appendChild(sectionTitle("Devices"));
  if (devices.length > 0) {
    container.appendChild(devicesTable(devices));
  } else {
    container.appendChild(emptyState("No devices found"));
  }

  // Clients table
  container.appendChild(sectionTitle("Clients"));
  if (clients.length > 0) {
    container.appendChild(clientsTable(clients));
  } else {
    container.appendChild(emptyState("No clients connected"));
  }

  // Alerts
  container.appendChild(sectionTitle("UniFi Alerts"));
  container.appendChild(alertsList(alerts));
}
