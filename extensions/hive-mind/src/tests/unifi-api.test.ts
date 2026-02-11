import { EventEmitter } from "node:events";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { UnifiSnapshot } from "../unifi-types.js";
import {
  handleUnifiSnapshot,
  handleUnifiDevices,
  handleUnifiClients,
  handleUnifiHealth,
  handleUnifiStations,
  handleUnifiAlerts,
  updateCachedSnapshot,
  getCachedSnapshot,
  clearCachedSnapshot,
} from "../unifi-api.js";

// ---------------------------------------------------------------------------
// Mock req / res helpers (same pattern as network-api.test.ts)
// ---------------------------------------------------------------------------

type MockReq = EventEmitter & {
  method: string;
  url: string;
  headers: Record<string, string>;
};

type MockRes = {
  writeHead: ReturnType<typeof vi.fn>;
  end: ReturnType<typeof vi.fn>;
  statusCode: number;
  body: string;
};

function createReq(method: string, url: string, headers: Record<string, string> = {}): MockReq {
  const req = new EventEmitter() as MockReq;
  req.method = method;
  req.url = url;
  req.headers = { "content-type": "application/json", ...headers };
  return req;
}

function createRes(): MockRes {
  const res: MockRes = {
    statusCode: 200,
    body: "",
    writeHead: vi.fn((code: number) => {
      res.statusCode = code;
    }),
    end: vi.fn((data?: string) => {
      res.body = data ?? "";
    }),
  };
  return res;
}

function parseResBody(res: MockRes): unknown {
  return JSON.parse(res.body);
}

// ---------------------------------------------------------------------------
// Test snapshot data
// ---------------------------------------------------------------------------

const VALID_API_KEY = "openclaw-network-2026-kelvin";

function testSnapshot(): UnifiSnapshot {
  return {
    timestamp: "2026-02-07T00:00:00.000Z",
    stale: false,
    devices: [
      {
        _id: "d1",
        mac: "aa:bb:cc:dd:ee:ff",
        ip: "10.1.7.2",
        name: "USW-Flex",
        model: "USW-Flex-2.5G-8-PoE",
        type: "usw",
        version: "7.1.68",
        uptime: 86400,
        state: 1,
        adopted: true,
      },
    ],
    clients: [
      {
        _id: "c1",
        mac: "11:22:33:44:55:66",
        ip: "10.1.7.180",
        hostname: "scraper",
        is_wired: true,
        rx_bytes: 1000,
        tx_bytes: 2000,
        uptime: 3600,
      },
    ],
    stations: [
      { ip: "10.1.7.180", label: "SCRAPER", connected: true, mac: "11:22:33:44:55:66" },
      { ip: "10.1.7.87", label: "Julie", connected: false },
    ],
    health: [
      { subsystem: "wan", status: "ok" },
      { subsystem: "lan", status: "ok" },
    ],
    alerts: [{ _id: "a1", key: "EVT_SW", msg: "Port down", time: 1000, archived: false }],
    events: [{ _id: "e1", key: "EVT_AP", msg: "AP connected", time: 1001 }],
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  clearCachedSnapshot();
});

describe("cache functions", () => {
  it("getCachedSnapshot returns null when empty", () => {
    expect(getCachedSnapshot()).toBeNull();
  });

  it("updateCachedSnapshot / getCachedSnapshot roundtrip", () => {
    const snap = testSnapshot();
    updateCachedSnapshot(snap);
    expect(getCachedSnapshot()).toEqual(snap);
  });

  it("clearCachedSnapshot resets to null", () => {
    updateCachedSnapshot(testSnapshot());
    clearCachedSnapshot();
    expect(getCachedSnapshot()).toBeNull();
  });
});

describe("API key guard", () => {
  it("returns 401 when X-API-Key header is missing", async () => {
    updateCachedSnapshot(testSnapshot());
    const req = createReq("GET", "/api/unifi/snapshot");
    const res = createRes();

    await handleUnifiSnapshot(req as never, res as never);

    expect(res.statusCode).toBe(401);
    const body = parseResBody(res) as Record<string, unknown>;
    expect(body.error).toMatch(/API key/i);
  });

  it("returns 401 when X-API-Key header is wrong", async () => {
    updateCachedSnapshot(testSnapshot());
    const req = createReq("GET", "/api/unifi/snapshot", { "x-api-key": "wrong-key" });
    const res = createRes();

    await handleUnifiSnapshot(req as never, res as never);

    expect(res.statusCode).toBe(401);
  });

  it("allows request with valid API key", async () => {
    updateCachedSnapshot(testSnapshot());
    const req = createReq("GET", "/api/unifi/snapshot", { "x-api-key": VALID_API_KEY });
    const res = createRes();

    await handleUnifiSnapshot(req as never, res as never);

    expect(res.statusCode).toBe(200);
  });
});

describe("handleUnifiSnapshot", () => {
  it("returns full snapshot when cached", async () => {
    const snap = testSnapshot();
    updateCachedSnapshot(snap);
    const req = createReq("GET", "/api/unifi/snapshot", { "x-api-key": VALID_API_KEY });
    const res = createRes();

    await handleUnifiSnapshot(req as never, res as never);

    expect(res.statusCode).toBe(200);
    const body = parseResBody(res) as UnifiSnapshot;
    expect(body.timestamp).toBe(snap.timestamp);
    expect(body.devices).toHaveLength(1);
    expect(body.clients).toHaveLength(1);
    expect(body.stations).toHaveLength(2);
  });

  it("returns 503 when no snapshot cached", async () => {
    const req = createReq("GET", "/api/unifi/snapshot", { "x-api-key": VALID_API_KEY });
    const res = createRes();

    await handleUnifiSnapshot(req as never, res as never);

    expect(res.statusCode).toBe(503);
    const body = parseResBody(res) as Record<string, unknown>;
    expect(body.error).toMatch(/not available/i);
  });

  it("returns 405 for non-GET requests", async () => {
    const req = createReq("POST", "/api/unifi/snapshot", { "x-api-key": VALID_API_KEY });
    const res = createRes();

    await handleUnifiSnapshot(req as never, res as never);

    expect(res.statusCode).toBe(405);
  });
});

describe("handleUnifiDevices", () => {
  it("returns devices array from cached snapshot", async () => {
    updateCachedSnapshot(testSnapshot());
    const req = createReq("GET", "/api/unifi/devices", { "x-api-key": VALID_API_KEY });
    const res = createRes();

    await handleUnifiDevices(req as never, res as never);

    expect(res.statusCode).toBe(200);
    const body = parseResBody(res) as Record<string, unknown>;
    expect(body).toHaveProperty("devices");
    expect((body.devices as unknown[]).length).toBe(1);
  });

  it("returns 503 when no snapshot cached", async () => {
    const req = createReq("GET", "/api/unifi/devices", { "x-api-key": VALID_API_KEY });
    const res = createRes();

    await handleUnifiDevices(req as never, res as never);

    expect(res.statusCode).toBe(503);
  });
});

describe("handleUnifiClients", () => {
  it("returns clients array from cached snapshot", async () => {
    updateCachedSnapshot(testSnapshot());
    const req = createReq("GET", "/api/unifi/clients", { "x-api-key": VALID_API_KEY });
    const res = createRes();

    await handleUnifiClients(req as never, res as never);

    expect(res.statusCode).toBe(200);
    const body = parseResBody(res) as Record<string, unknown>;
    expect(body).toHaveProperty("clients");
    expect((body.clients as unknown[]).length).toBe(1);
  });

  it("returns 503 when no snapshot cached", async () => {
    const req = createReq("GET", "/api/unifi/clients", { "x-api-key": VALID_API_KEY });
    const res = createRes();

    await handleUnifiClients(req as never, res as never);

    expect(res.statusCode).toBe(503);
  });
});

describe("handleUnifiHealth", () => {
  it("returns health array from cached snapshot", async () => {
    updateCachedSnapshot(testSnapshot());
    const req = createReq("GET", "/api/unifi/health", { "x-api-key": VALID_API_KEY });
    const res = createRes();

    await handleUnifiHealth(req as never, res as never);

    expect(res.statusCode).toBe(200);
    const body = parseResBody(res) as Record<string, unknown>;
    expect(body).toHaveProperty("health");
    expect((body.health as unknown[]).length).toBe(2);
  });

  it("returns 503 when no snapshot cached", async () => {
    const req = createReq("GET", "/api/unifi/health", { "x-api-key": VALID_API_KEY });
    const res = createRes();

    await handleUnifiHealth(req as never, res as never);

    expect(res.statusCode).toBe(503);
  });
});

describe("handleUnifiStations", () => {
  it("returns stations array from cached snapshot", async () => {
    updateCachedSnapshot(testSnapshot());
    const req = createReq("GET", "/api/unifi/stations", { "x-api-key": VALID_API_KEY });
    const res = createRes();

    await handleUnifiStations(req as never, res as never);

    expect(res.statusCode).toBe(200);
    const body = parseResBody(res) as Record<string, unknown>;
    expect(body).toHaveProperty("stations");
    expect((body.stations as unknown[]).length).toBe(2);
  });

  it("returns 503 when no snapshot cached", async () => {
    const req = createReq("GET", "/api/unifi/stations", { "x-api-key": VALID_API_KEY });
    const res = createRes();

    await handleUnifiStations(req as never, res as never);

    expect(res.statusCode).toBe(503);
  });
});

describe("handleUnifiAlerts", () => {
  it("returns alerts array from cached snapshot", async () => {
    updateCachedSnapshot(testSnapshot());
    const req = createReq("GET", "/api/unifi/alerts", { "x-api-key": VALID_API_KEY });
    const res = createRes();

    await handleUnifiAlerts(req as never, res as never);

    expect(res.statusCode).toBe(200);
    const body = parseResBody(res) as Record<string, unknown>;
    expect(body).toHaveProperty("alerts");
    expect((body.alerts as unknown[]).length).toBe(1);
  });

  it("returns 503 when no snapshot cached", async () => {
    const req = createReq("GET", "/api/unifi/alerts", { "x-api-key": VALID_API_KEY });
    const res = createRes();

    await handleUnifiAlerts(req as never, res as never);

    expect(res.statusCode).toBe(503);
  });
});
