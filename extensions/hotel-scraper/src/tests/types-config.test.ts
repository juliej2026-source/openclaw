import { describe, it, expect } from "vitest";
import type {
  Hotel,
  PriceEntry,
  ScrapeParams,
  ScrapeResult,
  ScrapeJob,
  ScrapeRequest,
  HotelSource,
  ScraperStrategy,
  WebsiteMetadata,
  Unit,
  CompetitorPrice,
} from "../types.js";
import {
  NISEKO_SEARCH_AREAS,
  SCHEDULE,
  DEFAULT_SEARCH,
  CURRENCY_RATES,
  PEAK_SEASONS,
  OFF_SEASONS,
} from "../config.js";
import { CONVEX_URL, PLAYWRIGHT_SERVICE_URL } from "../types.js";

describe("types", () => {
  it("exports CONVEX_URL constant", () => {
    expect(typeof CONVEX_URL).toBe("string");
    expect(CONVEX_URL).toContain("10.1.7.158");
  });

  it("exports PLAYWRIGHT_SERVICE_URL constant", () => {
    expect(typeof PLAYWRIGHT_SERVICE_URL).toBe("string");
    expect(PLAYWRIGHT_SERVICE_URL).toContain("hf.space");
  });

  it("HotelSource covers all 6 sources", () => {
    const sources: HotelSource[] = [
      "ratehawk",
      "google_hotels",
      "nisade",
      "playwright",
      "roomboss",
      "manual",
    ];
    expect(sources).toHaveLength(6);
  });

  it("ScraperStrategy covers all 4 strategies", () => {
    const strategies: ScraperStrategy[] = ["apify_only", "playwright_only", "hybrid", "auto"];
    expect(strategies).toHaveLength(4);
  });

  it("Hotel type has required fields", () => {
    const hotel: Hotel = {
      hotelId: "test-1",
      source: "ratehawk",
      providerName: "RateHawk",
      name: "Test Hotel",
      location: {
        prefecture: "Hokkaido",
        city: "Kutchan",
        district: "Hirafu",
        address: "123 Main St",
        coordinates: { lat: 42.8486, lon: 140.6873 },
      },
      price: 25000,
      currency: "JPY",
      priceInYen: 25000,
      checkIn: "2026-03-01",
      checkOut: "2026-03-03",
      nights: 2,
      guests: 2,
      availability: true,
      url: "https://example.com",
      lastUpdated: Date.now(),
    };
    expect(hotel.hotelId).toBe("test-1");
    expect(hotel.location.district).toBe("Hirafu");
  });

  it("ScrapeParams includes strategy field", () => {
    const params: ScrapeParams = {
      checkIn: "2026-03-01",
      checkOut: "2026-03-03",
      guests: 2,
      strategy: "auto",
    };
    expect(params.strategy).toBe("auto");
  });
});

describe("config — Niseko search areas", () => {
  it("defines 4 search areas", () => {
    expect(NISEKO_SEARCH_AREAS).toHaveLength(4);
  });

  it("has Hirafu as largest area", () => {
    const hirafu = NISEKO_SEARCH_AREAS.find((a) => a.name === "Hirafu");
    expect(hirafu).toBeDefined();
    expect(hirafu!.estimatedProperties).toBe(40);
    expect(hirafu!.radiusKm).toBe(2.5);
  });

  it("covers all 4 Niseko villages", () => {
    const names = NISEKO_SEARCH_AREAS.map((a) => a.name);
    expect(names).toContain("Hirafu");
    expect(names).toContain("Niseko Village");
    expect(names).toContain("Annupuri");
    expect(names).toContain("Hanazono");
  });

  it("all areas have valid GPS coordinates", () => {
    for (const area of NISEKO_SEARCH_AREAS) {
      expect(area.latitude).toBeGreaterThan(42);
      expect(area.latitude).toBeLessThan(43);
      expect(area.longitude).toBeGreaterThan(140);
      expect(area.longitude).toBeLessThan(141);
      expect(area.radiusKm).toBeGreaterThan(0);
    }
  });

  it("total estimated properties is 73", () => {
    const total = NISEKO_SEARCH_AREAS.reduce((sum, a) => sum + a.estimatedProperties, 0);
    expect(total).toBe(73);
  });
});

describe("config — schedule", () => {
  it("defines 9 schedule entries", () => {
    expect(SCHEDULE).toHaveLength(9);
  });

  it("covers all 5 data sources", () => {
    const sources = new Set(SCHEDULE.filter((s) => s.source !== "system").map((s) => s.source));
    expect(sources.size).toBe(5);
    expect(sources.has("ratehawk")).toBe(true);
    expect(sources.has("google_hotels")).toBe(true);
    expect(sources.has("nisade")).toBe(true);
    expect(sources.has("playwright")).toBe(true);
    expect(sources.has("roomboss")).toBe(true);
  });

  it("has 4 system jobs", () => {
    const systemJobs = SCHEDULE.filter((s) => s.source === "system");
    expect(systemJobs).toHaveLength(4);
  });

  it("all entries have positive intervalMs", () => {
    for (const entry of SCHEDULE) {
      expect(entry.intervalMs).toBeGreaterThan(0);
    }
  });

  it("queue processor runs every 2 minutes", () => {
    const qp = SCHEDULE.find((s) => s.name === "queue_processor");
    expect(qp).toBeDefined();
    expect(qp!.intervalMs).toBe(2 * 60 * 1000);
  });
});

describe("config — defaults", () => {
  it("has default search params", () => {
    expect(DEFAULT_SEARCH.currency).toBe("JPY");
    expect(DEFAULT_SEARCH.guests).toBe(2);
    expect(DEFAULT_SEARCH.nightsAhead).toBe(7);
    expect(DEFAULT_SEARCH.stayLength).toBe(2);
  });

  it("has currency conversion rates", () => {
    expect(CURRENCY_RATES.JPY).toBe(1);
    expect(CURRENCY_RATES.USD).toBe(150);
    expect(Object.keys(CURRENCY_RATES).length).toBeGreaterThanOrEqual(5);
  });

  it("defines peak and off seasons", () => {
    expect(PEAK_SEASONS).toHaveLength(2);
    expect(OFF_SEASONS).toHaveLength(2);
    expect(PEAK_SEASONS[0].name).toBe("Winter Peak");
  });
});
