// ---------------------------------------------------------------------------
// Convex queries — ported from hotel-calc-kelvin
// ---------------------------------------------------------------------------

import { v } from "convex/values";
import { query, internalQuery } from "./_generated/server";

export const getHotels = query({
  args: { enabled: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    let hotels = await ctx.db.query("hotels").collect();
    if (args.enabled !== undefined) {
      hotels = hotels.filter((h) => h.enabled === args.enabled);
    }
    return hotels.sort((a, b) => a.priority - b.priority);
  },
});

export const getHotelBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("hotels")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
  },
});

export const getLatestPrices = query({
  args: {
    hotelId: v.optional(v.id("hotels")),
    source: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let q: any = ctx.db.query("prices");
    if (args.hotelId) {
      q = q.withIndex("by_hotel", (qi: any) => qi.eq("hotelId", args.hotelId));
    } else if (args.source) {
      q = q.withIndex("by_source", (qi: any) => qi.eq("source", args.source));
    }
    const prices = await q.collect();
    const sorted = prices.sort((a: any, b: any) => b.scrapedAt - a.scrapedAt);
    return sorted.slice(0, args.limit || 50);
  },
});

export const getActiveAlerts = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("alerts")
      .withIndex("by_acknowledged")
      .order("desc")
      .filter((q) => q.eq(q.field("acknowledged"), false))
      .take(20);
  },
});

export const getScrapeJobs = query({
  args: {
    status: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let jobs = await ctx.db.query("scrapeJobs").collect();
    if (args.status) {
      jobs = jobs.filter((j) => j.status === args.status);
    }
    const sorted = jobs.sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0));
    return sorted.slice(0, args.limit || 20);
  },
});

export const getCurrencyRate = query({
  args: { fromCurrency: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("currencyRates")
      .withIndex("by_currency", (q) => q.eq("fromCurrency", args.fromCurrency))
      .first();
  },
});

export const getScrapeProgress = query({
  args: { jobId: v.id("scrapeJobs") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("scrapeProgress")
      .withIndex("by_job", (q) => q.eq("jobId", args.jobId))
      .first();
  },
});

export const getPendingScrapeRequests = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("scrapeRequests")
      .withIndex("by_status_priority", (q) => q.eq("status", "pending"))
      .order("desc")
      .take(10);
  },
});

// ---------------------------------------------------------------------------
// Internal queries (for use by actions/cron handlers)
// ---------------------------------------------------------------------------

export const internalGetHotels = internalQuery({
  args: { enabled: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    let hotels = await ctx.db.query("hotels").collect();
    if (args.enabled !== undefined) {
      hotels = hotels.filter((h) => h.enabled === args.enabled);
    }
    return hotels.sort((a, b) => a.priority - b.priority);
  },
});

export const internalGetHotelById = internalQuery({
  args: { id: v.id("hotels") },
  handler: async (ctx, args) => await ctx.db.get(args.id),
});

export const internalGetHotelsByIds = internalQuery({
  args: { ids: v.array(v.id("hotels")) },
  handler: async (ctx, args) => {
    const hotels = await Promise.all(args.ids.map((id) => ctx.db.get(id)));
    return hotels.filter((h): h is NonNullable<typeof h> => h !== null);
  },
});

export const internalGetPrices = internalQuery({
  args: { hotelId: v.id("hotels") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("prices")
      .withIndex("by_hotel", (q) => q.eq("hotelId", args.hotelId))
      .collect();
  },
});

export const internalGetAllPrices = internalQuery({
  handler: async (ctx) => await ctx.db.query("prices").collect(),
});

export const internalGetCurrencyRate = internalQuery({
  args: { fromCurrency: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("currencyRates")
      .withIndex("by_currency", (q) => q.eq("fromCurrency", args.fromCurrency))
      .first();
  },
});

export const internalGetWebsiteMetadata = internalQuery({
  handler: async (ctx) => await ctx.db.query("websiteMetadata").collect(),
});

export const internalGetSelectorTracking = internalQuery({
  handler: async (ctx) => await ctx.db.query("selectorTracking").collect(),
});

export const internalGetSelectorTrackingByHotelAndSelector = internalQuery({
  args: {
    hotelId: v.id("hotels"),
    selector: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("selectorTracking")
      .withIndex("by_hotel_selector", (q) =>
        q.eq("hotelId", args.hotelId).eq("selector", args.selector),
      )
      .first();
  },
});

export const internalFindExistingPrice = internalQuery({
  args: {
    hotelId: v.id("hotels"),
    source: v.string(),
    checkIn: v.string(),
    checkOut: v.string(),
    guests: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("prices")
      .withIndex("by_dedup_key", (q) =>
        q
          .eq("hotelId", args.hotelId)
          .eq("source", args.source)
          .eq("checkIn", args.checkIn)
          .eq("checkOut", args.checkOut)
          .eq("guests", args.guests),
      )
      .first();
  },
});

export const internalGetPendingScrapeRequests = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("scrapeRequests")
      .withIndex("by_status_priority", (q) => q.eq("status", "pending"))
      .order("desc")
      .take(10);
  },
});
