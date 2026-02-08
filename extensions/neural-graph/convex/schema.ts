import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // AI capabilities, models, stations — the "neurons"
  graph_nodes: defineTable({
    nodeId: v.string(),
    nodeType: v.string(), // capability | station | model | synthetic
    name: v.string(),
    description: v.string(),
    stationId: v.string(),
    status: v.string(), // active | degraded | dormant | pruned
    fitnessScore: v.float64(), // 0–100
    maturationPhase: v.string(), // genesis | differentiation | synaptogenesis | pruning | myelination
    capabilities: v.array(v.string()),
    activationCount: v.float64(),
    totalLatencyMs: v.float64(),
    successCount: v.float64(),
    failureCount: v.float64(),
    lastActivated: v.optional(v.string()),
    createdAt: v.string(),
    metadata: v.any(),
  })
    .index("by_nodeId", ["nodeId"])
    .index("by_stationId", ["stationId"])
    .index("by_status", ["status"])
    .index("by_nodeType", ["nodeType"]),

  // Relationships between nodes — the "synapses"
  graph_edges: defineTable({
    edgeId: v.string(),
    sourceNodeId: v.string(),
    targetNodeId: v.string(),
    edgeType: v.string(), // data_flow | dependency | activation | fallback | inhibition
    weight: v.float64(), // 0.0–1.0
    myelinated: v.boolean(),
    activationCount: v.float64(),
    coActivationCount: v.float64(),
    avgLatencyMs: v.float64(),
    stationId: v.string(),
    createdAt: v.string(),
    metadata: v.any(),
  })
    .index("by_edgeId", ["edgeId"])
    .index("by_source", ["sourceNodeId"])
    .index("by_target", ["targetNodeId"])
    .index("by_stationId", ["stationId"])
    .index("by_myelinated", ["myelinated"]),

  // LangGraph thread state — persistent checkpoints
  checkpoints: defineTable({
    threadId: v.string(),
    checkpointId: v.string(),
    parentCheckpointId: v.optional(v.string()),
    channelValues: v.string(), // JSON-serialized
    channelVersions: v.string(), // JSON-serialized
    createdAt: v.string(),
  })
    .index("by_threadId", ["threadId"])
    .index("by_checkpointId", ["checkpointId"]),

  // Audit log of graph mutations
  evolution_events: defineTable({
    eventType: v.string(),
    targetId: v.string(),
    previousState: v.any(),
    newState: v.any(),
    reason: v.string(),
    triggeredBy: v.string(),
    requiresApproval: v.boolean(),
    approvalStatus: v.string(), // pending | approved | rejected | auto_approved
    stationId: v.string(),
    createdAt: v.string(),
  })
    .index("by_stationId", ["stationId"])
    .index("by_approvalStatus", ["approvalStatus"])
    .index("by_targetId", ["targetId"]),

  // Every graph traversal — execution telemetry
  execution_records: defineTable({
    threadId: v.string(),
    taskType: v.string(),
    taskDescription: v.string(),
    nodesVisited: v.array(v.string()),
    edgesTraversed: v.array(v.string()),
    success: v.boolean(),
    totalLatencyMs: v.float64(),
    nodeLatencies: v.any(), // Record<string, number>
    stationId: v.string(),
    createdAt: v.string(),
  })
    .index("by_stationId", ["stationId"])
    .index("by_threadId", ["threadId"])
    .index("by_taskType", ["taskType"]),

  // Semantic search across graph — vector embeddings
  graph_embeddings: defineTable({
    sourceId: v.string(),
    embedding: v.array(v.float64()),
    textContent: v.string(),
    stationId: v.string(),
    createdAt: v.string(),
  })
    .index("by_sourceId", ["sourceId"])
    .index("by_stationId", ["stationId"])
    .vectorIndex("by_embedding", {
      vectorField: "embedding",
      dimensions: 1536,
    }),
});
