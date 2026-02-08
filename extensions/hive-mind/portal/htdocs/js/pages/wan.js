// WAN Monitor page — dual-path WAN status, HR02 5G modem, failover controls
// Route: #/wan

import { sendCommand, fetchMetrics } from "../api.js";
import { card, cardGrid, badge, sectionTitle, cols2, errorBanner, esc } from "../components.js";
import { parsePrometheus, getScalar, getAll } from "../prometheus.js";
import { fmtDuration } from "../utils.js";

/**
 * Build a WAN status banner element.
 * @param {boolean} failoverActive
 * @param {string} activePath — "primary" | "hr02_5g"
 * @returns {HTMLElement}
 */
function wanBanner(failoverActive, activePath) {
  const el = document.createElement("div");
  if (failoverActive) {
    el.className = "wan-banner failover";
    el.textContent = "FAILOVER \u2014 HR02 5G";
  } else {
    el.className = "wan-banner normal";
    el.textContent = "NORMAL \u2014 Primary Path Active";
  }
  return el;
}

/**
 * Build a path card for a single WAN path.
 * @param {object} path — {id, ssid, gateway, subnet, status, latency, packetLoss}
 * @returns {HTMLElement}
 */
function pathCard(path) {
  const el = document.createElement("div");
  const isActive = path.status === "active";
  el.className = "path-card" + (isActive ? " active" : " standby");

  const statusBadge = isActive ? badge("ACTIVE", "green") : badge("STANDBY", "dim");

  const latency = path.latency != null ? path.latency.toFixed(1) + " ms" : "--";
  const loss = path.packetLoss != null ? path.packetLoss.toFixed(2) + "%" : "--";

  el.innerHTML =
    `<div class="path-label">${esc(path.ssid || path.id)}</div>` +
    `<div class="path-value">Gateway: <span class="mono">${esc(path.gateway || "--")}</span></div>` +
    `<div class="path-value">Subnet: <span class="mono">${esc(path.subnet || "--")}</span></div>` +
    `<div class="path-value">Latency: <span class="mono">${esc(latency)}</span></div>` +
    `<div class="path-value">Packet Loss: <span class="mono">${esc(loss)}</span></div>`;

  // Insert status badge after the label
  const label = el.querySelector(".path-label");
  label.appendChild(document.createTextNode(" "));
  label.appendChild(statusBadge);

  return el;
}

/**
 * Build the HR02 5G modem detail card.
 * @param {object|null} modem — from network:5g command
 * @returns {HTMLElement}
 */
function modemCard(modem) {
  const wrap = document.createElement("div");
  if (!modem) {
    wrap.appendChild(card({ label: "HR02 5G Modem", value: "Unavailable", status: "crit" }));
    return wrap;
  }

  const el = document.createElement("div");
  el.className = "path-card active";

  const signal = modem.signal_percent != null ? modem.signal_percent + "%" : "--";
  const dlSpeed = modem.download_speed != null ? modem.download_speed.toFixed(1) + " Mbps" : "--";
  const ulSpeed = modem.upload_speed != null ? modem.upload_speed.toFixed(1) + " Mbps" : "--";
  const uptime = modem.uptime_seconds != null ? fmtDuration(modem.uptime_seconds) : "--";

  el.innerHTML =
    `<div class="path-label">HR02 5G Modem</div>` +
    `<div class="path-value">Signal: <span class="mono">${esc(signal)}</span></div>` +
    `<div class="path-value">Band: <span class="mono">${esc(modem.band || "--")}</span></div>` +
    `<div class="path-value">Technology: <span class="mono">${esc(modem.technology || "--")}</span></div>` +
    `<div class="path-value">Download: <span class="mono">${esc(dlSpeed)}</span></div>` +
    `<div class="path-value">Upload: <span class="mono">${esc(ulSpeed)}</span></div>` +
    `<div class="path-value">Uptime: <span class="mono">${esc(uptime)}</span></div>`;

  wrap.appendChild(el);
  return wrap;
}

/**
 * Build manual switch buttons.
 * @returns {HTMLElement}
 */
function switchButtons() {
  const wrap = document.createElement("div");
  wrap.style.display = "flex";
  wrap.style.gap = "10px";
  wrap.style.marginTop = "16px";

  const btnPrimary = document.createElement("button");
  btnPrimary.className = "btn btn-primary";
  btnPrimary.textContent = "Switch to Primary";
  btnPrimary.addEventListener("click", async () => {
    btnPrimary.disabled = true;
    btnPrimary.textContent = "Switching\u2026";
    try {
      await sendCommand("network:switch", { path: "primary" });
    } catch (e) {
      console.error("[wan] switch to primary failed:", e);
    }
    btnPrimary.disabled = false;
    btnPrimary.textContent = "Switch to Primary";
  });

  const btn5g = document.createElement("button");
  btn5g.className = "btn btn-primary";
  btn5g.textContent = "Switch to HR02 5G";
  btn5g.addEventListener("click", async () => {
    btn5g.disabled = true;
    btn5g.textContent = "Switching\u2026";
    try {
      await sendCommand("network:switch", { path: "hr02_5g" });
    } catch (e) {
      console.error("[wan] switch to hr02_5g failed:", e);
    }
    btn5g.disabled = false;
    btn5g.textContent = "Switch to HR02 5G";
  });

  wrap.appendChild(btnPrimary);
  wrap.appendChild(btn5g);
  return wrap;
}

/**
 * Fetch all WAN data from command API and Prometheus metrics.
 * @returns {Promise<{dualNet: object|null, modem: object|null, metrics: object}>}
 */
async function fetchData() {
  const [dualNet, modem, metricsText] = await Promise.allSettled([
    sendCommand("network:path"),
    sendCommand("network:5g"),
    fetchMetrics(),
  ]);

  return {
    dualNet: dualNet.status === "fulfilled" ? dualNet.value : null,
    modem: modem.status === "fulfilled" && !modem.value.error ? modem.value : null,
    metrics: metricsText.status === "fulfilled" ? parsePrometheus(metricsText.value) : {},
  };
}

/**
 * Render the full WAN Monitor page into the container.
 * @param {HTMLElement} container
 * @param {object} query — route query params (unused)
 */
export async function render(container, query) {
  container.innerHTML = "";

  const title = document.createElement("div");
  title.className = "page-title";
  title.textContent = "WAN Monitor";
  container.appendChild(title);

  try {
    const { dualNet, modem, metrics } = await fetchData();
    buildPage(container, dualNet, modem, metrics);
  } catch (e) {
    container.appendChild(errorBanner("Failed to load WAN data: " + e.message));
  }
}

/**
 * Refresh the WAN Monitor page (re-fetch and rebuild content below the title).
 * @param {HTMLElement} container
 * @param {object} query
 */
export async function refresh(container, query) {
  try {
    const { dualNet, modem, metrics } = await fetchData();

    // Remove everything except the page title
    const titleEl = container.querySelector(".page-title");
    container.innerHTML = "";
    if (titleEl) container.appendChild(titleEl);

    buildPage(container, dualNet, modem, metrics);
  } catch (e) {
    console.error("[wan] refresh error:", e);
  }
}

/**
 * Build the page content from fetched data.
 * @param {HTMLElement} container
 * @param {object|null} dualNet — from network:path
 * @param {object|null} modem — from network:5g
 * @param {object} metrics — parsed Prometheus metrics
 */
function buildPage(container, dualNet, modem, metrics) {
  // Determine failover state from command data, fall back to metrics
  const failoverFromCmd = dualNet?.failoverActive ?? false;
  const failoverFromMetrics = getScalar(metrics, "hivemind_wan_failover_active");
  const failoverActive = failoverFromCmd || failoverFromMetrics === 1;
  const activePath = dualNet?.activePath || "primary";

  // Status banner
  container.appendChild(wanBanner(failoverActive, activePath));

  // Path cards — 2-column layout
  container.appendChild(sectionTitle("WAN Paths"));

  const paths = dualNet?.paths || [];
  if (paths.length >= 2) {
    container.appendChild(cols2(pathCard(paths[0]), pathCard(paths[1])));
  } else if (paths.length === 1) {
    container.appendChild(cols2(pathCard(paths[0]), document.createElement("div")));
  } else {
    // Fall back to metrics-only path display
    const metricPaths = getAll(metrics, "hivemind_wan_active_path");
    const latencyEntries = getAll(metrics, "hivemind_wan_quality_latency_ms");
    const lossEntries = getAll(metrics, "hivemind_wan_quality_packet_loss_pct");

    const synthPaths = metricPaths.map((entry) => {
      const pathId = entry.labels.path_id || "unknown";
      const latEntry = latencyEntries.find((l) => l.labels.path_id === pathId);
      const lossEntry = lossEntries.find((l) => l.labels.path_id === pathId);
      return {
        id: pathId,
        ssid: pathId,
        gateway: "--",
        subnet: "--",
        status: entry.value === 1 ? "active" : "standby",
        latency: latEntry ? latEntry.value : null,
        packetLoss: lossEntry ? lossEntry.value : null,
      };
    });

    if (synthPaths.length >= 2) {
      container.appendChild(cols2(pathCard(synthPaths[0]), pathCard(synthPaths[1])));
    } else if (synthPaths.length === 1) {
      container.appendChild(cols2(pathCard(synthPaths[0]), document.createElement("div")));
    }
  }

  // HR02 5G modem detail
  container.appendChild(sectionTitle("HR02 5G Modem"));
  container.appendChild(modemCard(modem));

  // Failover stats
  container.appendChild(sectionTitle("Failover Statistics"));

  const switchCount =
    dualNet?.switchCount ?? getScalar(metrics, "hivemind_wan_switch_count_total") ?? 0;
  const lastSwitch = dualNet?.lastSwitch || null;
  const lastSwitchStr = lastSwitch ? new Date(lastSwitch).toLocaleString() : "--";

  container.appendChild(
    cardGrid([
      card({ label: "Total Switches", value: switchCount, status: "info" }),
      card({ label: "Last Switch", value: lastSwitchStr, status: "info" }),
    ]),
  );

  // Manual switch controls
  container.appendChild(sectionTitle("Manual Switch"));
  container.appendChild(switchButtons());
}
