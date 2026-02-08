import type { IncomingMessage, ServerResponse } from "node:http";
import type { UnifiSnapshot } from "./unifi-types.js";
import { STATION_ID } from "./types.js";
import { UNIFI_API_KEY } from "./unifi-types.js";

// ---------------------------------------------------------------------------
// Snapshot cache
// ---------------------------------------------------------------------------

let cachedSnapshot: UnifiSnapshot | null = null;

export function updateCachedSnapshot(snapshot: UnifiSnapshot): void {
  cachedSnapshot = snapshot;
}

export function getCachedSnapshot(): UnifiSnapshot | null {
  return cachedSnapshot;
}

export function clearCachedSnapshot(): void {
  cachedSnapshot = null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const JSON_HEADERS: Record<string, string> = {
  "Content-Type": "application/json",
  "X-Station-ID": STATION_ID,
};

function jsonResponse(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, JSON_HEADERS);
  res.end(JSON.stringify(body));
}

function methodNotAllowed(res: ServerResponse): void {
  res.writeHead(405, { ...JSON_HEADERS, Allow: "GET" });
  res.end(JSON.stringify({ error: "Method not allowed. Use GET." }));
}

function requireApiKey(req: IncomingMessage, res: ServerResponse): boolean {
  const key = req.headers["x-api-key"];
  if (key !== UNIFI_API_KEY) {
    res.writeHead(401, JSON_HEADERS);
    res.end(JSON.stringify({ error: "Invalid or missing API key" }));
    return false;
  }
  return true;
}

function noData(res: ServerResponse): void {
  jsonResponse(res, 503, { error: "Snapshot data not available yet" });
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

export async function handleUnifiSnapshot(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  if (req.method !== "GET") {
    methodNotAllowed(res);
    return;
  }
  if (!requireApiKey(req, res)) {
    return;
  }

  const snap = getCachedSnapshot();
  if (!snap) {
    noData(res);
    return;
  }
  jsonResponse(res, 200, snap);
}

export async function handleUnifiDevices(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== "GET") {
    methodNotAllowed(res);
    return;
  }
  if (!requireApiKey(req, res)) {
    return;
  }

  const snap = getCachedSnapshot();
  if (!snap) {
    noData(res);
    return;
  }
  jsonResponse(res, 200, { devices: snap.devices, timestamp: snap.timestamp, stale: snap.stale });
}

export async function handleUnifiClients(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== "GET") {
    methodNotAllowed(res);
    return;
  }
  if (!requireApiKey(req, res)) {
    return;
  }

  const snap = getCachedSnapshot();
  if (!snap) {
    noData(res);
    return;
  }
  jsonResponse(res, 200, { clients: snap.clients, timestamp: snap.timestamp, stale: snap.stale });
}

export async function handleUnifiHealth(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== "GET") {
    methodNotAllowed(res);
    return;
  }
  if (!requireApiKey(req, res)) {
    return;
  }

  const snap = getCachedSnapshot();
  if (!snap) {
    noData(res);
    return;
  }
  jsonResponse(res, 200, { health: snap.health, timestamp: snap.timestamp, stale: snap.stale });
}

export async function handleUnifiStations(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  if (req.method !== "GET") {
    methodNotAllowed(res);
    return;
  }
  if (!requireApiKey(req, res)) {
    return;
  }

  const snap = getCachedSnapshot();
  if (!snap) {
    noData(res);
    return;
  }
  jsonResponse(res, 200, {
    stations: snap.stations,
    timestamp: snap.timestamp,
    stale: snap.stale,
  });
}

export async function handleUnifiAlerts(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== "GET") {
    methodNotAllowed(res);
    return;
  }
  if (!requireApiKey(req, res)) {
    return;
  }

  const snap = getCachedSnapshot();
  if (!snap) {
    noData(res);
    return;
  }
  jsonResponse(res, 200, { alerts: snap.alerts, timestamp: snap.timestamp, stale: snap.stale });
}
