// ---------------------------------------------------------------------------
// Convex Client — singleton for data-mine persistence
// ---------------------------------------------------------------------------

import { ConvexHttpClient } from "convex/browser";

let client: ConvexHttpClient | null = null;

const CONVEX_URL = process.env.CONVEX_URL ?? process.env.NEXT_PUBLIC_CONVEX_URL ?? "";

export function getConvexClient(): ConvexHttpClient | null {
  if (!CONVEX_URL) return null;
  if (!client) {
    client = new ConvexHttpClient(CONVEX_URL);
  }
  return client;
}

export function isConvexAvailable(): boolean {
  return !!CONVEX_URL;
}
