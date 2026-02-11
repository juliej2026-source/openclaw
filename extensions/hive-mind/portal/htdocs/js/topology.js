// SVG neural network topology renderer
// Renders station nodes and connections as an interactive SVG graph

// Known stations with positions (hardcoded to match physical network)
const NODES = [
  {
    id: "UDM-Pro",
    label: "UDM Pro",
    ip: "10.1.7.1",
    role: "gateway",
    x: 400,
    y: 50,
    icon: "\u25C6",
  },
  {
    id: "HR02-5G",
    label: "HR02 5G",
    ip: "192.168.128.1",
    role: "modem",
    x: 150,
    y: 50,
    icon: "\u25B2",
  },
  { id: "Julie", label: "Julie", ip: "10.1.7.87", role: "ai", x: 150, y: 180, icon: "\u2605" },
  {
    id: "IOT-HUB",
    label: "IOT-HUB",
    ip: "10.1.7.158",
    role: "hub",
    x: 350,
    y: 180,
    icon: "\u2B22",
  },
  {
    id: "SCRAPER",
    label: "SCRAPER",
    ip: "10.1.7.180",
    role: "decommissioned",
    x: 500,
    y: 180,
    icon: "\u25CF",
  },
  { id: "CLERK", label: "CLERK", ip: "10.1.7.239", role: "worker", x: 650, y: 180, icon: "\u25CF" },
  {
    id: "Bravia",
    label: "Bravia",
    ip: "10.1.7.131",
    role: "device",
    x: 550,
    y: 300,
    icon: "\u25A0",
  },
];

// Network connections
const LINKS = [
  { from: "UDM-Pro", to: "IOT-HUB", type: "wired" },
  { from: "UDM-Pro", to: "SCRAPER", type: "wired" },
  { from: "UDM-Pro", to: "CLERK", type: "wired" },
  { from: "UDM-Pro", to: "Julie", type: "wired" },
  { from: "UDM-Pro", to: "Bravia", type: "wired" },
  { from: "HR02-5G", to: "Julie", type: "wireless" },
  { from: "Julie", to: "IOT-HUB", type: "api" },
];

const ROLE_COLORS = {
  gateway: "#58a6ff",
  modem: "#f0883e",
  ai: "#bc8cff",
  hub: "#39d2c0",
  worker: "#3fb950",
  device: "#8b949e",
  decommissioned: "#6e7681",
};

/**
 * Render the topology SVG into a container.
 * @param {HTMLElement} container
 * @param {Object} opts
 * @param {Object} [opts.scanData] — from /api/network/scan
 * @param {Object} [opts.dualNet] — from network:path command
 * @param {boolean} [opts.mini] — mini mode (smaller, no legend)
 * @param {function} [opts.onNodeClick] — callback(nodeId)
 */
export function renderTopology(container, opts = {}) {
  const { scanData, dualNet, mini, onNodeClick } = opts;
  const width = mini ? 400 : 780;
  const height = mini ? 220 : 360;
  const scale = mini ? 0.5 : 1;
  const nodeRadius = mini ? 16 : 24;

  // Build reachability map from scan data
  const reachable = {};
  if (scanData && scanData.stations) {
    for (const s of scanData.stations) {
      reachable[s.ip] = s.reachable;
    }
  }

  // Latency map
  const latency = {};
  if (scanData && scanData.stations) {
    for (const s of scanData.stations) {
      if (s.latency != null) latency[s.ip] = s.latency;
    }
  }

  // Active WAN path
  const activeWan = dualNet?.activePath || "primary";

  // Scaled positions
  const nodes = NODES.map((n) => ({
    ...n,
    sx: n.x * scale + (mini ? 10 : 20),
    sy: n.y * scale + (mini ? 20 : 40),
    up: reachable[n.ip] !== false, // default to up if no scan data
    lat: latency[n.ip],
  }));

  const nodeMap = {};
  for (const n of nodes) nodeMap[n.id] = n;

  // Build SVG
  let svg = `<svg class="topology-svg" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`;

  // Defs: glow filters
  svg += `<defs>
    <filter id="glow-green" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="3" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="glow-red" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="3" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="link-glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="2" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>`;

  // Render links
  for (const link of LINKS) {
    const from = nodeMap[link.from];
    const to = nodeMap[link.to];
    if (!from || !to) continue;

    const bothUp = from.up && to.up;
    const color = bothUp ? "#3fb950" : "#f85149";
    let dash = "";
    if (link.type === "wireless") dash = ' stroke-dasharray="6 4"';
    if (link.type === "api") dash = ' stroke-dasharray="2 4"';

    // Highlight active WAN path
    let strokeWidth = mini ? 1.5 : 2;
    let filter = "";
    if (link.from === "UDM-Pro" && activeWan === "primary") {
      // Primary path is UDM-Pro to stations
    }
    if (link.from === "HR02-5G" && activeWan === "hr02_5g") {
      strokeWidth = mini ? 2.5 : 3.5;
      filter = ' filter="url(#link-glow)"';
    }

    svg +=
      `<line x1="${from.sx}" y1="${from.sy}" x2="${to.sx}" y2="${to.sy}" ` +
      `stroke="${color}" stroke-width="${strokeWidth}"${dash}${filter} opacity="0.5"/>`;
  }

  // Render nodes
  for (const node of nodes) {
    const r = nodeRadius;
    const fillColor = node.up ? (ROLE_COLORS[node.role] || "#3fb950") + "33" : "#f8514933";
    const strokeColor = node.up ? ROLE_COLORS[node.role] || "#3fb950" : "#f85149";
    const glowFilter = node.up ? "url(#glow-green)" : "url(#glow-red)";
    const clickAttr = onNodeClick ? ` style="cursor:pointer"` : "";

    svg += `<g class="topo-node ${node.up ? "up" : "down"}" data-id="${node.id}"${clickAttr}>`;
    svg += `<circle cx="${node.sx}" cy="${node.sy}" r="${r}" fill="${fillColor}" stroke="${strokeColor}" stroke-width="2" filter="${glowFilter}"/>`;

    // Icon glyph
    if (!mini) {
      svg += `<text x="${node.sx}" y="${node.sy}" text-anchor="middle" dominant-baseline="central" fill="${strokeColor}" font-size="14">${node.icon}</text>`;
    }

    // Label below
    const labelY = node.sy + r + (mini ? 10 : 14);
    svg += `<text class="topo-label" x="${node.sx}" y="${labelY}" font-size="${mini ? 9 : 11}" font-weight="600" fill="#f0f6fc">${node.label}</text>`;

    // IP sublabel
    if (!mini) {
      svg += `<text class="topo-sublabel" x="${node.sx}" y="${labelY + 13}" font-size="9" fill="#8b949e">${node.ip}</text>`;
    }

    // Latency above
    if (node.lat != null && !mini) {
      svg += `<text class="topo-latency" x="${node.sx}" y="${node.sy - r - 6}" font-size="9" fill="#39d2c0">${node.lat.toFixed(1)}ms</text>`;
    }

    svg += "</g>";
  }

  svg += "</svg>";

  // Set HTML
  container.innerHTML = svg;

  // Add click handlers
  if (onNodeClick) {
    container.querySelectorAll(".topo-node").forEach((g) => {
      g.addEventListener("click", () => {
        const id = g.dataset.id;
        if (id) onNodeClick(id);
      });
    });
  }

  // Add tooltip support (full mode only)
  if (!mini) {
    setupTooltips(container, nodes);
  }
}

function setupTooltips(container, nodes) {
  // Create tooltip element
  let tooltip = container.querySelector(".topo-tooltip");
  if (!tooltip) {
    tooltip = document.createElement("div");
    tooltip.className = "topo-tooltip";
    container.style.position = "relative";
    container.appendChild(tooltip);
  }

  container.querySelectorAll(".topo-node").forEach((g) => {
    const id = g.dataset.id;
    const node = nodes.find((n) => n.id === id);
    if (!node) return;

    g.addEventListener("mouseenter", (e) => {
      // Build tooltip safely using textContent to prevent XSS
      tooltip.innerHTML = "";
      const title = document.createElement("div");
      title.className = "topo-tooltip-title";
      title.textContent = node.label;
      tooltip.appendChild(title);
      for (const [k, v] of [
        ["IP", node.ip],
        ["Role", node.role],
        ["Status", node.up ? "Online" : "Offline"],
      ]) {
        const row = document.createElement("div");
        row.className = "topo-tooltip-row";
        const key = document.createElement("span");
        key.className = "topo-tooltip-key";
        key.textContent = k;
        const val = document.createElement("span");
        val.className = "topo-tooltip-val";
        val.textContent = v;
        row.appendChild(key);
        row.appendChild(val);
        tooltip.appendChild(row);
      }
      if (node.lat != null) {
        const row = document.createElement("div");
        row.className = "topo-tooltip-row";
        const key = document.createElement("span");
        key.className = "topo-tooltip-key";
        key.textContent = "Latency";
        const val = document.createElement("span");
        val.className = "topo-tooltip-val";
        val.textContent = node.lat.toFixed(1) + "ms";
        row.appendChild(key);
        row.appendChild(val);
        tooltip.appendChild(row);
      }
      tooltip.classList.add("visible");
    });

    g.addEventListener("mousemove", (e) => {
      const rect = container.getBoundingClientRect();
      tooltip.style.left = e.clientX - rect.left + 12 + "px";
      tooltip.style.top = e.clientY - rect.top - 10 + "px";
    });

    g.addEventListener("mouseleave", () => {
      tooltip.classList.remove("visible");
    });
  });
}

/**
 * Render the topology legend.
 * @param {HTMLElement} container
 */
export function renderLegend(container) {
  container.innerHTML =
    '<div class="topo-legend">' +
    '<div class="topo-legend-item"><span class="topo-legend-dot up"></span> Online</div>' +
    '<div class="topo-legend-item"><span class="topo-legend-dot down"></span> Offline</div>' +
    '<div class="topo-legend-item"><span class="topo-legend-line wired"></span> Wired</div>' +
    '<div class="topo-legend-item"><span class="topo-legend-line wireless"></span> Wireless</div>' +
    '<div class="topo-legend-item"><span class="topo-legend-line api"></span> API</div>' +
    "</div>";
}

// Exported for tests
export { NODES, LINKS };
