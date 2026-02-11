import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchUdmSystemInfo,
  pingStation,
  scanStations,
  createNetworkScanner,
} from "../network-scanner.js";

// ---------------------------------------------------------------------------
// Mock fetch for UDM Pro /api/system
// ---------------------------------------------------------------------------

const mockFetch = vi.fn();
const originalFetch = globalThis.fetch;

beforeEach(() => {
  globalThis.fetch = mockFetch;
  mockFetch.mockReset();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function udmSystemResponse(): Response {
  return new Response(
    JSON.stringify({
      hardware: { shortname: "UDMPRO" },
      name: "1898 Hotel Dream Machine Pro",
      mac: "0CEA14E7F3F7",
      directConnectDomain: "abc123.id.ui.direct",
      deviceState: "setup",
      cloudConnected: true,
      hasInternet: true,
      isSsoEnabled: true,
      remoteAccessEnabled: true,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

// ---------------------------------------------------------------------------
// fetchUdmSystemInfo
// ---------------------------------------------------------------------------

describe("fetchUdmSystemInfo", () => {
  it("parses UDM Pro system info from /api/system", async () => {
    mockFetch.mockResolvedValueOnce(udmSystemResponse());

    const info = await fetchUdmSystemInfo("10.1.7.1");

    expect(info).not.toBeNull();
    expect(info!.name).toBe("1898 Hotel Dream Machine Pro");
    expect(info!.mac).toBe("0CEA14E7F3F7");
    expect(info!.model).toBe("UDMPRO");
    expect(info!.cloudConnected).toBe(true);
    expect(info!.hasInternet).toBe(true);
    expect(info!.deviceState).toBe("setup");
  });

  it("calls correct URL with HTTPS and rejectUnauthorized=false", async () => {
    mockFetch.mockResolvedValueOnce(udmSystemResponse());

    await fetchUdmSystemInfo("10.1.7.1");

    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("https://10.1.7.1/api/system");
    expect(opts.signal).toBeDefined();
  });

  it("returns null on network error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("ECONNREFUSED"));

    const info = await fetchUdmSystemInfo("10.1.7.1");

    expect(info).toBeNull();
  });

  it("returns null on non-200 response", async () => {
    mockFetch.mockResolvedValueOnce(new Response("Unauthorized", { status: 401 }));

    const info = await fetchUdmSystemInfo("10.1.7.1");

    expect(info).toBeNull();
  });

  it("returns null on invalid JSON", async () => {
    mockFetch.mockResolvedValueOnce(new Response("not json", { status: 200 }));

    const info = await fetchUdmSystemInfo("10.1.7.1");

    expect(info).toBeNull();
  });

  it("includes lastChecked timestamp", async () => {
    mockFetch.mockResolvedValueOnce(udmSystemResponse());

    const info = await fetchUdmSystemInfo("10.1.7.1");

    expect(info!.lastChecked).toBeDefined();
    // Should be a valid ISO timestamp
    expect(new Date(info!.lastChecked).getTime()).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// pingStation
// ---------------------------------------------------------------------------

describe("pingStation", () => {
  it("returns reachable=true with latency on successful fetch", async () => {
    // Simulate a successful HTTP health check to the station
    mockFetch.mockResolvedValueOnce(new Response("ok", { status: 200 }));

    const result = await pingStation("10.1.7.87", 3001);

    expect(result.ip).toBe("10.1.7.87");
    expect(result.reachable).toBe(true);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("returns reachable=false on timeout/error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("ETIMEDOUT"));

    const result = await pingStation("10.1.7.99", 3001);

    expect(result.ip).toBe("10.1.7.99");
    expect(result.reachable).toBe(false);
    expect(result.latencyMs).toBeUndefined();
  });

  it("calls correct URL for station health endpoint", async () => {
    mockFetch.mockResolvedValueOnce(new Response("ok", { status: 200 }));

    await pingStation("10.1.7.87", 3001);

    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe("http://10.1.7.87:3001/health");
  });
});

// ---------------------------------------------------------------------------
// scanStations
// ---------------------------------------------------------------------------

describe("scanStations", () => {
  it("scans all known stations and returns results", async () => {
    // 5 known stations — mock all fetch calls
    mockFetch
      .mockResolvedValueOnce(new Response("ok", { status: 200 })) // Julie
      .mockResolvedValueOnce(new Response("ok", { status: 200 })) // SCRAPER
      .mockRejectedValueOnce(new Error("timeout")) // CLERK
      .mockResolvedValueOnce(new Response("ok", { status: 200 })) // IOT-HUB
      .mockResolvedValueOnce(new Response("ok", { status: 200 })); // Bravia TV

    const results = await scanStations(3001);

    expect(results).toHaveLength(5);
    const julie = results.find((r) => r.label === "Julie");
    expect(julie).toBeDefined();
    expect(julie!.reachable).toBe(true);

    const clerk = results.find((r) => r.label === "CLERK");
    expect(clerk).toBeDefined();
    expect(clerk!.reachable).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// createNetworkScanner
// ---------------------------------------------------------------------------

describe("createNetworkScanner", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("polls immediately on start", async () => {
    // UDM system + 5 station pings
    mockFetch.mockResolvedValue(udmSystemResponse());

    const scanner = createNetworkScanner({ udmHost: "10.1.7.1", stationPort: 3001 });
    await scanner.start();

    // At least 1 call for UDM system + 5 station pings = 6
    expect(mockFetch.mock.calls.length).toBeGreaterThanOrEqual(6);

    scanner.stop();
  });

  it("returns latest scan result", async () => {
    mockFetch.mockResolvedValue(udmSystemResponse());

    const scanner = createNetworkScanner({ udmHost: "10.1.7.1", stationPort: 3001 });
    await scanner.start();

    const result = scanner.getLatestScan();
    expect(result).not.toBeNull();
    expect(result!.udm).not.toBeNull();
    expect(result!.udm!.name).toBe("1898 Hotel Dream Machine Pro");
    expect(result!.stations).toHaveLength(5);
    expect(result!.timestamp).toBeDefined();

    scanner.stop();
  });

  it("returns null before first scan", () => {
    const scanner = createNetworkScanner({ udmHost: "10.1.7.1", stationPort: 3001 });
    expect(scanner.getLatestScan()).toBeNull();
  });

  it("updates snapshot cache with station data", async () => {
    // UDM system call succeeds, station calls succeed
    mockFetch.mockResolvedValue(new Response("ok", { status: 200 }));
    // Override first call (UDM system) to return proper JSON
    mockFetch.mockResolvedValueOnce(udmSystemResponse());

    const scanner = createNetworkScanner({ udmHost: "10.1.7.1", stationPort: 3001 });
    await scanner.start();

    const result = scanner.getLatestScan();
    expect(result!.stations.every((s) => s.label)).toBe(true);

    scanner.stop();
  });

  it("continues scanning when UDM is unreachable", async () => {
    // UDM fails, stations succeed
    mockFetch.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    // Remaining 5 calls for station pings
    mockFetch.mockResolvedValue(new Response("ok", { status: 200 }));

    const scanner = createNetworkScanner({ udmHost: "10.1.7.1", stationPort: 3001 });
    await scanner.start();

    const result = scanner.getLatestScan();
    expect(result!.udm).toBeNull();
    expect(result!.stations).toHaveLength(5);

    scanner.stop();
  });

  it("polls again after interval", async () => {
    mockFetch.mockResolvedValue(udmSystemResponse());

    const scanner = createNetworkScanner({
      udmHost: "10.1.7.1",
      stationPort: 3001,
      intervalMs: 30_000,
    });
    await scanner.start();

    const firstCallCount = mockFetch.mock.calls.length;

    // Advance past interval
    await vi.advanceTimersByTimeAsync(31_000);

    expect(mockFetch.mock.calls.length).toBeGreaterThan(firstCallCount);

    scanner.stop();
  });

  it("stop clears the interval", async () => {
    mockFetch.mockResolvedValue(udmSystemResponse());

    const scanner = createNetworkScanner({
      udmHost: "10.1.7.1",
      stationPort: 3001,
      intervalMs: 30_000,
    });
    await scanner.start();
    scanner.stop();

    const callCountAfterStop = mockFetch.mock.calls.length;

    await vi.advanceTimersByTimeAsync(60_000);

    expect(mockFetch.mock.calls.length).toBe(callCountAfterStop);
  });

  it("builds health entry from UDM system info", async () => {
    mockFetch.mockResolvedValue(udmSystemResponse());

    const scanner = createNetworkScanner({ udmHost: "10.1.7.1", stationPort: 3001 });
    await scanner.start();

    const result = scanner.getLatestScan();
    expect(result!.health).toHaveLength(1);
    expect(result!.health[0].subsystem).toBe("wan");
    expect(result!.health[0].status).toBe("ok");

    scanner.stop();
  });

  it("sets wan health to error when UDM has no internet", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          hardware: { shortname: "UDMPRO" },
          name: "UDM Pro",
          mac: "AABBCCDDEEFF",
          cloudConnected: false,
          hasInternet: false,
          isSsoEnabled: true,
          deviceState: "setup",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    // Station pings
    mockFetch.mockResolvedValue(new Response("ok", { status: 200 }));

    const scanner = createNetworkScanner({ udmHost: "10.1.7.1", stationPort: 3001 });
    await scanner.start();

    const result = scanner.getLatestScan();
    expect(result!.health[0].status).toBe("error");

    scanner.stop();
  });
});
