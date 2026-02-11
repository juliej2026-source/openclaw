import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { UnifiClient } from "../unifi-client.js";
import type { UnifiClientEntry } from "../unifi-types.js";
import { createUnifiPoller, buildStationViews } from "../unifi-poller.js";

// Mock the unifi-api cache so we can verify updates
vi.mock("../unifi-api.js", () => ({
  updateCachedSnapshot: vi.fn(),
}));

import { updateCachedSnapshot } from "../unifi-api.js";

const mockUpdateCache = vi.mocked(updateCachedSnapshot);

beforeEach(() => {
  vi.useFakeTimers();
  mockUpdateCache.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// Mock client factory
// ---------------------------------------------------------------------------

function mockClient(overrides: Partial<UnifiClient> = {}): UnifiClient {
  return {
    login: vi.fn().mockResolvedValue(undefined),
    getDevices: vi.fn().mockResolvedValue([
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
    ]),
    getClients: vi.fn().mockResolvedValue([
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
      {
        _id: "c2",
        mac: "77:88:99:aa:bb:cc",
        ip: "10.1.7.87",
        hostname: "julie",
        is_wired: true,
        rx_bytes: 500,
        tx_bytes: 600,
        uptime: 7200,
      },
    ]),
    getHealth: vi.fn().mockResolvedValue([
      { subsystem: "wan", status: "ok" },
      { subsystem: "lan", status: "ok" },
      { subsystem: "wlan", status: "ok" },
    ]),
    getAlerts: vi.fn().mockResolvedValue([]),
    getEvents: vi.fn().mockResolvedValue([]),
    isAvailable: vi.fn().mockResolvedValue(true),
    ...overrides,
  } as unknown as UnifiClient;
}

// ---------------------------------------------------------------------------
// buildStationViews tests
// ---------------------------------------------------------------------------

describe("buildStationViews", () => {
  it("marks known stations as connected when found in clients", () => {
    const clients: UnifiClientEntry[] = [
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
    ];

    const views = buildStationViews(clients);
    const scraper = views.find((s) => s.ip === "10.1.7.180");

    expect(scraper).toBeDefined();
    expect(scraper!.connected).toBe(true);
    expect(scraper!.label).toBe("SCRAPER");
    expect(scraper!.mac).toBe("11:22:33:44:55:66");
  });

  it("marks known stations as disconnected when not in clients", () => {
    const views = buildStationViews([]);
    const julia = views.find((s) => s.ip === "10.1.7.87");

    expect(julia).toBeDefined();
    expect(julia!.connected).toBe(false);
    expect(julia!.label).toBe("Julie");
    expect(julia!.mac).toBeUndefined();
  });

  it("returns all known stations", () => {
    const views = buildStationViews([]);
    // KNOWN_STATIONS has 5 entries
    expect(views).toHaveLength(5);
  });

  it("includes client data for connected stations", () => {
    const clients: UnifiClientEntry[] = [
      {
        _id: "c1",
        mac: "aa:bb",
        ip: "10.1.7.158",
        hostname: "iot-hub",
        is_wired: true,
        rx_bytes: 5000,
        tx_bytes: 6000,
        uptime: 9000,
        sw_port: 3,
      },
    ];

    const views = buildStationViews(clients);
    const iotHub = views.find((s) => s.ip === "10.1.7.158");

    expect(iotHub!.is_wired).toBe(true);
    expect(iotHub!.rx_bytes).toBe(5000);
    expect(iotHub!.tx_bytes).toBe(6000);
    expect(iotHub!.uptime).toBe(9000);
    expect(iotHub!.sw_port).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// createUnifiPoller tests
// ---------------------------------------------------------------------------

describe("createUnifiPoller", () => {
  it("returns a poller with correct id", () => {
    const poller = createUnifiPoller({ client: mockClient() });
    expect(poller.id).toBe("unifi-poller");
  });

  it("polls immediately on start", async () => {
    const client = mockClient();
    const poller = createUnifiPoller({ client });

    await poller.start();

    expect(client.getDevices).toHaveBeenCalledOnce();
    expect(client.getClients).toHaveBeenCalledOnce();
    expect(client.getHealth).toHaveBeenCalledOnce();
    expect(client.getAlerts).toHaveBeenCalledOnce();
    expect(client.getEvents).toHaveBeenCalledOnce();

    poller.stop();
  });

  it("updates cache after successful poll", async () => {
    const client = mockClient();
    const poller = createUnifiPoller({ client });

    await poller.start();

    expect(mockUpdateCache).toHaveBeenCalledOnce();
    const snap = mockUpdateCache.mock.calls[0][0];
    expect(snap.devices).toHaveLength(1);
    expect(snap.clients).toHaveLength(2);
    expect(snap.health).toHaveLength(3);
    expect(snap.stale).toBe(false);

    poller.stop();
  });

  it("builds station views in snapshot", async () => {
    const client = mockClient();
    const poller = createUnifiPoller({ client });

    await poller.start();

    const snap = mockUpdateCache.mock.calls[0][0];
    expect(snap.stations).toHaveLength(5);
    // SCRAPER and JULIA connected (in mock clients), others disconnected
    const scraper = snap.stations.find((s: { ip: string }) => s.ip === "10.1.7.180");
    expect(scraper.connected).toBe(true);

    poller.stop();
  });

  it("polls again after interval", async () => {
    const client = mockClient();
    const poller = createUnifiPoller({ client, intervalMs: 30_000 });

    await poller.start();
    expect(client.getDevices).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(30_000);
    expect(client.getDevices).toHaveBeenCalledTimes(2);

    poller.stop();
  });

  it("stops interval on stop()", async () => {
    const client = mockClient();
    const poller = createUnifiPoller({ client, intervalMs: 30_000 });

    await poller.start();
    poller.stop();

    await vi.advanceTimersByTimeAsync(30_000);
    expect(client.getDevices).toHaveBeenCalledTimes(1);
  });

  it("marks snapshot stale on total failure", async () => {
    const client = mockClient({
      getDevices: vi.fn().mockRejectedValue(new Error("ECONNREFUSED")),
      getClients: vi.fn().mockRejectedValue(new Error("ECONNREFUSED")),
      getHealth: vi.fn().mockRejectedValue(new Error("ECONNREFUSED")),
      getAlerts: vi.fn().mockRejectedValue(new Error("ECONNREFUSED")),
      getEvents: vi.fn().mockRejectedValue(new Error("ECONNREFUSED")),
    } as unknown as Partial<UnifiClient>);

    const poller = createUnifiPoller({ client });
    await poller.start();

    expect(mockUpdateCache).toHaveBeenCalledOnce();
    const snap = mockUpdateCache.mock.calls[0][0];
    expect(snap.stale).toBe(true);

    poller.stop();
  });

  it("falls back to last known data on partial failure", async () => {
    const client = mockClient({
      getAlerts: vi.fn().mockRejectedValue(new Error("timeout")),
    } as unknown as Partial<UnifiClient>);

    const poller = createUnifiPoller({ client });
    await poller.start();

    expect(mockUpdateCache).toHaveBeenCalledOnce();
    const snap = mockUpdateCache.mock.calls[0][0];
    // Devices, clients, health should still be present
    expect(snap.devices).toHaveLength(1);
    expect(snap.clients).toHaveLength(2);
    expect(snap.health).toHaveLength(3);
    // Alerts failed — falls back to empty
    expect(snap.alerts).toHaveLength(0);
    expect(snap.stale).toBe(false);

    poller.stop();
  });

  it("uses custom interval when specified", async () => {
    const client = mockClient();
    const poller = createUnifiPoller({ client, intervalMs: 10_000 });

    await poller.start();
    expect(client.getDevices).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(10_000);
    expect(client.getDevices).toHaveBeenCalledTimes(2);

    // Should not poll at 30s (default)
    poller.stop();
  });
});
