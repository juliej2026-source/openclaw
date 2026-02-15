import { describe, it, expect } from "vitest";
import type {
  EngineId,
  DataSourceId,
  DataPoint,
  DataSeries,
  AnalysisRequest,
  AnalysisResult,
  DescriptiveStats,
  CorrelationResult,
  CorrelationMatrix,
  RegressionResult,
  TimeSeriesResult,
  MovingAverageType,
  ClusterResult,
  PCAResult,
  AnomalyResult,
  AnomalyMethod,
  GraphNode,
  GraphEdge,
  CentralityResult,
  CommunityResult,
  GraphMetrics,
  ExperimentConfig,
  ExperimentObservation,
  ExperimentResult,
  HypothesisTest,
} from "../types.js";
import {
  ENGINE_IDS,
  DATA_SOURCE_IDS,
  STATION_ID,
  ANALYSIS_CACHE_TTL_MS,
  SCHEDULED_INTERVAL_MS,
  MAX_DATA_POINTS,
} from "../types.js";

describe("Data Mine types", () => {
  describe("ENGINE_IDS", () => {
    it("has 5 engines", () => {
      expect(ENGINE_IDS).toHaveLength(5);
    });

    it("contains all expected engines", () => {
      expect(ENGINE_IDS).toContain("statistics");
      expect(ENGINE_IDS).toContain("timeseries");
      expect(ENGINE_IDS).toContain("clustering");
      expect(ENGINE_IDS).toContain("graph_analytics");
      expect(ENGINE_IDS).toContain("experiments");
    });

    it("is readonly", () => {
      const ids: readonly string[] = ENGINE_IDS;
      expect(ids).toBeDefined();
    });
  });

  describe("DATA_SOURCE_IDS", () => {
    it("has 5 data sources", () => {
      expect(DATA_SOURCE_IDS).toHaveLength(5);
    });

    it("contains all expected sources", () => {
      expect(DATA_SOURCE_IDS).toContain("neural_graph");
      expect(DATA_SOURCE_IDS).toContain("hotel_scraper");
      expect(DATA_SOURCE_IDS).toContain("meta_engine");
      expect(DATA_SOURCE_IDS).toContain("network");
      expect(DATA_SOURCE_IDS).toContain("custom");
    });
  });

  describe("constants", () => {
    it("STATION_ID is iot-hub", () => {
      expect(STATION_ID).toBe("iot-hub");
    });

    it("ANALYSIS_CACHE_TTL_MS is 5 minutes", () => {
      expect(ANALYSIS_CACHE_TTL_MS).toBe(300_000);
    });

    it("SCHEDULED_INTERVAL_MS is 1 hour", () => {
      expect(SCHEDULED_INTERVAL_MS).toBe(3_600_000);
    });

    it("MAX_DATA_POINTS is 100000", () => {
      expect(MAX_DATA_POINTS).toBe(100_000);
    });
  });

  describe("type shapes", () => {
    it("DataPoint has correct shape", () => {
      const point: DataPoint = { timestamp: Date.now(), value: 42 };
      expect(point.timestamp).toBeTypeOf("number");
      expect(point.value).toBe(42);
    });

    it("DataPoint accepts optional fields", () => {
      const point: DataPoint = {
        timestamp: Date.now(),
        value: 42,
        label: "test",
        metadata: { key: "value" },
      };
      expect(point.label).toBe("test");
      expect(point.metadata).toEqual({ key: "value" });
    });

    it("DataSeries has correct shape", () => {
      const series: DataSeries = {
        id: "series-1",
        name: "Test Series",
        source: "neural_graph",
        points: [{ timestamp: 1, value: 10 }],
      };
      expect(series.id).toBe("series-1");
      expect(series.source).toBe("neural_graph");
      expect(series.points).toHaveLength(1);
    });

    it("AnalysisRequest has correct shape", () => {
      const req: AnalysisRequest = {
        engine: "statistics",
        source: "hotel_scraper",
        method: "descriptiveStats",
        params: { window: 10 },
      };
      expect(req.engine).toBe("statistics");
      expect(req.source).toBe("hotel_scraper");
    });

    it("AnalysisResult has correct shape", () => {
      const result: AnalysisResult = {
        id: "result-1",
        engine: "timeseries",
        method: "movingAverage",
        source: "neural_graph",
        result: { values: [1, 2, 3] },
        metadata: {
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          durationMs: 42,
          dataPointCount: 100,
        },
        success: true,
      };
      expect(result.success).toBe(true);
      expect(result.metadata.durationMs).toBe(42);
    });

    it("DescriptiveStats has all required fields", () => {
      const stats: DescriptiveStats = {
        count: 10,
        mean: 5,
        median: 5,
        mode: 4,
        min: 1,
        max: 10,
        range: 9,
        stdDev: 2.5,
        variance: 6.25,
        skewness: 0.1,
        kurtosis: -0.5,
        q1: 3,
        q3: 7,
        iqr: 4,
        percentiles: { 25: 3, 50: 5, 75: 7 },
      };
      expect(stats.count).toBe(10);
      expect(stats.iqr).toBe(4);
    });

    it("RegressionResult supports all types", () => {
      const linear: RegressionResult = {
        type: "linear",
        coefficients: [2],
        intercept: 1,
        rSquared: 0.99,
        residuals: [0.1, -0.1],
        predictions: [3, 5],
      };
      const poly: RegressionResult = {
        type: "polynomial",
        coefficients: [1, 0, 1],
        intercept: 0,
        rSquared: 0.95,
        residuals: [],
        predictions: [],
      };
      const multi: RegressionResult = {
        type: "multivariate",
        coefficients: [1, 2, 3],
        intercept: 0.5,
        rSquared: 0.88,
        residuals: [],
        predictions: [],
      };
      expect(linear.type).toBe("linear");
      expect(poly.type).toBe("polynomial");
      expect(multi.type).toBe("multivariate");
    });

    it("ClusterResult has correct shape", () => {
      const cluster: ClusterResult = {
        k: 3,
        clusters: [{ centroid: [0, 0], points: [[1, 1]], size: 1 }],
        labels: [0],
        silhouetteScore: 0.8,
        inertia: 5.0,
      };
      expect(cluster.k).toBe(3);
      expect(cluster.silhouetteScore).toBe(0.8);
    });

    it("GraphMetrics has correct shape", () => {
      const metrics: GraphMetrics = {
        nodeCount: 10,
        edgeCount: 15,
        density: 0.33,
        diameter: 3,
        avgPathLength: 1.8,
        clusteringCoefficient: 0.5,
        connectedComponents: 1,
        isConnected: true,
      };
      expect(metrics.isConnected).toBe(true);
      expect(metrics.density).toBe(0.33);
    });

    it("ExperimentConfig has correct shape", () => {
      const config: ExperimentConfig = {
        id: "exp-1",
        name: "Test Experiment",
        description: "A/B test",
        groups: ["control", "treatment"],
        metric: "latency",
        hypothesis: "Treatment reduces latency",
        alpha: 0.05,
        minSampleSize: 30,
        createdAt: new Date().toISOString(),
      };
      expect(config.groups).toHaveLength(2);
      expect(config.alpha).toBe(0.05);
    });

    it("HypothesisTest has correct shape", () => {
      const test: HypothesisTest = {
        testName: "t-test",
        statistic: 2.5,
        pValue: 0.015,
        degreesOfFreedom: 58,
        significant: true,
        confidenceInterval: [-3.2, -0.8],
        confidenceLevel: 0.95,
      };
      expect(test.significant).toBe(true);
      expect(test.pValue).toBeLessThan(0.05);
    });

    it("MovingAverageType accepts valid types", () => {
      const types: MovingAverageType[] = ["sma", "ema", "wma"];
      expect(types).toHaveLength(3);
    });

    it("AnomalyMethod accepts valid methods", () => {
      const methods: AnomalyMethod[] = ["zscore", "iqr", "mahalanobis"];
      expect(methods).toHaveLength(3);
    });

    it("CorrelationMatrix has correct shape", () => {
      const matrix: CorrelationMatrix = {
        variables: ["a", "b"],
        matrix: [
          [1, 0.5],
          [0.5, 1],
        ],
        method: "pearson",
      };
      expect(matrix.variables).toHaveLength(2);
      expect(matrix.matrix[0][0]).toBe(1);
    });

    it("CommunityResult has correct shape", () => {
      const result: CommunityResult = {
        communities: [{ id: 0, nodes: ["a", "b"], size: 2 }],
        modularity: 0.4,
        algorithm: "louvain",
      };
      expect(result.communities).toHaveLength(1);
      expect(result.modularity).toBe(0.4);
    });

    it("ExperimentResult has correct shape", () => {
      const result: ExperimentResult = {
        experimentId: "exp-1",
        config: {
          id: "exp-1",
          name: "Test",
          description: "Test",
          groups: ["A", "B"],
          metric: "score",
          hypothesis: "A > B",
          alpha: 0.05,
          minSampleSize: 30,
          createdAt: new Date().toISOString(),
        },
        groupStats: {},
        significant: false,
        recommendation: "Collect more data",
      };
      expect(result.significant).toBe(false);
    });
  });
});
