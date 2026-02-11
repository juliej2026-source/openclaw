// ---------------------------------------------------------------------------
// Unified scraper orchestrator — runs all sources with Promise.allSettled
// ---------------------------------------------------------------------------

import type { ScrapeParams, ScrapeResult, HotelSource } from "../types.js";
import type { ScraperModule } from "./types.js";

// Lazy imports to avoid loading all scrapers when only one is needed
async function loadScrapers(): Promise<ScraperModule[]> {
  const [ratehawk, googleHotels, nisade, playwrightOfficial, roomboss] = await Promise.all([
    import("./ratehawk.js"),
    import("./google-hotels.js"),
    import("./nisade.js"),
    import("./playwright-official.js"),
    import("./roomboss.js"),
  ]);

  return [
    { name: "RateHawk", source: "ratehawk", scrape: ratehawk.scrape },
    { name: "Google Hotels", source: "google_hotels", scrape: googleHotels.scrape },
    { name: "nisade.com", source: "nisade", scrape: nisade.scrape },
    { name: "Official Sites", source: "playwright", scrape: playwrightOfficial.scrape },
    { name: "RoomBoss", source: "roomboss", scrape: roomboss.scrape },
  ];
}

export async function runAllScrapers(params: ScrapeParams): Promise<ScrapeResult[]> {
  const scrapers = await loadScrapers();

  // Filter to requested sources if specified
  const active = params.sources
    ? scrapers.filter((s) => params.sources!.includes(s.source))
    : scrapers;

  const settled = await Promise.allSettled(active.map((s) => s.scrape(params)));

  return settled.map((result, i) => {
    if (result.status === "fulfilled") return result.value;
    return {
      source: active[i].source,
      hotels: [],
      pricesFound: 0,
      duration_ms: 0,
      error: result.reason instanceof Error ? result.reason.message : String(result.reason),
    };
  });
}

export async function runScraper(source: HotelSource, params: ScrapeParams): Promise<ScrapeResult> {
  const scrapers = await loadScrapers();
  const scraper = scrapers.find((s) => s.source === source);

  if (!scraper) {
    return {
      source,
      hotels: [],
      pricesFound: 0,
      duration_ms: 0,
      error: `Unknown scraper source: ${source}`,
    };
  }

  return scraper.scrape(params);
}

export { loadScrapers };
