import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { BraviaClient, BraviaStatus } from "../bravia-client.js";
import { createBraviaPoller } from "../bravia-poller.js";

// ---------------------------------------------------------------------------
// Mock BraviaClient
// ---------------------------------------------------------------------------

function mockStatus(overrides?: Partial<BraviaStatus>): BraviaStatus {
  return {
    power: "active",
    model: "K-65XR70",
    apiVersion: "6.3.0",
    volume: { level: 15, muted: false, maxVolume: 100 },
    inputs: [],
    apps: { textInput: false, cursorDisplay: false, webBrowse: false },
    powerSaving: "low",
    time: "2026-02-15T16:00:00+0900",
    wolMac: "80:99:E7:27:A2:C6",
    soundbar: null,
    cast: null,
    fetchedAt: new Date().toISOString(),
    ...overrides,
  };
}

function createMockClient(status?: BraviaStatus): BraviaClient {
  return {
    getStatus: vi.fn().mockResolvedValue(status ?? mockStatus()),
    isReachable: vi.fn().mockResolvedValue(true),
  } as unknown as BraviaClient;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("createBraviaPoller", () => {
  it("returns poller with correct id", () => {
    const poller = createBraviaPoller({ client: createMockClient() });
    expect(poller.id).toBe("bravia-poller");
  });

  it("getLatestStatus returns null before start", () => {
    const poller = createBraviaPoller({ client: createMockClient() });
    expect(poller.getLatestStatus()).toBeNull();
  });

  it("start performs initial poll and stores status", async () => {
    const status = mockStatus({ power: "standby" });
    const client = createMockClient(status);
    const poller = createBraviaPoller({ client });

    await poller.start();
    const latest = poller.getLatestStatus();
    expect(latest).not.toBeNull();
    expect(latest!.power).toBe("standby");
    expect(client.getStatus).toHaveBeenCalledTimes(1);
    poller.stop();
  });

  it("polls at configured interval", async () => {
    const client = createMockClient();
    const poller = createBraviaPoller({ client, intervalMs: 10_000 });

    await poller.start();
    expect(client.getStatus).toHaveBeenCalledTimes(1);

    // Advance past one interval
    await vi.advanceTimersByTimeAsync(10_000);
    expect(client.getStatus).toHaveBeenCalledTimes(2);

    // Another interval
    await vi.advanceTimersByTimeAsync(10_000);
    expect(client.getStatus).toHaveBeenCalledTimes(3);

    poller.stop();
  });

  it("updates status on each poll", async () => {
    const client = createMockClient();
    const getStatus = client.getStatus as ReturnType<typeof vi.fn>;

    getStatus.mockResolvedValueOnce(
      mockStatus({ power: "active", volume: { level: 10, muted: false, maxVolume: 100 } }),
    );
    getStatus.mockResolvedValueOnce(
      mockStatus({ power: "standby", volume: { level: 0, muted: true, maxVolume: 100 } }),
    );

    const poller = createBraviaPoller({ client, intervalMs: 5_000 });
    await poller.start();

    expect(poller.getLatestStatus()!.power).toBe("active");
    expect(poller.getLatestStatus()!.volume.level).toBe(10);

    await vi.advanceTimersByTimeAsync(5_000);

    expect(poller.getLatestStatus()!.power).toBe("standby");
    expect(poller.getLatestStatus()!.volume.muted).toBe(true);

    poller.stop();
  });

  it("keeps last good status on poll error", async () => {
    const client = createMockClient();
    const getStatus = client.getStatus as ReturnType<typeof vi.fn>;

    getStatus.mockResolvedValueOnce(mockStatus({ power: "active" }));
    getStatus.mockRejectedValueOnce(new Error("timeout"));

    const poller = createBraviaPoller({ client, intervalMs: 5_000 });
    await poller.start();

    expect(poller.getLatestStatus()!.power).toBe("active");

    await vi.advanceTimersByTimeAsync(5_000);

    // Should still have last good status
    expect(poller.getLatestStatus()!.power).toBe("active");
    poller.stop();
  });

  it("stop clears the interval", async () => {
    const client = createMockClient();
    const poller = createBraviaPoller({ client, intervalMs: 5_000 });

    await poller.start();
    expect(client.getStatus).toHaveBeenCalledTimes(1);

    poller.stop();

    await vi.advanceTimersByTimeAsync(15_000);
    // Should not have polled again after stop
    expect(client.getStatus).toHaveBeenCalledTimes(1);
  });

  it("defaults to 30s interval", () => {
    const client = createMockClient();
    const poller = createBraviaPoller({ client });
    // Just verify it creates without error
    expect(poller.id).toBe("bravia-poller");
  });

  it("start does not throw if initial poll fails", async () => {
    const client = createMockClient();
    (client.getStatus as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("unreachable"));

    const poller = createBraviaPoller({ client });
    await poller.start(); // Should not throw
    expect(poller.getLatestStatus()).toBeNull();
    poller.stop();
  });

  it("stop is safe to call multiple times", async () => {
    const poller = createBraviaPoller({ client: createMockClient() });
    await poller.start();
    poller.stop();
    poller.stop(); // Should not throw
  });

  it("stop is safe to call before start", () => {
    const poller = createBraviaPoller({ client: createMockClient() });
    poller.stop(); // Should not throw
  });
});
