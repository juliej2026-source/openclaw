// ---------------------------------------------------------------------------
// Data Mine — Core Types
// ---------------------------------------------------------------------------

// ---- Engine IDs ----

export const ENGINE_IDS = [
  "statistics",
  "timeseries",
  "clustering",
  "graph_analytics",
  "experiments",
] as const;

export type EngineId = (typeof ENGINE_IDS)[number];

// ---- Data Source IDs ----

export const DATA_SOURCE_IDS = [
  "neural_graph",
  "hotel_scraper",
  "meta_engine",
  "network",
  "custom",
] as const;

export type DataSourceId = (typeof DATA_SOURCE_IDS)[number];

// ---- Core Data Structures ----

export interface DataPoint {
  timestamp: number;
  value: number;
  label?: string;
  metadata?: Record<string, unknown>;
}

export interface DataSeries {
  id: string;
  name: string;
  source: DataSourceId;
  points: DataPoint[];
  unit?: string;
  metadata?: Record<string, unknown>;
}

// ---- Analysis Request / Result ----

export interface AnalysisRequest {
  engine: EngineId;
  source: DataSourceId;
  method: string;
  params: Record<string, unknown>;
  datasetId?: string;
  rawData?: DataSeries[];
}

export interface AnalysisResult {
  id: string;
  engine: EngineId;
  method: string;
  source: DataSourceId;
  result: unknown;
  metadata: {
    startedAt: string;
    completedAt: string;
    durationMs: number;
    dataPointCount: number;
  };
  success: boolean;
  error?: string;
}

// ---- Statistics Types ----

export interface DescriptiveStats {
  count: number;
  mean: number;
  median: number;
  mode: number;
  min: number;
  max: number;
  range: number;
  stdDev: number;
  variance: number;
  skewness: number;
  kurtosis: number;
  q1: number;
  q3: number;
  iqr: number;
  percentiles: Record<number, number>;
}

export interface CorrelationResult {
  variableA: string;
  variableB: string;
  pearson: number;
  spearman: number;
  pValue: number;
}

export interface CorrelationMatrix {
  variables: string[];
  matrix: number[][];
  method: "pearson" | "spearman";
}

export interface RegressionResult {
  type: "linear" | "polynomial" | "multivariate";
  coefficients: number[];
  intercept: number;
  rSquared: number;
  residuals: number[];
  predictions: number[];
}

// ---- Time-Series Types ----

export interface TimeSeriesResult {
  trend: DataPoint[];
  seasonal?: DataPoint[];
  residual?: DataPoint[];
  forecast?: DataPoint[];
  changePoints?: number[];
  parameters: Record<string, unknown>;
}

export type MovingAverageType = "sma" | "ema" | "wma";

// ---- Clustering Types ----

export interface ClusterResult {
  k: number;
  clusters: Array<{
    centroid: number[];
    points: number[][];
    size: number;
  }>;
  labels: number[];
  silhouetteScore: number;
  inertia: number;
}

export interface PCAResult {
  eigenvalues: number[];
  eigenvectors: number[][];
  explainedVariance: number[];
  cumulativeVariance: number[];
  projections: number[][];
}

export interface AnomalyResult {
  anomalies: Array<{
    index: number;
    value: number;
    score: number;
    method: string;
  }>;
  threshold: number;
  method: string;
  totalPoints: number;
  anomalyRate: number;
}

export type AnomalyMethod = "zscore" | "iqr" | "mahalanobis";

// ---- Graph Analytics Types ----

export interface GraphNode {
  id: string;
  label?: string;
  weight?: number;
  metadata?: Record<string, unknown>;
}

export interface GraphEdge {
  source: string;
  target: string;
  weight?: number;
  metadata?: Record<string, unknown>;
}

export interface CentralityResult {
  nodeId: string;
  degree: number;
  betweenness: number;
  closeness: number;
  pageRank: number;
}

export interface CommunityResult {
  communities: Array<{
    id: number;
    nodes: string[];
    size: number;
  }>;
  modularity: number;
  algorithm: string;
}

export interface GraphMetrics {
  nodeCount: number;
  edgeCount: number;
  density: number;
  diameter: number;
  avgPathLength: number;
  clusteringCoefficient: number;
  connectedComponents: number;
  isConnected: boolean;
}

// ---- Experiment Types ----

export interface ExperimentConfig {
  id: string;
  name: string;
  description: string;
  groups: string[];
  metric: string;
  hypothesis: string;
  alpha: number;
  minSampleSize: number;
  createdAt: string;
}

export interface ExperimentObservation {
  experimentId: string;
  group: string;
  value: number;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface ExperimentResult {
  experimentId: string;
  config: ExperimentConfig;
  groupStats: Record<string, DescriptiveStats>;
  tTest?: HypothesisTest;
  mannWhitney?: HypothesisTest;
  effectSize?: {
    cohensD: number;
    interpretation: string;
  };
  significant: boolean;
  recommendation: string;
}

export interface HypothesisTest {
  testName: string;
  statistic: number;
  pValue: number;
  degreesOfFreedom?: number;
  significant: boolean;
  confidenceInterval?: [number, number];
  confidenceLevel: number;
}

// ---- Constants ----

export const STATION_ID = "iot-hub";
export const ANALYSIS_CACHE_TTL_MS = 300_000; // 5 minutes
export const SCHEDULED_INTERVAL_MS = 3_600_000; // 1 hour
export const MAX_DATA_POINTS = 100_000;
