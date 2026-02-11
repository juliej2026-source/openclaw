// ---------------------------------------------------------------------------
// Google Hotels scraper via Apify FREE actor (vittuhy~google-travel-hotel-prices)
// Ported from hotel-calc-kelvin convex/actions/apifyGoogleHotels.ts
// ---------------------------------------------------------------------------

import type { Hotel, ScrapeParams, ScrapeResult } from "../types.js";
import type { GoogleHotelResult } from "./types.js";

const APIFY_API_URL = "https://api.apify.com/v2";
const POLL_INTERVAL = 5_000;
const MAX_WAIT = 120_000;

function getApifyToken(): string {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) throw new Error("APIFY_API_TOKEN not configured");
  return token;
}

function calculateNights(checkIn: string, checkOut: string): number {
  const ms = new Date(checkOut).getTime() - new Date(checkIn).getTime();
  return Math.max(1, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

async function waitForRun(runId: string, token: string): Promise<GoogleHotelResult[]> {
  const deadline = Date.now() + MAX_WAIT;

  while (Date.now() < deadline) {
    const statusResp = await fetch(`${APIFY_API_URL}/actor-runs/${runId}?token=${token}`);
    if (!statusResp.ok) throw new Error(`Failed to check run status: ${statusResp.status}`);

    const statusData = (await statusResp.json()) as {
      data: { status: string; defaultDatasetId: string };
    };
    const status = statusData.data.status;

    if (status === "SUCCEEDED") {
      const dataResp = await fetch(
        `${APIFY_API_URL}/datasets/${statusData.data.defaultDatasetId}/items?token=${token}`,
      );
      if (!dataResp.ok) throw new Error(`Failed to fetch results: ${dataResp.status}`);
      return (await dataResp.json()) as GoogleHotelResult[];
    }

    if (status === "FAILED" || status === "ABORTED") {
      throw new Error(`Apify run ${status.toLowerCase()}`);
    }

    await new Promise((r) => setTimeout(r, POLL_INTERVAL));
  }

  throw new Error("Timeout waiting for Apify actor");
}

function transformResult(raw: GoogleHotelResult, params: ScrapeParams): Hotel {
  const nights = calculateNights(params.checkIn, params.checkOut);
  return {
    hotelId: `google-${raw.id || raw.name}`,
    source: "google_hotels",
    providerName: raw.provider || "Google Hotels",
    name: raw.name,
    location: {
      prefecture: "Hokkaido",
      city: "Kutchan",
      district: "Hirafu",
      address: "",
      coordinates: { lat: 42.8486, lon: 140.6873 },
    },
    price: raw.price,
    currency: raw.currency || "JPY",
    priceInYen: raw.price, // Actor requests JPY directly
    checkIn: params.checkIn,
    checkOut: params.checkOut,
    nights,
    guests: params.guests,
    availability: true,
    url: raw.url,
    lastUpdated: Date.now(),
    stars: raw.rating,
  };
}

export async function scrape(params: ScrapeParams): Promise<ScrapeResult> {
  const start = Date.now();
  try {
    const token = getApifyToken();
    const nights = calculateNights(params.checkIn, params.checkOut);

    // Start the FREE Google Hotels actor
    const resp = await fetch(
      `${APIFY_API_URL}/acts/vittuhy~google-travel-hotel-prices/runs?token=${token}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity: "Niseko Hirafu, Japan",
          checkInDate: params.checkIn,
          days: nights,
          adults: params.guests,
          currency: "JPY",
          proxyConfig: {
            useApifyProxy: true,
            apifyProxyGroups: ["RESIDENTIAL"],
            apifyProxyCountry: "JP",
          },
        }),
      },
    );

    if (!resp.ok) throw new Error(`Apify API error: ${resp.status}`);

    const run = (await resp.json()) as { data: { id: string } };
    const results = await waitForRun(run.data.id, token);

    if (!results || results.length === 0) {
      return {
        source: "google_hotels",
        hotels: [],
        pricesFound: 0,
        duration_ms: Date.now() - start,
      };
    }

    const hotels = results.map((r) => transformResult(r, params));

    return {
      source: "google_hotels",
      hotels,
      pricesFound: hotels.length,
      duration_ms: Date.now() - start,
    };
  } catch (err) {
    return {
      source: "google_hotels",
      hotels: [],
      pricesFound: 0,
      duration_ms: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
