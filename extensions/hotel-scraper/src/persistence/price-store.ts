// ---------------------------------------------------------------------------
// Price persistence — wraps Convex HTTP client for price read/write
// ---------------------------------------------------------------------------

import { getConvexClient } from "./convex-client.js";

type ConvexPriceRow = {
  _id: string;
  hotelId: string;
  source: string;
  price: number;
  originalPrice: number;
  currency: string;
  priceInYen: number;
  checkIn: string;
  checkOut: string;
  nights: number;
  guests: number;
  roomType?: string;
  availability: boolean;
  rating?: number;
  url: string;
  scrapedAt: number;
  canonicalHotelId?: string;
  providerName?: string;
  pricePerNight?: number;
};

export type PriceRow = ConvexPriceRow;

export async function getLatestPrices(opts?: {
  hotelId?: string;
  source?: string;
  limit?: number;
}): Promise<PriceRow[]> {
  const client = getConvexClient();
  const { api } = await import("../../convex/_generated/api.js");
  return await client.query(api.queries.getLatestPrices, {
    hotelId: opts?.hotelId,
    source: opts?.source,
    limit: opts?.limit,
  });
}

export async function addPrice(price: Omit<ConvexPriceRow, "_id" | "scrapedAt">): Promise<string> {
  const client = getConvexClient();
  const { api } = await import("../../convex/_generated/api.js");
  return await client.mutation(api.mutations.addPrice, price);
}

export async function getPriceCountBySource(): Promise<Record<string, number>> {
  const prices = await getLatestPrices({ limit: 500 });
  const counts: Record<string, number> = {};
  for (const p of prices) {
    counts[p.source] = (counts[p.source] || 0) + 1;
  }
  return counts;
}

export async function getLowestPriceByHotel(hotelId: string): Promise<PriceRow | null> {
  const prices = await getLatestPrices({ hotelId, limit: 100 });
  if (prices.length === 0) return null;
  return prices.reduce((min, p) => (p.priceInYen < min.priceInYen ? p : min));
}
