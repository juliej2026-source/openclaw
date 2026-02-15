import type { BraviaClient, BraviaStatus } from "./bravia-client.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BraviaPollerOptions = {
  client: BraviaClient;
  intervalMs?: number;
};

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

const DEFAULT_INTERVAL_MS = 30_000;

export function createBraviaPoller(opts: BraviaPollerOptions) {
  const { client } = opts;
  const intervalMs = opts.intervalMs ?? DEFAULT_INTERVAL_MS;
  let intervalId: ReturnType<typeof setInterval> | undefined;
  let latestStatus: BraviaStatus | null = null;

  async function poll(): Promise<void> {
    try {
      latestStatus = await client.getStatus();
    } catch {
      // Keep last good status on error
    }
  }

  return {
    id: "bravia-poller" as const,

    async start(): Promise<void> {
      await poll();
      intervalId = setInterval(() => {
        poll().catch(() => {});
      }, intervalMs);
    },

    stop(): void {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = undefined;
      }
    },

    getLatestStatus(): BraviaStatus | null {
      return latestStatus;
    },
  };
}
