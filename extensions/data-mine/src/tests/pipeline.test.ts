import { describe, it, expect, beforeEach } from "vitest";
import { runAnalysis, getResult, getResults, clearCache } from "../pipeline/pipeline.js";
import { getScheduledJobs } from "../pipeline/scheduler.js";

describe("Analysis Pipeline", () => {
  beforeEach(() => {
    clearCache();
  });

  describe("runAnalysis", () => {
    it("runs statistics analysis on neural data", async () => {
      const result = await runAnalysis({
        engine: "statistics",
        source: "neural_graph",
        method: "descriptiveStats",
        params: {},
      });

      expect(result.success).toBe(true);
      expect(result.engine).toBe("statistics");
      expect(result.method).toBe("descriptiveStats");
      expect(result.result).toBeDefined();
      expect(result.metadata.durationMs).toBeGreaterThanOrEqual(0);
      expect(result.metadata.dataPointCount).toBeGreaterThan(0);
    });

    it("runs timeseries analysis", async () => {
      const result = await runAnalysis({
        engine: "timeseries",
        source: "hotel_scraper",
        method: "trendDetection",
        params: {},
      });

      expect(result.success).toBe(true);
      expect(result.engine).toBe("timeseries");
    });

    it("runs clustering analysis", async () => {
      const result = await runAnalysis({
        engine: "clustering",
        source: "neural_graph",
        method: "anomalyDetection",
        params: { method: "zscore" },
      });

      expect(result.success).toBe(true);
    });

    it("runs graph analytics", async () => {
      const result = await runAnalysis({
        engine: "graph_analytics",
        source: "neural_graph",
        method: "graphMetrics",
        params: {},
      });

      expect(result.success).toBe(true);
    });

    it("returns error for unknown engine", async () => {
      const result = await runAnalysis({
        engine: "nonexistent" as any,
        source: "neural_graph",
        method: "test",
        params: {},
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("returns error for unknown method", async () => {
      const result = await runAnalysis({
        engine: "statistics",
        source: "neural_graph",
        method: "nonexistent",
        params: {},
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Unknown");
    });

    it("accepts raw data", async () => {
      const result = await runAnalysis({
        engine: "statistics",
        source: "custom",
        method: "descriptiveStats",
        params: {},
        rawData: [
          {
            id: "test",
            name: "Test",
            source: "custom",
            points: [
              { timestamp: 1, value: 10 },
              { timestamp: 2, value: 20 },
              { timestamp: 3, value: 30 },
            ],
          },
        ],
      });

      expect(result.success).toBe(true);
      const stats = result.result as any;
      expect(stats.mean).toBeCloseTo(20, 1);
    });
  });

  describe("result caching", () => {
    it("caches results and retrieves by ID", async () => {
      const result = await runAnalysis({
        engine: "statistics",
        source: "neural_graph",
        method: "descriptiveStats",
        params: {},
      });

      const cached = getResult(result.id);
      expect(cached).toBeDefined();
      expect(cached!.id).toBe(result.id);
    });

    it("returns undefined for unknown ID", () => {
      expect(getResult("nonexistent")).toBeUndefined();
    });

    it("lists recent results", async () => {
      await runAnalysis({
        engine: "statistics",
        source: "neural_graph",
        method: "descriptiveStats",
        params: {},
      });
      await runAnalysis({
        engine: "timeseries",
        source: "hotel_scraper",
        method: "trendDetection",
        params: {},
      });

      const { results, total } = getResults();
      expect(total).toBe(2);
      expect(results).toHaveLength(2);
    });

    it("supports pagination", async () => {
      for (let i = 0; i < 5; i++) {
        await runAnalysis({
          engine: "statistics",
          source: "neural_graph",
          method: "descriptiveStats",
          params: {},
        });
      }

      const { results, total } = getResults(2, 1);
      expect(total).toBe(5);
      expect(results).toHaveLength(2);
    });
  });

  describe("scheduler", () => {
    it("has 4 default scheduled jobs", () => {
      const jobs = getScheduledJobs();
      expect(jobs).toHaveLength(4);
      expect(jobs[0].id).toBe("neural-health");
      expect(jobs[1].id).toBe("hotel-trends");
      expect(jobs[2].id).toBe("model-performance");
      expect(jobs[3].id).toBe("anomaly-scan");
    });

    it("all default jobs are enabled", () => {
      const jobs = getScheduledJobs();
      for (const job of jobs) {
        expect(job.enabled).toBe(true);
      }
    });
  });
});
