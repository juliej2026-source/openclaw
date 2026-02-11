// ---------------------------------------------------------------------------
// RateHawk API scraper — ported from hotel-calc-kelvin lib/ratehawk/
// Returns data without persisting (caller handles storage)
// ---------------------------------------------------------------------------

import axios from "axios";
import type { Hotel, ScrapeParams, ScrapeResult } from "../types.js";
import type { RateHawkHotel, RateHawkSearchResponse } from "./types.js";
import { NISEKO_SEARCH_AREAS } from "../config.js";
import { CURRENCY_RATES } from "../config.js";

const BASE_URL = "https://api.worldota.net/api/b2b/v3";
const TIMEOUT = 30_000;

function getApiKey(): string {
  const key = process.env.RATEHAWK_API_KEY;
  if (!key) throw new Error("RATEHAWK_API_KEY not configured");
  return key;
}

function detectNisekoDistrict(lat: number, lon: number): string {
  let closest = "Hirafu";
  let minDist = Infinity;
  for (const area of NISEKO_SEARCH_AREAS) {
    const dist = Math.sqrt((lat - area.latitude) ** 2 + (lon - area.longitude) ** 2);
    if (dist < minDist) {
      minDist = dist;
      closest = area.name;
    }
  }
  return closest;
}

function convertToJpy(amount: number, currency: string): number {
  if (currency === "JPY") return amount;
  return Math.round(amount * (CURRENCY_RATES[currency] || 1));
}

function calculateNights(checkIn: string, checkOut: string): number {
  const ms = new Date(checkOut).getTime() - new Date(checkIn).getTime();
  return Math.max(1, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

function transformHotel(raw: RateHawkHotel, params: ScrapeParams): Hotel {
  const nights = calculateNights(params.checkIn, params.checkOut);
  const priceInYen = convertToJpy(raw.rates.min_price, raw.rates.currency);
  const district = detectNisekoDistrict(raw.location.lat, raw.location.lon);

  return {
    hotelId: `ratehawk-${raw.id}`,
    source: "ratehawk",
    providerName: "RateHawk",
    name: raw.name.en || raw.name.ja || `Hotel ${raw.id}`,
    nameJa: raw.name.ja,
    nameZh: raw.name.zh,
    location: {
      prefecture: "Hokkaido",
      city: raw.address.city || "Kutchan",
      district,
      address: raw.address.line1 || "",
      coordinates: { lat: raw.location.lat, lon: raw.location.lon },
    },
    price: raw.rates.min_price,
    currency: raw.rates.currency,
    priceInYen,
    checkIn: params.checkIn,
    checkOut: params.checkOut,
    nights,
    guests: params.guests,
    availability: true,
    url: raw.booking_url || "",
    lastUpdated: Date.now(),
    stars: raw.stars,
  };
}

async function searchArea(
  area: (typeof NISEKO_SEARCH_AREAS)[number],
  params: ScrapeParams,
  apiKey: string,
): Promise<Hotel[]> {
  const resp = await axios.post<RateHawkSearchResponse>(
    `${BASE_URL}/search/serp`,
    {
      geo: { lat: area.latitude, lon: area.longitude, radius: area.radiusKm * 1000 },
      checkin: params.checkIn,
      checkout: params.checkOut,
      residency: "jp",
      language: "en",
      guests: [{ adults: params.guests, children: [] }],
      currency: "JPY",
    },
    {
      timeout: TIMEOUT,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    },
  );

  const hotels = resp.data?.data?.hotels ?? [];
  return hotels.map((h) => transformHotel(h, params));
}

export async function scrape(params: ScrapeParams): Promise<ScrapeResult> {
  const start = Date.now();
  try {
    const apiKey = getApiKey();
    const allHotels: Hotel[] = [];

    // Search all 4 Niseko areas in parallel
    const results = await Promise.allSettled(
      NISEKO_SEARCH_AREAS.map((area) => searchArea(area, params, apiKey)),
    );

    for (const r of results) {
      if (r.status === "fulfilled") {
        allHotels.push(...r.value);
      }
    }

    // Deduplicate by hotelId
    const seen = new Set<string>();
    const unique = allHotels.filter((h) => {
      if (seen.has(h.hotelId)) return false;
      seen.add(h.hotelId);
      return true;
    });

    return {
      source: "ratehawk",
      hotels: unique,
      pricesFound: unique.length,
      duration_ms: Date.now() - start,
    };
  } catch (err) {
    return {
      source: "ratehawk",
      hotels: [],
      pricesFound: 0,
      duration_ms: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
