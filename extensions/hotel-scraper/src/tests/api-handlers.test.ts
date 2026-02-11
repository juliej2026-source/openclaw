import { describe, it, expect, beforeEach } from "vitest";

describe("api-handlers", () => {
  beforeEach(async () => {
    const { jobs } = await import("../api-handlers.js");
    jobs.clear();
    // Reset scheduler state for clean status tests
    const { resetSchedulerState } = await import("../scheduler/scraper-scheduler.js");
    resetSchedulerState();
  });

  it("handleStatus returns extension info", async () => {
    const { handleStatus } = await import("../api-handlers.js");
    const result = await handleStatus();
    expect(result.extension).toBe("hotel-scraper");
    expect(result.version).toBe("2026.2.8");
    expect(result.sources).toHaveLength(5);
    expect(result.areas).toHaveLength(4);
    expect(result.scheduler).toBeDefined();
    expect(result.jobsInMemory).toBe(0);
  });

  it("handleSchedule returns schedule entries", async () => {
    const { handleSchedule } = await import("../api-handlers.js");
    const result = handleSchedule();
    expect(result.schedule).toBeDefined();
    expect(Array.isArray(result.schedule)).toBe(true);
    expect((result.schedule as any[]).length).toBeGreaterThan(0);
    expect(result.defaults).toBeDefined();
  });

  it("handleJobs returns empty when no jobs", async () => {
    const { handleJobs } = await import("../api-handlers.js");
    const result = await handleJobs({});
    expect(result.total).toBe(0);
    expect(result.jobs).toEqual([]);
  });

  it("handlePrices returns empty when no data", async () => {
    const { handlePrices } = await import("../api-handlers.js");
    const result = await handlePrices({});
    expect(result.count).toBe(0);
    expect(result.prices).toEqual([]);
    expect(result.params).toBeDefined();
  });

  it("handleHotels returns empty when no data", async () => {
    const { handleHotels } = await import("../api-handlers.js");
    const result = await handleHotels({});
    expect(result.count).toBe(0);
    expect(result.hotels).toEqual([]);
  });

  it("handleCompare requires hotelId", async () => {
    const { handleCompare } = await import("../api-handlers.js");
    const result = await handleCompare({});
    expect(result.error).toBeDefined();
  });

  it("handleCompare returns empty prices for unknown hotel", async () => {
    const { handleCompare } = await import("../api-handlers.js");
    const result = await handleCompare({ hotelId: "nonexistent" });
    expect(result.prices).toEqual([]);
    expect(result.sourceCount).toBe(0);
  });

  it("defaultParams uses defaults when no overrides", async () => {
    const { defaultParams } = await import("../api-handlers.js");
    const params = defaultParams({});
    expect(params.checkIn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(params.checkOut).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(params.guests).toBe(2);
    // checkOut should be 2 days after checkIn
    const inDate = new Date(params.checkIn);
    const outDate = new Date(params.checkOut);
    const nights = (outDate.getTime() - inDate.getTime()) / 86_400_000;
    expect(nights).toBe(2);
  });

  it("defaultParams respects overrides", async () => {
    const { defaultParams } = await import("../api-handlers.js");
    const params = defaultParams({ checkIn: "2026-04-01", checkOut: "2026-04-05", guests: 4 });
    expect(params.checkIn).toBe("2026-04-01");
    expect(params.checkOut).toBe("2026-04-05");
    expect(params.guests).toBe(4);
  });

  it("handleJobs filters by status", async () => {
    const { handleJobs, jobs } = await import("../api-handlers.js");

    // Insert test jobs directly
    jobs.set("j1", {
      id: "j1",
      status: "completed",
      params: { checkIn: "2026-03-01", checkOut: "2026-03-03", guests: 2 },
      results: [],
      startedAt: 1000,
      completedAt: 2000,
    });
    jobs.set("j2", {
      id: "j2",
      status: "processing",
      params: { checkIn: "2026-03-01", checkOut: "2026-03-03", guests: 2 },
      results: [],
      startedAt: 3000,
    });

    const completed = await handleJobs({ status: "completed" });
    expect(completed.total).toBe(1);

    const processing = await handleJobs({ status: "processing" });
    expect(processing.total).toBe(1);

    const all = await handleJobs({});
    expect(all.total).toBe(2);
  });

  it("handleJobs respects limit", async () => {
    const { handleJobs, jobs } = await import("../api-handlers.js");

    for (let i = 0; i < 5; i++) {
      jobs.set(`j${i}`, {
        id: `j${i}`,
        status: "completed",
        params: { checkIn: "2026-03-01", checkOut: "2026-03-03", guests: 2 },
        results: [],
        startedAt: i * 1000,
      });
    }

    const limited = await handleJobs({ limit: 2 });
    expect(limited.total).toBe(2);
  });
});
