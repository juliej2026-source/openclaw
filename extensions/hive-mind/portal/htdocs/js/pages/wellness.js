// Wellness Concierge page — EMWCP multi-agent wellness platform dashboard
// Shows status cards, force-directed agent topology, sessions table,
// CAPA findings, audit log, and escalation queue.

import {
  card,
  cardGrid,
  badge,
  dataTable,
  sectionTitle,
  errorBanner,
  emptyState,
} from "../components.js";

// ---- Constants ----

const AGENT_COLORS = {
  orchestrator_router: "#58a6ff",
  clinical_safety_escalation: "#f85149",
  data_steward_pdpa: "#bc8cff",
  daily_coach: "#3fb950",
  concierge_operator: "#f0883e",
  rag_knowledge: "#39d2c0",
  device_integration_optional: "#d29922",
  evaluation_capa: "#8b949e",
};

const AGENT_LABELS = {
  orchestrator_router: "Orchestrator",
  clinical_safety_escalation: "Clinical Safety",
  data_steward_pdpa: "Data Steward",
  daily_coach: "Daily Coach",
  concierge_operator: "Concierge",
  rag_knowledge: "RAG Knowledge",
  device_integration_optional: "Device Integration",
  evaluation_capa: "Evaluation CAPA",
};

// Graph topology edges (agent flow)
const TOPOLOGY_EDGES = [
  { source: "orchestrator_router", target: "daily_coach" },
  { source: "orchestrator_router", target: "clinical_safety_escalation" },
  { source: "orchestrator_router", target: "data_steward_pdpa" },
  { source: "orchestrator_router", target: "concierge_operator" },
  { source: "orchestrator_router", target: "rag_knowledge" },
  { source: "orchestrator_router", target: "device_integration_optional" },
  { source: "daily_coach", target: "evaluation_capa" },
  { source: "clinical_safety_escalation", target: "evaluation_capa" },
  { source: "data_steward_pdpa", target: "evaluation_capa" },
  { source: "concierge_operator", target: "evaluation_capa" },
  { source: "rag_knowledge", target: "evaluation_capa" },
  { source: "device_integration_optional", target: "evaluation_capa" },
];

// ---- Data fetching ----

async function fetchStatus() {
  try {
    const resp = await fetch("/api/wellness/status");
    if (!resp.ok) return null;
    return resp.json();
  } catch {
    return null;
  }
}

async function fetchSessions() {
  try {
    const resp = await fetch("/api/wellness/sessions");
    if (!resp.ok) return { sessions: [], total: 0 };
    return resp.json();
  } catch {
    return { sessions: [], total: 0 };
  }
}

async function fetchAgents() {
  try {
    const resp = await fetch("/api/wellness/agents");
    if (!resp.ok) return { agents: [] };
    return resp.json();
  } catch {
    return { agents: [] };
  }
}

async function fetchAudit() {
  try {
    const resp = await fetch("/api/wellness/audit?limit=20");
    if (!resp.ok) return { entries: [] };
    return resp.json();
  } catch {
    return { entries: [] };
  }
}

async function fetchCapa() {
  try {
    const resp = await fetch("/api/wellness/capa");
    if (!resp.ok) return { findings: [] };
    return resp.json();
  } catch {
    return { findings: [] };
  }
}

// ---- Force-directed SVG topology ----

function renderTopology(container, agents) {
  const width = container.clientWidth || 800;
  const height = 420;
  const nodeIds = Object.keys(AGENT_COLORS);
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) * 0.35;

  // Position nodes in a circle
  const nodePositions = {};
  nodeIds.forEach((id, i) => {
    const angle = (2 * Math.PI * i) / nodeIds.length - Math.PI / 2;
    nodePositions[id] = {
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    };
  });

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", height);
  svg.style.background = "#0d1117";
  svg.style.borderRadius = "8px";
  svg.style.border = "1px solid #30363d";

  // Defs for arrow markers and glow
  const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
  const marker = document.createElementNS("http://www.w3.org/2000/svg", "marker");
  marker.setAttribute("id", "arrow-wellness");
  marker.setAttribute("viewBox", "0 0 10 10");
  marker.setAttribute("refX", "28");
  marker.setAttribute("refY", "5");
  marker.setAttribute("markerWidth", "6");
  marker.setAttribute("markerHeight", "6");
  marker.setAttribute("orient", "auto-start-reverse");
  const arrowPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
  arrowPath.setAttribute("d", "M 0 0 L 10 5 L 0 10 z");
  arrowPath.setAttribute("fill", "#484f58");
  marker.appendChild(arrowPath);
  defs.appendChild(marker);

  // Glow filter
  const filter = document.createElementNS("http://www.w3.org/2000/svg", "filter");
  filter.setAttribute("id", "glow-wellness");
  const blur = document.createElementNS("http://www.w3.org/2000/svg", "feGaussianBlur");
  blur.setAttribute("stdDeviation", "3");
  blur.setAttribute("result", "blur");
  const merge = document.createElementNS("http://www.w3.org/2000/svg", "feMerge");
  const m1 = document.createElementNS("http://www.w3.org/2000/svg", "feMergeNode");
  m1.setAttribute("in", "blur");
  const m2 = document.createElementNS("http://www.w3.org/2000/svg", "feMergeNode");
  m2.setAttribute("in", "SourceGraphic");
  merge.appendChild(m1);
  merge.appendChild(m2);
  filter.appendChild(blur);
  filter.appendChild(merge);
  defs.appendChild(filter);
  svg.appendChild(defs);

  // Draw edges
  for (const edge of TOPOLOGY_EDGES) {
    const s = nodePositions[edge.source];
    const t = nodePositions[edge.target];
    if (!s || !t) continue;
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", s.x);
    line.setAttribute("y1", s.y);
    line.setAttribute("x2", t.x);
    line.setAttribute("y2", t.y);
    line.setAttribute("stroke", "#30363d");
    line.setAttribute("stroke-width", "1.5");
    line.setAttribute("marker-end", "url(#arrow-wellness)");
    svg.appendChild(line);
  }

  // Draw nodes
  for (const id of nodeIds) {
    const pos = nodePositions[id];
    const color = AGENT_COLORS[id];
    const label = AGENT_LABELS[id];

    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.setAttribute("transform", `translate(${pos.x},${pos.y})`);

    // Outer glow circle
    const glowCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    glowCircle.setAttribute("r", "20");
    glowCircle.setAttribute("fill", color);
    glowCircle.setAttribute("opacity", "0.15");
    glowCircle.setAttribute("filter", "url(#glow-wellness)");
    g.appendChild(glowCircle);

    // Node circle
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("r", "14");
    circle.setAttribute("fill", "#0d1117");
    circle.setAttribute("stroke", color);
    circle.setAttribute("stroke-width", "2.5");
    g.appendChild(circle);

    // Inner dot
    const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    dot.setAttribute("r", "4");
    dot.setAttribute("fill", color);
    g.appendChild(dot);

    // Label
    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("y", "28");
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("fill", "#c9d1d9");
    text.setAttribute("font-size", "10");
    text.setAttribute("font-family", "'JetBrains Mono', monospace");
    text.textContent = label;
    g.appendChild(text);

    svg.appendChild(g);
  }

  // Title
  const title = document.createElementNS("http://www.w3.org/2000/svg", "text");
  title.setAttribute("x", "12");
  title.setAttribute("y", "20");
  title.setAttribute("fill", "#8b949e");
  title.setAttribute("font-size", "11");
  title.setAttribute("font-family", "'JetBrains Mono', monospace");
  title.textContent = `Agent Topology \u2022 ${nodeIds.length} agents \u2022 ${TOPOLOGY_EDGES.length} edges`;
  svg.appendChild(title);

  container.appendChild(svg);
}

// ---- Render ----

let fullscreenContainer = null;

export async function render(app) {
  app.innerHTML = '<div class="loading">Loading wellness data\u2026</div>';

  const [status, sessionData, agentData, auditData, capaData] = await Promise.all([
    fetchStatus(),
    fetchSessions(),
    fetchAgents(),
    fetchAudit(),
    fetchCapa(),
  ]);

  app.innerHTML = "";

  if (!status) {
    app.appendChild(
      errorBanner("Failed to load wellness status. Is the wellness-concierge extension running?"),
    );
    return;
  }

  // ---- Status Cards ----
  const cards = cardGrid([
    card({
      label: "Active Sessions",
      value: status.activeSessions ?? 0,
      sub: `${status.totalQueries ?? 0} total queries`,
      status: "ok",
    }),
    card({
      label: "Total Queries",
      value: status.totalQueries ?? 0,
      sub: "processed",
      status: "info",
    }),
    card({
      label: "Agents",
      value: status.agents ?? 0,
      sub: "multi-agent graph",
      status: "ok",
    }),
    card({
      label: "Escalations",
      value: status.totalEscalations ?? 0,
      sub: "safety triggers",
      status: (status.totalEscalations ?? 0) > 0 ? "warn" : "ok",
    }),
    card({
      label: "Tools",
      value: status.tools ?? 0,
      sub: "registered tools",
      status: "info",
    }),
    card({
      label: "Errors",
      value: status.totalErrors ?? 0,
      status: (status.totalErrors ?? 0) > 0 ? "crit" : "ok",
    }),
  ]);
  app.appendChild(cards);

  // ---- Agent Topology SVG ----
  app.appendChild(sectionTitle("Agent Topology"));
  const topoSection = document.createElement("div");
  topoSection.style.position = "relative";
  topoSection.style.marginBottom = "1.5rem";

  const topoContainer = document.createElement("div");
  topoContainer.id = "wellness-topology";
  topoSection.appendChild(topoContainer);

  // Fullscreen button
  const fsBtn = document.createElement("button");
  fsBtn.textContent = "\u26F6 Full Screen";
  fsBtn.className = "btn btn-small";
  fsBtn.style.position = "absolute";
  fsBtn.style.top = "8px";
  fsBtn.style.right = "8px";
  fsBtn.style.zIndex = "10";
  fsBtn.addEventListener("click", () => {
    if (topoSection.requestFullscreen) topoSection.requestFullscreen();
  });
  topoSection.appendChild(fsBtn);

  app.appendChild(topoSection);
  renderTopology(topoContainer, agentData.agents);

  // ---- Active Sessions Table ----
  app.appendChild(sectionTitle("Active Sessions"));
  if (sessionData.sessions.length === 0) {
    app.appendChild(emptyState("No active sessions"));
  } else {
    app.appendChild(
      dataTable({
        columns: [
          { key: "sessionId", label: "Session ID", mono: true },
          { key: "userId", label: "User" },
          { key: "status", label: "Status" },
          { key: "intent", label: "Intent" },
          { key: "agent", label: "Agent" },
          { key: "createdAt", label: "Created" },
        ],
        rows: sessionData.sessions.map((s) => ({
          sessionId: s.sessionId?.slice(0, 16) ?? "--",
          userId: s.userId ?? "--",
          status: s.status ?? "--",
          intent: s.intent ?? "--",
          agent: s.agent ?? "--",
          createdAt: s.createdAt ? new Date(s.createdAt).toLocaleTimeString() : "--",
        })),
      }),
    );
  }

  // ---- CAPA Findings ----
  app.appendChild(sectionTitle("CAPA Findings"));
  if (capaData.findings.length === 0) {
    app.appendChild(emptyState("No CAPA findings"));
  } else {
    app.appendChild(
      dataTable({
        columns: [
          { key: "findingId", label: "Finding ID", mono: true },
          { key: "category", label: "Category" },
          { key: "severity", label: "Severity" },
          { key: "description", label: "Description" },
          { key: "resolved", label: "Resolved" },
        ],
        rows: capaData.findings.map((f) => ({
          findingId: f.findingId ?? "--",
          category: f.category ?? "--",
          severity: f.severity ?? "--",
          description: f.description ?? "--",
          resolved: f.resolved ? "Yes" : "No",
        })),
      }),
    );
  }

  // ---- Audit Log ----
  app.appendChild(sectionTitle("Recent Audit Log"));
  if (auditData.entries.length === 0) {
    app.appendChild(emptyState("No audit entries"));
  } else {
    app.appendChild(
      dataTable({
        columns: [
          { key: "timestamp", label: "Time" },
          { key: "toolId", label: "Tool", mono: true },
          { key: "agentId", label: "Agent" },
          { key: "result", label: "Result" },
          { key: "auditLevel", label: "Level" },
        ],
        rows: auditData.entries.map((e) => ({
          timestamp: e.timestamp ? new Date(e.timestamp).toLocaleTimeString() : "--",
          toolId: e.tool_id ?? "--",
          agentId: e.agent_id ?? "--",
          result: e.result ?? "--",
          auditLevel: e.audit_level ?? "--",
        })),
      }),
    );
  }
}

// ---- Refresh ----

export async function refresh(app) {
  // Re-render the full page on refresh
  await render(app);
}

// ---- Destroy ----

export function destroy() {
  fullscreenContainer = null;
}
