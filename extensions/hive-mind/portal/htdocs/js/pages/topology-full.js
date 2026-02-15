// Full-page topology view (route: #/topology)
// Shows WAN status banner, full SVG topology with legend,
// Flow toggle with animated data-flow particles, and click-to-navigate.

import { fetchMetrics, sendCommand } from "../api.js";
import { sectionTitle, badge, errorBanner } from "../components.js";
import { parsePrometheus, getScalar } from "../prometheus.js";
import { renderTopology, renderLegend, stopFlow } from "../topology.js";
import { statusClass } from "../utils.js";

// ---- Module state ----
let _flowActive = false;
let _data = null;

// ---- Data fetching ----

async function fetchData() {
  const [metricsText, scanData, dualNet] = await Promise.all([
    fetchMetrics(),
    sendCommand("network:scan").catch(() => null),
    sendCommand("network:path").catch(() => null),
  ]);
  const metrics = parsePrometheus(metricsText);
  return { metrics, scanData, dualNet };
}

// ---- WAN status banner ----

function buildWanBanner(metrics) {
  const failover = getScalar(metrics, "hivemind_wan_failover_active");
  const isFailover = failover === 1;

  const banner = document.createElement("div");
  banner.className = "wan-banner " + (isFailover ? "failover" : "normal");

  const label = document.createElement("span");
  label.className = "wan-banner-label";
  label.textContent = "WAN Status: ";
  banner.appendChild(label);

  banner.appendChild(isFailover ? badge("FAILOVER", "red") : badge("NORMAL", "green"));

  if (isFailover) {
    const hint = document.createElement("span");
    hint.className = "wan-banner-hint";
    hint.textContent = " -- Traffic is routing through failover path";
    banner.appendChild(hint);
  }

  return banner;
}

// ---- Flow stats bar ----

function buildFlowStats(stats) {
  const bar = document.createElement("div");
  bar.className = "flow-stats";
  bar.innerHTML =
    `<span class="flow-stat"><span class="flow-stat-val">${stats.onlineCount}</span>/<span class="flow-stat-dim">${stats.totalNodes}</span> nodes online</span>` +
    `<span class="flow-stat"><span class="flow-stat-val">${stats.activeLinks}</span>/<span class="flow-stat-dim">${stats.totalLinks}</span> active links</span>` +
    `<span class="flow-stat"><span id="particle-count" class="flow-stat-val">${stats.particleCount}</span> particles</span>`;
  return bar;
}

// ---- Build full page ----

function buildPage(data, flow) {
  const { metrics, scanData, dualNet } = data;
  const frag = document.createDocumentFragment();

  // Page header with title and flow toggle
  const header = document.createElement("div");
  header.className = "topo-header";

  const title = document.createElement("h1");
  title.className = "page-title";
  title.textContent = "Neural Network Topology";
  header.appendChild(title);

  const flowBtn = document.createElement("button");
  flowBtn.className = "flow-btn" + (flow ? " active" : "");
  flowBtn.innerHTML = `<span class="flow-icon">${flow ? "\u26A1" : "\u25B6"}</span> ${flow ? "Flow Active" : "Data Flow"}`;
  flowBtn.addEventListener("click", () => {
    _flowActive = !_flowActive;
    // Re-render into the router's app container
    const container = document.getElementById("app");
    if (container && _data) {
      stopFlow();
      container.innerHTML = "";
      container.appendChild(buildPage(_data, _flowActive));
    }
  });
  header.appendChild(flowBtn);
  frag.appendChild(header);

  // WAN status banner
  frag.appendChild(buildWanBanner(metrics));

  // Full topology SVG
  const topoContainer = document.createElement("div");
  topoContainer.className = "topology-container" + (flow ? " flow-expanded" : "");
  const stats = renderTopology(topoContainer, {
    scanData,
    dualNet,
    mini: false,
    flow,
    onNodeClick: (nodeId) => {
      location.hash = `#/stations?id=${nodeId}`;
    },
  });
  frag.appendChild(topoContainer);

  // Flow stats bar (only when flow is active)
  if (flow && stats) {
    frag.appendChild(buildFlowStats(stats));
  }

  // Legend
  const legendContainer = document.createElement("div");
  legendContainer.className = "topo-legend";
  renderLegend(legendContainer);
  frag.appendChild(legendContainer);

  return frag;
}

// ---- Exports (page module interface) ----

export async function render(container, query) {
  try {
    _data = await fetchData();
    stopFlow();
    container.innerHTML = "";
    container.appendChild(buildPage(_data, _flowActive));
  } catch (err) {
    console.error("[topology-full] render error:", err);
    container.innerHTML = "";
    container.appendChild(errorBanner("Failed to load topology: " + err.message));
  }
}

export async function refresh(container, query) {
  // Full re-render: topology SVG is rebuilt from fresh scan + metrics data
  await render(container, query);
}

export function destroy() {
  stopFlow();
  _flowActive = false;
  _data = null;
}
