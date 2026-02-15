// SVG neural network topology renderer
// Renders station nodes and connections as an interactive SVG graph
// Supports Flow mode with animated data-flow particles

// Known stations with positions (hardcoded to match physical network)
const NODES = [
  {
    id: "UDM-Pro",
    label: "UDM Pro",
    ip: "10.1.8.1",
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
  { id: "Julie", label: "Julie", ip: "10.1.8.143", role: "ai", x: 150, y: 180, icon: "\u2605" },
  {
    id: "IOT-HUB",
    label: "IOT-HUB",
    ip: "10.1.8.158",
    role: "hub",
    x: 350,
    y: 180,
    icon: "\u2B22",
  },
  {
    id: "Caesar",
    label: "Caesar",
    ip: "10.1.8.82",
    role: "intel",
    x: 500,
    y: 180,
    icon: "\u25CF",
  },
  {
    id: "BRAVIA",
    label: "BRAVIA TV",
    ip: "10.1.8.194",
    role: "device",
    x: 550,
    y: 300,
    icon: "\u25A0",
  },
];

// Network connections
const LINKS = [
  { from: "UDM-Pro", to: "IOT-HUB", type: "wired" },
  { from: "UDM-Pro", to: "Julie", type: "wired" },
  { from: "UDM-Pro", to: "Caesar", type: "wired" },
  { from: "UDM-Pro", to: "BRAVIA", type: "wired" },
  { from: "HR02-5G", to: "IOT-HUB", type: "wireless" },
  { from: "Julie", to: "IOT-HUB", type: "api" },
  { from: "IOT-HUB", to: "Caesar", type: "api" },
  { from: "IOT-HUB", to: "BRAVIA", type: "api" },
];

const ROLE_COLORS = {
  gateway: "#58a6ff",
  modem: "#f0883e",
  ai: "#bc8cff",
  hub: "#39d2c0",
  worker: "#3fb950",
  intel: "#e3b341",
  device: "#8b949e",
  decommissioned: "#6e7681",
};

// Flow animation state (module-level)
let _animFrame = null;
let _particles = [];

function _stopAnimation() {
  if (_animFrame) {
    cancelAnimationFrame(_animFrame);
    _animFrame = null;
  }
  _particles = [];
}

/**
 * Render the topology SVG into a container.
 * @param {HTMLElement} container
 * @param {Object} opts
 * @param {Object} [opts.scanData] — from /api/network/scan
 * @param {Object} [opts.dualNet] — from network:path command
 * @param {boolean} [opts.mini] — mini mode (smaller, no legend)
 * @param {boolean} [opts.flow] — flow mode (animated particles, expanded)
 * @param {function} [opts.onNodeClick] — callback(nodeId)
 */
export function renderTopology(container, opts = {}) {
  const { scanData, dualNet, mini, flow, onNodeClick } = opts;

  _stopAnimation();

  const width = flow ? 1100 : mini ? 400 : 780;
  const height = flow ? 520 : mini ? 220 : 360;
  const scale = mini ? 0.5 : 1;
  const pad = flow ? 60 : mini ? 10 : 20;
  const nodeRadius = flow ? 34 : mini ? 16 : 24;

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
  const nodes = NODES.map((n) => {
    const sx = flow ? (n.x * (width - 2 * pad)) / 700 + pad : n.x * scale + pad;
    const sy = flow ? (n.y * (height - 2 * pad)) / 340 + pad : n.y * scale + (mini ? 20 : 40);
    return {
      ...n,
      sx,
      sy,
      up: reachable[n.ip] !== false, // default to up if no scan data
      lat: latency[n.ip],
    };
  });

  const nodeMap = {};
  for (const n of nodes) nodeMap[n.id] = n;

  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  const textFill = isDark ? "#f5f5fa" : "#1a1a2e";
  const dimFill = isDark ? "#8b8fa8" : "#6b7084";

  // Build SVG
  let svg = `<svg class="topology-svg" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`;

  // Defs: glow filters
  svg += `<defs>
    <filter id="glow-green" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="${flow ? 6 : 3}" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="glow-red" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="3" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>`;

  if (flow) {
    svg += `<filter id="link-glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>`;
    const gc = isDark ? "#4ade80" : "#22c55e";
    const bc = isDark ? "#60a5fa" : "#3b82f6";
    const pc = isDark ? "#c084fc" : "#a855f7";
    svg += `<linearGradient id="flow-grad-green" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="${gc}" stop-opacity="0"/><stop offset="50%" stop-color="${gc}" stop-opacity="0.6"/><stop offset="100%" stop-color="${gc}" stop-opacity="0"/></linearGradient>`;
    svg += `<linearGradient id="flow-grad-blue" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="${bc}" stop-opacity="0"/><stop offset="50%" stop-color="${bc}" stop-opacity="0.6"/><stop offset="100%" stop-color="${bc}" stop-opacity="0"/></linearGradient>`;
    svg += `<linearGradient id="flow-grad-purple" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="${pc}" stop-opacity="0"/><stop offset="50%" stop-color="${pc}" stop-opacity="0.6"/><stop offset="100%" stop-color="${pc}" stop-opacity="0"/></linearGradient>`;
  } else {
    svg += `<filter id="link-glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="2" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>`;
  }
  svg += `</defs>`;

  // Background grid in flow mode
  if (flow) {
    const gridColor = isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)";
    for (let gx = 0; gx <= width; gx += 40) {
      svg += `<line x1="${gx}" y1="0" x2="${gx}" y2="${height}" stroke="${gridColor}" stroke-width="1"/>`;
    }
    for (let gy = 0; gy <= height; gy += 40) {
      svg += `<line x1="0" y1="${gy}" x2="${width}" y2="${gy}" stroke="${gridColor}" stroke-width="1"/>`;
    }
  }

  // Render links
  for (const link of LINKS) {
    const from = nodeMap[link.from];
    const to = nodeMap[link.to];
    if (!from || !to) continue;

    const bothUp = from.up && to.up;

    // Glowing animated link background in flow mode
    if (flow && bothUp) {
      const gradId =
        link.type === "api"
          ? "flow-grad-purple"
          : link.type === "wireless"
            ? "flow-grad-blue"
            : "flow-grad-green";
      svg += `<line x1="${from.sx}" y1="${from.sy}" x2="${to.sx}" y2="${to.sy}" stroke="url(#${gradId})" stroke-width="6" opacity="0.4" filter="url(#link-glow)">`;
      svg += `<animate attributeName="opacity" values="0.2;0.5;0.2" dur="${(2 + Math.random()).toFixed(1)}s" repeatCount="indefinite"/>`;
      svg += `</line>`;
    }

    const color = bothUp
      ? isDark
        ? "rgba(74,222,128,0.35)"
        : "rgba(34,197,94,0.3)"
      : isDark
        ? "rgba(248,113,113,0.3)"
        : "rgba(239,68,68,0.2)";
    let dash = "";
    if (link.type === "wireless") dash = ' stroke-dasharray="8 5"';
    if (link.type === "api") dash = ' stroke-dasharray="3 5"';

    let strokeWidth = flow ? 2.5 : mini ? 1.5 : 2;
    let filter = "";
    if (link.from === "HR02-5G" && activeWan === "hr02_5g") {
      strokeWidth = flow ? 3.5 : mini ? 2.5 : 3.5;
      filter = ' filter="url(#link-glow)"';
    }

    svg += `<line x1="${from.sx}" y1="${from.sy}" x2="${to.sx}" y2="${to.sy}" stroke="${color}" stroke-width="${strokeWidth}"${dash}${filter}/>`;

    // Data throughput labels in flow mode
    if (flow && bothUp) {
      const mx = (from.sx + to.sx) / 2;
      const my = (from.sy + to.sy) / 2 - 8;
      const typeLabel = link.type === "wired" ? "1G" : link.type === "wireless" ? "5G" : "REST";
      svg += `<text x="${mx}" y="${my}" font-size="8" fill="${dimFill}" text-anchor="middle" font-weight="500" opacity="0.7">${typeLabel}</text>`;
    }
  }

  // Particle layers (flow mode)
  if (flow) {
    svg += `<g id="topo-trails"></g>`;
    svg += `<g id="topo-particles"></g>`;
  }

  // Render nodes
  for (const node of nodes) {
    const r = nodeRadius;
    const roleColor = ROLE_COLORS[node.role] || "#3fb950";
    const fillOpacity = node.up ? (flow ? 0.15 : 0.12) : 0.08;
    const strokeOpacity = node.up ? 0.8 : 0.4;
    const strokeColor = node.up ? roleColor : "#f85149";
    const glowFilter = node.up ? "url(#glow-green)" : "url(#glow-red)";
    const clickAttr = onNodeClick ? ` style="cursor:pointer"` : "";

    // Pulse rings
    if (node.up && node.role !== "decommissioned") {
      const ringCount = flow ? 2 : 1;
      for (let ri = 0; ri < ringCount; ri++) {
        const delay = ri * 1.5;
        svg += `<circle cx="${node.sx}" cy="${node.sy}" r="${r + 4}" fill="none" stroke="${roleColor}" stroke-width="${flow ? 1.5 : 1}" opacity="0.3">`;
        svg += `<animate attributeName="r" values="${r + 2};${r + (flow ? 18 : 10)};${r + 2}" dur="${flow ? "2.5" : "3"}s" begin="${delay}s" repeatCount="indefinite"/>`;
        svg += `<animate attributeName="opacity" values="0.35;0;0.35" dur="${flow ? "2.5" : "3"}s" begin="${delay}s" repeatCount="indefinite"/>`;
        svg += `</circle>`;
      }
    }

    svg += `<g class="topo-node ${node.up ? "up" : "down"}" data-id="${node.id}"${clickAttr} filter="${glowFilter}">`;
    svg += `<circle cx="${node.sx}" cy="${node.sy}" r="${r}" fill="${strokeColor}" fill-opacity="${fillOpacity}" stroke="${strokeColor}" stroke-width="${flow ? 2 : 1.5}" stroke-opacity="${strokeOpacity}"/>`;

    // Icon glyph
    if (!mini) {
      svg += `<text x="${node.sx}" y="${node.sy}" text-anchor="middle" dominant-baseline="central" fill="${strokeColor}" font-size="${flow ? 18 : 14}" font-weight="600">${node.icon}</text>`;
    }

    svg += `</g>`;

    // Label below
    const labelY = node.sy + r + (flow ? 20 : mini ? 10 : 14);
    svg += `<text class="topo-label" x="${node.sx}" y="${labelY}" font-size="${flow ? 13 : mini ? 9 : 11}" font-weight="600" fill="${textFill}">${node.label}</text>`;

    // IP sublabel
    if (!mini) {
      svg += `<text class="topo-sublabel" x="${node.sx}" y="${labelY + (flow ? 16 : 13)}" font-size="${flow ? 10 : 9}" fill="${dimFill}">${node.ip}</text>`;
    }

    // Status badge in flow mode
    if (flow) {
      const badgeY = labelY + 30;
      const status = node.up ? "ONLINE" : "OFFLINE";
      const badgeColor = node.up
        ? isDark
          ? "#4ade80"
          : "#22c55e"
        : isDark
          ? "#f87171"
          : "#ef4444";
      svg += `<rect x="${node.sx - 22}" y="${badgeY - 8}" width="44" height="16" rx="4" fill="${badgeColor}" fill-opacity="0.15"/>`;
      svg += `<text x="${node.sx}" y="${badgeY + 2}" font-size="7" font-weight="700" fill="${badgeColor}" text-anchor="middle" letter-spacing="0.5">${status}</text>`;
    }

    // Latency above
    if (node.lat != null && !mini) {
      svg += `<text class="topo-latency" x="${node.sx}" y="${node.sy - r - (flow ? 12 : 6)}" font-size="${flow ? 11 : 9}" fill="${isDark ? "#22d3ee" : "#06b6d4"}" font-weight="600">${node.lat.toFixed(flow ? 0 : 1)}ms</text>`;
    }
  }

  svg += "</svg>";

  // Set HTML
  container.innerHTML = svg;

  // Start particles in flow mode
  if (flow) {
    _initParticles(nodeMap);
  }

  // Add click handlers
  if (onNodeClick) {
    container.querySelectorAll(".topo-node").forEach((g) => {
      g.addEventListener("click", () => {
        const id = g.dataset.id;
        if (id) onNodeClick(id);
      });
    });
  }

  // Add tooltip support (full mode only, not in flow since we have badges)
  if (!mini && !flow) {
    setupTooltips(container, nodes);
  }

  // Return stats for the flow stats bar
  const onlineCount = nodes.filter((n) => n.up).length;
  const activeLinks = LINKS.filter((l) => {
    const a = nodeMap[l.from];
    const b = nodeMap[l.to];
    return a && b && a.up && b.up;
  }).length;

  return {
    onlineCount,
    totalNodes: nodes.length,
    activeLinks,
    totalLinks: LINKS.length,
    particleCount: _particles.length,
  };
}

function _initParticles(nodeMap) {
  _particles = [];

  for (const link of LINKS) {
    const f = nodeMap[link.from];
    const t = nodeMap[link.to];
    if (!f || !t || !f.up || !t.up) continue;

    const count = link.type === "api" ? 4 : 6;
    for (let i = 0; i < count; i++) {
      _particles.push({
        fx: f.sx,
        fy: f.sy,
        tx: t.sx,
        ty: t.sy,
        progress: i / count,
        speed: 0.002 + Math.random() * 0.003,
        size: link.type === "api" ? 4 : 4.5,
        type: link.type,
        trail: [],
      });
    }
  }

  // Update particle count display
  const pc = document.getElementById("particle-count");
  if (pc) pc.textContent = _particles.length;

  _animateParticles();
}

function _animateParticles() {
  const g = document.getElementById("topo-particles");
  if (!g) return;

  const trailG = document.getElementById("topo-trails");
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  let circles = "";
  let trails = "";

  for (const p of _particles) {
    p.progress += p.speed;
    if (p.progress > 1) p.progress -= 1;

    const x = p.fx + (p.tx - p.fx) * p.progress;
    const y = p.fy + (p.ty - p.fy) * p.progress;
    const alpha = Math.sin(p.progress * Math.PI);
    const color =
      p.type === "api"
        ? isDark
          ? "192,132,252"
          : "168,85,247"
        : p.type === "wireless"
          ? isDark
            ? "96,165,250"
            : "59,130,246"
          : isDark
            ? "74,222,128"
            : "34,197,94";

    // Outer glow
    circles += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${p.size * 2.5}" fill="rgba(${color},${(alpha * 0.12).toFixed(2)})"/>`;
    // Core particle
    circles += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${p.size}" fill="rgba(${color},${(alpha * 0.85).toFixed(2)})"/>`;

    // Trail
    if (p.trail) {
      p.trail.push({ x, y });
      if (p.trail.length > 8) p.trail.shift();
      if (p.trail.length >= 2) {
        for (let ti = 0; ti < p.trail.length - 1; ti++) {
          const ta = (ti / p.trail.length) * alpha * 0.3;
          const tw = (ti / p.trail.length) * p.size * 0.6;
          trails += `<circle cx="${p.trail[ti].x.toFixed(1)}" cy="${p.trail[ti].y.toFixed(1)}" r="${tw.toFixed(1)}" fill="rgba(${color},${ta.toFixed(2)})"/>`;
        }
      }
    }
  }

  if (trailG) trailG.innerHTML = trails;
  g.innerHTML = circles;

  _animFrame = requestAnimationFrame(_animateParticles);
}

function setupTooltips(container, nodes) {
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

/** Stop any running flow animation (call on page teardown). */
export function stopFlow() {
  _stopAnimation();
}

// Exported for tests
export { NODES, LINKS };
