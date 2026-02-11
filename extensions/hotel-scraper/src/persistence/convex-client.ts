import { ConvexHttpClient } from "convex/browser";
import { CONVEX_URL } from "../types.js";

// ---------------------------------------------------------------------------
// Convex HTTP client wrapper — singleton for hotel-scraper extension
// Follows the same pattern as @openclaw/neural-graph
// ---------------------------------------------------------------------------

let client: ConvexHttpClient | null = null;

export function getConvexClient(): ConvexHttpClient {
  if (!client) {
    client = new ConvexHttpClient(CONVEX_URL);
  }
  return client;
}

export async function isConvexHealthy(): Promise<boolean> {
  try {
    const resp = await fetch(`${CONVEX_URL}/version`, {
      signal: AbortSignal.timeout(3000),
    });
    return resp.ok;
  } catch {
    return false;
  }
}

export function resetClient(): void {
  client = null;
}
