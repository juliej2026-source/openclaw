// ---------------------------------------------------------------------------
// Core hotel data types — ported from hotel-calc-kelvin
// ---------------------------------------------------------------------------

export type HotelSource =
  | "ratehawk"
  | "google_hotels"
  | "nisade"
  | "playwright"
  | "roomboss"
  | "manual";

export type ScraperStrategy = "apify_only" | "playwright_only" | "hybrid" | "auto";

export type ScrapeJobStatus = "pending" | "processing" | "completed" | "failed";

export type Currency = "JPY" | "USD" | "AUD" | "EUR" | "GBP" | "RMB";

// ---------------------------------------------------------------------------
// Location
// ---------------------------------------------------------------------------

export type HotelLocation = {
  prefecture: string;
  city: string;
  district: string; // Hirafu, Village, Annupuri, Hanazono
  address: string;
  coordinates: { lat: number; lon: number };
};

// ---------------------------------------------------------------------------
// Price
// ---------------------------------------------------------------------------

export type PriceEntry = {
  source: HotelSource;
  providerName: string;
  rate: number;
  currency: string;
  pricePerNight: number;
  checkIn: string; // YYYY-MM-DD
  checkOut: string; // YYYY-MM-DD
  nights: number;
  guests: number;
  roomType?: string;
  availability: boolean;
  bookingUrl: string;
  lastChecked: number; // epoch ms
  conditions?: string;
};

// ---------------------------------------------------------------------------
// Hotel (unified)
// ---------------------------------------------------------------------------

export type Hotel = {
  hotelId: string;
  canonicalId?: string;
  aliases?: string[];

  source: string;
  providerName: string;
  sources?: string[];

  name: string;
  nameJa?: string;
  nameZh?: string;

  location: HotelLocation;

  price: number;
  currency: string;
  priceInYen: number;
  prices?: PriceEntry[];

  checkIn: string;
  checkOut: string;
  nights: number;
  guests: number;

  availability: boolean;
  url: string;

  lastUpdated: number;
  lastMerged?: number;

  stars?: number;
  bedrooms?: number;
  maxGuests?: number;
  amenities?: string[];
  description?: string;
  photos?: string[];
  checkInTime?: string;
  checkOutTime?: string;
};

// ---------------------------------------------------------------------------
// Scrape job
// ---------------------------------------------------------------------------

export type ScrapeParams = {
  checkIn: string;
  checkOut: string;
  guests: number;
  hotelIds?: string[];
  sources?: HotelSource[];
  strategy?: ScraperStrategy;
};

export type ScrapeResult = {
  source: HotelSource;
  hotels: Hotel[];
  pricesFound: number;
  duration_ms: number;
  error?: string;
};

export type ScrapeJob = {
  id: string;
  status: ScrapeJobStatus;
  params: ScrapeParams;
  results: ScrapeResult[];
  startedAt?: number;
  completedAt?: number;
  duration_ms?: number;
  error?: string;
};

// ---------------------------------------------------------------------------
// Scrape request queue
// ---------------------------------------------------------------------------

export type ScrapeRequest = {
  id: string;
  status: ScrapeJobStatus;
  priority: number;
  params: ScrapeParams;
  requestedBy: string;
  requestedAt: number;
  processedAt?: number;
  jobId?: string;
  error?: string;
  retryCount: number;
  maxRetries: number;
};

// ---------------------------------------------------------------------------
// Website metadata (for Playwright scraping)
// ---------------------------------------------------------------------------

export type BookingEngine = "guesty" | "bookingsync" | "custom" | "unknown";

export type WebsiteMetadata = {
  hotelId: string;
  officialWebsite: string;
  bookingEngine: BookingEngine;
  bookingWidgetUrl?: string;
  calendarSelector?: string;
  priceSelector?: string;
  scraperConfig?: Record<string, unknown>;
  lastVerified: number;
  verificationStatus: "pending" | "verified" | "failed";
  notes?: string;
};

// ---------------------------------------------------------------------------
// Selector health tracking
// ---------------------------------------------------------------------------

export type SelectorTracking = {
  hotelId: string;
  hotelName: string;
  selector: string;
  totalAttempts: number;
  successfulAttempts: number;
  failedAttempts: number;
  consecutiveFailures: number;
  lastAttempt: number;
  lastSuccess?: number;
  lastFailure?: number;
  lastError?: string;
};

// ---------------------------------------------------------------------------
// Competitor pricing (rate calculator)
// ---------------------------------------------------------------------------

export type Unit = {
  id: string;
  slug: string;
  name: string;
  nameJa?: string;
  nameZh?: string;
  bedrooms: number;
  maxGuests: number;
  size: number;
  peakRate: number;
  cnyRate: number;
  cny2Rate: number;
  midRate: number;
  lowRate: number;
  endRate: number;
  preRate: number;
  currentRate?: number;
  seasonTier?: string;
};

export type CompetitorPrice = {
  id: string;
  competitorId: string;
  nightlyRate: number;
  totalPrice: number;
  scrapedAt: string;
  source: string;
  sourceInfo?: { displayName: string; icon: string; color: string; category: string };
  competitor: {
    id: string;
    name: string;
    category: string;
    propertyType: string;
    bedrooms?: number;
    maxGuests?: number;
    officialWebsite?: string;
  };
};

// ---------------------------------------------------------------------------
// Extension constants
// ---------------------------------------------------------------------------

export const CONVEX_URL = process.env.CONVEX_URL ?? "http://10.1.7.158:3210";

export const PLAYWRIGHT_SERVICE_URL =
  process.env.PLAYWRIGHT_SERVICE_URL ?? "https://igoraid-playwright-hotel-scraper.hf.space";
