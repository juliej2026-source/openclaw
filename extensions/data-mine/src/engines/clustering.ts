// ---------------------------------------------------------------------------
// ML/Clustering Engine — K-means, PCA, anomaly detection, silhouette scoring
// ---------------------------------------------------------------------------

import { kmeans } from "ml-kmeans";
import { PCA } from "ml-pca";
import type { ClusterResult, PCAResult, AnomalyResult, AnomalyMethod } from "../types.js";

/**
 * K-means clustering.
 */
export function kMeansClustering(
  data: number[][],
  k: number,
  options?: { maxIterations?: number; seed?: number },
): ClusterResult {
  if (data.length === 0 || k <= 0) {
    return { k: 0, clusters: [], labels: [], silhouetteScore: 0, inertia: 0 };
  }

  const clampedK = Math.min(k, data.length);
  const result = kmeans(data, clampedK, {
    maxIterations: options?.maxIterations ?? 100,
    seed: options?.seed,
  });

  const labels = result.clusters;
  const centroids = result.centroids;

  // Build cluster groups
  const clusterMap = new Map<number, number[][]>();
  for (let i = 0; i < data.length; i++) {
    const label = labels[i];
    if (!clusterMap.has(label)) clusterMap.set(label, []);
    clusterMap.get(label)!.push(data[i]);
  }

  const clusters = centroids.map((centroid: number[], idx: number) => ({
    centroid,
    points: clusterMap.get(idx) ?? [],
    size: (clusterMap.get(idx) ?? []).length,
  }));

  // Compute inertia (sum of squared distances to nearest centroid)
  let inertia = 0;
  for (let i = 0; i < data.length; i++) {
    const centroid = centroids[labels[i]];
    inertia += euclideanDistSq(data[i], centroid);
  }

  // Compute silhouette score
  const sil = data.length > clampedK ? silhouetteScore(data, labels) : 0;

  return { k: clampedK, clusters, labels, silhouetteScore: sil, inertia };
}

/**
 * PCA (Principal Component Analysis).
 */
export function pcaAnalysis(data: number[][], components?: number): PCAResult {
  if (data.length === 0) {
    return {
      eigenvalues: [],
      eigenvectors: [],
      explainedVariance: [],
      cumulativeVariance: [],
      projections: [],
    };
  }

  const pca = new PCA(data, { center: true, scale: true });
  const nComponents = components ?? Math.min(data[0].length, data.length);
  const eigenvalues = pca.getEigenvalues();
  const eigenvectors = pca.getEigenvectors().to2DArray();
  const explained = pca.getExplainedVariance();
  const cumulative = pca.getCumulativeVariance();
  const projections = pca.predict(data, { nComponents }).to2DArray();

  return {
    eigenvalues: eigenvalues.slice(0, nComponents),
    eigenvectors: eigenvectors.slice(0, nComponents),
    explainedVariance: explained.slice(0, nComponents),
    cumulativeVariance: cumulative.slice(0, nComponents),
    projections,
  };
}

/**
 * Anomaly detection using Z-score, IQR, or Mahalanobis distance.
 */
export function anomalyDetection(
  data: number[] | number[][],
  method: AnomalyMethod = "zscore",
  threshold?: number,
): AnomalyResult {
  if (method === "mahalanobis" && Array.isArray(data[0])) {
    return mahalanobisAnomalies(data as number[][], threshold ?? 3.0);
  }

  const values = (
    Array.isArray(data[0]) ? (data as number[][]).map((d) => d[0]) : data
  ) as number[];

  if (values.length === 0) {
    return { anomalies: [], threshold: 0, method, totalPoints: 0, anomalyRate: 0 };
  }

  switch (method) {
    case "zscore":
      return zScoreAnomalies(values, threshold ?? 3.0);
    case "iqr":
      return iqrAnomalies(values, threshold ?? 1.5);
    default:
      return zScoreAnomalies(values, threshold ?? 3.0);
  }
}

function zScoreAnomalies(values: number[], threshold: number): AnomalyResult {
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const stdDev = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / (values.length - 1));

  if (stdDev === 0) {
    return {
      anomalies: [],
      threshold,
      method: "zscore",
      totalPoints: values.length,
      anomalyRate: 0,
    };
  }

  const anomalies: AnomalyResult["anomalies"] = [];
  for (let i = 0; i < values.length; i++) {
    const zScore = Math.abs((values[i] - mean) / stdDev);
    if (zScore > threshold) {
      anomalies.push({ index: i, value: values[i], score: zScore, method: "zscore" });
    }
  }

  return {
    anomalies,
    threshold,
    method: "zscore",
    totalPoints: values.length,
    anomalyRate: anomalies.length / values.length,
  };
}

function iqrAnomalies(values: number[], multiplier: number): AnomalyResult {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const q1 = sorted[Math.floor(n * 0.25)];
  const q3 = sorted[Math.floor(n * 0.75)];
  const iqr = q3 - q1;
  const lower = q1 - multiplier * iqr;
  const upper = q3 + multiplier * iqr;

  const anomalies: AnomalyResult["anomalies"] = [];
  for (let i = 0; i < values.length; i++) {
    if (values[i] < lower || values[i] > upper) {
      const score =
        values[i] < lower ? (lower - values[i]) / (iqr || 1) : (values[i] - upper) / (iqr || 1);
      anomalies.push({ index: i, value: values[i], score, method: "iqr" });
    }
  }

  return {
    anomalies,
    threshold: multiplier,
    method: "iqr",
    totalPoints: values.length,
    anomalyRate: anomalies.length / values.length,
  };
}

function mahalanobisAnomalies(data: number[][], threshold: number): AnomalyResult {
  const n = data.length;
  const dims = data[0].length;

  // Compute means
  const means = new Array(dims).fill(0);
  for (const point of data) {
    for (let d = 0; d < dims; d++) means[d] += point[d];
  }
  for (let d = 0; d < dims; d++) means[d] /= n;

  // Compute covariance matrix
  const cov = Array.from({ length: dims }, () => new Array(dims).fill(0));
  for (const point of data) {
    for (let i = 0; i < dims; i++) {
      for (let j = 0; j < dims; j++) {
        cov[i][j] += (point[i] - means[i]) * (point[j] - means[j]);
      }
    }
  }
  for (let i = 0; i < dims; i++) {
    for (let j = 0; j < dims; j++) {
      cov[i][j] /= n - 1;
    }
  }

  // Invert 2D covariance (for simplicity, support up to 2D; for higher dims use diagonal approximation)
  let invCov: number[][];
  if (dims === 1) {
    invCov = [[1 / (cov[0][0] || 1)]];
  } else if (dims === 2) {
    const det = cov[0][0] * cov[1][1] - cov[0][1] * cov[1][0];
    if (Math.abs(det) < 1e-10) {
      // Use diagonal
      invCov = [
        [1 / (cov[0][0] || 1), 0],
        [0, 1 / (cov[1][1] || 1)],
      ];
    } else {
      invCov = [
        [cov[1][1] / det, -cov[0][1] / det],
        [-cov[1][0] / det, cov[0][0] / det],
      ];
    }
  } else {
    // Diagonal approximation for higher dims
    invCov = Array.from({ length: dims }, (_, i) => {
      const row = new Array(dims).fill(0);
      row[i] = 1 / (cov[i][i] || 1);
      return row;
    });
  }

  // Compute Mahalanobis distance for each point
  const anomalies: AnomalyResult["anomalies"] = [];
  for (let idx = 0; idx < n; idx++) {
    const diff = data[idx].map((v, d) => v - means[d]);
    let dist = 0;
    for (let i = 0; i < dims; i++) {
      for (let j = 0; j < dims; j++) {
        dist += diff[i] * invCov[i][j] * diff[j];
      }
    }
    dist = Math.sqrt(dist);
    if (dist > threshold) {
      anomalies.push({ index: idx, value: dist, score: dist, method: "mahalanobis" });
    }
  }

  return {
    anomalies,
    threshold,
    method: "mahalanobis",
    totalPoints: n,
    anomalyRate: anomalies.length / n,
  };
}

/**
 * Compute silhouette score for clustering quality.
 */
export function silhouetteScore(data: number[][], labels: number[]): number {
  if (data.length <= 1) return 0;

  const uniqueLabels = [...new Set(labels)];
  if (uniqueLabels.length <= 1) return 0;

  let totalScore = 0;
  for (let i = 0; i < data.length; i++) {
    const myLabel = labels[i];

    // a(i) = avg distance to same cluster
    let aSum = 0;
    let aCount = 0;
    for (let j = 0; j < data.length; j++) {
      if (j !== i && labels[j] === myLabel) {
        aSum += euclideanDist(data[i], data[j]);
        aCount++;
      }
    }
    const a = aCount > 0 ? aSum / aCount : 0;

    // b(i) = min avg distance to other clusters
    let b = Infinity;
    for (const label of uniqueLabels) {
      if (label === myLabel) continue;
      let bSum = 0;
      let bCount = 0;
      for (let j = 0; j < data.length; j++) {
        if (labels[j] === label) {
          bSum += euclideanDist(data[i], data[j]);
          bCount++;
        }
      }
      if (bCount > 0) {
        b = Math.min(b, bSum / bCount);
      }
    }

    const s = Math.max(a, b) === 0 ? 0 : (b - a) / Math.max(a, b);
    totalScore += s;
  }

  return totalScore / data.length;
}

/**
 * Elbow method: run K-means for k=1..maxK and return inertia curve.
 */
export function elbowMethod(
  data: number[][],
  maxK?: number,
): Array<{ k: number; inertia: number }> {
  const max = Math.min(maxK ?? 10, data.length);
  const results: Array<{ k: number; inertia: number }> = [];

  for (let k = 1; k <= max; k++) {
    const { inertia } = kMeansClustering(data, k);
    results.push({ k, inertia });
  }

  return results;
}

/**
 * Z-score normalization per feature.
 */
export function normalizeData(data: number[][]): {
  normalized: number[][];
  means: number[];
  stdDevs: number[];
} {
  if (data.length === 0) {
    return { normalized: [], means: [], stdDevs: [] };
  }

  const dims = data[0].length;
  const means = new Array(dims).fill(0);
  const stdDevs = new Array(dims).fill(0);

  for (const point of data) {
    for (let d = 0; d < dims; d++) means[d] += point[d];
  }
  for (let d = 0; d < dims; d++) means[d] /= data.length;

  for (const point of data) {
    for (let d = 0; d < dims; d++) stdDevs[d] += (point[d] - means[d]) ** 2;
  }
  for (let d = 0; d < dims; d++) {
    stdDevs[d] = Math.sqrt(stdDevs[d] / (data.length - 1));
    if (stdDevs[d] === 0) stdDevs[d] = 1;
  }

  const normalized = data.map((point) => point.map((v, d) => (v - means[d]) / stdDevs[d]));

  return { normalized, means, stdDevs };
}

// ---- Helpers ----

function euclideanDist(a: number[], b: number[]): number {
  return Math.sqrt(euclideanDistSq(a, b));
}

function euclideanDistSq(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += (a[i] - b[i]) ** 2;
  }
  return sum;
}
