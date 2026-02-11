// ---------------------------------------------------------------------------
// Convex mutations — ported from hotel-calc-kelvin
// ---------------------------------------------------------------------------

import { v } from "convex/values";
import { mutation, internalMutation } from "./_generated/server";

// ---------------------------------------------------------------------------
// Hotel CRUD
// ---------------------------------------------------------------------------

export const addHotel = mutation({
  args: {
    slug: v.string(),
    name: v.string(),
    nameJa: v.string(),
    nameZh: v.string(),
    location: v.string(),
    niseko_area: v.string(),
    peakRate: v.number(),
    cnyRate: v.number(),
    cny2Rate: v.number(),
    midRate: v.number(),
    lowRate: v.number(),
    endRate: v.number(),
    preRate: v.number(),
    bedrooms: v.number(),
    maxGuests: v.number(),
    size: v.number(),
    bookingComUrl: v.optional(v.string()),
    hotelsDotComUrl: v.optional(v.string()),
    expediaUrl: v.optional(v.string()),
    tripadvisorUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("hotels", { ...args, enabled: true, priority: 1 });
  },
});

export const updateHotel = mutation({
  args: {
    id: v.id("hotels"),
    enabled: v.optional(v.boolean()),
    priority: v.optional(v.number()),
    bookingComUrl: v.optional(v.string()),
    hotelsDotComUrl: v.optional(v.string()),
    expediaUrl: v.optional(v.string()),
    tripadvisorUrl: v.optional(v.string()),
    aliases: v.optional(v.array(v.string())),
    sources: v.optional(v.array(v.string())),
    lastMerged: v.optional(v.number()),
    canonicalHotelId: v.optional(v.id("hotels")),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);
  },
});

// ---------------------------------------------------------------------------
// Price CRUD
// ---------------------------------------------------------------------------

export const addPrice = mutation({
  args: {
    hotelId: v.id("hotels"),
    source: v.string(),
    price: v.number(),
    originalPrice: v.number(),
    currency: v.string(),
    priceInYen: v.number(),
    checkIn: v.string(),
    checkOut: v.string(),
    nights: v.number(),
    guests: v.number(),
    roomType: v.optional(v.string()),
    availability: v.boolean(),
    rating: v.optional(v.number()),
    url: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("prices", { ...args, scrapedAt: Date.now() });
  },
});

// ---------------------------------------------------------------------------
// Scrape jobs
// ---------------------------------------------------------------------------

export const createScrapeJob = mutation({
  args: {
    type: v.string(),
    hotelIds: v.array(v.id("hotels")),
    sources: v.array(v.string()),
    checkIn: v.string(),
    checkOut: v.string(),
    guests: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("scrapeJobs", {
      ...args,
      status: "pending",
      startedAt: Date.now(),
    });
  },
});

export const updateScrapeJob = mutation({
  args: {
    id: v.id("scrapeJobs"),
    status: v.optional(v.string()),
    completedAt: v.optional(v.number()),
    duration: v.optional(v.number()),
    resultsCount: v.optional(v.number()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);
  },
});

// ---------------------------------------------------------------------------
// Currency
// ---------------------------------------------------------------------------

export const updateCurrencyRate = mutation({
  args: { fromCurrency: v.string(), toYen: v.number() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("currencyRates")
      .withIndex("by_currency", (q) => q.eq("fromCurrency", args.fromCurrency))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { toYen: args.toYen, updatedAt: Date.now() });
      return existing._id;
    }
    return await ctx.db.insert("currencyRates", {
      fromCurrency: args.fromCurrency,
      toYen: args.toYen,
      updatedAt: Date.now(),
    });
  },
});

// ---------------------------------------------------------------------------
// Scrape request queue
// ---------------------------------------------------------------------------

export const queueScrapeRequest = mutation({
  args: {
    checkIn: v.string(),
    checkOut: v.string(),
    guests: v.number(),
    hotelIds: v.optional(v.array(v.id("hotels"))),
    sources: v.optional(v.array(v.string())),
    priority: v.optional(v.number()),
    strategy: v.optional(v.string()),
    useOfficialSites: v.optional(v.boolean()),
    playwrightConfig: v.optional(
      v.object({
        useXhrInterception: v.boolean(),
        captureScreenshots: v.boolean(),
        stealthMode: v.boolean(),
        maxNavigationTime: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const requestId = await ctx.db.insert("scrapeRequests", {
      status: "pending",
      priority: args.priority || 5,
      checkIn: args.checkIn,
      checkOut: args.checkOut,
      guests: args.guests,
      hotelIds: args.hotelIds,
      sources: args.sources,
      requestedBy: "hotel-scraper-ext",
      requestedAt: Date.now(),
      retryCount: 0,
      maxRetries: 3,
      strategy: args.strategy || "auto",
      useOfficialSites: args.useOfficialSites ?? true,
      playwrightConfig: args.playwrightConfig,
    });
    return { requestId, status: "queued" };
  },
});

// ---------------------------------------------------------------------------
// Internal mutations
// ---------------------------------------------------------------------------

export const internalAddHotel = internalMutation({
  args: {
    slug: v.string(),
    name: v.string(),
    nameJa: v.string(),
    nameZh: v.string(),
    location: v.string(),
    niseko_area: v.string(),
    peakRate: v.number(),
    cnyRate: v.number(),
    cny2Rate: v.number(),
    midRate: v.number(),
    lowRate: v.number(),
    endRate: v.number(),
    preRate: v.number(),
    bedrooms: v.number(),
    maxGuests: v.number(),
    size: v.number(),
    bookingComUrl: v.optional(v.string()),
    hotelsDotComUrl: v.optional(v.string()),
    expediaUrl: v.optional(v.string()),
    tripadvisorUrl: v.optional(v.string()),
    coordinates: v.optional(v.object({ lat: v.number(), lon: v.number() })),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("hotels", { ...args, enabled: true, priority: 1 });
  },
});

export const internalUpdateHotel = internalMutation({
  args: {
    id: v.id("hotels"),
    enabled: v.optional(v.boolean()),
    priority: v.optional(v.number()),
    aliases: v.optional(v.array(v.string())),
    sources: v.optional(v.array(v.string())),
    lastMerged: v.optional(v.number()),
    canonicalHotelId: v.optional(v.id("hotels")),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);
  },
});

export const internalAddPrice = internalMutation({
  args: {
    hotelId: v.id("hotels"),
    source: v.string(),
    price: v.number(),
    originalPrice: v.number(),
    currency: v.string(),
    priceInYen: v.number(),
    checkIn: v.string(),
    checkOut: v.string(),
    nights: v.number(),
    guests: v.number(),
    roomType: v.optional(v.string()),
    availability: v.boolean(),
    rating: v.optional(v.number()),
    url: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("prices", { ...args, scrapedAt: Date.now() });
  },
});

export const deletePrice = internalMutation({
  args: { id: v.id("prices") },
  handler: async (ctx, args) => await ctx.db.delete(args.id),
});

export const updatePrice = internalMutation({
  args: {
    id: v.id("prices"),
    canonicalHotelId: v.optional(v.id("hotels")),
    providerName: v.optional(v.string()),
    pricePerNight: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);
  },
});

export const internalCreateScrapeJob = internalMutation({
  args: {
    type: v.string(),
    status: v.string(),
    hotelIds: v.array(v.id("hotels")),
    sources: v.array(v.string()),
    checkIn: v.string(),
    checkOut: v.string(),
    guests: v.number(),
    startedAt: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("scrapeJobs", args);
  },
});

export const internalUpdateScrapeJob = internalMutation({
  args: {
    jobId: v.id("scrapeJobs"),
    status: v.string(),
    completedAt: v.number(),
    duration: v.optional(v.number()),
    resultsCount: v.optional(v.number()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { jobId, ...updates } = args;
    await ctx.db.patch(jobId, updates);
  },
});

export const internalInsertAlert = internalMutation({
  args: {
    type: v.string(),
    severity: v.string(),
    hotelId: v.optional(v.id("hotels")),
    hotelName: v.optional(v.string()),
    message: v.string(),
    details: v.optional(v.any()),
    acknowledged: v.boolean(),
    createdAt: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("alerts", args);
  },
});

export const internalUpsertScrapeProgress = internalMutation({
  args: {
    jobId: v.id("scrapeJobs"),
    phase: v.string(),
    hotel: v.optional(v.string()),
    source: v.optional(v.string()),
    progress: v.number(),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const ttl = now + 3600000;

    const existing = await ctx.db
      .query("scrapeProgress")
      .withIndex("by_job", (q) => q.eq("jobId", args.jobId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { ...args, timestamp: now, ttl });
      return existing._id;
    }
    return await ctx.db.insert("scrapeProgress", { ...args, timestamp: now, ttl });
  },
});

export const internalDeleteExpiredProgress = internalMutation({
  handler: async (ctx) => {
    const now = Date.now();
    const expired = await ctx.db
      .query("scrapeProgress")
      .withIndex("by_ttl")
      .filter((q) => q.lt(q.field("ttl"), now))
      .collect();
    for (const entry of expired) {
      await ctx.db.delete(entry._id);
    }
    return { deleted: expired.length };
  },
});

export const internalUpdateScrapeRequest = internalMutation({
  args: {
    requestId: v.id("scrapeRequests"),
    status: v.string(),
    processedAt: v.optional(v.number()),
    jobId: v.optional(v.id("scrapeJobs")),
    error: v.optional(v.string()),
    errorDetails: v.optional(v.any()),
    retryCount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { requestId, ...updates } = args;
    await ctx.db.patch(requestId, updates);
  },
});

export const internalInsertSelectorAttempt = internalMutation({
  args: {
    hotelId: v.id("hotels"),
    hotelName: v.string(),
    selector: v.string(),
    success: v.boolean(),
    priceFound: v.optional(v.number()),
    screenshotPath: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    timestamp: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("selectorAttempts", args);
  },
});

export const internalPatchSelectorTracking = internalMutation({
  args: {
    id: v.id("selectorTracking"),
    totalAttempts: v.number(),
    successfulAttempts: v.number(),
    failedAttempts: v.number(),
    consecutiveFailures: v.number(),
    lastAttempt: v.number(),
    lastSuccess: v.optional(v.number()),
    lastFailure: v.optional(v.number()),
    lastError: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);
  },
});

export const internalInsertSelectorTracking = internalMutation({
  args: {
    hotelId: v.id("hotels"),
    hotelName: v.string(),
    selector: v.string(),
    totalAttempts: v.number(),
    successfulAttempts: v.number(),
    failedAttempts: v.number(),
    consecutiveFailures: v.number(),
    lastAttempt: v.number(),
    lastSuccess: v.optional(v.number()),
    lastFailure: v.optional(v.number()),
    lastError: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("selectorTracking", args);
  },
});

export const internalPatchWebsiteMetadata = internalMutation({
  args: {
    id: v.id("websiteMetadata"),
    lastVerified: v.number(),
    verificationStatus: v.string(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);
  },
});
