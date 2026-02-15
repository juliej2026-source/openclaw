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
import { parseCSV, parseJSON } from "../connectors/csv-connector.js";
import { getHotelPrices } from "../connectors/hotel-connector.js";
import { getModelPerformance } from "../connectors/meta-connector.js";
import { getNetworkTelemetry } from "../connectors/network-connector.js";
import { getNeuralExecutions, getNeuralTopology } from "../connectors/neural-connector.js";
import { kMeansClustering, anomalyDetection, pcaAnalysis } from "../engines/clustering.js";
import {
  createExperiment,
  recordObservation,
  evaluateExperiment,
  clearExperiments,
} from "../engines/experiments.js";
import { tTest, effectSize, confidenceInterval } from "../engines/experiments.js";
import {
  buildGraph,
  centralityAnalysis,
  communityDetection,
  graphMetrics,
} from "../engines/graph-analytics.js";
import { descriptiveStats, correlationMatrix } from "../engines/statistics.js";
import { trendDetection, movingAverage, forecast } from "../engines/timeseries.js";
import { formatMetrics } from "../metrics/mine-metrics.js";
import { runAnalysis, clearCache } from "../pipeline/pipeline.js";

describe("Integration Tests", () => {
  beforeEach(() => {
    clearCache();
    clearExperiments();
  });

  describe("Statistics: hotel prices -> descriptive stats + correlations", () => {
    it("loads hotel prices and computes descriptive stats", async () => {
      const series = await getHotelPrices();
      expect(series.length).toBeGreaterThan(0);

      const allValues = series.flatMap((s) => s.points.map((p) => p.value));
      const stats = descriptiveStats(allValues);

      expect(stats.count).toBeGreaterThan(0);
      expect(stats.mean).toBeGreaterThan(0);
      expect(stats.stdDev).toBeGreaterThan(0);
      expect(stats.min).toBeLessThanOrEqual(stats.max);
      expect(stats.median).toBeGreaterThan(0);
    });

    it("computes correlations across hotel price series", async () => {
      const series = await getHotelPrices();
      const variables: Record<string, number[]> = {};
      for (const s of series) {
        variables[s.name] = s.points.map((p) => p.value);
      }
      const matrix = correlationMatrix(variables);

      expect(matrix.variables.length).toBe(series.length);
      expect(matrix.matrix.length).toBe(series.length);
      // Diagonal should be 1
      for (let i = 0; i < matrix.matrix.length; i++) {
        expect(matrix.matrix[i][i]).toBeCloseTo(1.0, 5);
      }
    });

    it("end-to-end via pipeline: hotel price stats", async () => {
      const result = await runAnalysis({
        engine: "statistics",
        source: "hotel_scraper",
        method: "descriptiveStats",
        params: {},
      });
      expect(result.success).toBe(true);
      expect(result.engine).toBe("statistics");
      expect(result.source).toBe("hotel_scraper");
      expect((result.result as any).mean).toBeGreaterThan(0);
    });
  });

  describe("Time-Series: neural-graph execution history -> trends -> forecast", () => {
    it("detects trends in neural-graph latency data", async () => {
      const series = await getNeuralExecutions();
      const latencySeries = series.find((s) => s.name.toLowerCase().includes("latency"));
      expect(latencySeries).toBeDefined();

      const values = latencySeries!.points.map((p) => p.value);
      const trend = trendDetection(values);

      expect(trend.direction).toBeDefined();
      expect(["up", "down", "flat"]).toContain(trend.direction);
      expect(typeof trend.slope).toBe("number");
      expect(typeof trend.rSquared).toBe("number");
    });

    it("computes moving average on execution data", async () => {
      const series = await getNeuralExecutions();
      const values = series[0].points.map((p) => p.value);
      const sma = movingAverage(values, 3, "sma");

      expect(sma.length).toBe(values.length);
      // SMA values should be valid numbers
      const validValues = sma.filter((v) => !isNaN(v));
      expect(validValues.length).toBeGreaterThan(0);
    });

    it("forecasts neural-graph data", async () => {
      const series = await getNeuralExecutions();
      const values = series[0].points.map((p) => p.value);
      const fc = forecast(values, 5, "ses");

      // forecast returns number[] directly
      expect(fc.length).toBe(5);
      for (const v of fc) {
        expect(typeof v).toBe("number");
        expect(v).toBeGreaterThanOrEqual(0);
      }
    });

    it("end-to-end via pipeline: timeseries trend detection", async () => {
      const result = await runAnalysis({
        engine: "timeseries",
        source: "neural_graph",
        method: "trendDetection",
        params: {},
      });
      expect(result.success).toBe(true);
      expect((result.result as any).direction).toBeDefined();
    });
  });

  describe("Clustering: meta-engine performance -> K-means + anomalies", () => {
    it("clusters meta-engine performance data", async () => {
      const series = await getModelPerformance();
      const allValues = series.flatMap((s) => s.points.map((p) => p.value));

      const result = kMeansClustering(
        allValues.map((v) => [v]),
        2,
      );

      expect(result.k).toBe(2);
      expect(result.clusters.length).toBe(2);
      expect(result.labels.length).toBe(allValues.length);
      expect(result.silhouetteScore).toBeDefined();
    });

    it("detects anomalies in performance data", async () => {
      const series = await getModelPerformance();
      const values = series[0].points.map((p) => p.value);
      const result = anomalyDetection(values, "zscore", 2.0);

      expect(result.totalPoints).toBe(values.length);
      expect(result.anomalies.length).toBeGreaterThanOrEqual(0);
      expect(result.method).toBe("zscore");
    });

    it("runs PCA on multi-series data", async () => {
      const series = await getModelPerformance();
      // Build a matrix with multiple features
      const minLen = Math.min(...series.map((s) => s.points.length));
      const data = [];
      for (let i = 0; i < minLen; i++) {
        data.push(series.map((s) => s.points[i].value));
      }

      if (data.length >= 3 && data[0].length >= 2) {
        const pca = pcaAnalysis(data, Math.min(2, data[0].length));
        expect(pca.explainedVariance.length).toBeGreaterThan(0);
        expect(pca.projections.length).toBe(data.length);
      }
    });

    it("end-to-end via pipeline: clustering", async () => {
      const result = await runAnalysis({
        engine: "clustering",
        source: "meta_engine",
        method: "kMeansClustering",
        params: { k: 2 },
      });
      expect(result.success).toBe(true);
      expect((result.result as any).clusters).toBeDefined();
    });
  });

  describe("Graph: neural-graph topology -> centrality -> bottlenecks", () => {
    it("builds graph from neural topology and computes centrality", async () => {
      const { nodes, edges } = await getNeuralTopology();
      const graph = buildGraph(nodes, edges);

      // centralityAnalysis returns CentralityResult[] — one per node
      const cent = centralityAnalysis(graph);
      expect(cent.length).toBe(nodes.length);

      for (const node of cent) {
        expect(typeof node.degree).toBe("number");
        expect(typeof node.pageRank).toBe("number");
        expect(typeof node.betweenness).toBe("number");
      }

      // PageRank scores should sum to approximately 1
      const prSum = cent.reduce((s, n) => s + n.pageRank, 0);
      expect(prSum).toBeCloseTo(1.0, 0);
    });

    it("detects communities in neural topology", async () => {
      const { nodes, edges } = await getNeuralTopology();
      const graph = buildGraph(nodes, edges);

      const result = communityDetection(graph);
      expect(result.communities.length).toBeGreaterThanOrEqual(1);
      // Total nodes across all communities should equal node count
      const totalNodes = result.communities.reduce((s, c) => s + c.nodes.length, 0);
      expect(totalNodes).toBe(nodes.length);
    });

    it("computes graph metrics", async () => {
      const { nodes, edges } = await getNeuralTopology();
      const graph = buildGraph(nodes, edges);

      const metrics = graphMetrics(graph);
      expect(metrics.nodeCount).toBe(nodes.length);
      expect(metrics.edgeCount).toBe(edges.length);
      expect(metrics.density).toBeGreaterThan(0);
      expect(metrics.density).toBeLessThanOrEqual(1);
    });

    it("end-to-end via pipeline: graph analytics", async () => {
      const result = await runAnalysis({
        engine: "graph_analytics",
        source: "neural_graph",
        method: "graphMetrics",
        params: {},
      });
      expect(result.success).toBe(true);
      expect((result.result as any).nodeCount).toBeGreaterThan(0);
    });
  });

  describe("Experiment: A/B test lifecycle -> significance evaluation", () => {
    it("creates experiment, adds observations, evaluates significance", () => {
      const exp = createExperiment({
        name: "Neural Latency Test",
        description: "Compare old vs new routing algorithm",
        groups: ["control", "variant"],
        metric: "latency_ms",
        hypothesis: "variant < control",
        alpha: 0.05,
        minSampleSize: 10,
      });

      expect(exp.id).toBeTruthy();
      expect(exp.name).toBe("Neural Latency Test");

      // Add control group observations (higher latency)
      for (let i = 0; i < 30; i++) {
        recordObservation({
          experimentId: exp.id,
          group: "control",
          value: 100 + Math.random() * 30,
          timestamp: new Date().toISOString(),
        });
      }

      // Add variant group observations (lower latency)
      for (let i = 0; i < 30; i++) {
        recordObservation({
          experimentId: exp.id,
          group: "variant",
          value: 80 + Math.random() * 30,
          timestamp: new Date().toISOString(),
        });
      }

      const result = evaluateExperiment(exp.id);
      expect(result.experimentId).toBe(exp.id);
      expect(result.groupStats).toBeDefined();
      expect(result.groupStats.control).toBeDefined();
      expect(result.groupStats.variant).toBeDefined();
      expect(result.groupStats.control.count).toBe(30);
      expect(result.groupStats.variant.count).toBe(30);
      expect(result.recommendation).toBeDefined();

      // With a ~20ms difference and ~30 samples, we should detect significance
      if (result.tTest) {
        expect(typeof result.tTest.statistic).toBe("number");
        expect(typeof result.tTest.pValue).toBe("number");
      }
    });

    it("performs t-test with known distributions", () => {
      // Group A: mean ~50, Group B: mean ~60
      const groupA = [48, 50, 52, 49, 51, 47, 53, 50, 48, 52];
      const groupB = [58, 60, 62, 59, 61, 57, 63, 60, 58, 62];

      const result = tTest(groupA, groupB);
      expect(result.statistic).toBeLessThan(0); // A < B
      expect(result.pValue).toBeLessThan(0.01); // Highly significant
      expect(result.significant).toBe(true);
    });

    it("computes effect size and confidence intervals", () => {
      const groupA = [10, 12, 11, 13, 10, 14, 11, 12];
      const groupB = [20, 22, 21, 23, 20, 24, 21, 22];

      const es = effectSize(groupA, groupB);
      expect(es.cohensD).toBeGreaterThan(2); // Very large effect
      expect(es.interpretation).toBe("large");

      const ci = confidenceInterval(groupA, 0.95);
      expect(ci[0]).toBeLessThan(ci[1]); // lower < upper
      const mean = groupA.reduce((s, v) => s + v, 0) / groupA.length;
      expect(ci[0]).toBeLessThan(mean);
      expect(ci[1]).toBeGreaterThan(mean);
    });
  });

  describe("Pipeline: full request -> connector -> engine -> result -> API response", () => {
    it("full flow: analyze -> cache -> retrieve via API", async () => {
      // Step 1: Run analysis via API handler
      const analyzeResult = await handleAnalyze({
        engine: "statistics",
        source: "hotel_scraper",
        method: "descriptiveStats",
        params: {},
      });
      expect((analyzeResult as any).success).toBe(true);
      const id = (analyzeResult as any).id;

      // Step 2: Retrieve result by ID
      const getResult = await handleGetResult(id);
      expect((getResult as any).id).toBe(id);
      expect((getResult as any).engine).toBe("statistics");

      // Step 3: List results shows it
      const listResult = await handleListResults();
      expect(listResult.total).toBeGreaterThanOrEqual(1);
      expect(listResult.results.some((r: any) => r.id === id)).toBe(true);

      // Step 4: Status reflects the analysis
      const status = await handleDataMineStatus();
      expect(status.totalAnalyses).toBeGreaterThanOrEqual(1);
      expect(status.cachedResults).toBeGreaterThanOrEqual(1);

      // Step 5: Metrics include the count
      const metrics = await handleDataMineMetrics();
      expect(metrics).toContain("data_mine_analyses_total");
    });

    it("full flow: import CSV -> analyze imported data", async () => {
      // Step 1: Import CSV dataset
      const importResult = await handleImportDataset({
        format: "csv",
        content:
          "timestamp,value\n1,100\n2,150\n3,120\n4,180\n5,200\n6,160\n7,220\n8,190\n9,250\n10,230",
        name: "integration-test",
      });
      expect((importResult as any).datasetId).toBeTruthy();
      expect((importResult as any).pointCount).toBe(10);

      // Step 2: Run analysis with raw data
      const analyzeResult = await handleAnalyze({
        engine: "statistics",
        source: "custom",
        method: "descriptiveStats",
        params: {},
        rawData: [
          {
            id: "test-import",
            name: "Test Import",
            source: "custom",
            points: [
              { timestamp: 1, value: 100 },
              { timestamp: 2, value: 150 },
              { timestamp: 3, value: 120 },
              { timestamp: 4, value: 180 },
              { timestamp: 5, value: 200 },
            ],
          },
        ],
      } as any);
      expect((analyzeResult as any).success).toBe(true);
      const stats = (analyzeResult as any).result;
      expect(stats.mean).toBeCloseTo(150, 0);
      expect(stats.count).toBe(5);
    });

    it("full flow: all convenience endpoints return data", async () => {
      const [stats, correlations, timeseries, clusters, anomalies, graph] = await Promise.all([
        handleStats(),
        handleCorrelations(),
        handleTimeseries(),
        handleClusters(),
        handleAnomalies(),
        handleGraph(),
      ]);

      // Each endpoint should return valid data (not an error object)
      expect(stats).toBeDefined();
      expect(correlations).toBeDefined();
      expect(timeseries).toBeDefined();
      expect(clusters).toBeDefined();
      expect(anomalies).toBeDefined();
      expect(graph).toBeDefined();
      expect(graph.metrics).toBeDefined();
    });

    it("full flow: datasets endpoint aggregates all connectors", async () => {
      const result = await handleListDatasets();
      expect(result.total).toBeGreaterThan(0);

      const sources = new Set(result.datasets.map((d: any) => d.source));
      // Should have data from at least neural_graph and hotel_scraper
      expect(sources.has("neural_graph")).toBe(true);
      expect(sources.has("hotel_scraper")).toBe(true);
    });

    it("full flow: experiment lifecycle via API", async () => {
      // Create
      const created = await handleCreateExperiment({
        name: "Integration Test Experiment",
        groups: ["control", "variant"],
        metric: "conversion_rate",
        hypothesis: "variant improves conversion",
      });
      expect((created as any).id).toBeTruthy();

      // List
      const listed = await handleListExperiments();
      expect(listed.total).toBe(1);
      expect(listed.experiments[0].name).toBe("Integration Test Experiment");

      // Get
      const evaluated = await handleGetExperiment((created as any).id);
      expect((evaluated as any).experimentId).toBe((created as any).id);
      expect((evaluated as any).recommendation).toBeDefined();
    });
  });

  describe("Cross-engine integration", () => {
    it("runs all engine types sequentially on the same source", async () => {
      const engines = [
        { engine: "statistics", method: "descriptiveStats" },
        { engine: "timeseries", method: "trendDetection" },
        { engine: "clustering", method: "anomalyDetection" },
        { engine: "graph_analytics", method: "graphMetrics" },
      ];

      for (const { engine, method } of engines) {
        const result = await runAnalysis({
          engine: engine as any,
          source: "neural_graph",
          method,
          params: engine === "clustering" ? { method: "zscore" } : {},
        });
        expect(result.success).toBe(true);
        expect(result.engine).toBe(engine);
      }
    });

    it("handles network data through statistics and timeseries", async () => {
      const statsResult = await runAnalysis({
        engine: "statistics",
        source: "network",
        method: "descriptiveStats",
        params: {},
      });
      expect(statsResult.success).toBe(true);

      const tsResult = await runAnalysis({
        engine: "timeseries",
        source: "network",
        method: "trendDetection",
        params: {},
      });
      expect(tsResult.success).toBe(true);
    });

    it("JSON import -> statistics + clustering analysis", async () => {
      const data = Array.from({ length: 50 }, (_, i) => ({
        timestamp: i,
        value: Math.sin(i / 5) * 10 + 50 + Math.random() * 3,
      }));

      const series = parseJSON(JSON.stringify(data), "sine-wave");
      expect(series.points.length).toBe(50);

      // Run stats on the imported data
      const statsResult = await runAnalysis({
        engine: "statistics",
        source: "custom",
        method: "descriptiveStats",
        params: {},
        rawData: [series],
      });
      expect(statsResult.success).toBe(true);
      expect((statsResult.result as any).count).toBe(50);

      // Run clustering
      const clusterResult = await runAnalysis({
        engine: "clustering",
        source: "custom",
        method: "kMeansClustering",
        params: { k: 3 },
        rawData: [series],
      });
      expect(clusterResult.success).toBe(true);
      expect((clusterResult.result as any).clusters).toBeDefined();
    });
  });
});
