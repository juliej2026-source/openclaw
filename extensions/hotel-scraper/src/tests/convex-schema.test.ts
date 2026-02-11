import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";

// Test the schema file content since we can't run Convex in unit tests
const schemaPath = path.resolve(import.meta.dirname, "../../convex/schema.ts");
const schemaContent = fs.readFileSync(schemaPath, "utf-8");

describe("Convex schema", () => {
  it("defines all 10 tables", () => {
    const tables = [
      "hotels",
      "prices",
      "scrapeJobs",
      "currencyRates",
      "websiteMetadata",
      "selectorTracking",
      "selectorAttempts",
      "alerts",
      "scrapeProgress",
      "scrapeRequests",
    ];

    for (const table of tables) {
      expect(schemaContent).toContain(`${table}: defineTable(`);
    }
  });

  it("hotels table has required indexes", () => {
    expect(schemaContent).toContain('.index("by_slug", ["slug"])');
    expect(schemaContent).toContain('.index("by_area", ["niseko_area"])');
    expect(schemaContent).toContain('.index("by_priority", ["priority"])');
  });

  it("prices table has dedup index", () => {
    expect(schemaContent).toContain('.index("by_dedup_key"');
    expect(schemaContent).toContain('"hotelId", "source", "checkIn", "checkOut", "guests"');
  });

  it("prices table has entity resolution index", () => {
    expect(schemaContent).toContain('.index("by_canonical"');
  });

  it("alerts table has severity and created indexes", () => {
    expect(schemaContent).toContain('.index("by_severity"');
    expect(schemaContent).toContain('.index("by_created"');
  });

  it("scrapeRequests has status+priority compound index", () => {
    expect(schemaContent).toContain('.index("by_status_priority"');
  });

  it("hotels table has entity resolution fields", () => {
    expect(schemaContent).toContain("aliases:");
    expect(schemaContent).toContain("canonicalHotelId:");
    expect(schemaContent).toContain("coordinates:");
  });

  it("websiteMetadata has booking engine field", () => {
    expect(schemaContent).toContain("bookingEngine:");
    expect(schemaContent).toContain("bookingWidgetUrl:");
    expect(schemaContent).toContain("calendarSelector:");
    expect(schemaContent).toContain("priceSelector:");
  });
});

describe("Convex queries file", () => {
  const queriesPath = path.resolve(import.meta.dirname, "../../convex/queries.ts");
  const queriesContent = fs.readFileSync(queriesPath, "utf-8");

  it("exports all public queries", () => {
    const publicQueries = [
      "getHotels",
      "getHotelBySlug",
      "getLatestPrices",
      "getActiveAlerts",
      "getScrapeJobs",
      "getCurrencyRate",
      "getScrapeProgress",
      "getPendingScrapeRequests",
    ];

    for (const q of publicQueries) {
      expect(queriesContent).toContain(`export const ${q}`);
    }
  });

  it("exports internal queries", () => {
    const internalQueries = [
      "internalGetHotels",
      "internalGetHotelById",
      "internalGetHotelsByIds",
      "internalGetPrices",
      "internalGetAllPrices",
      "internalGetCurrencyRate",
      "internalGetWebsiteMetadata",
      "internalGetSelectorTracking",
      "internalFindExistingPrice",
      "internalGetPendingScrapeRequests",
    ];

    for (const q of internalQueries) {
      expect(queriesContent).toContain(`export const ${q}`);
    }
  });
});

describe("Convex mutations file", () => {
  const mutationsPath = path.resolve(import.meta.dirname, "../../convex/mutations.ts");
  const mutationsContent = fs.readFileSync(mutationsPath, "utf-8");

  it("exports public mutations", () => {
    const publicMutations = [
      "addHotel",
      "updateHotel",
      "addPrice",
      "createScrapeJob",
      "updateScrapeJob",
      "updateCurrencyRate",
      "queueScrapeRequest",
    ];

    for (const m of publicMutations) {
      expect(mutationsContent).toContain(`export const ${m}`);
    }
  });

  it("exports internal mutations", () => {
    const internalMutations = [
      "internalAddHotel",
      "internalUpdateHotel",
      "internalAddPrice",
      "deletePrice",
      "updatePrice",
      "internalCreateScrapeJob",
      "internalUpdateScrapeJob",
      "internalInsertAlert",
      "internalUpsertScrapeProgress",
      "internalDeleteExpiredProgress",
      "internalUpdateScrapeRequest",
    ];

    for (const m of internalMutations) {
      expect(mutationsContent).toContain(`export const ${m}`);
    }
  });
});

describe("persistence stores", () => {
  it("hotel-store exports expected functions", async () => {
    const mod = await import("../persistence/hotel-store.js");
    expect(typeof mod.listHotels).toBe("function");
    expect(typeof mod.getHotelBySlug).toBe("function");
    expect(typeof mod.getHotelCount).toBe("function");
    expect(typeof mod.getAreaBreakdown).toBe("function");
  });

  it("price-store exports expected functions", async () => {
    const mod = await import("../persistence/price-store.js");
    expect(typeof mod.getLatestPrices).toBe("function");
    expect(typeof mod.addPrice).toBe("function");
    expect(typeof mod.getPriceCountBySource).toBe("function");
    expect(typeof mod.getLowestPriceByHotel).toBe("function");
  });
});
