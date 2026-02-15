import { ConvexHttpClient } from "convex/browser";
import { CONVEX_URL } from "../types.js";

// ---------------------------------------------------------------------------
// Convex Client — singleton HTTP client for wellness-concierge persistence
// ---------------------------------------------------------------------------

let client: ConvexHttpClient | null = null;

/**
 * Get or create the Convex HTTP client singleton.
 */
export function getConvexClient(): ConvexHttpClient {
  if (!client) {
    client = new ConvexHttpClient(CONVEX_URL);
  }
  return client;
}

/**
 * Reset the client (for testing).
 */
export function resetConvexClient(): void {
  client = null;
}
