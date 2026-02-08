import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// ---------------------------------------------------------------------------
// Evolution event audit log
// ---------------------------------------------------------------------------

export const list = query({
  args: {
    stationId: v.optional(v.string()),
    limit: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    const all = args.stationId
      ? await ctx.db
          .query("evolution_events")
          .withIndex("by_stationId", (q) => q.eq("stationId", args.stationId!))
          .collect()
      : await ctx.db.query("evolution_events").collect();
    // Return most recent first
    all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return all.slice(0, limit);
  },
});

export const listPending = query({
  args: {},
  handler: async (ctx) => {
    return ctx.db
      .query("evolution_events")
      .withIndex("by_approvalStatus", (q) => q.eq("approvalStatus", "pending"))
      .collect();
  },
});

export const record = mutation({
  args: {
    eventType: v.string(),
    targetId: v.string(),
    previousState: v.any(),
    newState: v.any(),
    reason: v.string(),
    triggeredBy: v.string(),
    requiresApproval: v.boolean(),
    approvalStatus: v.string(),
    stationId: v.string(),
    createdAt: v.string(),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("evolution_events", args);
  },
});

export const approve = mutation({
  args: { eventId: v.id("evolution_events") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.eventId, { approvalStatus: "approved" });
    return true;
  },
});

export const reject = mutation({
  args: { eventId: v.id("evolution_events") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.eventId, { approvalStatus: "rejected" });
    return true;
  },
});

export const count = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("evolution_events").collect();
    return all.length;
  },
});
