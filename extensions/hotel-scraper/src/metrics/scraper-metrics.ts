// ---------------------------------------------------------------------------
// Prometheus metrics renderer for hotel-scraper
// Pattern: neural-graph/src/metrics/neural-metrics.ts
// ---------------------------------------------------------------------------

import { SCHEDULE, NISEKO_SEARCH_AREAS } from "../config.js";

export async function renderScraperMetrics(): Promise<string> {
  const lines: string[] = [];

  // -- Extension alive --
  lines.push("# HELP hotel_scraper_up Whether the hotel scraper extension is running");
  lines.push("# TYPE hotel_scraper_up gauge");
  lines.push("hotel_scraper_up 1");
  lines.push("");

  // -- Source count --
  lines.push("# HELP hotel_scraper_sources_total Number of configured scraper sources");
  lines.push("# TYPE hotel_scraper_sources_total gauge");
  lines.push("hotel_scraper_sources_total 5");
  lines.push("");

  // -- Areas --
  lines.push("# HELP hotel_scraper_areas_total Number of Niseko search areas");
  lines.push("# TYPE hotel_scraper_areas_total gauge");
  lines.push(`hotel_scraper_areas_total ${NISEKO_SEARCH_AREAS.length}`);
  lines.push("");

  // -- Scheduler status --
  try {
    const { getSchedulerStatus } = await import("../scheduler/scraper-scheduler.js");
    const status = getSchedulerStatus();

    lines.push("# HELP hotel_scraper_scheduler_running Whether the scheduler is active");
    lines.push("# TYPE hotel_scraper_scheduler_running gauge");
    lines.push(`hotel_scraper_scheduler_running ${status.running ? 1 : 0}`);
    lines.push("");

    lines.push("# HELP hotel_scraper_scheduler_uptime_seconds Scheduler uptime in seconds");
    lines.push("# TYPE hotel_scraper_scheduler_uptime_seconds gauge");
    lines.push(`hotel_scraper_scheduler_uptime_seconds ${Math.floor(status.uptimeMs / 1000)}`);
    lines.push("");

    lines.push("# HELP hotel_scraper_scheduler_active_timers Number of active schedule timers");
    lines.push("# TYPE hotel_scraper_scheduler_active_timers gauge");
    lines.push(`hotel_scraper_scheduler_active_timers ${status.activeTimers}`);
    lines.push("");

    lines.push("# HELP hotel_scraper_schedule_enabled Number of enabled schedule entries");
    lines.push("# TYPE hotel_scraper_schedule_enabled gauge");
    lines.push(`hotel_scraper_schedule_enabled ${status.enabledScheduled}`);
    lines.push("");

    // Per-entry run counts
    lines.push("# HELP hotel_scraper_task_runs_total Number of times each scheduled task has run");
    lines.push("# TYPE hotel_scraper_task_runs_total counter");
    for (const entry of status.entries) {
      lines.push(
        `hotel_scraper_task_runs_total{task="${entry.name}",source="${entry.source}"} ${entry.runCount}`,
      );
    }
    lines.push("");

    // Per-entry last run timestamp
    lines.push("# HELP hotel_scraper_task_last_run_timestamp Last run timestamp (epoch seconds)");
    lines.push("# TYPE hotel_scraper_task_last_run_timestamp gauge");
    for (const entry of status.entries) {
      const ts = entry.lastRun ? Math.floor(entry.lastRun / 1000) : 0;
      lines.push(`hotel_scraper_task_last_run_timestamp{task="${entry.name}"} ${ts}`);
    }
    lines.push("");

    // Per-entry errors
    lines.push("# HELP hotel_scraper_task_error Whether a task has a current error");
    lines.push("# TYPE hotel_scraper_task_error gauge");
    for (const entry of status.entries) {
      lines.push(`hotel_scraper_task_error{task="${entry.name}"} ${entry.lastError ? 1 : 0}`);
    }
    lines.push("");
  } catch {
    lines.push("# HELP hotel_scraper_scheduler_running Whether the scheduler is active");
    lines.push("# TYPE hotel_scraper_scheduler_running gauge");
    lines.push("hotel_scraper_scheduler_running 0");
    lines.push("");
  }

  // -- In-memory job store --
  try {
    const { jobs } = await import("../api-handlers.js");
    const jobArr = Array.from(jobs.values());

    lines.push("# HELP hotel_scraper_jobs_total Total jobs in memory");
    lines.push("# TYPE hotel_scraper_jobs_total gauge");
    lines.push(`hotel_scraper_jobs_total ${jobArr.length}`);
    lines.push("");

    lines.push("# HELP hotel_scraper_jobs_by_status Jobs count by status");
    lines.push("# TYPE hotel_scraper_jobs_by_status gauge");
    const statusCounts = new Map<string, number>();
    for (const j of jobArr) {
      statusCounts.set(j.status, (statusCounts.get(j.status) ?? 0) + 1);
    }
    for (const [st, count] of statusCounts) {
      lines.push(`hotel_scraper_jobs_by_status{status="${st}"} ${count}`);
    }
    if (statusCounts.size === 0) {
      lines.push('hotel_scraper_jobs_by_status{status="none"} 0');
    }
    lines.push("");

    // Total prices found across all completed jobs
    const totalPrices = jobArr
      .filter((j) => j.status === "completed")
      .reduce((sum, j) => sum + j.results.reduce((s, r) => s + r.pricesFound, 0), 0);

    lines.push("# HELP hotel_scraper_prices_found_total Total prices found across completed jobs");
    lines.push("# TYPE hotel_scraper_prices_found_total counter");
    lines.push(`hotel_scraper_prices_found_total ${totalPrices}`);
    lines.push("");
  } catch {
    lines.push("# HELP hotel_scraper_jobs_total Total jobs in memory");
    lines.push("# TYPE hotel_scraper_jobs_total gauge");
    lines.push("hotel_scraper_jobs_total 0");
    lines.push("");
  }

  // -- Playwright service health --
  lines.push(
    "# HELP hotel_scraper_playwright_reachable Whether the Playwright service is reachable",
  );
  lines.push("# TYPE hotel_scraper_playwright_reachable gauge");
  let pwHealthy = 0;
  try {
    const { PLAYWRIGHT_SERVICE_URL } = await import("../types.js");
    const resp = await fetch(`${PLAYWRIGHT_SERVICE_URL}/health`, {
      signal: AbortSignal.timeout(3000),
    });
    pwHealthy = resp.ok ? 1 : 0;
  } catch {
    // unreachable
  }
  lines.push(`hotel_scraper_playwright_reachable ${pwHealthy}`);
  lines.push("");

  // -- Schedule interval config (informational) --
  lines.push(
    "# HELP hotel_scraper_schedule_interval_seconds Configured interval for each schedule entry",
  );
  lines.push("# TYPE hotel_scraper_schedule_interval_seconds gauge");
  for (const entry of SCHEDULE) {
    lines.push(
      `hotel_scraper_schedule_interval_seconds{task="${entry.name}",source="${entry.source}",enabled="${entry.enabled}"} ${entry.intervalMs / 1000}`,
    );
  }
  lines.push("");

  return lines.join("\n") + "\n";
}
