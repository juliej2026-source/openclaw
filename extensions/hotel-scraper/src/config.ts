// ---------------------------------------------------------------------------
// Niseko geographic search areas and scheduling intervals
// Ported from hotel-calc-kelvin lib/ratehawk/niseko-config.ts + convex/crons.ts
// ---------------------------------------------------------------------------

import type { HotelSource } from "./types.js";

// ---------------------------------------------------------------------------
// Geographic areas
// ---------------------------------------------------------------------------

export type NisekoSearchArea = {
  name: string;
  latitude: number;
  longitude: number;
  radiusKm: number;
  description: string;
  propertyTypes: string[];
  estimatedProperties: number;
};

export const NISEKO_SEARCH_AREAS: NisekoSearchArea[] = [
  {
    name: "Hirafu",
    latitude: 42.8486,
    longitude: 140.6873,
    radiusKm: 2.5,
    description: "Main resort village with largest accommodation inventory",
    propertyTypes: ["Chalets", "Condos", "Hotels", "Apartments"],
    estimatedProperties: 40,
  },
  {
    name: "Niseko Village",
    latitude: 42.8056,
    longitude: 140.6842,
    radiusKm: 2.0,
    description: "International hotel zone with Hilton and Green Leaf",
    propertyTypes: ["International Hotels", "Condos"],
    estimatedProperties: 15,
  },
  {
    name: "Annupuri",
    latitude: 42.835,
    longitude: 140.655,
    radiusKm: 1.5,
    description: "Quieter area with local lodges and family-friendly properties",
    propertyTypes: ["Lodges", "Pensions", "Small Hotels"],
    estimatedProperties: 10,
  },
  {
    name: "Hanazono",
    latitude: 42.865,
    longitude: 140.71,
    radiusKm: 1.5,
    description: "Luxury resort area with Park Hyatt and high-end condos",
    propertyTypes: ["Luxury Hotels", "Premium Condos"],
    estimatedProperties: 8,
  },
];

// ---------------------------------------------------------------------------
// Default search parameters
// ---------------------------------------------------------------------------

export const DEFAULT_SEARCH = {
  currency: "JPY",
  language: "en" as const,
  residency: "jp",
  guests: 2,
  nightsAhead: 7, // default check-in = 7 days from now
  stayLength: 2, // default 2 nights
};

// ---------------------------------------------------------------------------
// Scheduling intervals (ported from Convex crons → setInterval)
// ---------------------------------------------------------------------------

export type ScheduleEntry = {
  name: string;
  source: HotelSource | "system";
  intervalMs: number;
  description: string;
  enabled: boolean;
};

const HOUR = 60 * 60 * 1000;
const MINUTE = 60 * 1000;

export const SCHEDULE: ScheduleEntry[] = [
  {
    name: "ratehawk_hourly",
    source: "ratehawk",
    intervalMs: 1 * HOUR,
    description: "RateHawk API price sync for all Niseko areas",
    enabled: true,
  },
  {
    name: "google_hotels_hourly",
    source: "google_hotels",
    intervalMs: 1 * HOUR,
    description: "Google Hotels via Apify FREE actor",
    enabled: true,
  },
  {
    name: "nisade_daily",
    source: "nisade",
    intervalMs: 24 * HOUR,
    description: "nisade.com Niseko accommodation portal scrape",
    enabled: true,
  },
  {
    name: "playwright_6h",
    source: "playwright",
    intervalMs: 6 * HOUR,
    description: "Official hotel websites via Playwright (selector-based)",
    enabled: true,
  },
  {
    name: "roomboss_hourly",
    source: "roomboss",
    intervalMs: 1 * HOUR,
    description: "Vacation Niseko via RoomBoss/HF Playwright service",
    enabled: true,
  },
  {
    name: "queue_processor",
    source: "system",
    intervalMs: 2 * MINUTE,
    description: "Process pending scrape requests from the queue",
    enabled: true,
  },
  {
    name: "data_quality_hourly",
    source: "system",
    intervalMs: 1 * HOUR,
    description: "Data freshness, success rate, and alert checks",
    enabled: true,
  },
  {
    name: "price_dedup_hourly",
    source: "system",
    intervalMs: 1 * HOUR,
    description: "Deduplicate price records (keep lowest per group)",
    enabled: true,
  },
  {
    name: "progress_cleanup_hourly",
    source: "system",
    intervalMs: 1 * HOUR,
    description: "Remove expired scrape progress entries (TTL > 1h)",
    enabled: true,
  },
];

// ---------------------------------------------------------------------------
// Currency conversion (placeholder rates — will be replaced by live API)
// ---------------------------------------------------------------------------

export const CURRENCY_RATES: Record<string, number> = {
  JPY: 1,
  USD: 150,
  AUD: 100,
  EUR: 165,
  GBP: 190,
  RMB: 21,
};

// ---------------------------------------------------------------------------
// Peak/off-season definitions
// ---------------------------------------------------------------------------

export const PEAK_SEASONS = [
  { name: "Winter Peak", start: "12-20", end: "03-15", description: "Ski season — highest demand" },
  {
    name: "Summer",
    start: "07-01",
    end: "08-31",
    description: "Summer activities — moderate demand",
  },
];

export const OFF_SEASONS = [
  {
    name: "Spring Thaw",
    start: "03-16",
    end: "04-30",
    description: "Post-ski season — lowest prices",
  },
  { name: "Autumn", start: "09-01", end: "11-30", description: "Pre-ski season — low demand" },
];
