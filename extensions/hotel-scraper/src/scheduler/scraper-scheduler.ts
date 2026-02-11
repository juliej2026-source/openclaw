// ---------------------------------------------------------------------------
// Scraper scheduler — setInterval-based cron replacement
// Ported from hotel-calc-kelvin convex/crons.ts
// ---------------------------------------------------------------------------

import type { HotelSource, ScrapeParams, ScrapeResult } from "../types.js";
import { SCHEDULE, DEFAULT_SEARCH, type ScheduleEntry } from "../config.js";

export type SchedulerState = {
  running: boolean;
  startedAt: number | null;
  timers: Map<string, ReturnType<typeof setInterval>>;
  lastRun: Map<string, number>;
  runCount: Map<string, number>;
  errors: Map<string, string>;
};

type SchedulerCallbacks = {
  onScrape?: (source: HotelSource, params: ScrapeParams) => Promise<ScrapeResult>;
  onSystemTask?: (taskName: string) => Promise<void>;
  onError?: (taskName: string, error: Error) => void;
  onTick?: (taskName: string) => void;
};

const state: SchedulerState = {
  running: false,
  startedAt: null,
  timers: new Map(),
  lastRun: new Map(),
  runCount: new Map(),
  errors: new Map(),
};

function defaultParams(): ScrapeParams {
  const now = new Date();
  const checkIn = new Date(now.getTime() + DEFAULT_SEARCH.nightsAhead * 24 * 60 * 60 * 1000);
  const checkOut = new Date(checkIn.getTime() + DEFAULT_SEARCH.stayLength * 24 * 60 * 60 * 1000);

  return {
    checkIn: checkIn.toISOString().split("T")[0],
    checkOut: checkOut.toISOString().split("T")[0],
    guests: DEFAULT_SEARCH.guests,
  };
}

function createTask(entry: ScheduleEntry, callbacks: SchedulerCallbacks) {
  return async () => {
    callbacks.onTick?.(entry.name);

    try {
      if (entry.source === "system") {
        await callbacks.onSystemTask?.(entry.name);
      } else {
        const params = defaultParams();
        params.sources = [entry.source as HotelSource];
        await callbacks.onScrape?.(entry.source as HotelSource, params);
      }

      state.lastRun.set(entry.name, Date.now());
      state.runCount.set(entry.name, (state.runCount.get(entry.name) ?? 0) + 1);
      state.errors.delete(entry.name);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      state.errors.set(entry.name, error.message);
      callbacks.onError?.(entry.name, error);
    }
  };
}

export async function startScheduler(
  callbacks: SchedulerCallbacks = {},
): Promise<ReturnType<typeof setInterval>> {
  if (state.running) {
    throw new Error("Scheduler already running");
  }

  state.running = true;
  state.startedAt = Date.now();

  for (const entry of SCHEDULE) {
    if (!entry.enabled) continue;

    const task = createTask(entry, callbacks);

    // Stagger start: don't fire all at once
    const staggerMs = Math.random() * 30_000;
    setTimeout(() => {
      if (!state.running) return;
      task(); // Initial run
      const timer = setInterval(task, entry.intervalMs);
      state.timers.set(entry.name, timer);
    }, staggerMs);
  }

  // Return a heartbeat timer for compatibility with the plugin lifecycle
  const heartbeat = setInterval(() => {
    // Heartbeat — scheduler is alive
  }, 60_000);

  state.timers.set("_heartbeat", heartbeat);
  return heartbeat;
}

export function stopScheduler(timer?: ReturnType<typeof setInterval>): void {
  state.running = false;

  for (const t of state.timers.values()) {
    clearInterval(t);
  }
  state.timers.clear();

  if (timer) {
    clearInterval(timer);
  }
}

export function getSchedulerState(): SchedulerState {
  return {
    ...state,
    timers: new Map(state.timers),
    lastRun: new Map(state.lastRun),
    runCount: new Map(state.runCount),
    errors: new Map(state.errors),
  };
}

export function getSchedulerStatus() {
  const entries = SCHEDULE.map((entry) => ({
    name: entry.name,
    source: entry.source,
    enabled: entry.enabled,
    intervalMs: entry.intervalMs,
    description: entry.description,
    lastRun: state.lastRun.get(entry.name) ?? null,
    runCount: state.runCount.get(entry.name) ?? 0,
    lastError: state.errors.get(entry.name) ?? null,
    active: state.timers.has(entry.name),
  }));

  return {
    running: state.running,
    startedAt: state.startedAt,
    uptimeMs: state.startedAt ? Date.now() - state.startedAt : 0,
    activeTimers: state.timers.size,
    totalScheduled: SCHEDULE.length,
    enabledScheduled: SCHEDULE.filter((e) => e.enabled).length,
    entries,
  };
}

export function resetSchedulerState(): void {
  state.running = false;
  state.startedAt = null;
  state.timers.clear();
  state.lastRun.clear();
  state.runCount.clear();
  state.errors.clear();
}
