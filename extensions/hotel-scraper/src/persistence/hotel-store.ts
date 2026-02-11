// ---------------------------------------------------------------------------
// Hotel persistence — wraps Convex HTTP client for hotel CRUD
// ---------------------------------------------------------------------------

import { NISEKO_SEARCH_AREAS } from "../config.js";
import { getConvexClient } from "./convex-client.js";

type ConvexHotelRow = {
  _id: string;
  slug: string;
  name: string;
  nameJa: string;
  nameZh: string;
  location: string;
  niseko_area: string;
  peakRate: number;
  cnyRate: number;
  cny2Rate: number;
  midRate: number;
  lowRate: number;
  endRate: number;
  preRate: number;
  bedrooms: number;
  maxGuests: number;
  size: number;
  bookingComUrl?: string;
  hotelsDotComUrl?: string;
  expediaUrl?: string;
  tripadvisorUrl?: string;
  enabled: boolean;
  priority: number;
  aliases?: string[];
  sources?: string[];
  lastMerged?: number;
  canonicalHotelId?: string;
  coordinates?: { lat: number; lon: number };
};

export type HotelRow = ConvexHotelRow;

export async function listHotels(opts?: { enabled?: boolean; area?: string }): Promise<HotelRow[]> {
  const client = getConvexClient();
  const { api } = await import("../../convex/_generated/api.js");
  let hotels: HotelRow[] = await client.query(api.queries.getHotels, {
    enabled: opts?.enabled,
  });
  if (opts?.area) {
    hotels = hotels.filter((h) => h.niseko_area === opts.area);
  }
  return hotels;
}

export async function getHotelBySlug(slug: string): Promise<HotelRow | null> {
  const client = getConvexClient();
  const { api } = await import("../../convex/_generated/api.js");
  return await client.query(api.queries.getHotelBySlug, { slug });
}

export async function getHotelCount(): Promise<number> {
  const hotels = await listHotels({ enabled: true });
  return hotels.length;
}

export async function getAreaBreakdown(): Promise<Record<string, number>> {
  const hotels = await listHotels({ enabled: true });
  const breakdown: Record<string, number> = {};
  for (const area of NISEKO_SEARCH_AREAS) {
    breakdown[area.name] = hotels.filter((h) => h.niseko_area === area.name).length;
  }
  return breakdown;
}
