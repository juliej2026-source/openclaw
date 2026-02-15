// ---------------------------------------------------------------------------
// Analysis Pipeline — Orchestrates data fetching, engine routing, caching
// ---------------------------------------------------------------------------

import type { AnalysisRequest, AnalysisResult, DataSeries } from "../types.js";
import { getHotelPrices, getHotelAvailability } from "../connectors/hotel-connector.js";
import { getModelPerformance } from "../connectors/meta-connector.js";
import { getNetworkTelemetry } from "../connectors/network-connector.js";
import { getNeuralExecutions, getNeuralTopology } from "../connectors/neural-connector.js";
import {
  kMeansClustering,
  pcaAnalysis,
  anomalyDetection,
  elbowMethod,
} from "../engines/clustering.js";
import {
  tTest,
  chiSquaredTest,
  mannWhitneyU,
  effectSize,
  confidenceInterval,
} from "../engines/experiments.js";
import {
  buildGraph,
  centralityAnalysis,
  communityDetection,
  pathAnalysis,
  graphMetrics,
} from "../engines/graph-analytics.js";
import {
  descriptiveStats,
  correlationMatrix,
  linearRegression,
  polynomialRegression,
  multivariateRegression,
  distributionTest,
} from "../engines/statistics.js";
import {
  movingAverage,
  trendDetection,
  seasonalityDecomposition,
  changePointDetection,
  forecast,
  rollingStats,
} from "../engines/timeseries.js";
import { ANALYSIS_CACHE_TTL_MS } from "../types.js";

// In-memory results cache
const resultCache = new Map<string, { result: AnalysisResult; expiresAt: number }>();
let resultCounter = 0;

/**
 * Run an analysis through the pipeline.
 */
export async function runAnalysis(request: AnalysisRequest): Promise<AnalysisResult> {
  const startedAt = new Date().toISOString();
  const start = Date.now();

  try {
    // 1) Fetch data
    const data = request.rawData ?? (await fetchData(request.source));

    // 2) Validate
    const totalPoints = data.reduce((s, ds) => s + ds.points.length, 0);
    if (totalPoints === 0) {
      throw new Error("No data points available from source");
    }

    // 3) Route to engine
    const result = await routeToEngine(request, data);

    // 4) Build result
    const id = `analysis-${++resultCounter}-${Date.now()}`;
    const analysisResult: AnalysisResult = {
      id,
      engine: request.engine,
      method: request.method,
      source: request.source,
      result,
      metadata: {
        startedAt,
        completedAt: new Date().toISOString(),
        durationMs: Date.now() - start,
        dataPointCount: totalPoints,
      },
      success: true,
    };

    // 5) Cache
    resultCache.set(id, {
      result: analysisResult,
      expiresAt: Date.now() + ANALYSIS_CACHE_TTL_MS,
    });

    return analysisResult;
  } catch (err: any) {
    const id = `analysis-${++resultCounter}-${Date.now()}`;
    return {
      id,
      engine: request.engine,
      method: request.method,
      source: request.source,
      result: null,
      metadata: {
        startedAt,
        completedAt: new Date().toISOString(),
        durationMs: Date.now() - start,
        dataPointCount: 0,
      },
      success: false,
      error: err.message,
    };
  }
}

/**
 * Get a cached result by ID.
 */
export function getResult(id: string): AnalysisResult | undefined {
  const entry = resultCache.get(id);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    resultCache.delete(id);
    return undefined;
  }
  return entry.result;
}

/**
 * List recent results.
 */
export function getResults(
  limit: number = 50,
  offset: number = 0,
): { results: AnalysisResult[]; total: number } {
  // Clean expired
  const now = Date.now();
  for (const [key, entry] of resultCache) {
    if (now > entry.expiresAt) resultCache.delete(key);
  }

  const all = [...resultCache.values()].map((e) => e.result);
  all.sort((a, b) => b.metadata.completedAt.localeCompare(a.metadata.completedAt));

  return {
    results: all.slice(offset, offset + limit),
    total: all.length,
  };
}

/**
 * Get cache size.
 */
export function getCacheSize(): number {
  return resultCache.size;
}

/**
 * Clear all cached results.
 */
export function clearCache(): void {
  resultCache.clear();
}

// ---- Data Fetching ----

async function fetchData(source: string): Promise<DataSeries[]> {
  switch (source) {
    case "neural_graph":
      return getNeuralExecutions();
    case "hotel_scraper": {
      const prices = await getHotelPrices();
      const avail = await getHotelAvailability();
      return [...prices, ...avail];
    }
    case "meta_engine":
      return getModelPerformance();
    case "network":
      return getNetworkTelemetry();
    default:
      return [];
  }
}

// ---- Engine Routing ----

async function routeToEngine(request: AnalysisRequest, data: DataSeries[]): Promise<unknown> {
  const values = data.length > 0 ? data[0].points.map((p) => p.value) : [];
  const points = data.length > 0 ? data[0].points : [];

  switch (request.engine) {
    case "statistics":
      return routeStatistics(request.method, data, values, request.params);
    case "timeseries":
      return routeTimeseries(request.method, values, points, request.params);
    case "clustering":
      return routeClustering(request.method, data, values, request.params);
    case "graph_analytics":
      return routeGraphAnalytics(request.method, request.params);
    case "experiments":
      return routeExperiments(request.method, request.params);
    default:
      throw new Error(`Unknown engine: ${request.engine}`);
  }
}

function routeStatistics(
  method: string,
  data: DataSeries[],
  values: number[],
  params: Record<string, unknown>,
): unknown {
  switch (method) {
    case "descriptiveStats":
      return descriptiveStats(values);
    case "correlationMatrix": {
      const vars: Record<string, number[]> = {};
      for (const ds of data) {
        vars[ds.name] = ds.points.map((p) => p.value);
      }
      return correlationMatrix(vars);
    }
    case "linearRegression": {
      const x = values.map((_, i) => i);
      return linearRegression(x, values);
    }
    case "polynomialRegression": {
      const x = values.map((_, i) => i);
      const degree = (params.degree as number) ?? 2;
      return polynomialRegression(x, values, degree);
    }
    case "distributionTest":
      return distributionTest(values);
    default:
      throw new Error(`Unknown statistics method: ${method}`);
  }
}

function routeTimeseries(
  method: string,
  values: number[],
  points: Array<{ timestamp: number; value: number }>,
  params: Record<string, unknown>,
): unknown {
  switch (method) {
    case "movingAverage": {
      const window = (params.window as number) ?? 5;
      const type = (params.type as string) ?? "sma";
      return movingAverage(values, window, type as any);
    }
    case "trendDetection":
      return trendDetection(points);
    case "seasonalityDecomposition": {
      const period = (params.period as number) ?? 12;
      return seasonalityDecomposition(values, period);
    }
    case "changePointDetection": {
      const threshold = params.threshold as number | undefined;
      return changePointDetection(values, threshold);
    }
    case "forecast": {
      const horizon = (params.horizon as number) ?? 5;
      const fmethod = (params.method as string) ?? "ses";
      return forecast(values, horizon, fmethod as any);
    }
    case "rollingStats": {
      const window = (params.window as number) ?? 5;
      return rollingStats(values, window);
    }
    default:
      throw new Error(`Unknown timeseries method: ${method}`);
  }
}

function routeClustering(
  method: string,
  data: DataSeries[],
  values: number[],
  params: Record<string, unknown>,
): unknown {
  switch (method) {
    case "kMeansClustering": {
      const k = (params.k as number) ?? 3;
      // Convert single series to 2D: [index, value]
      const data2d = values.map((v, i) => [i, v]);
      return kMeansClustering(data2d, k);
    }
    case "pcaAnalysis": {
      const components = params.components as number | undefined;
      const data2d = values.map((v, i) => [i, v]);
      return pcaAnalysis(data2d, components);
    }
    case "anomalyDetection": {
      const method2 = (params.method as string) ?? "zscore";
      const threshold = params.threshold as number | undefined;
      return anomalyDetection(values, method2 as any, threshold);
    }
    case "elbowMethod": {
      const maxK = params.maxK as number | undefined;
      const data2d = values.map((v, i) => [i, v]);
      return elbowMethod(data2d, maxK);
    }
    default:
      throw new Error(`Unknown clustering method: ${method}`);
  }
}

async function routeGraphAnalytics(
  method: string,
  params: Record<string, unknown>,
): Promise<unknown> {
  const { nodes: gNodes, edges: gEdges } = await getNeuralTopology();
  const graph = buildGraph(gNodes, gEdges);

  switch (method) {
    case "centralityAnalysis":
      return centralityAnalysis(graph);
    case "communityDetection":
      return communityDetection(graph);
    case "pathAnalysis": {
      const source = params.source as string;
      const target = params.target as string;
      if (!source || !target) throw new Error("source and target required for pathAnalysis");
      return pathAnalysis(graph, source, target);
    }
    case "graphMetrics":
      return graphMetrics(graph);
    default:
      throw new Error(`Unknown graph_analytics method: ${method}`);
  }
}

function routeExperiments(method: string, params: Record<string, unknown>): unknown {
  switch (method) {
    case "tTest": {
      const a = params.groupA as number[];
      const b = params.groupB as number[];
      return tTest(a, b, params);
    }
    case "chiSquaredTest": {
      const obs = params.observed as number[];
      const exp = params.expected as number[];
      return chiSquaredTest(obs, exp);
    }
    case "mannWhitneyU": {
      const a = params.groupA as number[];
      const b = params.groupB as number[];
      return mannWhitneyU(a, b);
    }
    case "effectSize": {
      const a = params.groupA as number[];
      const b = params.groupB as number[];
      return effectSize(a, b);
    }
    case "confidenceInterval": {
      const data = params.data as number[];
      const level = params.level as number | undefined;
      return confidenceInterval(data, level);
    }
    default:
      throw new Error(`Unknown experiments method: ${method}`);
  }
}
