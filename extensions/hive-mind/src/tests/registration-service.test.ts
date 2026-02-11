import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { JulieClient } from "../julie-client.js";
import { createRegistrationService } from "../registration-service.js";

vi.mock("../station-identity.js", () => ({
  buildStationIdentity: vi.fn().mockReturnValue({
    station_id: "iot-hub",
    hostname: "test-host",
    ip_address: "10.1.7.158",
    port: 3001,
    platform: "linux",
    arch: "x64",
    version: "1.0.0",
    uptime_seconds: 100,
    capabilities: [],
    layers: {},
    models: [],
  }),
}));

let tmpDir: string;
const originalHome = process.env.HOME;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "reg-service-test-"));
  process.env.HOME = tmpDir;
  vi.useFakeTimers();
});

afterEach(() => {
  process.env.HOME = originalHome;
  fs.rmSync(tmpDir, { recursive: true, force: true });
  vi.useRealTimers();
});

function mockJulieClient(overrides: Partial<JulieClient> = {}): JulieClient {
  return {
    register: vi.fn().mockResolvedValue({ success: true, agent_id: "iot-hub" }),
    reportExecution: vi.fn().mockResolvedValue({ received: true }),
    isAvailable: vi.fn().mockResolvedValue(true),
    ...overrides,
  } as unknown as JulieClient;
}

function mockServiceCtx() {
  return {
    config: {},
    stateDir: path.join(tmpDir, ".openclaw", "hive-mind"),
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
  };
}

describe("createRegistrationService", () => {
  it("returns a service with correct id", () => {
    const service = createRegistrationService(mockJulieClient());
    expect(service.id).toBe("hive-mind-registration");
  });

  it("registers immediately on start", async () => {
    const client = mockJulieClient();
    const service = createRegistrationService(client);
    const ctx = mockServiceCtx();

    await service.start(ctx as never);

    expect(client.register).toHaveBeenCalledOnce();
    service.stop?.(ctx as never);
  });

  it("registers again after 5 minutes", async () => {
    const client = mockJulieClient();
    const service = createRegistrationService(client);
    const ctx = mockServiceCtx();

    await service.start(ctx as never);
    expect(client.register).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    expect(client.register).toHaveBeenCalledTimes(2);

    service.stop?.(ctx as never);
  });

  it("stops interval on stop()", async () => {
    const client = mockJulieClient();
    const service = createRegistrationService(client);
    const ctx = mockServiceCtx();

    await service.start(ctx as never);
    service.stop?.(ctx as never);

    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    // Should NOT have been called again after stop
    expect(client.register).toHaveBeenCalledTimes(1);
  });

  it("silently handles registration failure", async () => {
    const client = mockJulieClient({
      register: vi.fn().mockRejectedValue(new Error("ECONNREFUSED")),
    } as unknown as Partial<JulieClient>);
    const service = createRegistrationService(client);
    const ctx = mockServiceCtx();

    // Should not throw
    await service.start(ctx as never);
    expect(ctx.logger.warn).toHaveBeenCalled();

    service.stop?.(ctx as never);
  });

  it("saves last_registered timestamp to state file", async () => {
    const client = mockJulieClient();
    const service = createRegistrationService(client);
    const ctx = mockServiceCtx();

    await service.start(ctx as never);

    const statePath = path.join(ctx.stateDir, "state.json");
    expect(fs.existsSync(statePath)).toBe(true);

    const state = JSON.parse(fs.readFileSync(statePath, "utf-8"));
    expect(state).toHaveProperty("last_registered");

    service.stop?.(ctx as never);
  });

  it("logs successful registration", async () => {
    const client = mockJulieClient();
    const service = createRegistrationService(client);
    const ctx = mockServiceCtx();

    await service.start(ctx as never);
    expect(ctx.logger.info).toHaveBeenCalled();

    service.stop?.(ctx as never);
  });
});
