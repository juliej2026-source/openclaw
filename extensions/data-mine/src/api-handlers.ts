// ---------------------------------------------------------------------------
// API Handlers — HTTP route handlers for /api/data-mine/*
// ---------------------------------------------------------------------------

import type { AnalysisRequest } from "./types.js";
import { parseCSV, parseJSON } from "./connectors/csv-connector.js";
import { getHotelPrices } from "./connectors/hotel-connector.js";
import { getModelPerformance } from "./connectors/meta-connector.js";
import { getNetworkTelemetry } from "./connectors/network-connector.js";
import { getNeuralExecutions, getNeuralTopology } from "./connectors/neural-connector.js";
import { anomalyDetection, kMeansClustering } from "./engines/clustering.js";
import { createExperiment, getExperiments, evaluateExperiment } from "./engines/experiments.js";
import {
  buildGraph,
  centralityAnalysis,
  communityDetection,
  graphMetrics,
} from "./engines/graph-analytics.js";
import { descriptiveStats, correlationMatrix } from "./engines/statistics.js";
import { trendDetection } from "./engines/timeseries.js";
import {
  formatMetrics,
  analysesTotal,
  cachedResults as cachedResultsMetric,
} from "./metrics/mine-metrics.js";
import { runAnalysis, getResult, getResults, getCacheSize } from "./pipeline/pipeline.js";
import { getScheduledJobs } from "./pipeline/scheduler.js";
import { ENGINE_IDS, DATA_SOURCE_IDS, STATION_ID } from "./types.js";

let totalAnalyses = 0;
let totalDurationMs = 0;

/**
 * GET /api/data-mine/status
 */
export async function handleDataMineStatus() {
  return {
    status: "ok",
    stationId: STATION_ID,
    version: "2026.2.16",
    engines: ENGINE_IDS.length,
    dataSources: DATA_SOURCE_IDS.length,
    totalAnalyses,
    cachedResults: getCacheSize(),
    avgDurationMs: totalAnalyses > 0 ? Math.round(totalDurationMs / totalAnalyses) : 0,
    uptime: process.uptime(),
  };
}

/**
 * POST /api/data-mine/analyze
 */
export async function handleAnalyze(body: AnalysisRequest) {
  if (!body.engine || !body.method) {
    return { error: "engine and method are required", status: 400 };
  }

  const result = await runAnalysis(body);
  totalAnalyses++;
  totalDurationMs += result.metadata.durationMs;
  analysesTotal.inc();
  cachedResultsMetric.set(getCacheSize());

  return result;
}

/**
 * GET /api/data-mine/results/:id
 */
export async function handleGetResult(id: string) {
  const result = getResult(id);
  if (!result) {
    return { error: "Result not found", status: 404 };
  }
  return result;
}

/**
 * GET /api/data-mine/results
 */
export async function handleListResults(query?: { limit?: number; offset?: number }) {
  const limit = query?.limit ?? 50;
  const offset = query?.offset ?? 0;
  return getResults(limit, offset);
}

/**
 * GET /api/data-mine/datasets
 */
export async function handleListDatasets() {
  const datasets = [];

  try {
    const neural = await getNeuralExecutions();
    for (const s of neural) {
      datasets.push({
        id: s.id,
        name: s.name,
        source: s.source,
        pointCount: s.points.length,
        lastUpdated: new Date().toISOString(),
      });
    }
  } catch {}

  try {
    const hotel = await getHotelPrices();
    for (const s of hotel) {
      datasets.push({
        id: s.id,
        name: s.name,
        source: s.source,
        pointCount: s.points.length,
        lastUpdated: new Date().toISOString(),
      });
    }
  } catch {}

  try {
    const meta = await getModelPerformance();
    for (const s of meta) {
      datasets.push({
        id: s.id,
        name: s.name,
        source: s.source,
        pointCount: s.points.length,
        lastUpdated: new Date().toISOString(),
      });
    }
  } catch {}

  try {
    const net = await getNetworkTelemetry();
    for (const s of net) {
      datasets.push({
        id: s.id,
        name: s.name,
        source: s.source,
        pointCount: s.points.length,
        lastUpdated: new Date().toISOString(),
      });
    }
  } catch {}

  return { datasets, total: datasets.length };
}

/**
 * POST /api/data-mine/datasets/import
 */
export async function handleImportDataset(body: {
  format: string;
  content: string;
  name?: string;
}) {
  if (!body.format || !body.content) {
    return { error: "format and content are required", status: 400 };
  }

  let series;
  if (body.format === "csv") {
    series = parseCSV(body.content, { name: body.name });
  } else if (body.format === "json") {
    series = parseJSON(body.content, body.name);
  } else {
    return { error: "format must be csv or json", status: 400 };
  }

  return { datasetId: series.id, pointCount: series.points.length, name: series.name };
}

/**
 * GET /api/data-mine/stats
 */
export async function handleStats(query?: { source?: string }) {
  const source = query?.source ?? "neural_graph";
  const result = await runAnalysis({
    engine: "statistics",
    source: source as any,
    method: "descriptiveStats",
    params: {},
  });
  return result.success ? result.result : { error: result.error };
}

/**
 * GET /api/data-mine/correlations
 */
export async function handleCorrelations(query?: { source?: string }) {
  const source = query?.source ?? "hotel_scraper";
  const result = await runAnalysis({
    engine: "statistics",
    source: source as any,
    method: "correlationMatrix",
    params: {},
  });
  return result.success ? result.result : { error: result.error };
}

/**
 * GET /api/data-mine/timeseries
 */
export async function handleTimeseries(query?: {
  source?: string;
  method?: string;
  window?: number;
  horizon?: number;
}) {
  const source = query?.source ?? "neural_graph";
  const method = query?.method ?? "trendDetection";
  const result = await runAnalysis({
    engine: "timeseries",
    source: source as any,
    method,
    params: { window: query?.window, horizon: query?.horizon },
  });
  return result.success ? result.result : { error: result.error };
}

/**
 * GET /api/data-mine/clusters
 */
export async function handleClusters(query?: { source?: string; k?: number }) {
  const source = query?.source ?? "neural_graph";
  const result = await runAnalysis({
    engine: "clustering",
    source: source as any,
    method: "kMeansClustering",
    params: { k: query?.k ?? 3 },
  });
  return result.success ? result.result : { error: result.error };
}

/**
 * GET /api/data-mine/anomalies
 */
export async function handleAnomalies(query?: {
  source?: string;
  method?: string;
  threshold?: number;
}) {
  const source = query?.source ?? "neural_graph";
  const result = await runAnalysis({
    engine: "clustering",
    source: source as any,
    method: "anomalyDetection",
    params: { method: query?.method ?? "zscore", threshold: query?.threshold },
  });
  return result.success ? result.result : { error: result.error };
}

/**
 * GET /api/data-mine/graph
 */
export async function handleGraph(query?: { source?: string }) {
  const result = await runAnalysis({
    engine: "graph_analytics",
    source: "neural_graph",
    method: "graphMetrics",
    params: {},
  });
  if (!result.success) return { error: result.error };

  const centResult = await runAnalysis({
    engine: "graph_analytics",
    source: "neural_graph",
    method: "centralityAnalysis",
    params: {},
  });
  const commResult = await runAnalysis({
    engine: "graph_analytics",
    source: "neural_graph",
    method: "communityDetection",
    params: {},
  });

  return {
    metrics: result.result,
    centrality: centResult.success ? centResult.result : null,
    communities: commResult.success ? commResult.result : null,
  };
}

/**
 * POST /api/data-mine/experiments
 */
export async function handleCreateExperiment(body: any) {
  if (!body.name || !body.groups || !body.metric) {
    return { error: "name, groups, and metric are required", status: 400 };
  }

  const config = createExperiment({
    name: body.name,
    description: body.description ?? "",
    groups: body.groups,
    metric: body.metric,
    hypothesis: body.hypothesis ?? "",
    alpha: body.alpha ?? 0.05,
    minSampleSize: body.minSampleSize ?? 30,
  });

  return config;
}

/**
 * GET /api/data-mine/experiments
 */
export async function handleListExperiments() {
  const exps = getExperiments();
  return { experiments: exps, total: exps.length };
}

/**
 * GET /api/data-mine/experiments/:id
 */
export async function handleGetExperiment(id: string) {
  const result = evaluateExperiment(id);
  if (result.recommendation === "Experiment not found") {
    return { error: "Experiment not found", status: 404 };
  }
  return result;
}

/**
 * GET /api/data-mine/metrics
 */
export async function handleDataMineMetrics() {
  cachedResultsMetric.set(getCacheSize());
  return formatMetrics();
}
