import { describe, it, expect } from "vitest";
import type { Hotel, ScrapeResult } from "../types.js";

describe("entity resolution", () => {
  it("exports findMatchingHotel, batchMatch, calculateMatchStats", async () => {
    const mod = await import("../processing/entity-resolution.js");
    expect(typeof mod.findMatchingHotel).toBe("function");
    expect(typeof mod.batchMatch).toBe("function");
    expect(typeof mod.calculateMatchStats).toBe("function");
  });

  it("matches identical hotels with high confidence", async () => {
    const { findMatchingHotel } = await import("../processing/entity-resolution.js");

    const candidate: Hotel = {
      hotelId: "new-1",
      source: "ratehawk",
      providerName: "RateHawk",
      name: "Ki Niseko",
      location: {
        prefecture: "Hokkaido",
        city: "Kutchan",
        district: "Hirafu",
        address: "123 Main St",
        coordinates: { lat: 42.8486, lon: 140.6873 },
      },
      price: 75000,
      currency: "JPY",
      priceInYen: 75000,
      checkIn: "2026-03-01",
      checkOut: "2026-03-03",
      nights: 2,
      guests: 2,
      availability: true,
      url: "https://example.com",
      lastUpdated: Date.now(),
    };

    const existing: Hotel[] = [
      {
        ...candidate,
        hotelId: "existing-1",
        source: "nisade",
        name: "Ki Niseko Hotel",
        location: {
          ...candidate.location,
          coordinates: { lat: 42.8487, lon: 140.6874 }, // ~10m away
        },
      },
    ];

    const result = findMatchingHotel(candidate, existing);
    expect(result.confidence).toBeGreaterThan(0.5);
    expect(result.canonicalId).toBe("existing-1");
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it("rejects distant hotels", async () => {
    const { findMatchingHotel } = await import("../processing/entity-resolution.js");

    const candidate: Hotel = {
      hotelId: "new-1",
      source: "ratehawk",
      providerName: "RateHawk",
      name: "Park Hyatt",
      location: {
        prefecture: "Hokkaido",
        city: "Kutchan",
        district: "Hanazono",
        address: "",
        coordinates: { lat: 42.865, lon: 140.71 },
      },
      price: 100000,
      currency: "JPY",
      priceInYen: 100000,
      checkIn: "2026-03-01",
      checkOut: "2026-03-03",
      nights: 2,
      guests: 2,
      availability: true,
      url: "",
      lastUpdated: Date.now(),
    };

    const existing: Hotel[] = [
      {
        ...candidate,
        hotelId: "existing-1",
        name: "Hilton Niseko Village",
        location: {
          ...candidate.location,
          district: "Niseko Village",
          coordinates: { lat: 42.8056, lon: 140.6842 }, // ~7km away
        },
      },
    ];

    const result = findMatchingHotel(candidate, existing);
    expect(result.shouldMerge).toBe(false);
  });

  it("batchMatch processes multiple candidates", async () => {
    const { batchMatch, calculateMatchStats } = await import("../processing/entity-resolution.js");

    const base: Hotel = {
      hotelId: "",
      source: "ratehawk",
      providerName: "RateHawk",
      name: "",
      location: {
        prefecture: "Hokkaido",
        city: "Kutchan",
        district: "Hirafu",
        address: "",
        coordinates: { lat: 42.8486, lon: 140.6873 },
      },
      price: 50000,
      currency: "JPY",
      priceInYen: 50000,
      checkIn: "2026-03-01",
      checkOut: "2026-03-03",
      nights: 2,
      guests: 2,
      availability: true,
      url: "",
      lastUpdated: Date.now(),
    };

    const candidates = [
      { ...base, hotelId: "c1", name: "Hotel A" },
      { ...base, hotelId: "c2", name: "Hotel B" },
    ];

    const existing = [{ ...base, hotelId: "e1", name: "Hotel A Hirafu" }];

    const results = batchMatch(candidates, existing);
    expect(results.size).toBe(2);

    const stats = calculateMatchStats(results);
    expect(stats.totalCandidates).toBe(2);
  });
});

describe("price deduplication", () => {
  it("exports deduplicatePrices", async () => {
    const mod = await import("../processing/price-dedup.js");
    expect(typeof mod.deduplicatePrices).toBe("function");
  });

  it("returns empty result for empty input", async () => {
    const { deduplicatePrices } = await import("../processing/price-dedup.js");
    const result = deduplicatePrices([]);
    expect(result.totalPrices).toBe(0);
    expect(result.duplicatesRemoved).toBe(0);
    expect(result.idsToDelete).toHaveLength(0);
  });

  it("keeps lowest price in each group", async () => {
    const { deduplicatePrices } = await import("../processing/price-dedup.js");

    const prices = [
      {
        id: "p1",
        hotelId: "h1",
        source: "ratehawk",
        checkIn: "2026-03-01",
        checkOut: "2026-03-03",
        guests: 2,
        priceInYen: 50000,
      },
      {
        id: "p2",
        hotelId: "h1",
        source: "ratehawk",
        checkIn: "2026-03-01",
        checkOut: "2026-03-03",
        guests: 2,
        priceInYen: 45000,
      },
      {
        id: "p3",
        hotelId: "h1",
        source: "ratehawk",
        checkIn: "2026-03-01",
        checkOut: "2026-03-03",
        guests: 2,
        priceInYen: 60000,
      },
    ];

    const result = deduplicatePrices(prices);
    expect(result.totalPrices).toBe(3);
    expect(result.uniqueGroups).toBe(1);
    expect(result.duplicatesRemoved).toBe(2);
    expect(result.idsToDelete).toContain("p1"); // 50000
    expect(result.idsToDelete).toContain("p3"); // 60000
    expect(result.idsToDelete).not.toContain("p2"); // 45000 (lowest, kept)
  });

  it("keeps all unique group entries", async () => {
    const { deduplicatePrices } = await import("../processing/price-dedup.js");

    const prices = [
      {
        id: "p1",
        hotelId: "h1",
        source: "ratehawk",
        checkIn: "2026-03-01",
        checkOut: "2026-03-03",
        guests: 2,
        priceInYen: 50000,
      },
      {
        id: "p2",
        hotelId: "h2",
        source: "ratehawk",
        checkIn: "2026-03-01",
        checkOut: "2026-03-03",
        guests: 2,
        priceInYen: 45000,
      },
      {
        id: "p3",
        hotelId: "h1",
        source: "nisade",
        checkIn: "2026-03-01",
        checkOut: "2026-03-03",
        guests: 2,
        priceInYen: 48000,
      },
    ];

    const result = deduplicatePrices(prices);
    expect(result.duplicatesRemoved).toBe(0);
    expect(result.uniqueGroups).toBe(3);
    expect(result.idsToDelete).toHaveLength(0);
  });
});

describe("currency", () => {
  it("exports conversion and formatting functions", async () => {
    const mod = await import("../processing/currency.js");
    expect(typeof mod.convertToJpy).toBe("function");
    expect(typeof mod.calculateNights).toBe("function");
    expect(typeof mod.formatJpy).toBe("function");
    expect(typeof mod.formatPricePerNight).toBe("function");
  });

  it("converts USD to JPY", async () => {
    const { convertToJpy } = await import("../processing/currency.js");
    const jpy = convertToJpy(100, "USD");
    expect(jpy).toBe(15000); // 100 * 150
  });

  it("returns JPY unchanged", async () => {
    const { convertToJpy } = await import("../processing/currency.js");
    expect(convertToJpy(50000, "JPY")).toBe(50000);
  });

  it("calculates nights correctly", async () => {
    const { calculateNights } = await import("../processing/currency.js");
    expect(calculateNights("2026-03-01", "2026-03-03")).toBe(2);
    expect(calculateNights("2026-03-01", "2026-03-08")).toBe(7);
    expect(calculateNights("2026-03-01", "2026-03-01")).toBe(1); // minimum 1
  });

  it("formats JPY with yen symbol", async () => {
    const { formatJpy } = await import("../processing/currency.js");
    expect(formatJpy(50000)).toMatch(/¥50,000/);
  });

  it("formats price per night", async () => {
    const { formatPricePerNight } = await import("../processing/currency.js");
    const result = formatPricePerNight(100000, 2);
    expect(result).toContain("/night");
    expect(result).toContain("50,000");
  });
});

describe("data quality", () => {
  it("exports assessScrapeResults and isPriceOutlier", async () => {
    const mod = await import("../processing/data-quality.js");
    expect(typeof mod.assessScrapeResults).toBe("function");
    expect(typeof mod.isPriceOutlier).toBe("function");
  });

  it("reports failed sources", async () => {
    const { assessScrapeResults } = await import("../processing/data-quality.js");

    const results: ScrapeResult[] = [
      { source: "ratehawk", hotels: [], pricesFound: 10, duration_ms: 1000 },
      {
        source: "google_hotels",
        hotels: [],
        pricesFound: 0,
        duration_ms: 500,
        error: "API key missing",
      },
    ];

    const report = assessScrapeResults(results);
    expect(report.totalSources).toBe(2);
    expect(report.failedSources).toContain("google_hotels");
    expect(report.healthySources).toBe(1);
    expect(report.priceCount).toBe(10);
  });

  it("detects price outliers", async () => {
    const { isPriceOutlier } = await import("../processing/data-quality.js");

    const peers = [50000, 52000, 48000, 55000, 47000];
    expect(isPriceOutlier(50000, peers)).toBe(false);
    expect(isPriceOutlier(200000, peers)).toBe(true);
    expect(isPriceOutlier(5000, peers)).toBe(true);
  });

  it("returns false for small peer sets", async () => {
    const { isPriceOutlier } = await import("../processing/data-quality.js");
    expect(isPriceOutlier(99999, [50000, 60000])).toBe(false);
  });
});
