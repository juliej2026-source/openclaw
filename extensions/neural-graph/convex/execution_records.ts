import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// ---------------------------------------------------------------------------
// Execution record telemetry
// ---------------------------------------------------------------------------

export const list = query({
  args: {
    stationId: v.optional(v.string()),
    limit: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;
    const all = args.stationId
      ? await ctx.db
          .query("execution_records")
          .withIndex("by_stationId", (q) => q.eq("stationId", args.stationId!))
          .collect()
      : await ctx.db.query("execution_records").collect();
    all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return all.slice(0, limit);
  },
});

export const getByThread = query({
  args: { threadId: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("execution_records")
      .withIndex("by_threadId", (q) => q.eq("threadId", args.threadId))
      .collect();
  },
});

export const record = mutation({
  args: {
    threadId: v.string(),
    taskType: v.string(),
    taskDescription: v.string(),
    nodesVisited: v.array(v.string()),
    edgesTraversed: v.array(v.string()),
    success: v.boolean(),
    totalLatencyMs: v.float64(),
    nodeLatencies: v.any(),
    stationId: v.string(),
    createdAt: v.string(),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("execution_records", args);
  },
});

export const count = query({
  args: { stationId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const all = args.stationId
      ? await ctx.db
          .query("execution_records")
          .withIndex("by_stationId", (q) => q.eq("stationId", args.stationId!))
          .collect()
      : await ctx.db.query("execution_records").collect();
    return all.length;
  },
});

export const countByTaskType = query({
  args: { taskType: v.string() },
  handler: async (ctx, args) => {
    const all = await ctx.db
      .query("execution_records")
      .withIndex("by_taskType", (q) => q.eq("taskType", args.taskType))
      .collect();
    return all.length;
  },
});
