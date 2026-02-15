// ---------------------------------------------------------------------------
// Analysis Scheduler — Periodic analysis job scheduling
// ---------------------------------------------------------------------------

import type { AnalysisRequest } from "../types.js";
import { runAnalysis } from "./pipeline.js";

export interface ScheduledJob {
  id: string;
  name: string;
  request: AnalysisRequest;
  intervalMs: number;
  lastRun?: string;
  enabled: boolean;
}

const DEFAULT_JOBS: ScheduledJob[] = [
  {
    id: "neural-health",
    name: "Neural Graph Health Check",
    request: {
      engine: "statistics",
      source: "neural_graph",
      method: "descriptiveStats",
      params: {},
    },
    intervalMs: 3_600_000, // 1 hour
    enabled: true,
  },
  {
    id: "hotel-trends",
    name: "Hotel Price Trends",
    request: {
      engine: "timeseries",
      source: "hotel_scraper",
      method: "trendDetection",
      params: {},
    },
    intervalMs: 3_600_000,
    enabled: true,
  },
  {
    id: "model-performance",
    name: "Model Performance Summary",
    request: {
      engine: "statistics",
      source: "meta_engine",
      method: "descriptiveStats",
      params: {},
    },
    intervalMs: 3_600_000,
    enabled: true,
  },
  {
    id: "anomaly-scan",
    name: "Anomaly Scan",
    request: {
      engine: "clustering",
      source: "neural_graph",
      method: "anomalyDetection",
      params: { method: "zscore", threshold: 2.5 },
    },
    intervalMs: 3_600_000,
    enabled: true,
  },
];

const timers = new Map<string, ReturnType<typeof setInterval>>();
const jobs = new Map<string, ScheduledJob>();

// Initialize with defaults
for (const job of DEFAULT_JOBS) {
  jobs.set(job.id, { ...job });
}

export function startScheduler(): void {
  for (const [id, job] of jobs) {
    if (!job.enabled) continue;
    if (timers.has(id)) continue;

    const timer = setInterval(async () => {
      try {
        await runAnalysis(job.request);
        job.lastRun = new Date().toISOString();
      } catch {
        // Log error silently
      }
    }, job.intervalMs);

    timers.set(id, timer);
  }
}

export function stopScheduler(): void {
  for (const [id, timer] of timers) {
    clearInterval(timer);
  }
  timers.clear();
}

export function getScheduledJobs(): ScheduledJob[] {
  return [...jobs.values()];
}
