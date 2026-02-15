import { describe, it, expect } from "vitest";
import {
  kMeansClustering,
  pcaAnalysis,
  anomalyDetection,
  silhouetteScore,
  elbowMethod,
  normalizeData,
} from "../engines/clustering.js";

describe("ML/Clustering Engine", () => {
  // Generate well-separated 2D clusters
  function makeClusterData(): number[][] {
    const data: number[][] = [];
    // Cluster at (0, 0)
    for (let i = 0; i < 20; i++) data.push([Math.sin(i) * 0.5, Math.cos(i) * 0.5]);
    // Cluster at (10, 0)
    for (let i = 0; i < 20; i++) data.push([10 + Math.sin(i) * 0.5, Math.cos(i) * 0.5]);
    // Cluster at (5, 10)
    for (let i = 0; i < 20; i++) data.push([5 + Math.sin(i) * 0.5, 10 + Math.cos(i) * 0.5]);
    return data;
  }

  describe("kMeansClustering", () => {
    it("recovers 3 well-separated clusters", () => {
      const data = makeClusterData();
      const result = kMeansClustering(data, 3, { seed: 42 });
      expect(result.k).toBe(3);
      expect(result.clusters).toHaveLength(3);
      expect(result.labels).toHaveLength(60);
      // Each cluster should have ~20 points
      for (const c of result.clusters) {
        expect(c.size).toBeGreaterThan(10);
      }
    });

    it("computes positive silhouette for well-separated data", () => {
      const data = makeClusterData();
      const result = kMeansClustering(data, 3, { seed: 42 });
      expect(result.silhouetteScore).toBeGreaterThan(0.5);
    });

    it("computes inertia", () => {
      const data = makeClusterData();
      const result = kMeansClustering(data, 3, { seed: 42 });
      expect(result.inertia).toBeGreaterThan(0);
    });

    it("handles empty data", () => {
      const result = kMeansClustering([], 3);
      expect(result.k).toBe(0);
      expect(result.clusters).toHaveLength(0);
    });

    it("clamps k to data length", () => {
      const data = [
        [1, 0],
        [2, 0],
        [3, 0],
      ];
      const result = kMeansClustering(data, 10);
      expect(result.k).toBe(3);
    });
  });

  describe("pcaAnalysis", () => {
    it("reduces correlated 2D data to 1 principal component", () => {
      // Highly correlated: y ≈ x
      const data = Array.from({ length: 50 }, (_, i) => [i, i + Math.sin(i) * 0.1]);
      const result = pcaAnalysis(data, 2);
      expect(result.eigenvalues).toHaveLength(2);
      // First component should explain >80% variance
      expect(result.explainedVariance[0]).toBeGreaterThan(0.8);
      expect(result.projections).toHaveLength(50);
    });

    it("handles empty data", () => {
      const result = pcaAnalysis([]);
      expect(result.eigenvalues).toHaveLength(0);
    });

    it("cumulative variance sums correctly", () => {
      const data = Array.from({ length: 30 }, (_, i) => [i, i * 2, i * 0.5]);
      const result = pcaAnalysis(data);
      // Last cumulative should be ~1
      const last = result.cumulativeVariance[result.cumulativeVariance.length - 1];
      expect(last).toBeCloseTo(1.0, 1);
    });
  });

  describe("anomalyDetection", () => {
    it("detects Z-score outliers", () => {
      const data = [1, 1, 1, 1, 1, 1, 1, 100, 1, 1];
      const result = anomalyDetection(data, "zscore", 2.0);
      expect(result.anomalies.length).toBeGreaterThan(0);
      const outlier = result.anomalies.find((a) => a.value === 100);
      expect(outlier).toBeDefined();
      expect(outlier!.index).toBe(7);
    });

    it("detects IQR outliers", () => {
      const data = [1, 1, 1, 1, 1, 1, 1, 100, 1, 1];
      const result = anomalyDetection(data, "iqr");
      expect(result.anomalies.length).toBeGreaterThan(0);
      expect(result.anomalies[0].value).toBe(100);
    });

    it("no anomalies in constant series", () => {
      const data = new Array(20).fill(5);
      const result = anomalyDetection(data, "zscore");
      expect(result.anomalies).toHaveLength(0);
    });

    it("computes anomaly rate", () => {
      const data = [1, 1, 1, 1, 1, 1, 1, 100, 200, 1];
      const result = anomalyDetection(data, "zscore", 2.0);
      expect(result.anomalyRate).toBeGreaterThan(0);
      expect(result.totalPoints).toBe(10);
    });

    it("Mahalanobis detection on 2D data", () => {
      const data: number[][] = [];
      for (let i = 0; i < 30; i++) data.push([i * 0.1, i * 0.1]);
      data.push([100, 100]); // outlier
      const result = anomalyDetection(data, "mahalanobis", 3.0);
      expect(result.anomalies.length).toBeGreaterThan(0);
    });
  });

  describe("silhouetteScore", () => {
    it("returns high score for perfect clusters", () => {
      const data = [
        [0, 0],
        [0.1, 0],
        [0, 0.1],
        [10, 10],
        [10.1, 10],
        [10, 10.1],
      ];
      const labels = [0, 0, 0, 1, 1, 1];
      const score = silhouetteScore(data, labels);
      expect(score).toBeGreaterThan(0.9);
    });

    it("returns 0 for single point", () => {
      expect(silhouetteScore([[1, 2]], [0])).toBe(0);
    });
  });

  describe("elbowMethod", () => {
    it("returns decreasing inertia curve", () => {
      const data = makeClusterData();
      const curve = elbowMethod(data, 5);
      expect(curve).toHaveLength(5);
      // Inertia should generally decrease
      expect(curve[0].inertia).toBeGreaterThan(curve[curve.length - 1].inertia);
    });
  });

  describe("normalizeData", () => {
    it("normalizes to zero mean and unit variance", () => {
      const data = [
        [1, 100],
        [2, 200],
        [3, 300],
        [4, 400],
        [5, 500],
      ];
      const { normalized, means, stdDevs } = normalizeData(data);
      expect(normalized).toHaveLength(5);
      expect(means).toHaveLength(2);
      expect(stdDevs).toHaveLength(2);

      // Check normalized column means are ~0
      const col0Mean = normalized.reduce((s, r) => s + r[0], 0) / normalized.length;
      expect(col0Mean).toBeCloseTo(0, 5);
    });

    it("handles empty data", () => {
      const { normalized } = normalizeData([]);
      expect(normalized).toHaveLength(0);
    });
  });
});
