// ---------------------------------------------------------------------------
// Scrape request queue processor — retry logic + strategy routing
// Ported from hotel-calc-kelvin convex/cronHandlers.ts processScrapeQueue
// ---------------------------------------------------------------------------

import type {
  ScrapeParams,
  ScrapeRequest,
  ScrapeResult,
  HotelSource,
  ScraperStrategy,
} from "../types.js";

type ProcessResult = {
  requestId: string;
  status: "completed" | "failed" | "retry";
  results?: ScrapeResult[];
  error?: string;
};

type ExecuteFn = (source: HotelSource, params: ScrapeParams) => Promise<ScrapeResult>;

const MAX_CONCURRENT = 3;

function resolveSources(strategy: ScraperStrategy): HotelSource[] {
  switch (strategy) {
    case "apify_only":
      return ["google_hotels"];
    case "playwright_only":
      return ["playwright", "roomboss"];
    case "hybrid":
      return ["google_hotels", "playwright", "roomboss"];
    case "auto":
    default:
      return ["ratehawk", "google_hotels", "nisade", "playwright", "roomboss"];
  }
}

async function processOne(request: ScrapeRequest, execute: ExecuteFn): Promise<ProcessResult> {
  const strategy = request.params.strategy ?? "auto";
  const sources = request.params.sources ?? resolveSources(strategy);

  const results: ScrapeResult[] = [];

  for (const source of sources) {
    try {
      const result = await execute(source, request.params);
      results.push(result);
    } catch (err) {
      results.push({
        source,
        hotels: [],
        pricesFound: 0,
        duration_ms: 0,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const allFailed = results.every((r) => r.error);

  if (allFailed && request.retryCount < request.maxRetries) {
    return { requestId: request.id, status: "retry", results, error: "All sources failed" };
  }

  if (allFailed) {
    return {
      requestId: request.id,
      status: "failed",
      results,
      error: "All sources failed after max retries",
    };
  }

  return { requestId: request.id, status: "completed", results };
}

export async function processQueue(
  pending: ScrapeRequest[],
  execute: ExecuteFn,
): Promise<ProcessResult[]> {
  if (pending.length === 0) return [];

  // Sort by priority (higher first), then by requestedAt (older first)
  const sorted = [...pending].sort(
    (a, b) => b.priority - a.priority || a.requestedAt - b.requestedAt,
  );

  // Process up to MAX_CONCURRENT at a time
  const batch = sorted.slice(0, MAX_CONCURRENT);
  const results = await Promise.allSettled(batch.map((req) => processOne(req, execute)));

  return results.map((r, i) => {
    if (r.status === "fulfilled") return r.value;
    return {
      requestId: batch[i].id,
      status: "failed" as const,
      error: r.reason instanceof Error ? r.reason.message : String(r.reason),
    };
  });
}

export { resolveSources, processOne, MAX_CONCURRENT };
export type { ProcessResult, ExecuteFn };
