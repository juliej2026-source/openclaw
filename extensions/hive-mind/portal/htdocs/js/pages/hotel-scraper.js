// Hotel scraper dashboard page — #/hotel-scraper
// Status cards, price table, job list, scrape trigger

import { apiGet, apiPost } from "../api.js";
import {
  card,
  cardGrid,
  badge,
  dataTable,
  sectionTitle,
  errorBanner,
  emptyState,
} from "../components.js";
import { timeAgo } from "../utils.js";

const API_BASE = "/api/hotel-scraper";

// ---- Data fetching ----

async function fetchStatus() {
  return apiGet(`${API_BASE}/status`);
}

async function fetchJobs() {
  return apiGet(`${API_BASE}/jobs?limit=20`);
}

async function fetchSchedule() {
  return apiGet(`${API_BASE}/schedule`);
}

async function fetchPrices(query) {
  const params = new URLSearchParams();
  if (query.checkIn) params.set("checkIn", query.checkIn);
  if (query.checkOut) params.set("checkOut", query.checkOut);
  if (query.area) params.set("area", query.area);
  return apiGet(`${API_BASE}/prices?${params}`);
}

// ---- Summary cards ----

function buildStatusCards(status) {
  const scheduler = status.scheduler || {};
  const uptimeMin = Math.floor((scheduler.uptimeMs || 0) / 60000);

  return cardGrid([
    card({ label: "Sources", value: (status.sources || []).length, status: "info" }),
    card({ label: "Areas", value: (status.areas || []).length, status: "info" }),
    card({
      label: "Scheduler",
      value: scheduler.running ? "Running" : "Stopped",
      sub: scheduler.running ? `${uptimeMin}m uptime` : "",
      status: scheduler.running ? "ok" : "warn",
    }),
    card({ label: "Active Timers", value: scheduler.activeTimers || 0, status: "ok" }),
    card({ label: "Jobs In Memory", value: status.jobsInMemory || 0, status: "info" }),
    card({
      label: "Playwright",
      value: status.playwrightService ? "Configured" : "Missing",
      sub: status.playwrightService || "",
      status: status.playwrightService ? "ok" : "crit",
    }),
  ]);
}

// ---- Job list ----

function buildJobTable(jobsData) {
  const jobs = jobsData.jobs || [];

  if (jobs.length === 0) {
    return emptyState("No scrape jobs recorded yet. Trigger a scrape to get started.");
  }

  return dataTable({
    columns: [
      { key: "id", label: "Job ID", mono: true },
      { key: "status", label: "Status" },
      { key: "sources", label: "Sources" },
      { key: "prices", label: "Prices" },
      { key: "duration", label: "Duration" },
      { key: "started", label: "Started", sortable: true, sortKey: "startedAt" },
    ],
    rows: jobs.map((j) => ({
      id: j.id,
      status: j.status,
      sources: j.resultCount || 0,
      prices: j.pricesFound || 0,
      duration: j.duration_ms ? `${(j.duration_ms / 1000).toFixed(1)}s` : "--",
      started: j.startedAt ? timeAgo(j.startedAt) : "--",
      startedAt: j.startedAt || 0,
      _statusBadge: true,
    })),
  });
}

// ---- Schedule table ----

function buildScheduleTable(schedData) {
  const entries = schedData.schedule || [];

  return dataTable({
    columns: [
      { key: "name", label: "Task" },
      { key: "source", label: "Source" },
      { key: "interval", label: "Interval" },
      { key: "enabled", label: "Enabled" },
    ],
    rows: entries.map((s) => ({
      name: s.name,
      source: s.source,
      interval: formatInterval(s.intervalMs),
      enabled: s.enabled ? "Yes" : "No",
    })),
  });
}

function formatInterval(ms) {
  if (ms >= 86400000) return `${ms / 86400000}d`;
  if (ms >= 3600000) return `${ms / 3600000}h`;
  if (ms >= 60000) return `${ms / 60000}m`;
  return `${ms / 1000}s`;
}

// ---- Scrape trigger ----

function buildScrapeForm(container) {
  const form = document.createElement("div");
  form.className = "scrape-form";

  const btn = document.createElement("button");
  btn.className = "btn btn-primary";
  btn.textContent = "Trigger Scrape";
  btn.addEventListener("click", async () => {
    btn.disabled = true;
    btn.textContent = "Starting...";
    try {
      const result = await apiPost(`${API_BASE}/scrape`, { guests: 2 });
      btn.textContent = `Started: ${result.jobId}`;
      setTimeout(() => {
        btn.disabled = false;
        btn.textContent = "Trigger Scrape";
        // Refresh the page to show the new job
        if (typeof container._refresh === "function") container._refresh();
      }, 3000);
    } catch (err) {
      btn.disabled = false;
      btn.textContent = "Trigger Scrape";
      console.error("[hotel-scraper] scrape trigger failed:", err);
    }
  });

  form.appendChild(btn);
  return form;
}

// ---- Source badges ----

function buildSourceBadges(sources) {
  const wrap = document.createElement("div");
  wrap.style.cssText = "display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px";

  const colors = {
    ratehawk: "blue",
    google_hotels: "green",
    nisade: "purple",
    playwright: "orange",
    roomboss: "cyan",
  };

  for (const src of sources || []) {
    wrap.appendChild(badge(src, colors[src] || "dim"));
  }

  return wrap;
}

// ---- Main render ----

async function load(container, query) {
  let status, jobsData, schedData;

  try {
    [status, jobsData, schedData] = await Promise.all([
      fetchStatus(),
      fetchJobs(),
      fetchSchedule(),
    ]);
  } catch (err) {
    container.innerHTML = "";
    container.appendChild(errorBanner("Failed to load hotel scraper data: " + err.message));
    return;
  }

  container.innerHTML = "";

  // Page title
  const title = document.createElement("div");
  title.className = "page-title";
  title.textContent = "Hotel Scraper";
  container.appendChild(title);

  // Source badges
  container.appendChild(buildSourceBadges(status.sources));

  // Status cards
  container.appendChild(buildStatusCards(status));

  // Scrape trigger
  container.appendChild(sectionTitle("Actions"));
  const formWrap = buildScrapeForm(container);
  container.appendChild(formWrap);

  // Jobs
  container.appendChild(sectionTitle("Recent Jobs"));
  container.appendChild(buildJobTable(jobsData));

  // Schedule
  container.appendChild(sectionTitle("Schedule"));
  container.appendChild(buildScheduleTable(schedData));

  // Store refresh handle for the scrape form
  container._refresh = () => load(container, query);
}

export async function render(container, query) {
  await load(container, query);
}

export async function refresh(container, query) {
  await load(container, query);
}
