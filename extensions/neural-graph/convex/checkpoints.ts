import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// ---------------------------------------------------------------------------
// LangGraph checkpoint persistence (BaseCheckpointSaver backend)
// ---------------------------------------------------------------------------

export const get = query({
  args: { threadId: v.string(), checkpointId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (args.checkpointId) {
      return ctx.db
        .query("checkpoints")
        .withIndex("by_checkpointId", (q) => q.eq("checkpointId", args.checkpointId!))
        .first();
    }
    // Return latest checkpoint for thread
    const all = await ctx.db
      .query("checkpoints")
      .withIndex("by_threadId", (q) => q.eq("threadId", args.threadId))
      .collect();
    if (all.length === 0) return null;
    // Sort by createdAt descending, return newest
    all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return all[0];
  },
});

export const listByThread = query({
  args: { threadId: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("checkpoints")
      .withIndex("by_threadId", (q) => q.eq("threadId", args.threadId))
      .collect();
  },
});

export const put = mutation({
  args: {
    threadId: v.string(),
    checkpointId: v.string(),
    parentCheckpointId: v.optional(v.string()),
    channelValues: v.string(),
    channelVersions: v.string(),
    createdAt: v.string(),
  },
  handler: async (ctx, args) => {
    // Upsert: replace if checkpointId already exists
    const existing = await ctx.db
      .query("checkpoints")
      .withIndex("by_checkpointId", (q) => q.eq("checkpointId", args.checkpointId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        channelValues: args.channelValues,
        channelVersions: args.channelVersions,
      });
      return existing._id;
    }
    return ctx.db.insert("checkpoints", args);
  },
});

export const remove = mutation({
  args: { threadId: v.string() },
  handler: async (ctx, args) => {
    const all = await ctx.db
      .query("checkpoints")
      .withIndex("by_threadId", (q) => q.eq("threadId", args.threadId))
      .collect();
    for (const cp of all) {
      await ctx.db.delete(cp._id);
    }
    return all.length;
  },
});
