// ---------------------------------------------------------------------------
// HTTP API handlers for /api/hotel-scraper/* routes
// ---------------------------------------------------------------------------

import type {
  HotelSource,
  ScrapeJobStatus,
  ScraperStrategy,
  ScrapeParams,
  ScrapeResult,
  ScrapeJob,
} from "./types.js";
import { SCHEDULE, NISEKO_SEARCH_AREAS, DEFAULT_SEARCH } from "./config.js";
import { PLAYWRIGHT_SERVICE_URL } from "./types.js";

// In-memory job store (Phase 2 Convex persistence is available for long-term storage)
const jobs = new Map<string, ScrapeJob>();
let jobSeq = 0;

function nextJobId(): string {
  return `job-${++jobSeq}-${Date.now()}`;
}

function defaultParams(overrides: {
  checkIn?: string;
  checkOut?: string;
  guests?: number;
}): ScrapeParams {
  const now = new Date();
  const checkIn =
    overrides.checkIn ??
    new Date(now.getTime() + DEFAULT_SEARCH.nightsAhead * 86_400_000).toISOString().split("T")[0];
  const checkOut =
    overrides.checkOut ??
    new Date(new Date(checkIn).getTime() + DEFAULT_SEARCH.stayLength * 86_400_000)
      .toISOString()
      .split("T")[0];
  return {
    checkIn,
    checkOut,
    guests: overrides.guests ?? DEFAULT_SEARCH.guests,
  };
}

export async function handleStatus(): Promise<Record<string, unknown>> {
  const { getSchedulerStatus } = await import("./scheduler/scraper-scheduler.js");
  const scheduler = getSchedulerStatus();

  return {
    extension: "hotel-scraper",
    version: "2026.2.8",
    sources: ["ratehawk", "google_hotels", "nisade", "playwright", "roomboss"],
    areas: NISEKO_SEARCH_AREAS.map((a) => a.name),
    scheduler: {
      running: scheduler.running,
      uptimeMs: scheduler.uptimeMs,
      activeTimers: scheduler.activeTimers,
      enabledScheduled: scheduler.enabledScheduled,
    },
    playwrightService: PLAYWRIGHT_SERVICE_URL,
    jobsInMemory: jobs.size,
  };
}

export async function handleHealth(): Promise<Record<string, unknown>> {
  let playwrightHealthy = false;
  try {
    const resp = await fetch(`${PLAYWRIGHT_SERVICE_URL}/health`, {
      signal: AbortSignal.timeout(5000),
    });
    playwrightHealthy = resp.ok;
  } catch {
    // unreachable
  }

  return {
    healthy: true,
    playwright_service: playwrightHealthy,
    playwright_url: PLAYWRIGHT_SERVICE_URL,
  };
}

export async function handlePrices(opts: {
  checkIn?: string;
  checkOut?: string;
  guests?: number;
  area?: string;
}): Promise<Record<string, unknown>> {
  // Collect all completed job results for matching dates
  const params = defaultParams(opts);
  const matching: ScrapeResult[] = [];

  for (const job of jobs.values()) {
    if (job.status !== "completed") continue;
    if (job.params.checkIn === params.checkIn && job.params.checkOut === params.checkOut) {
      matching.push(...job.results);
    }
  }

  const hotels = matching.flatMap((r) => r.hotels);

  // Filter by area if specified
  const filtered = opts.area
    ? hotels.filter((h) => h.location.district.toLowerCase() === opts.area!.toLowerCase())
    : hotels;

  // Sort by priceInYen
  filtered.sort((a, b) => a.priceInYen - b.priceInYen);

  return {
    prices: filtered.map((h) => ({
      name: h.name,
      source: h.source,
      priceInYen: h.priceInYen,
      currency: h.currency,
      area: h.location.district,
      url: h.url,
    })),
    params: {
      checkIn: params.checkIn,
      checkOut: params.checkOut,
      guests: params.guests,
      area: opts.area,
    },
    count: filtered.length,
  };
}

export async function handleHotels(opts: {
  area?: string;
  enabled?: string;
}): Promise<Record<string, unknown>> {
  // Collect unique hotels from all completed jobs
  const seen = new Map<string, (typeof hotels)[0]>();
  const hotels: Array<{
    name: string;
    hotelId: string;
    source: string;
    area: string;
    priceInYen: number;
  }> = [];

  for (const job of jobs.values()) {
    if (job.status !== "completed") continue;
    for (const result of job.results) {
      for (const hotel of result.hotels) {
        if (!seen.has(hotel.hotelId)) {
          const entry = {
            name: hotel.name,
            hotelId: hotel.hotelId,
            source: hotel.source,
            area: hotel.location.district,
            priceInYen: hotel.priceInYen,
          };
          seen.set(hotel.hotelId, entry);
          hotels.push(entry);
        }
      }
    }
  }

  const filtered = opts.area
    ? hotels.filter((h) => h.area.toLowerCase() === opts.area!.toLowerCase())
    : hotels;

  return {
    hotels: filtered,
    count: filtered.length,
    params: opts,
  };
}

export async function handleScrape(opts: {
  checkIn?: string;
  checkOut?: string;
  guests?: number;
  sources?: HotelSource[];
  strategy?: ScraperStrategy;
}): Promise<Record<string, unknown>> {
  const params = defaultParams(opts);
  if (opts.sources) params.sources = opts.sources;
  if (opts.strategy) params.strategy = opts.strategy;

  const jobId = nextJobId();
  const job: ScrapeJob = {
    id: jobId,
    status: "processing",
    params,
    results: [],
    startedAt: Date.now(),
  };
  jobs.set(jobId, job);

  // Run async — don't block the response
  (async () => {
    try {
      const { runAllScrapers } = await import("./scrapers/index.js");
      const results = await runAllScrapers(params);
      job.results = results;
      job.status = "completed";
      job.completedAt = Date.now();
      job.duration_ms = job.completedAt - (job.startedAt ?? job.completedAt);
    } catch (err) {
      job.status = "failed";
      job.error = err instanceof Error ? err.message : String(err);
      job.completedAt = Date.now();
      job.duration_ms = job.completedAt - (job.startedAt ?? job.completedAt);
    }
  })();

  return {
    jobId,
    status: "processing",
    params,
    message:
      "Scrape job started. Poll /api/hotel-scraper/jobs?status=processing to check progress.",
  };
}

export async function handleJobs(opts: {
  status?: ScrapeJobStatus;
  limit?: number;
}): Promise<Record<string, unknown>> {
  let entries = Array.from(jobs.values());

  if (opts.status) {
    entries = entries.filter((j) => j.status === opts.status);
  }

  // Sort newest first
  entries.sort((a, b) => (b.startedAt ?? 0) - (a.startedAt ?? 0));

  if (opts.limit) {
    entries = entries.slice(0, opts.limit);
  }

  return {
    jobs: entries.map((j) => ({
      id: j.id,
      status: j.status,
      params: j.params,
      resultCount: j.results.length,
      pricesFound: j.results.reduce((sum, r) => sum + r.pricesFound, 0),
      startedAt: j.startedAt,
      completedAt: j.completedAt,
      duration_ms: j.duration_ms,
      error: j.error,
    })),
    total: entries.length,
  };
}

export async function handleCompare(opts: { hotelId?: string }): Promise<Record<string, unknown>> {
  if (!opts.hotelId) {
    return { error: "hotelId query parameter required" };
  }

  // Find all price data for this hotel across jobs
  const prices: Array<{
    source: string;
    priceInYen: number;
    checkIn: string;
    checkOut: string;
    jobId: string;
  }> = [];

  for (const job of jobs.values()) {
    if (job.status !== "completed") continue;
    for (const result of job.results) {
      for (const hotel of result.hotels) {
        if (
          hotel.hotelId === opts.hotelId ||
          hotel.name.toLowerCase().includes(opts.hotelId.toLowerCase())
        ) {
          prices.push({
            source: hotel.source,
            priceInYen: hotel.priceInYen,
            checkIn: hotel.checkIn,
            checkOut: hotel.checkOut,
            jobId: job.id,
          });
        }
      }
    }
  }

  prices.sort((a, b) => a.priceInYen - b.priceInYen);

  return {
    hotelId: opts.hotelId,
    prices,
    cheapest: prices[0] ?? null,
    sourceCount: new Set(prices.map((p) => p.source)).size,
  };
}

export function handleSchedule(): Record<string, unknown> {
  return {
    schedule: SCHEDULE.map((s) => ({
      name: s.name,
      source: s.source,
      intervalMs: s.intervalMs,
      enabled: s.enabled,
      description: s.description,
    })),
    defaults: DEFAULT_SEARCH,
  };
}

// Exported for testing
export { jobs, defaultParams };
