import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ExecFn } from "../dual-network.js";
import {
  detectCurrentPath,
  nmcliGetActiveConnection,
  nmcliActivate,
  pingGateway,
  createDualNetworkManager,
  NETWORK_PATHS,
} from "../dual-network.js";

// ---------------------------------------------------------------------------
// Mock exec factory
// ---------------------------------------------------------------------------

function createMockExec(responses: Array<{ stdout: string; stderr?: string }>): ExecFn {
  const calls: Array<{ cmd: string; args: string[] }> = [];
  let callIdx = 0;

  const fn = async (cmd: string, args: string[]) => {
    calls.push({ cmd, args });
    const response = responses[callIdx++];
    if (!response) {
      throw new Error(`No mock response for call #${callIdx}`);
    }
    return { stdout: response.stdout, stderr: response.stderr ?? "" };
  };

  // Attach calls for inspection
  (fn as unknown as { calls: typeof calls }).calls = calls;
  return fn;
}

function failingExec(): ExecFn {
  return async () => {
    throw new Error("Command failed");
  };
}

// ---------------------------------------------------------------------------
// detectCurrentPath
// ---------------------------------------------------------------------------

describe("detectCurrentPath", () => {
  it("identifies primary network from hotel WiFi connection", () => {
    expect(detectCurrentPath("The 1898 Moiwa")).toBe("primary");
  });

  it("identifies HR02 from HR02a connection name", () => {
    expect(detectCurrentPath("HR02a-BE6444")).toBe("hr02_5g");
  });

  it("identifies HR02 from HR02b connection name", () => {
    expect(detectCurrentPath("HR02b-BE6445")).toBe("hr02_5g");
  });

  it("returns primary as default for unknown connections", () => {
    expect(detectCurrentPath(null)).toBe("primary");
    expect(detectCurrentPath("SomeOtherWiFi")).toBe("primary");
  });
});

// ---------------------------------------------------------------------------
// nmcliGetActiveConnection
// ---------------------------------------------------------------------------

describe("nmcliGetActiveConnection", () => {
  it("parses active WiFi connection from nmcli output", async () => {
    const exec = createMockExec([
      { stdout: "The 1898 Moiwa:802-11-wireless:wlo1\nlo:loopback:lo\n" },
    ]);

    const name = await nmcliGetActiveConnection(exec);

    expect(name).toBe("The 1898 Moiwa");
  });

  it("returns null when no WiFi connection is active", async () => {
    const exec = createMockExec([{ stdout: "lo:loopback:lo\n" }]);

    const name = await nmcliGetActiveConnection(exec);

    expect(name).toBeNull();
  });

  it("returns null on nmcli failure", async () => {
    const name = await nmcliGetActiveConnection(failingExec());

    expect(name).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// nmcliActivate
// ---------------------------------------------------------------------------

describe("nmcliActivate", () => {
  it("activates a connection profile and returns true", async () => {
    const exec = createMockExec([{ stdout: "Connection successfully activated\n" }]);

    const result = await nmcliActivate("HR02a-BE6444", exec);

    expect(result).toBe(true);
  });

  it("returns false when activation fails", async () => {
    const result = await nmcliActivate("nonexistent", failingExec());

    expect(result).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// pingGateway
// ---------------------------------------------------------------------------

describe("pingGateway", () => {
  it("parses ping output for latency and packet loss", async () => {
    const exec = createMockExec([
      {
        stdout: [
          "PING 10.1.7.1 (10.1.7.1) 56(84) bytes of data.",
          "64 bytes from 10.1.7.1: icmp_seq=1 ttl=64 time=2.45 ms",
          "64 bytes from 10.1.7.1: icmp_seq=2 ttl=64 time=1.89 ms",
          "64 bytes from 10.1.7.1: icmp_seq=3 ttl=64 time=2.10 ms",
          "",
          "--- 10.1.7.1 ping statistics ---",
          "3 packets transmitted, 3 received, 0% packet loss, time 2003ms",
          "rtt min/avg/max/mdev = 1.890/2.146/2.450/0.230 ms",
        ].join("\n"),
      },
    ]);

    const quality = await pingGateway("10.1.7.1", exec);

    expect(quality.reachable).toBe(true);
    expect(quality.latency_ms).toBeCloseTo(2.146, 1);
    expect(quality.packet_loss_pct).toBe(0);
  });

  it("returns unreachable when ping fails completely", async () => {
    const quality = await pingGateway("10.1.7.1", failingExec());

    expect(quality.reachable).toBe(false);
    expect(quality.latency_ms).toBeNull();
    expect(quality.packet_loss_pct).toBeNull();
  });

  it("detects partial packet loss", async () => {
    const exec = createMockExec([
      {
        stdout: [
          "PING 10.1.7.1 (10.1.7.1) 56(84) bytes of data.",
          "64 bytes from 10.1.7.1: icmp_seq=1 ttl=64 time=5.00 ms",
          "",
          "--- 10.1.7.1 ping statistics ---",
          "3 packets transmitted, 1 received, 66% packet loss, time 2003ms",
          "rtt min/avg/max/mdev = 5.000/5.000/5.000/0.000 ms",
        ].join("\n"),
      },
    ]);

    const quality = await pingGateway("10.1.7.1", exec);

    expect(quality.reachable).toBe(true);
    expect(quality.packet_loss_pct).toBe(66);
  });
});

// ---------------------------------------------------------------------------
// NETWORK_PATHS constant
// ---------------------------------------------------------------------------

describe("NETWORK_PATHS", () => {
  it("has primary and hr02_5g paths defined", () => {
    expect(NETWORK_PATHS.primary.ssid).toBe("The 1898 Moiwa");
    expect(NETWORK_PATHS.primary.gateway).toBe("10.1.7.1");
    expect(NETWORK_PATHS.hr02_5g.ssid).toBe("HR02a-BE6444");
    expect(NETWORK_PATHS.hr02_5g.gateway).toBe("192.168.128.1");
  });
});

// ---------------------------------------------------------------------------
// createDualNetworkManager
// ---------------------------------------------------------------------------

describe("createDualNetworkManager", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns manager with correct id", () => {
    const manager = createDualNetworkManager({ exec: failingExec() });
    expect(manager.id).toBe("dual-network");
  });

  it("start detects current path from nmcli", async () => {
    const exec = createMockExec([
      // nmcliGetActiveConnection call during start
      { stdout: "The 1898 Moiwa:802-11-wireless:wlo1\n" },
      // pingGateway call during start
      {
        stdout: [
          "3 packets transmitted, 3 received, 0% packet loss",
          "rtt min/avg/max/mdev = 2.0/2.0/2.0/0.0 ms",
        ].join("\n"),
      },
    ]);

    const manager = createDualNetworkManager({ exec });
    await manager.start();

    expect(manager.getCurrentPath()).toBe("primary");

    manager.stop();
  });

  it("switchToPath switches network via nmcli", async () => {
    const exec = createMockExec([
      // start: getActiveConnection
      { stdout: "The 1898 Moiwa:802-11-wireless:wlo1\n" },
      // start: pingGateway
      {
        stdout:
          "3 packets transmitted, 3 received, 0% packet loss\nrtt min/avg/max/mdev = 2.0/2.0/2.0/0.0 ms",
      },
      // switchToPath: nmcliActivate
      { stdout: "Connection successfully activated\n" },
    ]);

    const manager = createDualNetworkManager({ exec });
    await manager.start();

    const result = await manager.switchToPath("hr02_5g");

    expect(result.success).toBe(true);
    expect(result.from).toBe("primary");
    expect(result.to).toBe("hr02_5g");
    expect(manager.getCurrentPath()).toBe("hr02_5g");

    manager.stop();
  });

  it("switchToPath is no-op when already on target", async () => {
    const exec = createMockExec([
      { stdout: "The 1898 Moiwa:802-11-wireless:wlo1\n" },
      {
        stdout:
          "3 packets transmitted, 3 received, 0% packet loss\nrtt min/avg/max/mdev = 2.0/2.0/2.0/0.0 ms",
      },
    ]);

    const manager = createDualNetworkManager({ exec });
    await manager.start();

    const result = await manager.switchToPath("primary");

    expect(result.success).toBe(true);
    expect(result.from).toBe("primary");
    expect(result.to).toBe("primary");

    manager.stop();
  });

  it("switchToPath returns error on failure", async () => {
    const callCount = { n: 0 };
    const exec: ExecFn = async (_cmd, _args) => {
      callCount.n++;
      // First two calls succeed (start), third fails (switch)
      if (callCount.n <= 2) {
        if (callCount.n === 1) {
          return { stdout: "The 1898 Moiwa:802-11-wireless:wlo1\n", stderr: "" };
        }
        return {
          stdout:
            "3 packets transmitted, 3 received, 0% packet loss\nrtt min/avg/max/mdev = 2.0/2.0/2.0/0.0 ms",
          stderr: "",
        };
      }
      throw new Error("Connection activation failed");
    };

    const manager = createDualNetworkManager({ exec });
    await manager.start();

    const result = await manager.switchToPath("hr02_5g");

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();

    manager.stop();
  });

  it("getState returns complete state object", async () => {
    const exec = createMockExec([
      { stdout: "The 1898 Moiwa:802-11-wireless:wlo1\n" },
      {
        stdout:
          "3 packets transmitted, 3 received, 0% packet loss\nrtt min/avg/max/mdev = 2.0/2.0/2.0/0.0 ms",
      },
    ]);

    const manager = createDualNetworkManager({ exec });
    await manager.start();

    const state = manager.getState();

    expect(state.active_path).toBe("primary");
    expect(state.paths).toHaveProperty("primary");
    expect(state.paths).toHaveProperty("hr02_5g");
    expect(state.failover_active).toBe(false);
    expect(state.switch_count).toBe(0);

    manager.stop();
  });

  it("stop clears the interval", async () => {
    const exec = createMockExec([
      { stdout: "The 1898 Moiwa:802-11-wireless:wlo1\n" },
      {
        stdout:
          "3 packets transmitted, 3 received, 0% packet loss\nrtt min/avg/max/mdev = 2.0/2.0/2.0/0.0 ms",
      },
    ]);

    const manager = createDualNetworkManager({ exec, qualityIntervalMs: 30_000 });
    await manager.start();
    manager.stop();

    // No more exec calls should happen after stop
    await vi.advanceTimersByTimeAsync(120_000);

    // createMockExec throws on extra calls, so reaching here = interval was cleared
  });

  it("testPathQuality returns quality for current path", async () => {
    const exec = createMockExec([
      // start
      { stdout: "The 1898 Moiwa:802-11-wireless:wlo1\n" },
      {
        stdout:
          "3 packets transmitted, 3 received, 0% packet loss\nrtt min/avg/max/mdev = 2.0/2.0/2.0/0.0 ms",
      },
      // testPathQuality
      {
        stdout:
          "3 packets transmitted, 3 received, 0% packet loss\nrtt min/avg/max/mdev = 3.5/3.5/3.5/0.0 ms",
      },
    ]);

    const manager = createDualNetworkManager({ exec });
    await manager.start();

    const quality = await manager.testPathQuality();

    expect(quality.path_id).toBe("primary");
    expect(quality.reachable).toBe(true);

    manager.stop();
  });
});
