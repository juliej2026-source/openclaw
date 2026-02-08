// Neural Graph page — interactive force-directed graph visualization
// Shows nodes colored by fitness, edges by weight, myelinated paths with glow,
// evolution timeline, maturation phase indicator, and approval queue.

import {
  card,
  cardGrid,
  badge,
  progressBar,
  dataTable,
  sectionTitle,
  errorBanner,
  emptyState,
} from "../components.js";

// ---- Constants ----

const FITNESS_COLORS = {
  high: "#3fb950", // green > 70
  medium: "#d29922", // yellow > 40
  low: "#f85149", // red <= 40
};

const EDGE_TYPE_COLORS = {
  data_flow: "#58a6ff",
  dependency: "#bc8cff",
  activation: "#39d2c0",
  fallback: "#f0883e",
  inhibition: "#f85149",
};

const NODE_TYPE_ICONS = {
  capability: "\u2B22", // hexagon
  station: "\u25C6", // diamond
  model: "\u25CF", // circle
  synthetic: "\u2605", // star
};

const PHASE_LABELS = {
  genesis: "Genesis",
  differentiation: "Differentiation",
  synaptogenesis: "Synaptogenesis",
  pruning: "Pruning",
  myelination: "Myelination",
};

const PHASE_PROGRESS = {
  genesis: 10,
  differentiation: 30,
  synaptogenesis: 55,
  pruning: 75,
  myelination: 95,
};

// ---- Data fetching ----

async function fetchTopology() {
  try {
    const resp = await fetch("/api/neural/topology");
    if (!resp.ok) return null;
    return resp.json();
  } catch {
    return null;
  }
}

async function fetchStatus() {
  try {
    const resp = await fetch("/api/neural/status");
    if (!resp.ok) return null;
    return resp.json();
  } catch {
    return null;
  }
}

async function fetchEvents() {
  try {
    const resp = await fetch("/api/neural/events");
    if (!resp.ok) return [];
    return resp.json();
  } catch {
    return [];
  }
}

async function fetchPending() {
  try {
    const resp = await fetch("/api/neural/pending");
    if (!resp.ok) return [];
    return resp.json();
  } catch {
    return [];
  }
}

// ---- Fitness color helper ----

function fitnessColor(score) {
  if (score > 70) return FITNESS_COLORS.high;
  if (score > 40) return FITNESS_COLORS.medium;
  return FITNESS_COLORS.low;
}

// ---- Force-directed layout (simple spring simulation) ----

function layoutNodes(nodes, edges, width, height) {
  // Initialize positions in a circle
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) * 0.35;
  const positions = {};

  nodes.forEach((n, i) => {
    const angle = (2 * Math.PI * i) / nodes.length;
    positions[n.nodeId] = {
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
      vx: 0,
      vy: 0,
    };
  });

  // Run simple force simulation (50 iterations)
  const k = Math.sqrt((width * height) / Math.max(nodes.length, 1));
  for (let iter = 0; iter < 50; iter++) {
    const temp = 1 - iter / 50;
    // Repulsive forces between all node pairs
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = positions[nodes[i].nodeId];
        const b = positions[nodes[j].nodeId];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
        const force = ((k * k) / dist) * temp * 0.5;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        a.vx += fx;
        a.vy += fy;
        b.vx -= fx;
        b.vy -= fy;
      }
    }
    // Attractive forces along edges
    for (const edge of edges) {
      const a = positions[edge.sourceNodeId];
      const b = positions[edge.targetNodeId];
      if (!a || !b) continue;
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
      const force = ((dist - k) / k) * edge.weight * temp;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      a.vx -= fx;
      a.vy -= fy;
      b.vx += fx;
      b.vy += fy;
    }
    // Apply velocities
    for (const node of nodes) {
      const p = positions[node.nodeId];
      p.x += p.vx * 0.3;
      p.y += p.vy * 0.3;
      p.vx *= 0.8;
      p.vy *= 0.8;
      // Keep within bounds
      p.x = Math.max(40, Math.min(width - 40, p.x));
      p.y = Math.max(40, Math.min(height - 40, p.y));
    }
  }

  return positions;
}

// ---- SVG rendering ----

function renderGraphSVG(nodes, edges, width, height) {
  const positions = layoutNodes(nodes, edges, width, height);
  const nodeRadius = 24;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" class="neural-graph-svg">`;

  // Defs for myelinated glow
  svg += `<defs>
    <filter id="myelin-glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="3" result="glow"/>
      <feMerge><feMergeNode in="glow"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>`;

  // Edges
  for (const edge of edges) {
    const from = positions[edge.sourceNodeId];
    const to = positions[edge.targetNodeId];
    if (!from || !to) continue;

    const color = EDGE_TYPE_COLORS[edge.edgeType] ?? "#484f58";
    const thickness = 1 + edge.weight * 3;
    const opacity = 0.4 + edge.weight * 0.6;
    const filter = edge.myelinated ? ' filter="url(#myelin-glow)"' : "";
    const dashArray = edge.edgeType === "fallback" ? ' stroke-dasharray="6,3"' : "";

    svg +=
      `<line x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" ` +
      `stroke="${color}" stroke-width="${thickness}" opacity="${opacity}"${filter}${dashArray}/>`;

    // Weight label at midpoint
    if (edge.weight > 0.3) {
      const mx = (from.x + to.x) / 2;
      const my = (from.y + to.y) / 2;
      svg += `<text x="${mx}" y="${my - 5}" fill="${color}" font-size="9" text-anchor="middle" opacity="0.7">${edge.weight.toFixed(2)}</text>`;
    }
  }

  // Nodes
  for (const node of nodes) {
    const p = positions[node.nodeId];
    if (!p) continue;
    const color = fitnessColor(node.fitnessScore);
    const icon = NODE_TYPE_ICONS[node.nodeType] ?? "\u25CF";
    const statusOpacity = node.status === "active" ? 1 : node.status === "degraded" ? 0.7 : 0.3;

    // Node circle
    svg += `<circle cx="${p.x}" cy="${p.y}" r="${nodeRadius}" fill="${color}" opacity="${statusOpacity * 0.2}" stroke="${color}" stroke-width="2"/>`;
    // Icon
    svg += `<text x="${p.x}" y="${p.y + 1}" fill="${color}" font-size="16" text-anchor="middle" dominant-baseline="central" opacity="${statusOpacity}">${icon}</text>`;
    // Label
    svg += `<text x="${p.x}" y="${p.y + nodeRadius + 14}" fill="var(--text)" font-size="10" text-anchor="middle">${node.name}</text>`;
    // Fitness score
    svg += `<text x="${p.x}" y="${p.y - nodeRadius - 4}" fill="${color}" font-size="9" text-anchor="middle">${node.fitnessScore.toFixed(0)}</text>`;
  }

  svg += "</svg>";
  return svg;
}

// ---- Phase indicator ----

function renderPhaseIndicator(phase) {
  const label = PHASE_LABELS[phase] ?? phase;
  const progress = PHASE_PROGRESS[phase] ?? 0;
  const el = document.createElement("div");
  el.className = "phase-indicator";
  const lbl = document.createElement("div");
  lbl.className = "phase-label";
  lbl.textContent = `${label} — ${progress}%`;
  el.appendChild(lbl);
  el.appendChild(progressBar(progress, 100, "cyan"));
  return el;
}

// ---- Status cards ----

function renderStatusCards(status) {
  if (!status) return errorBanner("Neural graph backend unreachable");

  const avgF = status.avgFitness;
  return cardGrid([
    card({
      label: "Phase",
      value: PHASE_LABELS[status.phase] ?? status.phase ?? "genesis",
      status: "info",
    }),
    card({ label: "Nodes", value: status.totalNodes ?? 0, status: "info" }),
    card({ label: "Edges", value: status.totalEdges ?? 0, status: "info" }),
    card({
      label: "Myelinated",
      value: status.myelinatedEdges ?? 0,
      status: status.myelinatedEdges > 0 ? "ok" : "info",
    }),
    card({ label: "Executions", value: status.totalExecutions ?? 0, status: "info" }),
    card({
      label: "Avg Fitness",
      value: avgF != null ? avgF.toFixed(1) : "--",
      status: avgF > 70 ? "ok" : avgF > 40 ? "warn" : "crit",
    }),
  ]);
}

// ---- Evolution timeline ----

const TYPE_BADGES = {
  node_created: "green",
  node_pruned: "red",
  edge_created: "green",
  edge_pruned: "orange",
  edge_weight_changed: "blue",
  edge_myelinated: "cyan",
  fitness_recalculated: "blue",
  phase_transition: "yellow",
  node_status_changed: "blue",
};

function renderEvolutionTimeline(events) {
  if (!events || events.length === 0) {
    return emptyState("No evolution events yet.");
  }

  const columns = [
    { key: "event", label: "Event" },
    { key: "target", label: "Target", mono: true },
    { key: "reason", label: "Reason" },
    { key: "triggeredBy", label: "Triggered By" },
    { key: "time", label: "Time", sortable: true },
  ];

  const rows = events.slice(0, 20).map((e) => ({
    event: badge(e.eventType.replace(/_/g, " "), TYPE_BADGES[e.eventType] ?? "blue"),
    target: e.targetId,
    reason: e.reason,
    triggeredBy: e.triggeredBy,
    time: new Date(e.createdAt).toLocaleString(),
  }));

  return dataTable({ columns, rows });
}

// ---- Approval queue ----

function renderApprovalQueue(pending) {
  if (!pending || pending.length === 0) {
    return emptyState("No pending approvals.");
  }

  const columns = [
    { key: "event", label: "Event" },
    { key: "target", label: "Target", mono: true },
    { key: "reason", label: "Reason" },
    { key: "actions", label: "Actions" },
  ];

  const rows = pending.map((p) => {
    const actions = document.createElement("span");
    const approveBtn = document.createElement("button");
    approveBtn.className = "btn btn-sm btn-ok";
    approveBtn.textContent = "Approve";
    approveBtn.dataset.approve = p._id;
    const rejectBtn = document.createElement("button");
    rejectBtn.className = "btn btn-sm btn-crit";
    rejectBtn.textContent = "Reject";
    rejectBtn.dataset.reject = p._id;
    actions.appendChild(approveBtn);
    actions.append(" ");
    actions.appendChild(rejectBtn);

    return {
      event: badge(p.eventType.replace(/_/g, " "), "yellow"),
      target: p.targetId,
      reason: p.reason,
      actions,
    };
  });

  return dataTable({ columns, rows });
}

// ---- Legend ----

function renderLegendEl() {
  const el = document.createElement("div");
  el.className = "graph-legend";

  const addSpan = (cls, text, color) => {
    const s = document.createElement("span");
    s.className = cls;
    s.textContent = text;
    if (color) s.style.color = color;
    el.appendChild(s);
    el.append(" ");
  };

  addSpan("legend-title", "Node types:");
  for (const [type, icon] of Object.entries(NODE_TYPE_ICONS)) {
    addSpan("legend-item", `${icon} ${type}`);
  }
  addSpan("legend-title", "Fitness:");
  addSpan("legend-item", "\u25CF >70", FITNESS_COLORS.high);
  addSpan("legend-item", "\u25CF >40", FITNESS_COLORS.medium);
  addSpan("legend-item", "\u25CF \u226440", FITNESS_COLORS.low);
  addSpan("legend-title", "Edges:");
  for (const [type, color] of Object.entries(EDGE_TYPE_COLORS)) {
    addSpan("legend-item", `\u2500 ${type.replace("_", " ")}`, color);
  }
  return el;
}

// ---- Main render ----

export async function render(container) {
  const [status, topology, events, pending] = await Promise.all([
    fetchStatus(),
    fetchTopology(),
    fetchEvents(),
    fetchPending(),
  ]);

  const frag = document.createDocumentFragment();

  // Status cards
  frag.appendChild(sectionTitle("Neural Graph Status"));
  frag.appendChild(renderStatusCards(status));

  // Phase indicator
  if (status) {
    frag.appendChild(sectionTitle("Maturation Phase"));
    frag.appendChild(renderPhaseIndicator(status.phase ?? "genesis"));
  }

  // Interactive graph
  frag.appendChild(sectionTitle("Graph Topology"));
  if (topology && topology.nodes && topology.nodes.length > 0) {
    const graphContainer = document.createElement("div");
    graphContainer.className = "graph-container";
    graphContainer.innerHTML = renderGraphSVG(topology.nodes, topology.edges, 780, 400);
    frag.appendChild(graphContainer);
    frag.appendChild(renderLegendEl());
  } else {
    frag.appendChild(emptyState("No graph data available. Convex may not be running."));
  }

  // Approval queue
  frag.appendChild(sectionTitle("Pending Approvals"));
  frag.appendChild(renderApprovalQueue(pending));

  // Evolution timeline
  frag.appendChild(sectionTitle("Evolution Timeline"));
  frag.appendChild(renderEvolutionTimeline(events));

  container.innerHTML = "";
  container.appendChild(frag);

  // Wire up approval buttons
  container.querySelectorAll("[data-approve]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const eventId = btn.dataset.approve;
      await fetch("/api/neural/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId }),
      });
      render(container);
    });
  });

  container.querySelectorAll("[data-reject]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const eventId = btn.dataset.reject;
      await fetch("/api/neural/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId }),
      });
      render(container);
    });
  });
}

export async function refresh(container) {
  await render(container);
}
