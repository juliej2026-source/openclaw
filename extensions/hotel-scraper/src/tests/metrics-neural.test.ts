import { describe, it, expect, beforeEach } from "vitest";

describe("scraper-metrics", () => {
  beforeEach(async () => {
    const { resetSchedulerState } = await import("../scheduler/scraper-scheduler.js");
    resetSchedulerState();
    const { jobs } = await import("../api-handlers.js");
    jobs.clear();
  });

  it("renders valid Prometheus format", async () => {
    const { renderScraperMetrics } = await import("../metrics/scraper-metrics.js");
    const output = await renderScraperMetrics();

    expect(output).toContain("hotel_scraper_up 1");
    expect(output).toContain("hotel_scraper_sources_total 5");
    expect(output).toContain("# HELP");
    expect(output).toContain("# TYPE");
  });

  it("includes scheduler metrics", async () => {
    const { renderScraperMetrics } = await import("../metrics/scraper-metrics.js");
    const output = await renderScraperMetrics();

    expect(output).toContain("hotel_scraper_scheduler_running");
    expect(output).toContain("hotel_scraper_scheduler_uptime_seconds");
    expect(output).toContain("hotel_scraper_scheduler_active_timers");
    expect(output).toContain("hotel_scraper_schedule_enabled");
  });

  it("includes per-task metrics", async () => {
    const { renderScraperMetrics } = await import("../metrics/scraper-metrics.js");
    const output = await renderScraperMetrics();

    expect(output).toContain("hotel_scraper_task_runs_total");
    expect(output).toContain('task="ratehawk_hourly"');
    expect(output).toContain("hotel_scraper_task_last_run_timestamp");
    expect(output).toContain("hotel_scraper_task_error");
  });

  it("includes job store metrics", async () => {
    const { renderScraperMetrics } = await import("../metrics/scraper-metrics.js");
    const output = await renderScraperMetrics();

    expect(output).toContain("hotel_scraper_jobs_total 0");
    expect(output).toContain("hotel_scraper_prices_found_total 0");
  });

  it("includes playwright health metric", async () => {
    const { renderScraperMetrics } = await import("../metrics/scraper-metrics.js");
    const output = await renderScraperMetrics();

    expect(output).toContain("hotel_scraper_playwright_reachable");
  });

  it("includes schedule interval config", async () => {
    const { renderScraperMetrics } = await import("../metrics/scraper-metrics.js");
    const output = await renderScraperMetrics();

    expect(output).toContain("hotel_scraper_schedule_interval_seconds");
    expect(output).toContain('task="ratehawk_hourly"');
    expect(output).toContain('source="ratehawk"');
  });

  it("reports job counts by status when jobs exist", async () => {
    const { jobs } = await import("../api-handlers.js");
    jobs.set("j1", {
      id: "j1",
      status: "completed",
      params: { checkIn: "2026-03-01", checkOut: "2026-03-03", guests: 2 },
      results: [{ source: "ratehawk" as any, hotels: [], pricesFound: 10, duration_ms: 500 }],
      startedAt: 1000,
    });
    jobs.set("j2", {
      id: "j2",
      status: "processing",
      params: { checkIn: "2026-03-01", checkOut: "2026-03-03", guests: 2 },
      results: [],
      startedAt: 2000,
    });

    const { renderScraperMetrics } = await import("../metrics/scraper-metrics.js");
    const output = await renderScraperMetrics();

    expect(output).toContain("hotel_scraper_jobs_total 2");
    expect(output).toContain('hotel_scraper_jobs_by_status{status="completed"} 1');
    expect(output).toContain('hotel_scraper_jobs_by_status{status="processing"} 1');
    expect(output).toContain("hotel_scraper_prices_found_total 10");
  });

  it("has correct metric types", async () => {
    const { renderScraperMetrics } = await import("../metrics/scraper-metrics.js");
    const output = await renderScraperMetrics();

    // Verify HELP/TYPE pairs
    const typeLines = output.split("\n").filter((l: string) => l.startsWith("# TYPE"));
    expect(typeLines.length).toBeGreaterThan(10);

    // Each TYPE should be gauge or counter
    for (const line of typeLines) {
      expect(line).toMatch(/(gauge|counter)$/);
    }
  });
});

describe("neural seed-nodes", () => {
  it("exports seedHotelNodes function", async () => {
    const mod = await import("../neural/seed-nodes.js");
    expect(typeof mod.seedHotelNodes).toBe("function");
  });

  it("defines 6 nodes", async () => {
    const { HOTEL_SCRAPER_NODES } = await import("../neural/seed-nodes.js");
    expect(HOTEL_SCRAPER_NODES).toHaveLength(6);

    // Coordinator
    const coord = HOTEL_SCRAPER_NODES.find((n) => n.nodeId === "hotel-scraper");
    expect(coord).toBeDefined();
    expect(coord!.nodeType).toBe("capability");
    expect(coord!.capabilities).toContain("price_comparison");

    // 5 data sources
    const sources = HOTEL_SCRAPER_NODES.filter((n) => n.nodeType === "data_source");
    expect(sources).toHaveLength(5);
  });

  it("defines 11 edges", async () => {
    const { HOTEL_SCRAPER_EDGES } = await import("../neural/seed-nodes.js");
    expect(HOTEL_SCRAPER_EDGES).toHaveLength(11);

    // 5 activation edges (coordinator → sources)
    const activation = HOTEL_SCRAPER_EDGES.filter((e) => e.edgeType === "activation");
    expect(activation).toHaveLength(5);

    // 5 data_flow edges (sources → coordinator)
    const dataFlow = HOTEL_SCRAPER_EDGES.filter((e) => e.edgeType === "data_flow");
    expect(dataFlow).toHaveLength(5);

    // 1 monitoring edge (coordinator → iot-hub)
    const monitoring = HOTEL_SCRAPER_EDGES.filter((e) => e.edgeType === "monitoring");
    expect(monitoring).toHaveLength(1);
    expect(monitoring[0].targetNodeId).toBe("iot-hub");
  });

  it("returns zeros when Convex is unavailable", async () => {
    const { seedHotelNodes } = await import("../neural/seed-nodes.js");
    // Convex isn't running in test — should gracefully return zeros
    const result = await seedHotelNodes("iot-hub");
    expect(result.nodesCreated).toBe(0);
    expect(result.edgesCreated).toBe(0);
  });
});
