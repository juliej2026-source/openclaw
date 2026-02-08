// Full-page topology view (route: #/topology)
// Shows WAN status banner, full SVG topology with legend,
// and click-to-navigate to station detail.

import { fetchMetrics, sendCommand } from "../api.js";
import { sectionTitle, badge, errorBanner } from "../components.js";
import { parsePrometheus, getScalar } from "../prometheus.js";
import { renderTopology, renderLegend } from "../topology.js";
import { statusClass } from "../utils.js";

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

// ---- Build full page ----

function buildPage(data) {
  const { metrics, scanData, dualNet } = data;
  const frag = document.createDocumentFragment();

  // Page title
  const title = document.createElement("h1");
  title.className = "page-title";
  title.textContent = "Neural Network Topology";
  frag.appendChild(title);

  // WAN status banner
  frag.appendChild(buildWanBanner(metrics));

  // Full topology SVG
  const topoContainer = document.createElement("div");
  topoContainer.className = "topology-container";
  renderTopology(topoContainer, {
    scanData,
    dualNet,
    mini: false,
    onNodeClick: (nodeId) => {
      location.hash = `#/stations?id=${nodeId}`;
    },
  });
  frag.appendChild(topoContainer);

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
    const data = await fetchData();
    container.innerHTML = "";
    container.appendChild(buildPage(data));
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
