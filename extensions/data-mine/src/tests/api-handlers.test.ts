import { describe, it, expect, beforeEach } from "vitest";
import {
  handleDataMineStatus,
  handleAnalyze,
  handleGetResult,
  handleListResults,
  handleListDatasets,
  handleImportDataset,
  handleStats,
  handleCorrelations,
  handleTimeseries,
  handleClusters,
  handleAnomalies,
  handleGraph,
  handleCreateExperiment,
  handleListExperiments,
  handleGetExperiment,
  handleDataMineMetrics,
} from "../api-handlers.js";
import { clearExperiments } from "../engines/experiments.js";
import { clearCache } from "../pipeline/pipeline.js";

describe("API Handlers", () => {
  beforeEach(() => {
    clearCache();
    clearExperiments();
  });

  describe("handleDataMineStatus", () => {
    it("returns status object", async () => {
      const result = await handleDataMineStatus();
      expect(result.status).toBe("ok");
      expect(result.stationId).toBe("iot-hub");
      expect(result.version).toBeDefined();
      expect(result.engines).toBe(5);
      expect(result.dataSources).toBe(5);
      expect(typeof result.totalAnalyses).toBe("number");
      expect(typeof result.cachedResults).toBe("number");
      expect(typeof result.uptime).toBe("number");
    });
  });

  describe("handleAnalyze", () => {
    it("returns 400 when engine missing", async () => {
      const result = await handleAnalyze({ method: "test" } as any);
      expect((result as any).status).toBe(400);
      expect((result as any).error).toContain("engine");
    });

    it("returns 400 when method missing", async () => {
      const result = await handleAnalyze({ engine: "statistics" } as any);
      expect((result as any).status).toBe(400);
      expect((result as any).error).toContain("method");
    });

    it("runs analysis successfully", async () => {
      const result = await handleAnalyze({
        engine: "statistics",
        source: "neural_graph",
        method: "descriptiveStats",
        params: {},
      });
      expect((result as any).success).toBe(true);
      expect((result as any).engine).toBe("statistics");
    });
  });

  describe("handleGetResult", () => {
    it("returns 404 for unknown ID", async () => {
      const result = await handleGetResult("nonexistent");
      expect((result as any).status).toBe(404);
    });

    it("returns cached result by ID", async () => {
      const analysis = await handleAnalyze({
        engine: "statistics",
        source: "neural_graph",
        method: "descriptiveStats",
        params: {},
      });
      const id = (analysis as any).id;
      const result = await handleGetResult(id);
      expect((result as any).id).toBe(id);
    });
  });

  describe("handleListResults", () => {
    it("returns results list with total", async () => {
      await handleAnalyze({
        engine: "statistics",
        source: "neural_graph",
        method: "descriptiveStats",
        params: {},
      });
      const result = await handleListResults();
      expect(result.total).toBeGreaterThanOrEqual(1);
      expect(result.results.length).toBeGreaterThanOrEqual(1);
    });

    it("supports pagination", async () => {
      for (let i = 0; i < 3; i++) {
        await handleAnalyze({
          engine: "statistics",
          source: "neural_graph",
          method: "descriptiveStats",
          params: {},
        });
      }
      const result = await handleListResults({ limit: 2, offset: 0 });
      expect(result.results.length).toBe(2);
      expect(result.total).toBe(3);
    });
  });

  describe("handleListDatasets", () => {
    it("returns datasets from all connectors", async () => {
      const result = await handleListDatasets();
      expect(result.datasets.length).toBeGreaterThan(0);
      expect(result.total).toBe(result.datasets.length);
      for (const ds of result.datasets) {
        expect(ds.id).toBeTruthy();
        expect(ds.name).toBeTruthy();
        expect(ds.source).toBeTruthy();
        expect(ds.pointCount).toBeGreaterThan(0);
      }
    });
  });

  describe("handleImportDataset", () => {
    it("returns 400 when format missing", async () => {
      const result = await handleImportDataset({ content: "data" } as any);
      expect((result as any).status).toBe(400);
    });

    it("returns 400 when content missing", async () => {
      const result = await handleImportDataset({ format: "csv" } as any);
      expect((result as any).status).toBe(400);
    });

    it("returns 400 for unsupported format", async () => {
      const result = await handleImportDataset({ format: "xml", content: "<data/>" });
      expect((result as any).status).toBe(400);
    });

    it("imports CSV data", async () => {
      const result = await handleImportDataset({
        format: "csv",
        content: "timestamp,value\n1,10\n2,20\n3,30",
        name: "test-csv",
      });
      expect((result as any).datasetId).toBeTruthy();
      expect((result as any).pointCount).toBe(3);
      expect((result as any).name).toBe("test-csv");
    });

    it("imports JSON data", async () => {
      const result = await handleImportDataset({
        format: "json",
        content: JSON.stringify([
          { timestamp: 1, value: 10 },
          { timestamp: 2, value: 20 },
        ]),
      });
      expect((result as any).datasetId).toBeTruthy();
      expect((result as any).pointCount).toBe(2);
    });
  });

  describe("handleStats", () => {
    it("returns descriptive statistics", async () => {
      const result = await handleStats();
      expect(result).toBeDefined();
      expect(typeof result).toBe("object");
    });

    it("accepts source parameter", async () => {
      const result = await handleStats({ source: "hotel_scraper" });
      expect(result).toBeDefined();
    });
  });

  describe("handleCorrelations", () => {
    it("returns correlation data", async () => {
      const result = await handleCorrelations();
      expect(result).toBeDefined();
    });
  });

  describe("handleTimeseries", () => {
    it("returns timeseries analysis", async () => {
      const result = await handleTimeseries();
      expect(result).toBeDefined();
    });

    it("accepts method parameter", async () => {
      const result = await handleTimeseries({ method: "movingAverage" });
      expect(result).toBeDefined();
    });
  });

  describe("handleClusters", () => {
    it("returns cluster results", async () => {
      const result = await handleClusters();
      expect(result).toBeDefined();
    });

    it("accepts k parameter", async () => {
      const result = await handleClusters({ k: 2 });
      expect(result).toBeDefined();
    });
  });

  describe("handleAnomalies", () => {
    it("returns anomaly detection results", async () => {
      const result = await handleAnomalies();
      expect(result).toBeDefined();
    });

    it("accepts method and threshold", async () => {
      const result = await handleAnomalies({ method: "iqr", threshold: 2.0 });
      expect(result).toBeDefined();
    });
  });

  describe("handleGraph", () => {
    it("returns graph analytics with metrics, centrality, communities", async () => {
      const result = await handleGraph();
      expect(result.metrics).toBeDefined();
      expect(result.centrality).toBeDefined();
      expect(result.communities).toBeDefined();
    });
  });

  describe("handleCreateExperiment", () => {
    it("returns 400 when name missing", async () => {
      const result = await handleCreateExperiment({ groups: ["a", "b"], metric: "score" });
      expect((result as any).status).toBe(400);
    });

    it("returns 400 when groups missing", async () => {
      const result = await handleCreateExperiment({ name: "test", metric: "score" });
      expect((result as any).status).toBe(400);
    });

    it("creates experiment", async () => {
      const result = await handleCreateExperiment({
        name: "test-exp",
        groups: ["control", "variant"],
        metric: "conversion",
        hypothesis: "variant > control",
      });
      expect((result as any).id).toBeTruthy();
      expect((result as any).name).toBe("test-exp");
    });
  });

  describe("handleListExperiments", () => {
    it("returns empty list initially", async () => {
      const result = await handleListExperiments();
      expect(result.experiments).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it("returns experiments after creation", async () => {
      await handleCreateExperiment({
        name: "exp-1",
        groups: ["a", "b"],
        metric: "score",
      });
      const result = await handleListExperiments();
      expect(result.total).toBe(1);
    });
  });

  describe("handleGetExperiment", () => {
    it("returns 404 for unknown experiment", async () => {
      const result = await handleGetExperiment("nonexistent");
      expect((result as any).status).toBe(404);
    });

    it("returns experiment evaluation", async () => {
      const exp = await handleCreateExperiment({
        name: "eval-test",
        groups: ["control", "variant"],
        metric: "conversion",
      });
      const result = await handleGetExperiment((exp as any).id);
      expect((result as any).experimentId).toBe((exp as any).id);
      expect((result as any).recommendation).toBeDefined();
    });
  });

  describe("handleDataMineMetrics", () => {
    it("returns Prometheus-format metrics string", async () => {
      const result = await handleDataMineMetrics();
      expect(typeof result).toBe("string");
      expect(result).toContain("data_mine_analyses_total");
      expect(result).toContain("data_mine_cached_results");
      expect(result).toContain("# HELP");
      expect(result).toContain("# TYPE");
    });
  });
});
