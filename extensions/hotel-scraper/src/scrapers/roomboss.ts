// ---------------------------------------------------------------------------
// RoomBoss / Vacation Niseko scraper via HF Playwright service
// Ported from hotel-calc-kelvin convex/actions/roombossScraper.ts
// ---------------------------------------------------------------------------

import type { Hotel, ScrapeParams, ScrapeResult } from "../types.js";
import { PLAYWRIGHT_SERVICE_URL } from "../types.js";
import { VACATION_NISEKO_HOTEL_IDS } from "./types.js";

function calculateNights(checkIn: string, checkOut: string): number {
  return Math.max(
    1,
    Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000),
  );
}

type RoomBossServiceResponse = {
  success: boolean;
  hotelsFound?: number;
  prices?: Array<{
    hotelName: string;
    price: number;
    currency?: string;
    roomType?: string;
  }>;
  error?: string;
};

export async function scrape(params: ScrapeParams): Promise<ScrapeResult> {
  const start = Date.now();
  try {
    const serviceUrl = PLAYWRIGHT_SERVICE_URL;
    const resp = await fetch(`${serviceUrl}/api/roomboss`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hotelIds: VACATION_NISEKO_HOTEL_IDS.slice(0, 30),
        checkIn: params.checkIn,
        checkOut: params.checkOut,
        guests: params.guests,
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Service error ${resp.status}: ${text}`);
    }

    const data = (await resp.json()) as RoomBossServiceResponse;
    if (!data.success) throw new Error(`Service failure: ${data.error || "unknown"}`);

    const nights = calculateNights(params.checkIn, params.checkOut);
    const hotels: Hotel[] = [];

    if (data.prices && Array.isArray(data.prices)) {
      for (const p of data.prices) {
        hotels.push({
          hotelId: `roomboss-${p.hotelName.toLowerCase().replace(/\s+/g, "-")}`,
          source: "roomboss",
          providerName: "Vacation Niseko",
          name: p.hotelName,
          location: {
            prefecture: "Hokkaido",
            city: "Kutchan",
            district: "Hirafu",
            address: "",
            coordinates: { lat: 42.8486, lon: 140.6873 },
          },
          price: p.price,
          currency: p.currency || "JPY",
          priceInYen: p.price,
          checkIn: params.checkIn,
          checkOut: params.checkOut,
          nights,
          guests: params.guests,
          availability: true,
          url: "https://stay.vacationniseko.com",
          lastUpdated: Date.now(),
        });
      }
    }

    return {
      source: "roomboss",
      hotels,
      pricesFound: hotels.length,
      duration_ms: Date.now() - start,
    };
  } catch (err) {
    return {
      source: "roomboss",
      hotels: [],
      pricesFound: 0,
      duration_ms: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
