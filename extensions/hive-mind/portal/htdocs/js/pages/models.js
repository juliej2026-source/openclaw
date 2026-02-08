// AI Performance page — #/models
// Fleet summary, performance matrix, and model cards

import { sendCommand, fetchMetrics } from "../api.js";
import {
  card,
  cardGrid,
  badge,
  progressBar,
  dataTable,
  statusDot,
  sectionTitle,
  errorBanner,
  esc,
} from "../components.js";
import { parsePrometheus, getScalar, getAll } from "../prometheus.js";
import { fmtPercent, pctColor } from "../utils.js";

// ---- Data fetching ----

async function loadData() {
  const [statusRes, modelsRes, metricsText] = await Promise.allSettled([
    sendCommand("meta:status"),
    sendCommand("meta:models"),
    fetchMetrics(),
  ]);

  const status = statusRes.status === "fulfilled" ? statusRes.value : null;
  const models = modelsRes.status === "fulfilled" ? modelsRes.value : null;
  const metrics = metricsText.status === "fulfilled" ? parsePrometheus(metricsText.value) : {};

  return { status, models, metrics };
}

// ---- Summary cards ----

function buildSummaryCards(status, models, metrics) {
  const installed =
    models?.installed_count ??
    status?.models?.installed_count ??
    getScalar(metrics, "hivemind_model_installed_count") ??
    0;

  const running =
    models?.running_count ??
    status?.models?.running_count ??
    getScalar(metrics, "hivemind_model_running_count") ??
    0;

  const perfRecords = getScalar(metrics, "hivemind_perf_total_records") ?? 0;
  const execTotal = getScalar(metrics, "hivemind_exec_total") ?? 0;
  const execSuccessRate = getScalar(metrics, "hivemind_exec_success_rate");

  return cardGrid([
    card({ label: "Installed", value: installed, status: installed > 0 ? "ok" : "" }),
    card({ label: "Running", value: running, status: running > 0 ? "ok" : "warn" }),
    card({ label: "Perf Records", value: perfRecords }),
    card({ label: "Exec Total", value: execTotal }),
    card({
      label: "Exec Success Rate",
      value: execSuccessRate != null ? fmtPercent(execSuccessRate) : "--",
      status:
        execSuccessRate != null
          ? execSuccessRate >= 0.95
            ? "ok"
            : execSuccessRate >= 0.8
              ? "warn"
              : "crit"
          : "",
    }),
  ]);
}

// ---- Performance matrix ----

function buildPerfMatrix(metrics) {
  const successEntries = getAll(metrics, "hivemind_perf_success_rate");
  const latencyEntries = getAll(metrics, "hivemind_perf_avg_latency_ms");

  if (successEntries.length === 0 && latencyEntries.length === 0) {
    return null;
  }

  // Build a map keyed by "model_id|task_type"
  const map = {};
  for (const entry of successEntries) {
    const key = entry.labels.model_id + "|" + entry.labels.task_type;
    if (!map[key]) map[key] = { model: entry.labels.model_id, task: entry.labels.task_type };
    map[key].successRate = entry.value;
  }
  for (const entry of latencyEntries) {
    const key = entry.labels.model_id + "|" + entry.labels.task_type;
    if (!map[key]) map[key] = { model: entry.labels.model_id, task: entry.labels.task_type };
    map[key].avgLatency = entry.value;
  }

  // Convert to row objects with display elements
  const rows = Object.values(map).map((r) => {
    const pct = r.successRate != null ? r.successRate * 100 : null;
    const color = pct != null ? pctColor(pct) : "dim";

    // Build a wrapper that contains the bar and the label
    const successCell = document.createElement("span");
    successCell.className = "perf-success-cell";
    if (pct != null) {
      const bar = progressBar(pct, 100, color);
      const label = document.createElement("span");
      label.className = "perf-pct-label";
      label.textContent = fmtPercent(r.successRate);
      successCell.appendChild(bar);
      successCell.appendChild(label);
    } else {
      successCell.textContent = "--";
    }

    return {
      model: r.model,
      task: r.task,
      runs: "--", // no per-pair run count metric currently
      _successSort: pct ?? -1,
      success: successCell,
      avgLatency: r.avgLatency != null ? r.avgLatency.toFixed(1) + " ms" : "--",
      _latencySort: r.avgLatency ?? Infinity,
    };
  });

  return dataTable({
    columns: [
      { key: "model", label: "Model", sortable: true, mono: true },
      { key: "task", label: "Task Type", sortable: true },
      { key: "runs", label: "Runs", sortable: false },
      { key: "success", label: "Success%", sortable: true, sortKey: "_successSort" },
      { key: "avgLatency", label: "Avg Latency", sortable: true, sortKey: "_latencySort" },
    ],
    rows,
  });
}

// ---- Model cards ----

function buildModelCards(status, models) {
  const installed = models?.installed ?? status?.models?.installed ?? [];
  const running = models?.running ?? status?.models?.running ?? [];

  if (installed.length === 0) return null;

  // Build a set of running model names for quick lookup
  const runningSet = new Set(running.map((r) => r.name || r.model));

  const container = document.createElement("div");
  container.className = "card-grid model-cards";

  for (const m of installed) {
    const isRunning = runningSet.has(m.id) || running.some((r) => r.model === m.id);
    const el = document.createElement("div");
    el.className = "card model-card";

    let inner = "";
    inner += `<div class="model-card-header">`;
    inner += `<span class="model-card-id">${esc(m.id)}</span>`;
    inner += `</div>`;

    const details = [];
    if (m.family) details.push(`<span class="model-detail"><b>Family:</b> ${esc(m.family)}</span>`);
    if (m.parameter_size)
      details.push(`<span class="model-detail"><b>Params:</b> ${esc(m.parameter_size)}</span>`);
    if (m.quantization_level)
      details.push(`<span class="model-detail"><b>Quant:</b> ${esc(m.quantization_level)}</span>`);

    if (details.length > 0) {
      inner += `<div class="model-card-details">${details.join(" ")}</div>`;
    }

    // Capabilities (if present)
    if (m.capabilities && m.capabilities.length > 0) {
      inner += `<div class="model-card-caps">`;
      for (const cap of m.capabilities) {
        inner += `<span class="badge badge-dim">${esc(cap)}</span> `;
      }
      inner += `</div>`;
    }

    el.innerHTML = inner;

    // Append running status dot via DOM
    const header = el.querySelector(".model-card-header");
    header.appendChild(statusDot(isRunning));

    container.appendChild(el);
  }

  return container;
}

// ---- Page render ----

function buildPage(container, data) {
  const { status, models, metrics } = data;
  container.innerHTML = "";

  // Page title
  container.appendChild(sectionTitle("AI Performance"));

  // Errors
  if (!status && !models) {
    container.appendChild(
      errorBanner("Unable to reach model API. Check that meta-engine is running."),
    );
  }

  // Summary cards
  container.appendChild(buildSummaryCards(status, models, metrics));

  // Performance matrix
  const perfSection = buildPerfMatrix(metrics);
  if (perfSection) {
    container.appendChild(sectionTitle("Performance Matrix"));
    container.appendChild(perfSection);
  }

  // Model cards
  const modelSection = buildModelCards(status, models);
  if (modelSection) {
    container.appendChild(sectionTitle("Models"));
    container.appendChild(modelSection);
  }
}

// ---- Exports (page module interface) ----

export async function render(container, query) {
  const data = await loadData();
  buildPage(container, data);
}

export async function refresh(container, query) {
  const data = await loadData();
  buildPage(container, data);
}
