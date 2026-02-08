import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export const list = query({
  args: { stationId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (args.stationId) {
      return ctx.db
        .query("graph_nodes")
        .withIndex("by_stationId", (q) => q.eq("stationId", args.stationId!))
        .collect();
    }
    return ctx.db.query("graph_nodes").collect();
  },
});

export const getByNodeId = query({
  args: { nodeId: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("graph_nodes")
      .withIndex("by_nodeId", (q) => q.eq("nodeId", args.nodeId))
      .first();
  },
});

export const listActive = query({
  args: { stationId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const all = args.stationId
      ? await ctx.db
          .query("graph_nodes")
          .withIndex("by_stationId", (q) => q.eq("stationId", args.stationId!))
          .collect()
      : await ctx.db.query("graph_nodes").collect();
    return all.filter((n) => n.status === "active" || n.status === "degraded");
  },
});

export const count = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("graph_nodes").collect();
    return all.length;
  },
});

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export const create = mutation({
  args: {
    nodeId: v.string(),
    nodeType: v.string(),
    name: v.string(),
    description: v.string(),
    stationId: v.string(),
    status: v.string(),
    fitnessScore: v.float64(),
    maturationPhase: v.string(),
    capabilities: v.array(v.string()),
    activationCount: v.float64(),
    totalLatencyMs: v.float64(),
    successCount: v.float64(),
    failureCount: v.float64(),
    lastActivated: v.optional(v.string()),
    createdAt: v.string(),
    metadata: v.any(),
  },
  handler: async (ctx, args) => {
    // Prevent duplicates
    const existing = await ctx.db
      .query("graph_nodes")
      .withIndex("by_nodeId", (q) => q.eq("nodeId", args.nodeId))
      .first();
    if (existing) {
      return existing._id;
    }
    return ctx.db.insert("graph_nodes", args);
  },
});

export const updateFitness = mutation({
  args: {
    nodeId: v.string(),
    fitnessScore: v.float64(),
    maturationPhase: v.string(),
  },
  handler: async (ctx, args) => {
    const node = await ctx.db
      .query("graph_nodes")
      .withIndex("by_nodeId", (q) => q.eq("nodeId", args.nodeId))
      .first();
    if (!node) return null;
    await ctx.db.patch(node._id, {
      fitnessScore: args.fitnessScore,
      maturationPhase: args.maturationPhase,
    });
    return node._id;
  },
});

export const recordActivation = mutation({
  args: {
    nodeId: v.string(),
    latencyMs: v.float64(),
    success: v.boolean(),
  },
  handler: async (ctx, args) => {
    const node = await ctx.db
      .query("graph_nodes")
      .withIndex("by_nodeId", (q) => q.eq("nodeId", args.nodeId))
      .first();
    if (!node) return null;
    await ctx.db.patch(node._id, {
      activationCount: node.activationCount + 1,
      totalLatencyMs: node.totalLatencyMs + args.latencyMs,
      successCount: args.success ? node.successCount + 1 : node.successCount,
      failureCount: args.success ? node.failureCount : node.failureCount + 1,
      lastActivated: new Date().toISOString(),
    });
    return node._id;
  },
});

export const updateStatus = mutation({
  args: {
    nodeId: v.string(),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    const node = await ctx.db
      .query("graph_nodes")
      .withIndex("by_nodeId", (q) => q.eq("nodeId", args.nodeId))
      .first();
    if (!node) return null;
    await ctx.db.patch(node._id, { status: args.status });
    return node._id;
  },
});

export const remove = mutation({
  args: { nodeId: v.string() },
  handler: async (ctx, args) => {
    const node = await ctx.db
      .query("graph_nodes")
      .withIndex("by_nodeId", (q) => q.eq("nodeId", args.nodeId))
      .first();
    if (!node) return false;
    await ctx.db.delete(node._id);
    return true;
  },
});
