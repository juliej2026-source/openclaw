import type { IncomingMessage, ServerResponse } from "node:http";
import { STATION_ID } from "./types.js";

// ---------------------------------------------------------------------------
// Helpers (mirrors network-api.ts patterns)
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

// ---------------------------------------------------------------------------
// Scoreboard character mapping
// ---------------------------------------------------------------------------

const SCOREBOARD_LABELS: Record<string, string> = {
  _: "waiting",
  S: "starting",
  R: "reading",
  W: "writing",
  K: "keepalive",
  D: "dns",
  C: "closing",
  L: "logging",
  G: "graceful",
  I: "idle_cleanup",
  ".": "open",
};

/** Parse scoreboard string into worker state counts. */
function parseScoreboard(scoreboard: string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const ch of scoreboard) {
    const label = SCOREBOARD_LABELS[ch] ?? "unknown";
    counts[label] = (counts[label] ?? 0) + 1;
  }
  return counts;
}

// ---------------------------------------------------------------------------
// Apache server-status?auto parser
// ---------------------------------------------------------------------------

export interface ApacheStatus {
  uptime: number;
  totalAccesses: number;
  totalKBytes: number;
  reqPerSec: number;
  bytesPerSec: number;
  bytesPerReq: number;
  busyWorkers: number;
  idleWorkers: number;
  scoreboard: string;
  workers: Record<string, number>;
  serverVersion: string | null;
  serverMPM: string | null;
}

/** Fetch and parse Apache mod_status auto output from localhost. */
export async function fetchApacheStatus(): Promise<ApacheStatus> {
  const resp = await fetch("http://127.0.0.1/server-status?auto");
  if (!resp.ok) {
    throw new Error(`Apache server-status returned ${resp.status}`);
  }

  const text = await resp.text();
  const kv: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim();
    const val = line.slice(idx + 1).trim();
    if (key && val !== undefined) kv[key] = val;
  }

  const scoreboard = kv["Scoreboard"] ?? "";

  return {
    uptime: parseInt(kv["Uptime"] ?? "0", 10),
    totalAccesses: parseInt(kv["Total Accesses"] ?? "0", 10),
    totalKBytes: parseInt(kv["Total kBytes"] ?? "0", 10),
    reqPerSec: parseFloat(kv["ReqPerSec"] ?? "0"),
    bytesPerSec: parseFloat(kv["BytesPerSec"] ?? "0"),
    bytesPerReq: parseFloat(kv["BytesPerReq"] ?? "0"),
    busyWorkers: parseInt(kv["BusyWorkers"] ?? "0", 10),
    idleWorkers: parseInt(kv["IdleWorkers"] ?? "0", 10),
    scoreboard,
    workers: parseScoreboard(scoreboard),
    serverVersion: kv["ServerVersion"] ?? null,
    serverMPM: kv["ServerMPM"] ?? null,
  };
}

// ---------------------------------------------------------------------------
// HTTP handler
// ---------------------------------------------------------------------------

export async function handleApacheStatus(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== "GET") {
    methodNotAllowed(res, "GET");
    return;
  }

  try {
    const status = await fetchApacheStatus();
    jsonResponse(res, 200, status);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    jsonResponse(res, 503, { error: "Apache status unavailable", detail: message });
  }
}
