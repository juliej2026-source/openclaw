// ---------------------------------------------------------------------------
// Data quality checks — freshness monitoring, success rates, alerts
// ---------------------------------------------------------------------------

import type { ScrapeResult, HotelSource } from "../types.js";

export type DataQualityReport = {
  timestamp: number;
  totalSources: number;
  healthySources: number;
  staleSources: string[];
  failedSources: string[];
  priceCount: number;
  freshnessBySource: Record<string, { lastScrape: number; ageHours: number; status: string }>;
};

export function assessScrapeResults(results: ScrapeResult[], maxAgeHours = 24): DataQualityReport {
  const now = Date.now();
  const freshnessBySource: DataQualityReport["freshnessBySource"] = {};
  const staleSources: string[] = [];
  const failedSources: string[] = [];
  let totalPrices = 0;

  for (const result of results) {
    if (result.error) {
      failedSources.push(result.source);
      freshnessBySource[result.source] = {
        lastScrape: now,
        ageHours: 0,
        status: "failed",
      };
      continue;
    }

    const ageHours = result.duration_ms / (1000 * 60 * 60);
    totalPrices += result.pricesFound;

    const isFresh = ageHours < maxAgeHours;
    if (!isFresh) staleSources.push(result.source);

    freshnessBySource[result.source] = {
      lastScrape: now,
      ageHours,
      status: isFresh ? "fresh" : "stale",
    };
  }

  const healthySources = results.length - failedSources.length - staleSources.length;

  return {
    timestamp: now,
    totalSources: results.length,
    healthySources,
    staleSources,
    failedSources,
    priceCount: totalPrices,
    freshnessBySource,
  };
}

export function isPriceOutlier(price: number, peers: number[]): boolean {
  if (peers.length < 3) return false;
  const sorted = [...peers].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  const q3 = sorted[Math.floor(sorted.length * 0.75)];
  const iqr = q3 - q1;
  return price < q1 - 1.5 * iqr || price > q3 + 1.5 * iqr;
}
