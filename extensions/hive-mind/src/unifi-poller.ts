import type { UnifiClient } from "./unifi-client.js";
import type {
  UnifiDevice,
  UnifiClientEntry,
  UnifiHealthSubsystem,
  UnifiAlert,
  UnifiEvent,
  UnifiSnapshot,
  StationView,
} from "./unifi-types.js";
import { updateCachedSnapshot } from "./unifi-api.js";
import { KNOWN_STATIONS, DEFAULT_POLL_INTERVALS } from "./unifi-types.js";

// ---------------------------------------------------------------------------
// Station matching
// ---------------------------------------------------------------------------

export function buildStationViews(clients: UnifiClientEntry[]): StationView[] {
  const clientByIp = new Map<string, UnifiClientEntry>();
  for (const c of clients) {
    if (c.ip) {
      clientByIp.set(c.ip, c);
    }
  }

  return Object.entries(KNOWN_STATIONS).map(([ip, label]) => {
    const client = clientByIp.get(ip);
    if (client) {
      return {
        ip,
        label,
        connected: true,
        mac: client.mac,
        is_wired: client.is_wired,
        uptime: client.uptime,
        rx_bytes: client.rx_bytes,
        tx_bytes: client.tx_bytes,
        last_seen: client.last_seen,
        sw_port: client.sw_port,
      };
    }
    return { ip, label, connected: false };
  });
}

// ---------------------------------------------------------------------------
// Poller
// ---------------------------------------------------------------------------

export type UnifiPollerOptions = {
  client: UnifiClient;
  intervalMs?: number;
};

export function createUnifiPoller(opts: UnifiPollerOptions) {
  const { client } = opts;
  const intervalMs = opts.intervalMs ?? DEFAULT_POLL_INTERVALS.snapshotMs;
  let intervalId: ReturnType<typeof setInterval> | undefined;

  // Last known good data for fallback on partial failures
  let lastDevices: UnifiDevice[] = [];
  let lastClients: UnifiClientEntry[] = [];
  let lastHealth: UnifiHealthSubsystem[] = [];
  let lastAlerts: UnifiAlert[] = [];
  let lastEvents: UnifiEvent[] = [];

  async function poll(): Promise<void> {
    const results = await Promise.allSettled([
      client.getDevices(),
      client.getClients(),
      client.getHealth(),
      client.getAlerts(),
      client.getEvents(),
    ]);

    const devices = results[0].status === "fulfilled" ? results[0].value : lastDevices;
    const clients = results[1].status === "fulfilled" ? results[1].value : lastClients;
    const health = results[2].status === "fulfilled" ? results[2].value : lastHealth;
    const alerts = results[3].status === "fulfilled" ? results[3].value : lastAlerts;
    const events = results[4].status === "fulfilled" ? results[4].value : lastEvents;

    // Update last known good for successful fetches
    if (results[0].status === "fulfilled") {
      lastDevices = devices;
    }
    if (results[1].status === "fulfilled") {
      lastClients = clients;
    }
    if (results[2].status === "fulfilled") {
      lastHealth = health;
    }
    if (results[3].status === "fulfilled") {
      lastAlerts = alerts;
    }
    if (results[4].status === "fulfilled") {
      lastEvents = events;
    }

    // Stale if ALL fetches failed
    const allFailed = results.every((r) => r.status === "rejected");

    const snapshot: UnifiSnapshot = {
      timestamp: new Date().toISOString(),
      stale: allFailed,
      devices,
      clients,
      stations: buildStationViews(clients),
      health,
      alerts,
      events,
    };

    updateCachedSnapshot(snapshot);
  }

  return {
    id: "unifi-poller",

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
