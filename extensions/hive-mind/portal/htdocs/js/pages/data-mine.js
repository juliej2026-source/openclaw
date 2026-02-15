// Data Mine page — Deep data mining infrastructure dashboard
// Shows status cards, interactive analysis panel, recent results,
// active experiments, and anomaly feed.

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

const ENGINE_COLORS = {
  statistics: "#58a6ff",
  timeseries: "#3fb950",
  clustering: "#bc8cff",
  graph_analytics: "#f0883e",
  experiments: "#f85149",
};

const SOURCE_OPTIONS = [
  { value: "neural_graph", label: "Neural Graph" },
  { value: "hotel_scraper", label: "Hotel Scraper" },
  { value: "meta_engine", label: "Meta Engine" },
  { value: "network", label: "Network" },
];

const ENGINE_METHODS = {
  statistics: [
    "descriptiveStats",
    "correlationMatrix",
    "linearRegression",
    "polynomialRegression",
    "distributionTest",
  ],
  timeseries: [
    "trendDetection",
    "movingAverage",
    "seasonalityDecomposition",
    "changePointDetection",
    "forecast",
  ],
  clustering: ["kMeansClustering", "anomalyDetection", "pcaAnalysis", "elbowMethod"],
  graph_analytics: ["graphMetrics", "centralityAnalysis", "communityDetection", "pathAnalysis"],
  experiments: [],
};

// ---- Data fetching ----

async function fetchStatus() {
  try {
    const resp = await fetch("/api/data-mine/status");
    if (!resp.ok) return null;
    return resp.json();
  } catch {
    return null;
  }
}

async function fetchResults() {
  try {
    const resp = await fetch("/api/data-mine/results?limit=10");
    if (!resp.ok) return { results: [], total: 0 };
    return resp.json();
  } catch {
    return { results: [], total: 0 };
  }
}

async function fetchDatasets() {
  try {
    const resp = await fetch("/api/data-mine/datasets");
    if (!resp.ok) return { datasets: [], total: 0 };
    return resp.json();
  } catch {
    return { datasets: [], total: 0 };
  }
}

async function fetchExperiments() {
  try {
    const resp = await fetch("/api/data-mine/experiments");
    if (!resp.ok) return { experiments: [], total: 0 };
    return resp.json();
  } catch {
    return { experiments: [], total: 0 };
  }
}

async function fetchAnomalies() {
  try {
    const resp = await fetch("/api/data-mine/anomalies");
    if (!resp.ok) return null;
    return resp.json();
  } catch {
    return null;
  }
}

async function fetchGraph() {
  try {
    const resp = await fetch("/api/data-mine/graph");
    if (!resp.ok) return null;
    return resp.json();
  } catch {
    return null;
  }
}

async function runAnalysis(engine, source, method, params) {
  try {
    const resp = await fetch("/api/data-mine/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ engine, source, method, params }),
    });
    return resp.json();
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ---- Render helpers ----

function esc(s) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

function fmtDuration(ms) {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function fmtTime(ts) {
  if (!ts) return "--";
  try {
    return new Date(ts).toLocaleTimeString();
  } catch {
    return String(ts);
  }
}

function engineBadge(engine) {
  const color = ENGINE_COLORS[engine] ?? "#8b949e";
  const el = document.createElement("span");
  el.className = "badge";
  el.style.background = color + "22";
  el.style.color = color;
  el.style.border = `1px solid ${color}44`;
  el.style.padding = "2px 8px";
  el.style.borderRadius = "4px";
  el.style.fontSize = "11px";
  el.style.fontWeight = "600";
  el.textContent = engine;
  return el;
}

// ---- Analysis Panel ----

function renderAnalysisPanel(container) {
  const panel = document.createElement("div");
  panel.className = "section";
  panel.style.marginBottom = "24px";

  const header = sectionTitle("Run Analysis");
  panel.appendChild(header);

  const form = document.createElement("div");
  form.style.display = "grid";
  form.style.gridTemplateColumns = "1fr 1fr 1fr auto";
  form.style.gap = "12px";
  form.style.alignItems = "end";
  form.style.marginBottom = "16px";

  // Engine selector
  const engineGroup = document.createElement("div");
  engineGroup.innerHTML =
    '<label style="display:block;font-size:12px;color:#8b949e;margin-bottom:4px">Engine</label>';
  const engineSelect = document.createElement("select");
  engineSelect.className = "form-select";
  engineSelect.style.cssText =
    "width:100%;padding:8px;background:#161b22;color:#c9d1d9;border:1px solid #30363d;border-radius:6px;font-size:13px";
  for (const eng of Object.keys(ENGINE_METHODS)) {
    const opt = document.createElement("option");
    opt.value = eng;
    opt.textContent = eng.replace(/_/g, " ");
    engineSelect.appendChild(opt);
  }
  engineGroup.appendChild(engineSelect);
  form.appendChild(engineGroup);

  // Source selector
  const sourceGroup = document.createElement("div");
  sourceGroup.innerHTML =
    '<label style="display:block;font-size:12px;color:#8b949e;margin-bottom:4px">Data Source</label>';
  const sourceSelect = document.createElement("select");
  sourceSelect.className = "form-select";
  sourceSelect.style.cssText =
    "width:100%;padding:8px;background:#161b22;color:#c9d1d9;border:1px solid #30363d;border-radius:6px;font-size:13px";
  for (const src of SOURCE_OPTIONS) {
    const opt = document.createElement("option");
    opt.value = src.value;
    opt.textContent = src.label;
    sourceSelect.appendChild(opt);
  }
  sourceGroup.appendChild(sourceSelect);
  form.appendChild(sourceGroup);

  // Method selector
  const methodGroup = document.createElement("div");
  methodGroup.innerHTML =
    '<label style="display:block;font-size:12px;color:#8b949e;margin-bottom:4px">Method</label>';
  const methodSelect = document.createElement("select");
  methodSelect.className = "form-select";
  methodSelect.style.cssText =
    "width:100%;padding:8px;background:#161b22;color:#c9d1d9;border:1px solid #30363d;border-radius:6px;font-size:13px";
  form.appendChild(methodGroup);

  function updateMethods() {
    const engine = engineSelect.value;
    const methods = ENGINE_METHODS[engine] || [];
    methodSelect.innerHTML = "";
    for (const m of methods) {
      const opt = document.createElement("option");
      opt.value = m;
      opt.textContent = m.replace(/([A-Z])/g, " $1").trim();
      methodSelect.appendChild(opt);
    }
  }
  engineSelect.addEventListener("change", updateMethods);
  updateMethods();
  methodGroup.appendChild(methodSelect);

  // Run button
  const btnGroup = document.createElement("div");
  const runBtn = document.createElement("button");
  runBtn.textContent = "Run";
  runBtn.style.cssText =
    "padding:8px 20px;background:#238636;color:#fff;border:none;border-radius:6px;font-size:13px;font-weight:600;cursor:pointer";
  runBtn.addEventListener("mouseenter", () => (runBtn.style.background = "#2ea043"));
  runBtn.addEventListener("mouseleave", () => (runBtn.style.background = "#238636"));
  btnGroup.appendChild(runBtn);
  form.appendChild(btnGroup);

  panel.appendChild(form);

  // Result display area
  const resultArea = document.createElement("div");
  resultArea.style.cssText =
    "min-height:60px;background:#0d1117;border:1px solid #30363d;border-radius:8px;padding:16px;font-family:monospace;font-size:12px;color:#8b949e;overflow-x:auto;white-space:pre-wrap";
  resultArea.textContent = "Select an engine, source, and method, then click Run.";
  panel.appendChild(resultArea);

  runBtn.addEventListener("click", async () => {
    resultArea.textContent = "Running analysis...";
    resultArea.style.color = "#f0883e";
    runBtn.disabled = true;
    runBtn.textContent = "Running...";
    try {
      const result = await runAnalysis(
        engineSelect.value,
        sourceSelect.value,
        methodSelect.value,
        {},
      );
      if (result.success) {
        resultArea.style.color = "#3fb950";
        resultArea.textContent = JSON.stringify(result.result, null, 2);
      } else {
        resultArea.style.color = "#f85149";
        resultArea.textContent = `Error: ${result.error}`;
      }
    } catch (err) {
      resultArea.style.color = "#f85149";
      resultArea.textContent = `Error: ${err.message}`;
    } finally {
      runBtn.disabled = false;
      runBtn.textContent = "Run";
    }
  });

  container.appendChild(panel);
}

// ---- Graph Metrics Visualization ----

function renderGraphMetrics(container, graphData) {
  if (!graphData || !graphData.metrics) return;

  const section = document.createElement("div");
  section.className = "section";
  section.style.marginBottom = "24px";
  section.appendChild(sectionTitle("Graph Analytics"));

  const metrics = graphData.metrics;
  const grid = document.createElement("div");
  grid.style.cssText =
    "display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:12px;margin-bottom:16px";

  const items = [
    { label: "Nodes", value: metrics.nodeCount ?? "--" },
    { label: "Edges", value: metrics.edgeCount ?? "--" },
    { label: "Density", value: metrics.density != null ? metrics.density.toFixed(3) : "--" },
    { label: "Components", value: metrics.connectedComponents ?? "--" },
    {
      label: "Avg Clustering",
      value:
        metrics.avgClusteringCoefficient != null
          ? metrics.avgClusteringCoefficient.toFixed(3)
          : "--",
    },
    { label: "Diameter", value: metrics.diameter ?? "--" },
  ];

  for (const item of items) {
    const c = document.createElement("div");
    c.style.cssText =
      "background:#161b22;border:1px solid #30363d;border-radius:8px;padding:12px;text-align:center";
    c.innerHTML = `<div style="font-size:11px;color:#8b949e;margin-bottom:4px">${esc(item.label)}</div><div style="font-size:20px;font-weight:700;color:#c9d1d9">${esc(String(item.value))}</div>`;
    grid.appendChild(c);
  }
  section.appendChild(grid);

  // Centrality top nodes
  if (graphData.centrality) {
    const cent = graphData.centrality;
    if (cent.pageRank && cent.pageRank.length > 0) {
      const sub = document.createElement("div");
      sub.style.cssText = "font-size:12px;color:#8b949e;margin-bottom:8px";
      sub.textContent = "Top PageRank nodes:";
      section.appendChild(sub);

      const list = document.createElement("div");
      list.style.cssText = "display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px";
      const top5 = cent.pageRank.slice(0, 5);
      for (const node of top5) {
        const chip = document.createElement("span");
        chip.style.cssText =
          "background:#f0883e22;color:#f0883e;border:1px solid #f0883e44;padding:4px 10px;border-radius:4px;font-size:11px;font-weight:600";
        chip.textContent = `${node.nodeId}: ${node.score.toFixed(3)}`;
        list.appendChild(chip);
      }
      section.appendChild(list);
    }
  }

  container.appendChild(section);
}

// ---- Recent Results Table ----

function renderResultsTable(container, results) {
  const section = document.createElement("div");
  section.className = "section";
  section.style.marginBottom = "24px";
  section.appendChild(sectionTitle("Recent Analysis Results"));

  if (!results || results.length === 0) {
    section.appendChild(emptyState("No analysis results yet. Run an analysis above."));
    container.appendChild(section);
    return;
  }

  const rows = results.map((r) => ({
    id: r.id?.substring(0, 8) ?? "--",
    engine: r.engine,
    method: r.method,
    source: r.source,
    success: r.success ? "OK" : "FAIL",
    duration: fmtDuration(r.metadata?.durationMs ?? 0),
    points: r.metadata?.dataPointCount ?? "--",
    time: fmtTime(r.metadata?.timestamp),
  }));

  const table = dataTable({
    columns: [
      { key: "id", label: "ID", mono: true },
      { key: "engine", label: "Engine", sortable: true },
      { key: "method", label: "Method", sortable: true },
      { key: "source", label: "Source", sortable: true },
      { key: "success", label: "Status" },
      { key: "duration", label: "Duration", sortable: true },
      { key: "points", label: "Points" },
      { key: "time", label: "Time" },
    ],
    rows,
  });

  section.appendChild(table);
  container.appendChild(section);
}

// ---- Experiments Panel ----

function renderExperiments(container, experiments) {
  const section = document.createElement("div");
  section.className = "section";
  section.style.marginBottom = "24px";
  section.appendChild(sectionTitle("Active Experiments"));

  if (!experiments || experiments.length === 0) {
    section.appendChild(emptyState("No experiments created yet."));
    container.appendChild(section);
    return;
  }

  const rows = experiments.map((e) => ({
    name: e.name,
    groups: e.groups?.join(", ") ?? "--",
    metric: e.metric ?? "--",
    status: e.status ?? "running",
    created: fmtTime(e.createdAt),
  }));

  const table = dataTable({
    columns: [
      { key: "name", label: "Name", sortable: true },
      { key: "groups", label: "Groups" },
      { key: "metric", label: "Metric" },
      { key: "status", label: "Status" },
      { key: "created", label: "Created" },
    ],
    rows,
  });

  section.appendChild(table);
  container.appendChild(section);
}

// ---- Anomaly Feed ----

function renderAnomalyFeed(container, anomalyData) {
  const section = document.createElement("div");
  section.className = "section";
  section.style.marginBottom = "24px";
  section.appendChild(sectionTitle("Anomaly Detection"));

  if (!anomalyData || !anomalyData.anomalies || anomalyData.anomalies.length === 0) {
    section.appendChild(emptyState("No anomalies detected."));
    container.appendChild(section);
    return;
  }

  const list = document.createElement("div");
  list.style.cssText = "display:flex;flex-direction:column;gap:8px";

  for (const a of anomalyData.anomalies.slice(0, 10)) {
    const item = document.createElement("div");
    item.style.cssText =
      "background:#161b22;border:1px solid #f8514933;border-radius:8px;padding:12px;display:flex;justify-content:space-between;align-items:center";
    const left = document.createElement("div");
    left.innerHTML = `<span style="color:#f85149;font-weight:600;font-size:13px">Anomaly</span> <span style="color:#8b949e;font-size:12px">index ${a.index ?? "--"}</span>`;
    const right = document.createElement("div");
    right.style.cssText = "font-family:monospace;font-size:13px;color:#c9d1d9";
    right.textContent = `value: ${a.value?.toFixed(2) ?? "--"}, score: ${a.score?.toFixed(3) ?? "--"}`;
    item.appendChild(left);
    item.appendChild(right);
    list.appendChild(item);
  }

  section.appendChild(list);
  container.appendChild(section);
}

// ---- Datasets Panel ----

function renderDatasets(container, datasets) {
  const section = document.createElement("div");
  section.className = "section";
  section.style.marginBottom = "24px";
  section.appendChild(sectionTitle("Available Datasets"));

  if (!datasets || datasets.length === 0) {
    section.appendChild(emptyState("No datasets available."));
    container.appendChild(section);
    return;
  }

  const rows = datasets.map((d) => ({
    name: d.name,
    source: d.source,
    points: d.pointCount ?? "--",
    updated: fmtTime(d.lastUpdated),
  }));

  const table = dataTable({
    columns: [
      { key: "name", label: "Name", sortable: true },
      { key: "source", label: "Source", sortable: true },
      { key: "points", label: "Data Points", sortable: true },
      { key: "updated", label: "Last Updated" },
    ],
    rows,
  });

  section.appendChild(table);
  container.appendChild(section);
}

// ---- Main Render ----

export async function render(app) {
  app.innerHTML = '<div class="loading">Loading data mine\u2026</div>';

  const [status, resultData, datasetData, experimentData, anomalyData, graphData] =
    await Promise.all([
      fetchStatus(),
      fetchResults(),
      fetchDatasets(),
      fetchExperiments(),
      fetchAnomalies(),
      fetchGraph(),
    ]);

  app.innerHTML = "";

  if (!status) {
    app.appendChild(
      errorBanner("Failed to load data mine status. Is the data-mine extension running?"),
    );
    return;
  }

  // ---- Status Cards ----
  const cards = cardGrid([
    card({
      label: "Total Analyses",
      value: status.totalAnalyses ?? 0,
      sub: `${status.engines} engines available`,
      status: "ok",
    }),
    card({
      label: "Data Sources",
      value: status.dataSources ?? 0,
      sub: `${datasetData?.total ?? 0} datasets loaded`,
      status: "info",
    }),
    card({
      label: "Experiments",
      value: experimentData?.total ?? 0,
      sub: "A/B testing",
      status: experimentData?.total > 0 ? "ok" : "",
    }),
    card({
      label: "Anomalies",
      value: anomalyData?.anomalies?.length ?? 0,
      sub: "detected",
      status: anomalyData?.anomalies?.length > 0 ? "warn" : "ok",
    }),
    card({
      label: "Avg Duration",
      value: fmtDuration(status.avgDurationMs ?? 0),
      sub: "per analysis",
    }),
    card({
      label: "Cached Results",
      value: status.cachedResults ?? 0,
      sub: "in memory",
      status: "info",
    }),
  ]);
  app.appendChild(cards);

  // ---- Interactive Analysis Panel ----
  renderAnalysisPanel(app);

  // ---- Graph Analytics ----
  renderGraphMetrics(app, graphData);

  // ---- Recent Results ----
  renderResultsTable(app, resultData?.results ?? []);

  // ---- Datasets ----
  renderDatasets(app, datasetData?.datasets ?? []);

  // ---- Experiments ----
  renderExperiments(app, experimentData?.experiments ?? []);

  // ---- Anomaly Feed ----
  renderAnomalyFeed(app, anomalyData);
}

// ---- Refresh ----

export async function refresh(app) {
  await render(app);
}

// ---- Destroy ----

export function destroy() {
  // No cleanup needed
}
