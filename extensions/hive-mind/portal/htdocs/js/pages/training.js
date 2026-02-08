// Training page — #/training
// Training jobs, adapters, and new-job form

import { sendCommand } from "../api.js";
import {
  card,
  cardGrid,
  badge,
  progressBar,
  sectionTitle,
  errorBanner,
  emptyState,
  esc,
} from "../components.js";
import { timeAgo } from "../utils.js";

// ---- Status badge colors ----

const STATUS_COLORS = {
  queued: "dim",
  preparing: "blue",
  training: "cyan",
  merging: "purple",
  completed: "green",
  failed: "red",
};

function statusBadge(status) {
  const color = STATUS_COLORS[status] || "dim";
  return badge(status, color);
}

// ---- Data fetching ----

async function loadData() {
  const [jobsRes, adaptersRes] = await Promise.allSettled([
    sendCommand("meta:train:jobs"),
    sendCommand("meta:train:adapters"),
  ]);

  return {
    jobs: jobsRes.status === "fulfilled" ? jobsRes.value : null,
    adapters: adaptersRes.status === "fulfilled" ? adaptersRes.value : null,
    jobsError: jobsRes.status === "rejected" ? jobsRes.reason : null,
    adaptersError: adaptersRes.status === "rejected" ? adaptersRes.reason : null,
  };
}

// ---- Summary cards ----

function buildSummaryCards(data) {
  const jobs = data.jobs?.jobs ?? [];
  const adapters = data.adapters?.adapters ?? [];
  const activeJobs = jobs.filter(
    (j) => j.status === "training" || j.status === "preparing" || j.status === "merging",
  );

  return cardGrid([
    card({ label: "Total Jobs", value: jobs.length }),
    card({
      label: "Active Jobs",
      value: activeJobs.length,
      status: activeJobs.length > 0 ? "ok" : "",
    }),
    card({ label: "Adapters", value: adapters.length }),
  ]);
}

// ---- Jobs table ----

function buildJobsTable(data) {
  const jobs = data.jobs?.jobs;

  if (!jobs || jobs.length === 0) {
    return emptyState("No training jobs found.");
  }

  const table = document.createElement("table");
  table.className = "data-table";

  // Header
  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  const headers = ["ID", "Base Model", "Method", "Status", "Progress", "Started"];
  for (const h of headers) {
    const th = document.createElement("th");
    th.textContent = h;
    headRow.appendChild(th);
  }
  thead.appendChild(headRow);
  table.appendChild(thead);

  // Body
  const tbody = document.createElement("tbody");
  for (const job of jobs) {
    const tr = document.createElement("tr");

    // ID
    const tdId = document.createElement("td");
    tdId.className = "mono";
    tdId.textContent = job.id ?? "--";
    tr.appendChild(tdId);

    // Base Model
    const tdModel = document.createElement("td");
    tdModel.className = "mono";
    tdModel.textContent = job.base_model ?? "--";
    tr.appendChild(tdModel);

    // Method
    const tdMethod = document.createElement("td");
    tdMethod.textContent = job.method ?? "--";
    tr.appendChild(tdMethod);

    // Status badge
    const tdStatus = document.createElement("td");
    tdStatus.appendChild(statusBadge(job.status ?? "queued"));
    tr.appendChild(tdStatus);

    // Progress bar
    const tdProgress = document.createElement("td");
    const pct = typeof job.progress === "number" ? job.progress : 0;
    const barColor =
      job.status === "failed" ? "red" : job.status === "completed" ? "green" : "cyan";
    tdProgress.appendChild(progressBar(pct, 100, barColor));
    tr.appendChild(tdProgress);

    // Started timestamp
    const tdStarted = document.createElement("td");
    tdStarted.textContent = job.started_at ? timeAgo(job.started_at) : "--";
    tr.appendChild(tdStarted);

    tbody.appendChild(tr);
  }
  table.appendChild(tbody);

  return table;
}

// ---- Adapters section ----

function buildAdapters(data) {
  const adapters = data.adapters?.adapters;

  if (!adapters || adapters.length === 0) {
    return emptyState("No adapters found.");
  }

  const grid = document.createElement("div");
  grid.className = "card-grid";

  for (const a of adapters) {
    const el = document.createElement("div");
    el.className = "card adapter-card";

    let inner = `<div class="card-label">${esc(a.name ?? "unnamed")}</div>`;
    const details = [];
    if (a.base_model) details.push(`<b>Base:</b> ${esc(a.base_model)}`);
    if (a.size) details.push(`<b>Size:</b> ${esc(a.size)}`);
    if (details.length > 0) {
      inner += `<div class="card-sub">${details.join(" &middot; ")}</div>`;
    }

    el.innerHTML = inner;
    grid.appendChild(el);
  }

  return grid;
}

// ---- New Job form (UI only, not functional) ----

function buildNewJobForm() {
  const section = document.createElement("details");
  section.className = "new-job-form";

  const summary = document.createElement("summary");
  summary.textContent = "New Job";
  section.appendChild(summary);

  const form = document.createElement("form");
  form.addEventListener("submit", (e) => e.preventDefault());

  // Base model dropdown
  const modelGroup = document.createElement("div");
  modelGroup.className = "form-group";
  const modelLabel = document.createElement("label");
  modelLabel.textContent = "Base Model";
  modelLabel.setAttribute("for", "train-base-model");
  const modelSelect = document.createElement("select");
  modelSelect.id = "train-base-model";
  modelSelect.name = "base_model";
  // Placeholder options (real list would come from API)
  for (const opt of [
    "-- Select model --",
    "llama3.2:3b",
    "llama3.1:8b",
    "mistral:7b",
    "gemma2:9b",
    "phi3:14b",
  ]) {
    const o = document.createElement("option");
    o.value = opt.startsWith("--") ? "" : opt;
    o.textContent = opt;
    if (opt.startsWith("--")) o.disabled = true;
    modelSelect.appendChild(o);
  }
  modelGroup.appendChild(modelLabel);
  modelGroup.appendChild(modelSelect);
  form.appendChild(modelGroup);

  // Method radio group
  const methodGroup = document.createElement("div");
  methodGroup.className = "form-group";
  const methodLabel = document.createElement("label");
  methodLabel.textContent = "Method";
  methodGroup.appendChild(methodLabel);

  for (const method of ["lora", "qlora", "full"]) {
    const radioWrap = document.createElement("label");
    radioWrap.className = "radio-label";
    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "method";
    radio.value = method;
    if (method === "lora") radio.checked = true;
    radioWrap.appendChild(radio);
    radioWrap.appendChild(document.createTextNode(" " + method));
    methodGroup.appendChild(radioWrap);
  }
  form.appendChild(methodGroup);

  // Submit button (disabled / placeholder)
  const btnGroup = document.createElement("div");
  btnGroup.className = "form-group";
  const btn = document.createElement("button");
  btn.type = "submit";
  btn.className = "btn btn-primary";
  btn.textContent = "Start Training";
  btn.disabled = true;
  btn.title = "Training submission not yet implemented";
  btnGroup.appendChild(btn);
  form.appendChild(btnGroup);

  section.appendChild(form);
  return section;
}

// ---- Page render ----

function buildPage(container, data) {
  container.innerHTML = "";

  // Page title
  container.appendChild(sectionTitle("Training"));

  // API availability errors
  const apiUnavailable = data.jobsError && data.adaptersError;
  if (apiUnavailable) {
    container.appendChild(
      errorBanner(
        "Training API not available. The meta:train commands may not be implemented yet.",
      ),
    );
  }

  // Summary cards
  container.appendChild(buildSummaryCards(data));

  // Jobs table
  container.appendChild(sectionTitle("Jobs"));
  if (data.jobsError) {
    container.appendChild(errorBanner("Could not load training jobs: " + data.jobsError.message));
  } else {
    container.appendChild(buildJobsTable(data));
  }

  // Adapters
  container.appendChild(sectionTitle("Adapters"));
  if (data.adaptersError) {
    container.appendChild(errorBanner("Could not load adapters: " + data.adaptersError.message));
  } else {
    container.appendChild(buildAdapters(data));
  }

  // New Job form
  container.appendChild(sectionTitle("Create"));
  container.appendChild(buildNewJobForm());
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
