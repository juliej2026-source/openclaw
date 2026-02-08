import { v } from "convex/values";
import { mutation, query, action } from "./_generated/server";

// ---------------------------------------------------------------------------
// Vector embeddings for semantic search across the graph
// ---------------------------------------------------------------------------

export const upsert = mutation({
  args: {
    sourceId: v.string(),
    embedding: v.array(v.float64()),
    textContent: v.string(),
    stationId: v.string(),
    createdAt: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("graph_embeddings")
      .withIndex("by_sourceId", (q) => q.eq("sourceId", args.sourceId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        embedding: args.embedding,
        textContent: args.textContent,
      });
      return existing._id;
    }
    return ctx.db.insert("graph_embeddings", args);
  },
});

export const search = action({
  args: {
    embedding: v.array(v.float64()),
    limit: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 10;
    const results = await ctx.vectorSearch("graph_embeddings", "by_embedding", {
      vector: args.embedding,
      limit: Math.min(limit, 256),
    });
    return results;
  },
});

export const getBySource = query({
  args: { sourceId: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("graph_embeddings")
      .withIndex("by_sourceId", (q) => q.eq("sourceId", args.sourceId))
      .first();
  },
});

export const remove = mutation({
  args: { sourceId: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("graph_embeddings")
      .withIndex("by_sourceId", (q) => q.eq("sourceId", args.sourceId))
      .first();
    if (!existing) return false;
    await ctx.db.delete(existing._id);
    return true;
  },
});
