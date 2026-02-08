import type { IncomingMessage, ServerResponse } from "node:http";
import os from "node:os";
import type { DualNetworkState } from "./dual-network.js";
import type { NetworkScanResult } from "./network-scanner.js";
import type { NetworkCommand } from "./types.js";
import { dispatchCommand } from "./command-dispatch.js";
import { generateMetrics } from "./metrics-exporter.js";
import { generateMonitorHtml } from "./monitor-page.js";
import { buildStationIdentity } from "./station-identity.js";
import { STATION_ID } from "./types.js";
import { UNIFI_API_KEY } from "./unifi-types.js";

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

function methodNotAllowed(res: ServerResponse, allowed: string): void {
  res.writeHead(405, { ...JSON_HEADERS, Allow: allowed });
  res.end(JSON.stringify({ error: `Method not allowed. Use ${allowed}.` }));
}

const MAX_BODY = 1_048_576; // 1 MB

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer | string) => {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += buf.length;
      if (size > MAX_BODY) {
        req.destroy();
        reject(new Error("Body too large"));
        return;
      }
      chunks.push(buf);
    });
    req.on("end", () => {
      resolve(Buffer.concat(chunks).toString("utf-8"));
    });
    req.on("error", reject);
  });
}

/** Require X-API-Key header for authenticated endpoints. */
function requireApiKey(req: IncomingMessage, res: ServerResponse): boolean {
  const key = req.headers["x-api-key"];
  if (key !== UNIFI_API_KEY) {
    res.writeHead(401, JSON_HEADERS);
    res.end(JSON.stringify({ error: "Invalid or missing API key" }));
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

export async function handlePing(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== "GET") {
    methodNotAllowed(res, "GET");
    return;
  }

  jsonResponse(res, 200, {
    station_id: STATION_ID,
    status: "online",
    uptime_seconds: Math.floor(os.uptime()),
  });
}

export async function handleIdentity(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== "GET") {
    methodNotAllowed(res, "GET");
    return;
  }

  const identity = buildStationIdentity();
  jsonResponse(res, 200, identity);
}

export async function handleCommand(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== "POST") {
    methodNotAllowed(res, "POST");
    return;
  }

  if (!requireApiKey(req, res)) return;

  let body: string;
  try {
    body = await readBody(req);
  } catch {
    jsonResponse(res, 400, { error: "Failed to read request body" });
    return;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    jsonResponse(res, 400, { error: "Invalid JSON body" });
    return;
  }

  const cmd = parsed as Record<string, unknown>;
  if (!cmd.command || typeof cmd.command !== "string") {
    jsonResponse(res, 400, { error: "Missing required field: command" });
    return;
  }

  const networkCmd: NetworkCommand = {
    command: cmd.command,
    params: (cmd.params as Record<string, unknown>) ?? {},
    request_id: cmd.request_id ? String(cmd.request_id) : undefined,
  };

  const result = await dispatchCommand(networkCmd);
  // Ensure request_id is always preserved from the original request
  if (networkCmd.request_id && !result.request_id) {
    result.request_id = networkCmd.request_id;
  }
  jsonResponse(res, 200, result);
}

// ---------------------------------------------------------------------------
// Dashboard handler (UC-5: combined status view)
// ---------------------------------------------------------------------------

export async function handleDashboard(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== "GET") {
    methodNotAllowed(res, "GET");
    return;
  }

  const result = await dispatchCommand({ command: "meta:dashboard" });
  jsonResponse(res, result.success ? 200 : 500, result);
}

// ---------------------------------------------------------------------------
// Network scan handler (scanner getter injected via setter)
// ---------------------------------------------------------------------------

let scannerGetter: (() => NetworkScanResult | null) | null = null;

export function setNetworkScanGetter(getter: () => NetworkScanResult | null): void {
  scannerGetter = getter;
}

export async function handleNetworkScan(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== "GET") {
    methodNotAllowed(res, "GET");
    return;
  }

  const scan = scannerGetter ? scannerGetter() : null;
  if (!scan) {
    jsonResponse(res, 503, { error: "Network scan data not available yet" });
    return;
  }
  jsonResponse(res, 200, scan);
}

// ---------------------------------------------------------------------------
// Dual-network path handler
// ---------------------------------------------------------------------------

let dualNetworkGetter: (() => DualNetworkState | null) | null = null;

export function setDualNetworkGetter(getter: () => DualNetworkState | null): void {
  dualNetworkGetter = getter;
}

export async function handleNetworkPath(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== "GET") {
    methodNotAllowed(res, "GET");
    return;
  }

  const state = dualNetworkGetter ? dualNetworkGetter() : null;
  if (!state) {
    jsonResponse(res, 503, { error: "Dual network data not available" });
    return;
  }
  jsonResponse(res, 200, state);
}

// ---------------------------------------------------------------------------
// Prometheus metrics endpoint
// ---------------------------------------------------------------------------

export async function handleMetrics(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== "GET") {
    methodNotAllowed(res, "GET");
    return;
  }

  const body = generateMetrics();
  res.writeHead(200, {
    "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
    "X-Station-ID": STATION_ID,
  });
  res.end(body);
}

// ---------------------------------------------------------------------------
// Live HTML monitoring dashboard
// ---------------------------------------------------------------------------

export async function handleMonitor(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== "GET") {
    methodNotAllowed(res, "GET");
    return;
  }

  const html = generateMonitorHtml();
  res.writeHead(200, {
    "Content-Type": "text/html; charset=utf-8",
    "X-Station-ID": STATION_ID,
    "Cache-Control": "no-cache",
  });
  res.end(html);
}
