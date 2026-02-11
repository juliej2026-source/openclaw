// ---------------------------------------------------------------------------
// Convex schema — ported from hotel-calc-kelvin/convex/schema.ts
// 10 tables for the Niseko hotel price comparison system
// ---------------------------------------------------------------------------

import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  hotels: defineTable({
    slug: v.string(),
    name: v.string(),
    nameJa: v.string(),
    nameZh: v.string(),
    location: v.string(),
    niseko_area: v.string(),

    // Seasonal rates
    peakRate: v.number(),
    cnyRate: v.number(),
    cny2Rate: v.number(),
    midRate: v.number(),
    lowRate: v.number(),
    endRate: v.number(),
    preRate: v.number(),

    // Room details
    bedrooms: v.number(),
    maxGuests: v.number(),
    size: v.number(),

    // URLs for scraping
    bookingComUrl: v.optional(v.string()),
    hotelsDotComUrl: v.optional(v.string()),
    expediaUrl: v.optional(v.string()),
    tripadvisorUrl: v.optional(v.string()),

    enabled: v.boolean(),
    priority: v.number(),

    // Entity resolution
    aliases: v.optional(v.array(v.string())),
    sources: v.optional(v.array(v.string())),
    lastMerged: v.optional(v.number()),
    canonicalHotelId: v.optional(v.id("hotels")),
    coordinates: v.optional(v.object({ lat: v.number(), lon: v.number() })),
  })
    .index("by_slug", ["slug"])
    .index("by_area", ["niseko_area"])
    .index("by_priority", ["priority"]),

  prices: defineTable({
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
    scrapedAt: v.number(),

    // Entity resolution
    canonicalHotelId: v.optional(v.id("hotels")),
    providerName: v.optional(v.string()),
    pricePerNight: v.optional(v.number()),
  })
    .index("by_hotel", ["hotelId"])
    .index("by_source", ["source"])
    .index("by_scraped", ["scrapedAt"])
    .index("by_canonical", ["canonicalHotelId", "scrapedAt"])
    .index("by_dedup_key", ["hotelId", "source", "checkIn", "checkOut", "guests"]),

  scrapeJobs: defineTable({
    status: v.string(),
    type: v.string(),
    hotelIds: v.array(v.id("hotels")),
    sources: v.array(v.string()),
    checkIn: v.string(),
    checkOut: v.string(),
    guests: v.number(),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    duration: v.optional(v.number()),
    resultsCount: v.optional(v.number()),
    error: v.optional(v.string()),
  }).index("by_status", ["status"]),

  currencyRates: defineTable({
    fromCurrency: v.string(),
    toYen: v.number(),
    updatedAt: v.number(),
  }).index("by_currency", ["fromCurrency"]),

  websiteMetadata: defineTable({
    hotelId: v.id("hotels"),
    officialWebsite: v.string(),
    bookingEngine: v.string(),
    bookingWidgetUrl: v.optional(v.string()),
    calendarSelector: v.optional(v.string()),
    priceSelector: v.optional(v.string()),
    scraperConfig: v.optional(v.any()),
    lastVerified: v.number(),
    verificationStatus: v.string(),
    notes: v.optional(v.string()),
  })
    .index("by_hotel", ["hotelId"])
    .index("by_status", ["verificationStatus"])
    .index("by_verified", ["lastVerified"]),

  selectorTracking: defineTable({
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
    lastScreenshot: v.optional(v.string()),
  })
    .index("by_hotel_selector", ["hotelId", "selector"])
    .index("by_success_rate", ["successfulAttempts", "totalAttempts"]),

  selectorAttempts: defineTable({
    hotelId: v.id("hotels"),
    hotelName: v.string(),
    selector: v.string(),
    success: v.boolean(),
    priceFound: v.optional(v.number()),
    screenshotPath: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    timestamp: v.number(),
  })
    .index("by_hotel", ["hotelId"])
    .index("by_timestamp", ["timestamp"]),

  alerts: defineTable({
    type: v.string(),
    severity: v.string(),
    hotelId: v.optional(v.id("hotels")),
    hotelName: v.optional(v.string()),
    message: v.string(),
    details: v.optional(v.any()),
    acknowledged: v.boolean(),
    acknowledgedAt: v.optional(v.number()),
    createdAt: v.number(),
    resolvedAt: v.optional(v.number()),
  })
    .index("by_acknowledged", ["acknowledged"])
    .index("by_severity", ["severity"])
    .index("by_hotel", ["hotelId"])
    .index("by_created", ["createdAt"]),

  scrapeProgress: defineTable({
    jobId: v.id("scrapeJobs"),
    phase: v.string(),
    hotel: v.optional(v.string()),
    source: v.optional(v.string()),
    progress: v.number(),
    message: v.string(),
    timestamp: v.number(),
    ttl: v.number(),
  })
    .index("by_job", ["jobId"])
    .index("by_ttl", ["ttl"]),

  scrapeRequests: defineTable({
    status: v.string(),
    priority: v.number(),
    checkIn: v.string(),
    checkOut: v.string(),
    guests: v.number(),
    hotelIds: v.optional(v.array(v.id("hotels"))),
    sources: v.optional(v.array(v.string())),
    requestedBy: v.string(),
    requestedAt: v.number(),
    processedAt: v.optional(v.number()),
    jobId: v.optional(v.id("scrapeJobs")),
    error: v.optional(v.string()),
    errorDetails: v.optional(v.any()),
    retryCount: v.number(),
    maxRetries: v.number(),
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
  })
    .index("by_status_priority", ["status", "priority"])
    .index("by_requested", ["requestedAt"]),
});
