import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { HiveAlert } from "../alert-manager.js";
import type { StationPingResult, NetworkScanResult } from "../network-scanner.js";
import { ChannelManager } from "../discord/channel-manager.js";
import { createDiscordRestClient } from "../discord/discord-client.js";
import {
  buildAlertEmbed,
  buildStationStatusEmbed,
  buildDashboardEmbed,
  buildScraperJobEmbed,
  buildNeuralStatusEmbed,
  buildModelListEmbed,
  buildExecutionEmbed,
  buildTopologyTextEmbed,
} from "../discord/embed-builders.js";
import { NotificationBridge } from "../discord/notification-bridge.js";
import { PeriodicReports } from "../discord/periodic-reports.js";
import {
  SEVERITY_COLORS,
  CONTEXT_COLORS,
  CHANNEL_CONFIGS,
  ALL_CHANNEL_NAMES,
} from "../discord/types.js";

// ---------------------------------------------------------------------------
// Embed builders
// ---------------------------------------------------------------------------

describe("Discord embed builders", () => {
  const mockAlert: HiveAlert = {
    id: "alert-123",
    type: "station_offline",
    severity: "warning",
    message: "Station Julie went offline",
    source: "iot-hub",
    target: "10.1.7.87",
    timestamp: "2026-02-08T12:00:00.000Z",
    acknowledged: false,
    metadata: { station_label: "Julie" },
  };

  const mockStations: StationPingResult[] = [
    { ip: "10.1.7.87", label: "Julie", reachable: true, latencyMs: 5 },
    { ip: "10.1.7.158", label: "IOT-HUB", reachable: true, latencyMs: 1 },
    { ip: "10.1.7.239", label: "CLERK", reachable: false },
  ];

  it("buildAlertEmbed — correct severity color", () => {
    const embed = buildAlertEmbed(mockAlert);
    expect(embed.color).toBe(SEVERITY_COLORS.warning);
    expect(embed.title).toContain("Julie went offline");
    expect(embed.fields.length).toBeGreaterThanOrEqual(3);
    expect(embed.fields.length).toBeLessThanOrEqual(25);
    expect(embed.timestamp).toBe("2026-02-08T12:00:00.000Z");
  });

  it("buildAlertEmbed — critical severity uses red", () => {
    const critical = { ...mockAlert, severity: "critical" as const };
    const embed = buildAlertEmbed(critical);
    expect(embed.color).toBe(SEVERITY_COLORS.critical);
  });

  it("buildAlertEmbed — info severity uses green", () => {
    const info = { ...mockAlert, severity: "info" as const, type: "station_online" as const };
    const embed = buildAlertEmbed(info);
    expect(embed.color).toBe(SEVERITY_COLORS.info);
  });

  it("buildStationStatusEmbed — shows online count", () => {
    const embed = buildStationStatusEmbed(mockStations);
    expect(embed.title).toContain("2/3");
    expect(embed.description).toContain("Julie");
    expect(embed.description).toContain("CLERK");
  });

  it("buildDashboardEmbed — includes all provided fields", () => {
    const embed = buildDashboardEmbed({
      stations: mockStations,
      activeAlerts: 3,
      wanStatus: "primary",
      uptime: 7200,
      scraperStatus: "Running",
      neuralPhase: "genesis",
      modelCount: 5,
    });
    expect(embed.title).toBe("Hive Infrastructure Dashboard");
    expect(embed.fields.length).toBe(7);
    expect(embed.color).toBe(CONTEXT_COLORS.dashboard);
  });

  it("buildScraperJobEmbed — completed uses green", () => {
    const embed = buildScraperJobEmbed({
      jobId: "job-abc",
      status: "completed",
      pricesFound: 42,
      durationMs: 12500,
    });
    expect(embed.color).toBe(SEVERITY_COLORS.info);
    expect(embed.fields.some((f) => f.value === "42")).toBe(true);
  });

  it("buildNeuralStatusEmbed — includes phase and fitness", () => {
    const embed = buildNeuralStatusEmbed({
      phase: "growth",
      nodeCount: 12,
      edgeCount: 25,
      fitness: 0.78,
      convexHealthy: true,
    });
    expect(embed.color).toBe(CONTEXT_COLORS.neural);
    expect(embed.fields.some((f) => f.value === "growth")).toBe(true);
    expect(embed.fields.some((f) => f.value === "78.0%")).toBe(true);
  });

  it("buildModelListEmbed — lists models", () => {
    const embed = buildModelListEmbed({
      installed: 3,
      running: 1,
      models: [
        { id: "llama3:8b", running: true },
        { id: "codellama:7b", running: false },
      ],
    });
    expect(embed.fields.some((f) => f.value === "3")).toBe(true);
    expect(embed.fields.some((f) => f.value.includes("llama3:8b"))).toBe(true);
  });

  it("buildExecutionEmbed — shows success rate", () => {
    const embed = buildExecutionEmbed({
      totalExecutions: 100,
      successRate: 0.95,
      recentCommands: [
        {
          id: "e1",
          timestamp: "2026-02-08T12:00:00.000Z",
          command: "ping",
          task_type: "network",
          success: true,
          latency_ms: 5,
          reported_to_julie: true,
        },
      ],
    });
    expect(embed.fields.some((f) => f.value === "95.0%")).toBe(true);
    expect(embed.fields.some((f) => f.value.includes("ping"))).toBe(true);
  });

  it("buildTopologyTextEmbed — includes UDM info", () => {
    const scan: NetworkScanResult = {
      timestamp: "2026-02-08T12:00:00.000Z",
      udm: {
        name: "UDM-Pro",
        mac: "aa:bb:cc:dd:ee:ff",
        model: "UDMPRO",
        cloudConnected: true,
        hasInternet: true,
        isSsoEnabled: false,
        remoteAccessEnabled: true,
        deviceState: "connected",
        lastChecked: "2026-02-08T12:00:00.000Z",
      },
      stations: mockStations,
      health: [],
    };
    const embed = buildTopologyTextEmbed(scan);
    expect(embed.description).toContain("UDM-Pro");
    expect(embed.description).toContain("Internet: OK");
  });

  it("all embeds respect Discord field limits", () => {
    const embeds = [
      buildAlertEmbed(mockAlert),
      buildStationStatusEmbed(mockStations),
      buildDashboardEmbed({ stations: mockStations }),
      buildScraperJobEmbed({ jobId: "j1", status: "completed" }),
      buildNeuralStatusEmbed({ phase: "genesis" }),
      buildModelListEmbed({ installed: 0, running: 0 }),
      buildExecutionEmbed({ totalExecutions: 0, successRate: 0 }),
    ];
    for (const embed of embeds) {
      expect(embed.fields.length).toBeLessThanOrEqual(25);
      expect(embed.title.length).toBeLessThanOrEqual(256);
      expect(embed.footer.text).toBe("OpenClaw Hive Monitor");
    }
  });
});

// ---------------------------------------------------------------------------
// Channel manager
// ---------------------------------------------------------------------------

describe("Discord channel manager", () => {
  function mockClient(
    existingChannels: Array<{ id: string; name: string; type: number; parent_id?: string }> = [],
  ) {
    return {
      getGuild: vi.fn().mockResolvedValue({ id: "guild-1", name: "Test" }),
      getGuildChannels: vi.fn().mockResolvedValue(existingChannels),
      createChannel: vi
        .fn()
        .mockImplementation((_guildId, body) =>
          Promise.resolve({ id: `new-${body.name}`, name: body.name, type: body.type }),
        ),
      modifyChannel: vi.fn().mockResolvedValue(null),
      sendMessage: vi.fn().mockResolvedValue({ id: "msg-1" }),
      editMessage: vi.fn().mockResolvedValue({ id: "msg-1" }),
    };
  }

  it("creates category and all 7 channels when none exist", async () => {
    const client = mockClient();
    const manager = new ChannelManager(client as any, { token: "t", guildId: "g" });
    await manager.initialize();
    // 1 category + 7 channels = 8 createChannel calls
    expect(client.createChannel).toHaveBeenCalledTimes(8);
    for (const name of ALL_CHANNEL_NAMES) {
      expect(manager.getChannelId(name)).toBeTruthy();
    }
  });

  it("reuses existing category and channels", async () => {
    const existing = [
      { id: "cat-1", name: "Hive Infrastructure", type: 4 },
      { id: "ch-alerts", name: "hive-alerts", type: 0, parent_id: "cat-1" },
      { id: "ch-status", name: "hive-status", type: 0, parent_id: "cat-1" },
    ];
    const client = mockClient(existing);
    const manager = new ChannelManager(client as any, { token: "t", guildId: "g" });
    await manager.initialize();
    // Should only create the 5 missing channels (not category or the 2 existing)
    expect(client.createChannel).toHaveBeenCalledTimes(5);
    expect(manager.getChannelId("hive-alerts")).toBe("ch-alerts");
  });

  it("returns null for uncached channel", async () => {
    const client = mockClient();
    const manager = new ChannelManager(client as any, { token: "t", guildId: "g" });
    // Don't initialize — no channels cached
    expect(manager.getChannelId("hive-alerts")).toBeNull();
  });

  it("send() calls sendMessage with correct channel ID", async () => {
    const client = mockClient();
    const manager = new ChannelManager(client as any, { token: "t", guildId: "g" });
    await manager.initialize();
    await manager.send("hive-alerts", { content: "test" });
    expect(client.sendMessage).toHaveBeenCalledWith("new-hive-alerts", { content: "test" });
  });
});

// ---------------------------------------------------------------------------
// Notification bridge
// ---------------------------------------------------------------------------

describe("Discord notification bridge", () => {
  it("wires AlertManager listener and sends alert embed", async () => {
    const sendFn = vi.fn().mockResolvedValue(undefined);
    const mockChannelManager = { send: sendFn, getChannelId: () => "ch-1", initialize: vi.fn() };
    const bridge = new NotificationBridge(mockChannelManager as any);

    // Mock AlertManager with addListener
    let capturedListener: ((alert: HiveAlert) => void) | null = null;
    const mockAlertManager = {
      addListener: vi.fn((fn: (alert: HiveAlert) => void) => {
        capturedListener = fn;
        return () => {
          capturedListener = null;
        };
      }),
    };

    bridge.wireAlertManager(mockAlertManager as any);
    expect(mockAlertManager.addListener).toHaveBeenCalledOnce();

    // Simulate alert
    capturedListener!({
      id: "a1",
      type: "station_offline",
      severity: "warning",
      message: "Test",
      source: "iot-hub",
      timestamp: new Date().toISOString(),
      acknowledged: false,
    });

    // Wait for async send
    await vi.waitFor(() => expect(sendFn).toHaveBeenCalledOnce());
    expect(sendFn.mock.calls[0][0]).toBe("hive-alerts");
  });

  it("detects station state changes and sends to hive-network", async () => {
    vi.useFakeTimers();
    const sendFn = vi.fn().mockResolvedValue(undefined);
    const mockChannelManager = { send: sendFn, getChannelId: () => "ch-1", initialize: vi.fn() };
    const bridge = new NotificationBridge(mockChannelManager as any);

    let scanResult: NetworkScanResult | null = {
      timestamp: new Date().toISOString(),
      udm: null,
      stations: [{ ip: "10.1.7.87", label: "Julie", reachable: true, latencyMs: 5 }],
      health: [],
    };

    bridge.wireNetworkScanner(() => scanResult);
    // First call seeds state, no changes yet
    expect(sendFn).not.toHaveBeenCalled();

    // Simulate state change on next poll
    scanResult = {
      ...scanResult,
      stations: [{ ip: "10.1.7.87", label: "Julie", reachable: false }],
    };

    // Trigger the interval manually
    vi.advanceTimersByTime(30_000);
    await vi.waitFor(() => expect(sendFn).toHaveBeenCalledOnce());
    expect(sendFn.mock.calls[0][0]).toBe("hive-network");

    bridge.shutdown();
    vi.useRealTimers();
  });

  it("shutdown unsubscribes all listeners", () => {
    const mockChannelManager = { send: vi.fn(), getChannelId: () => null, initialize: vi.fn() };
    const bridge = new NotificationBridge(mockChannelManager as any);

    let unsubbed = false;
    const mockAlertManager = {
      addListener: vi.fn(() => () => {
        unsubbed = true;
      }),
    };

    bridge.wireAlertManager(mockAlertManager as any);
    bridge.shutdown();
    expect(unsubbed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Periodic reports
// ---------------------------------------------------------------------------

describe("Discord periodic reports", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("sends initial station report on start", async () => {
    const sendFn = vi.fn().mockResolvedValue(undefined);
    const mockChannelManager = { send: sendFn, getChannelId: () => "ch-1", initialize: vi.fn() };
    const mockServices = {
      alertManager: { getActive: () => [] } as any,
      getScan: () => ({
        timestamp: new Date().toISOString(),
        udm: null,
        stations: [{ ip: "10.1.7.158", label: "IOT-HUB", reachable: true, latencyMs: 1 }],
        health: [],
      }),
      getDualNetwork: () => ({
        active_path: "primary" as const,
        paths: {} as any,
        quality: {} as any,
        failover_active: false,
        last_switch: null,
        switch_count: 0,
      }),
      startTime: Date.now(),
    };

    const reports = new PeriodicReports(mockChannelManager as any, mockServices);
    await reports.start();
    expect(sendFn).toHaveBeenCalledOnce();
    expect(sendFn.mock.calls[0][0]).toBe("hive-status");
    reports.stop();
  });

  it("stop clears all intervals", async () => {
    const sendFn = vi.fn().mockResolvedValue(undefined);
    const mockChannelManager = { send: sendFn, getChannelId: () => "ch-1", initialize: vi.fn() };
    const mockServices = {
      alertManager: { getActive: () => [] } as any,
      getScan: () => null,
      getDualNetwork: () => ({
        active_path: "primary" as const,
        paths: {} as any,
        quality: {} as any,
        failover_active: false,
        last_switch: null,
        switch_count: 0,
      }),
      startTime: Date.now(),
    };

    const reports = new PeriodicReports(mockChannelManager as any, mockServices);
    await reports.start();
    reports.stop();

    sendFn.mockClear();
    vi.advanceTimersByTime(60 * 60 * 1000); // 1 hour
    expect(sendFn).not.toHaveBeenCalled();
  });

  it("sends dashboard report after 1 hour", async () => {
    const sendFn = vi.fn().mockResolvedValue(undefined);
    const mockChannelManager = { send: sendFn, getChannelId: () => "ch-1", initialize: vi.fn() };
    const mockServices = {
      alertManager: { getActive: () => [] } as any,
      getScan: () => ({
        timestamp: new Date().toISOString(),
        udm: null,
        stations: [{ ip: "10.1.7.158", label: "IOT-HUB", reachable: true, latencyMs: 1 }],
        health: [],
      }),
      getDualNetwork: () => ({
        active_path: "primary" as const,
        paths: {} as any,
        quality: {} as any,
        failover_active: false,
        last_switch: null,
        switch_count: 0,
      }),
      startTime: Date.now(),
    };

    // Mock fetch for scraper/neural status
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("no local API in test"));

    const reports = new PeriodicReports(mockChannelManager as any, mockServices);
    await reports.start();
    const initialCalls = sendFn.mock.calls.length;

    // Advance past 1-hour mark to trigger dashboard + station reports
    await vi.advanceTimersByTimeAsync(60 * 60 * 1000 + 100);

    expect(sendFn.mock.calls.length).toBeGreaterThan(initialCalls);
    reports.stop();
    globalThis.fetch = originalFetch;
  });
});

// ---------------------------------------------------------------------------
// Discord REST client
// ---------------------------------------------------------------------------

describe("Discord REST client", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("sends GET request with bot token", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ id: "guild-1", name: "Test" }),
    });

    const client = createDiscordRestClient("test-token");
    const result = await client.getGuild("guild-1");
    expect(result).toEqual({ id: "guild-1", name: "Test" });
    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledWith(
      "https://discord.com/api/v10/guilds/guild-1",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({ Authorization: "Bot test-token" }),
      }),
    );
  });

  it("retries on 429 rate limit", async () => {
    let callCount = 0;
    globalThis.fetch = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({
          ok: false,
          status: 429,
          json: () => Promise.resolve({ retry_after: 0.01 }),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ id: "msg-1" }),
      });
    });

    const client = createDiscordRestClient("test-token");
    const result = await client.sendMessage("ch-1", { content: "hello" });
    expect(result).toEqual({ id: "msg-1" });
    expect(callCount).toBe(2);
  });

  it("returns null on error without throwing", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("network down"));

    const client = createDiscordRestClient("test-token");
    const result = await client.getGuild("guild-1");
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Types / constants
// ---------------------------------------------------------------------------

describe("Discord types and constants", () => {
  it("defines 7 channels", () => {
    expect(ALL_CHANNEL_NAMES.length).toBe(7);
  });

  it("channel configs have unique positions", () => {
    const positions = ALL_CHANNEL_NAMES.map((n) => CHANNEL_CONFIGS[n].position);
    expect(new Set(positions).size).toBe(7);
  });

  it("severity colors are valid hex", () => {
    expect(SEVERITY_COLORS.critical).toBe(0xed4245);
    expect(SEVERITY_COLORS.warning).toBe(0xfee75c);
    expect(SEVERITY_COLORS.info).toBe(0x57f287);
  });
});
