import type { UnifiSnapshot } from "./unifi-types.js";
import { updateCachedSnapshot } from "./unifi-api.js";
import { UnifiCloudClient, type CloudHost } from "./unifi-cloud-client.js";
import { DEFAULT_POLL_INTERVALS } from "./unifi-types.js";

// ---------------------------------------------------------------------------
// Cloud-based UniFi poller — fallback when local UDM credentials are absent
// Uses the Site Manager API (api.ui.com) with API key auth
// ---------------------------------------------------------------------------

export type CloudPollerOptions = {
  client: UnifiCloudClient;
  intervalMs?: number;
};

export function createUnifiCloudPoller(opts: CloudPollerOptions) {
  const { client } = opts;
  const intervalMs = opts.intervalMs ?? DEFAULT_POLL_INTERVALS.snapshotMs;
  let intervalId: ReturnType<typeof setInterval> | undefined;

  let lastHost: CloudHost | null = null;

  async function poll(): Promise<void> {
    const [hosts, cloudDevices, sites] = await Promise.all([
      client.getHosts().catch(() => [] as CloudHost[]),
      client.getDevices().catch(() => []),
      client.getSites().catch(() => []),
    ]);

    // Use the first host (typically the UDM Pro)
    const host = hosts[0] ?? lastHost;
    if (host) lastHost = host;

    // Convert cloud devices to local format
    const devices = client.mapToLocalDevices(cloudDevices);

    // Build health from host data
    const health = host ? client.mapToLocalHealth(host) : [];

    // Cloud API doesn't expose clients or alerts directly
    const snapshot: UnifiSnapshot = {
      timestamp: new Date().toISOString(),
      stale: hosts.length === 0 && cloudDevices.length === 0,
      devices,
      clients: [],
      stations: [],
      health,
      alerts: [],
      events: [],
    };

    updateCachedSnapshot(snapshot);
  }

  return {
    id: "unifi-cloud-poller",

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
  };
}
