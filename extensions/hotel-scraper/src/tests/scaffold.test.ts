import { describe, it, expect } from "vitest";

describe("extension scaffold", () => {
  it("index.ts exports a default function", async () => {
    const mod = await import("../../index.js");
    expect(typeof mod.default).toBe("function");
  });

  it("api-handlers exports all handler functions", async () => {
    const mod = await import("../api-handlers.js");
    expect(typeof mod.handleStatus).toBe("function");
    expect(typeof mod.handleHealth).toBe("function");
    expect(typeof mod.handlePrices).toBe("function");
    expect(typeof mod.handleHotels).toBe("function");
    expect(typeof mod.handleScrape).toBe("function");
    expect(typeof mod.handleJobs).toBe("function");
    expect(typeof mod.handleCompare).toBe("function");
    expect(typeof mod.handleSchedule).toBe("function");
  });

  it("handleStatus returns extension metadata", async () => {
    const { handleStatus } = await import("../api-handlers.js");
    const status = await handleStatus();
    expect(status.extension).toBe("hotel-scraper");
    expect(status.sources).toHaveLength(5);
    expect(status.areas).toHaveLength(4);
  });

  it("handleSchedule returns schedule with defaults", async () => {
    const { handleSchedule } = await import("../api-handlers.js");
    const data = handleSchedule();
    expect(data.schedule).toBeDefined();
    expect(data.defaults).toBeDefined();
    expect(Array.isArray(data.schedule)).toBe(true);
  });

  it("scheduler exports start/stop functions", async () => {
    const mod = await import("../scheduler/scraper-scheduler.js");
    expect(typeof mod.startScheduler).toBe("function");
    expect(typeof mod.stopScheduler).toBe("function");
  });

  it("metrics exports renderScraperMetrics", async () => {
    const mod = await import("../metrics/scraper-metrics.js");
    expect(typeof mod.renderScraperMetrics).toBe("function");

    const output = await mod.renderScraperMetrics();
    expect(output).toContain("hotel_scraper_up 1");
    expect(output).toContain("hotel_scraper_sources_total 5");
  });

  it("convex-client exports getConvexClient and isConvexHealthy", async () => {
    const mod = await import("../persistence/convex-client.js");
    expect(typeof mod.getConvexClient).toBe("function");
    expect(typeof mod.isConvexHealthy).toBe("function");
    expect(typeof mod.resetClient).toBe("function");
  });

  it("neural seed-nodes exports seedHotelNodes", async () => {
    const mod = await import("../neural/seed-nodes.js");
    expect(typeof mod.seedHotelNodes).toBe("function");
  });
});
