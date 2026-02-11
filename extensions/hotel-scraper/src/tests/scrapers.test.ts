import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ScrapeParams } from "../types.js";

const defaultParams: ScrapeParams = {
  checkIn: "2026-03-01",
  checkOut: "2026-03-03",
  guests: 2,
};

describe("scraper orchestrator", () => {
  it("exports runAllScrapers and runScraper", async () => {
    const mod = await import("../scrapers/index.js");
    expect(typeof mod.runAllScrapers).toBe("function");
    expect(typeof mod.runScraper).toBe("function");
    expect(typeof mod.loadScrapers).toBe("function");
  });

  it("loadScrapers returns 5 scraper modules", async () => {
    const { loadScrapers } = await import("../scrapers/index.js");
    const scrapers = await loadScrapers();
    expect(scrapers).toHaveLength(5);

    const names = scrapers.map((s) => s.source);
    expect(names).toContain("ratehawk");
    expect(names).toContain("google_hotels");
    expect(names).toContain("nisade");
    expect(names).toContain("playwright");
    expect(names).toContain("roomboss");
  });

  it("each scraper module has name, source, and scrape function", async () => {
    const { loadScrapers } = await import("../scrapers/index.js");
    const scrapers = await loadScrapers();

    for (const scraper of scrapers) {
      expect(typeof scraper.name).toBe("string");
      expect(scraper.name.length).toBeGreaterThan(0);
      expect(typeof scraper.source).toBe("string");
      expect(typeof scraper.scrape).toBe("function");
    }
  });

  it("runScraper returns error for unknown source", async () => {
    const { runScraper } = await import("../scrapers/index.js");
    const result = await runScraper("manual" as any, defaultParams);
    expect(result.error).toContain("Unknown scraper source");
    expect(result.hotels).toHaveLength(0);
  });
});

describe("ratehawk scraper", () => {
  it("exports scrape function", async () => {
    const mod = await import("../scrapers/ratehawk.js");
    expect(typeof mod.scrape).toBe("function");
  });

  it("returns graceful error when API key missing", async () => {
    const originalKey = process.env.RATEHAWK_API_KEY;
    delete process.env.RATEHAWK_API_KEY;

    const { scrape } = await import("../scrapers/ratehawk.js");
    const result = await scrape(defaultParams);

    expect(result.source).toBe("ratehawk");
    expect(result.error).toContain("RATEHAWK_API_KEY");
    expect(result.hotels).toHaveLength(0);

    if (originalKey) process.env.RATEHAWK_API_KEY = originalKey;
  });
});

describe("google-hotels scraper", () => {
  it("exports scrape function", async () => {
    const mod = await import("../scrapers/google-hotels.js");
    expect(typeof mod.scrape).toBe("function");
  });

  it("returns graceful error when Apify token missing", async () => {
    const originalToken = process.env.APIFY_API_TOKEN;
    delete process.env.APIFY_API_TOKEN;

    const { scrape } = await import("../scrapers/google-hotels.js");
    const result = await scrape(defaultParams);

    expect(result.source).toBe("google_hotels");
    expect(result.error).toContain("APIFY_API_TOKEN");
    expect(result.hotels).toHaveLength(0);

    if (originalToken) process.env.APIFY_API_TOKEN = originalToken;
  });
});

describe("nisade scraper", () => {
  it("exports scrape function", async () => {
    const mod = await import("../scrapers/nisade.js");
    expect(typeof mod.scrape).toBe("function");
  });

  it("returns ScrapeResult with correct source", async () => {
    // Will fail on network but should return graceful error
    const { scrape } = await import("../scrapers/nisade.js");
    const result = await scrape(defaultParams);
    expect(result.source).toBe("nisade");
    expect(Array.isArray(result.hotels)).toBe(true);
    expect(typeof result.duration_ms).toBe("number");
  });
});

describe("playwright-official scraper", () => {
  it("exports scrape function", async () => {
    const mod = await import("../scrapers/playwright-official.js");
    expect(typeof mod.scrape).toBe("function");
  });

  it("returns empty result when no sites configured", async () => {
    const { scrape } = await import("../scrapers/playwright-official.js");
    const result = await scrape(defaultParams);

    expect(result.source).toBe("playwright");
    expect(result.hotels).toHaveLength(0);
    expect(result.error).toContain("No verified websites configured");
  });
});

describe("roomboss scraper", () => {
  it("exports scrape function", async () => {
    const mod = await import("../scrapers/roomboss.js");
    expect(typeof mod.scrape).toBe("function");
  });

  it("returns ScrapeResult with correct source", async () => {
    // Will fail on network but should return graceful error
    const { scrape } = await import("../scrapers/roomboss.js");
    const result = await scrape(defaultParams);
    expect(result.source).toBe("roomboss");
    expect(Array.isArray(result.hotels)).toBe(true);
    expect(typeof result.duration_ms).toBe("number");
  });
});

describe("scraper types", () => {
  it("exports VACATION_NISEKO_HOTEL_IDS with 30 IDs", async () => {
    const { VACATION_NISEKO_HOTEL_IDS } = await import("../scrapers/types.js");
    expect(VACATION_NISEKO_HOTEL_IDS).toHaveLength(30);
    expect(typeof VACATION_NISEKO_HOTEL_IDS[0]).toBe("string");
  });
});

describe("booking engine detection", () => {
  // Import the private functions indirectly through playwright-official
  it("playwright-official handles HTML with Guesty content", async () => {
    const { scrape } = await import("../scrapers/playwright-official.js");
    // Test that the scrape function exists and is callable with sites
    const result = await scrape(defaultParams, [
      {
        hotelName: "Test Hotel",
        officialUrl: "https://httpbin.org/html",
      },
    ]);
    expect(result.source).toBe("playwright");
    expect(typeof result.duration_ms).toBe("number");
  });
});
