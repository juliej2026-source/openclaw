import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Stored analysis results
  analysis_results: defineTable({
    analysisId: v.string(),
    engine: v.string(), // statistics | timeseries | clustering | graph_analytics | experiments
    method: v.string(),
    source: v.string(), // neural_graph | hotel_scraper | meta_engine | network | custom
    success: v.boolean(),
    result: v.any(),
    error: v.optional(v.string()),
    dataPointCount: v.float64(),
    durationMs: v.float64(),
    stationId: v.string(),
    createdAt: v.string(),
  })
    .index("by_analysisId", ["analysisId"])
    .index("by_engine", ["engine"])
    .index("by_source", ["source"])
    .index("by_stationId", ["stationId"]),

  // Registered datasets (imported or connector-discovered)
  datasets: defineTable({
    datasetId: v.string(),
    name: v.string(),
    source: v.string(),
    pointCount: v.float64(),
    format: v.optional(v.string()), // csv | json | connector
    schema: v.optional(v.any()), // column names, types, etc.
    stationId: v.string(),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_datasetId", ["datasetId"])
    .index("by_source", ["source"])
    .index("by_stationId", ["stationId"]),

  // A/B experiments
  experiments: defineTable({
    experimentId: v.string(),
    name: v.string(),
    description: v.string(),
    groups: v.array(v.string()),
    metric: v.string(),
    hypothesis: v.string(),
    alpha: v.float64(),
    minSampleSize: v.float64(),
    status: v.string(), // running | completed | stopped
    stationId: v.string(),
    createdAt: v.string(),
    completedAt: v.optional(v.string()),
  })
    .index("by_experimentId", ["experimentId"])
    .index("by_status", ["status"])
    .index("by_stationId", ["stationId"]),

  // Observations recorded for experiments
  experiment_observations: defineTable({
    experimentId: v.string(),
    group: v.string(),
    value: v.float64(),
    metadata: v.optional(v.any()),
    stationId: v.string(),
    createdAt: v.string(),
  })
    .index("by_experimentId", ["experimentId"])
    .index("by_group", ["group"])
    .index("by_stationId", ["stationId"]),

  // Periodic analysis snapshots (scheduler output)
  analysis_snapshots: defineTable({
    snapshotId: v.string(),
    jobId: v.string(), // neural-health | hotel-trends | model-performance | anomaly-scan
    engine: v.string(),
    method: v.string(),
    source: v.string(),
    summary: v.any(), // key metrics from the analysis
    anomalyCount: v.float64(),
    stationId: v.string(),
    createdAt: v.string(),
  })
    .index("by_snapshotId", ["snapshotId"])
    .index("by_jobId", ["jobId"])
    .index("by_stationId", ["stationId"]),
});
