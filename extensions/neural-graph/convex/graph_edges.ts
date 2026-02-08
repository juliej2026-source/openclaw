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
        .query("graph_edges")
        .withIndex("by_stationId", (q) => q.eq("stationId", args.stationId!))
        .collect();
    }
    return ctx.db.query("graph_edges").collect();
  },
});

export const getByEdgeId = query({
  args: { edgeId: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("graph_edges")
      .withIndex("by_edgeId", (q) => q.eq("edgeId", args.edgeId))
      .first();
  },
});

export const listBySource = query({
  args: { sourceNodeId: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("graph_edges")
      .withIndex("by_source", (q) => q.eq("sourceNodeId", args.sourceNodeId))
      .collect();
  },
});

export const listByTarget = query({
  args: { targetNodeId: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("graph_edges")
      .withIndex("by_target", (q) => q.eq("targetNodeId", args.targetNodeId))
      .collect();
  },
});

export const listMyelinated = query({
  args: {},
  handler: async (ctx) => {
    return ctx.db
      .query("graph_edges")
      .withIndex("by_myelinated", (q) => q.eq("myelinated", true))
      .collect();
  },
});

export const count = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("graph_edges").collect();
    return all.length;
  },
});

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export const create = mutation({
  args: {
    edgeId: v.string(),
    sourceNodeId: v.string(),
    targetNodeId: v.string(),
    edgeType: v.string(),
    weight: v.float64(),
    myelinated: v.boolean(),
    activationCount: v.float64(),
    coActivationCount: v.float64(),
    avgLatencyMs: v.float64(),
    stationId: v.string(),
    createdAt: v.string(),
    metadata: v.any(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("graph_edges")
      .withIndex("by_edgeId", (q) => q.eq("edgeId", args.edgeId))
      .first();
    if (existing) {
      return existing._id;
    }
    return ctx.db.insert("graph_edges", args);
  },
});

export const updateWeight = mutation({
  args: {
    edgeId: v.string(),
    weight: v.float64(),
  },
  handler: async (ctx, args) => {
    const edge = await ctx.db
      .query("graph_edges")
      .withIndex("by_edgeId", (q) => q.eq("edgeId", args.edgeId))
      .first();
    if (!edge) return null;
    await ctx.db.patch(edge._id, { weight: args.weight });
    return edge._id;
  },
});

export const recordActivation = mutation({
  args: {
    edgeId: v.string(),
    latencyMs: v.float64(),
  },
  handler: async (ctx, args) => {
    const edge = await ctx.db
      .query("graph_edges")
      .withIndex("by_edgeId", (q) => q.eq("edgeId", args.edgeId))
      .first();
    if (!edge) return null;
    const newCount = edge.activationCount + 1;
    const newAvg = (edge.avgLatencyMs * edge.activationCount + args.latencyMs) / newCount;
    await ctx.db.patch(edge._id, {
      activationCount: newCount,
      avgLatencyMs: newAvg,
    });
    return edge._id;
  },
});

export const recordCoActivation = mutation({
  args: { edgeId: v.string() },
  handler: async (ctx, args) => {
    const edge = await ctx.db
      .query("graph_edges")
      .withIndex("by_edgeId", (q) => q.eq("edgeId", args.edgeId))
      .first();
    if (!edge) return null;
    await ctx.db.patch(edge._id, {
      coActivationCount: edge.coActivationCount + 1,
    });
    return edge._id;
  },
});

export const myelinate = mutation({
  args: { edgeId: v.string() },
  handler: async (ctx, args) => {
    const edge = await ctx.db
      .query("graph_edges")
      .withIndex("by_edgeId", (q) => q.eq("edgeId", args.edgeId))
      .first();
    if (!edge) return null;
    await ctx.db.patch(edge._id, { myelinated: true });
    return edge._id;
  },
});

export const remove = mutation({
  args: { edgeId: v.string() },
  handler: async (ctx, args) => {
    const edge = await ctx.db
      .query("graph_edges")
      .withIndex("by_edgeId", (q) => q.eq("edgeId", args.edgeId))
      .first();
    if (!edge) return false;
    await ctx.db.delete(edge._id);
    return true;
  },
});
