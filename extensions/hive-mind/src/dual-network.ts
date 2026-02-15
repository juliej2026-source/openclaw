import { execFile } from "node:child_process";
import { promisify } from "node:util";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type NetworkPathId = "primary" | "hr02_5g";

export type NetworkPath = {
  id: NetworkPathId;
  ssid: string;
  gateway: string;
  subnet: string;
  description: string;
};

export type PathQuality = {
  path_id: NetworkPathId;
  reachable: boolean;
  latency_ms: number | null;
  packet_loss_pct: number | null;
  tested_at: string;
};

export type DualNetworkState = {
  active_path: NetworkPathId;
  paths: Record<NetworkPathId, NetworkPath>;
  quality: Record<NetworkPathId, PathQuality | null>;
  failover_active: boolean;
  last_switch: string | null;
  switch_count: number;
};

export type SwitchResult = {
  success: boolean;
  from: NetworkPathId;
  to: NetworkPathId;
  duration_ms: number;
  error?: string;
};

export type ExecFn = (cmd: string, args: string[]) => Promise<{ stdout: string; stderr: string }>;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const defaultExec: ExecFn = async (cmd, args) => {
  const execFileAsync = promisify(execFile);
  return execFileAsync(cmd, args);
};

export const NETWORK_PATHS: Record<NetworkPathId, NetworkPath> = {
  primary: {
    id: "primary",
    ssid: "The 1898 Moiwa",
    gateway: "10.1.8.1",
    subnet: "10.1.8.0/24",
    description: "Hotel WiFi (UDM Pro)",
  },
  hr02_5g: {
    id: "hr02_5g",
    ssid: "HR02a-BE6444",
    gateway: "192.168.128.1",
    subnet: "192.168.128.0/24",
    description: "NTT Docomo HR02 5G Modem",
  },
};

// ---------------------------------------------------------------------------
// nmcli helpers (exported for testing)
// ---------------------------------------------------------------------------

export function detectCurrentPath(activeConnection: string | null): NetworkPathId {
  if (!activeConnection) {
    return "primary";
  }
  if (activeConnection.startsWith("HR02")) {
    return "hr02_5g";
  }
  if (activeConnection === NETWORK_PATHS.primary.ssid) {
    return "primary";
  }
  return "primary";
}

export async function nmcliGetActiveConnection(exec: ExecFn = defaultExec): Promise<string | null> {
  try {
    const { stdout } = await exec("nmcli", [
      "-t",
      "-f",
      "NAME,TYPE,DEVICE",
      "con",
      "show",
      "--active",
    ]);
    for (const line of stdout.split("\n")) {
      const parts = line.split(":");
      if (parts[1] === "802-11-wireless") {
        return parts[0];
      }
    }
    return null;
  } catch {
    return null;
  }
}

export async function nmcliActivate(
  connection: string,
  exec: ExecFn = defaultExec,
): Promise<boolean> {
  try {
    await exec("nmcli", ["connection", "up", connection]);
    return true;
  } catch {
    return false;
  }
}

export async function pingGateway(
  gateway: string,
  exec: ExecFn = defaultExec,
): Promise<PathQuality> {
  const pathId = gateway === NETWORK_PATHS.hr02_5g.gateway ? "hr02_5g" : "primary";
  try {
    const { stdout } = await exec("ping", ["-c", "3", "-W", "2", gateway]);

    let latency: number | null = null;
    let packetLoss: number | null = null;

    const rttMatch = stdout.match(/rtt min\/avg\/max\/mdev = [\d.]+\/([\d.]+)\//);
    if (rttMatch) {
      latency = parseFloat(rttMatch[1]);
    }

    const lossMatch = stdout.match(/(\d+)% packet loss/);
    if (lossMatch) {
      packetLoss = parseInt(lossMatch[1], 10);
    }

    return {
      path_id: pathId,
      reachable: true,
      latency_ms: latency,
      packet_loss_pct: packetLoss,
      tested_at: new Date().toISOString(),
    };
  } catch {
    return {
      path_id: pathId,
      reachable: false,
      latency_ms: null,
      packet_loss_pct: null,
      tested_at: new Date().toISOString(),
    };
  }
}

// ---------------------------------------------------------------------------
// Dual-network manager
// ---------------------------------------------------------------------------

export type DualNetworkManagerOptions = {
  qualityIntervalMs?: number;
  failoverThreshold?: number;
  failbackThreshold?: number;
  exec?: ExecFn;
};

export function createDualNetworkManager(opts?: DualNetworkManagerOptions) {
  const exec = opts?.exec ?? defaultExec;
  const qualityIntervalMs = opts?.qualityIntervalMs ?? 60_000;
  const failoverThreshold = opts?.failoverThreshold ?? 3;
  const failbackThreshold = opts?.failbackThreshold ?? 2;

  let activePath: NetworkPathId = "primary";
  let failoverActive = false;
  let lastSwitch: string | null = null;
  let switchCount = 0;
  let consecutiveFailures = 0;
  let consecutiveRecoveries = 0;
  let intervalId: ReturnType<typeof setInterval> | undefined;

  const quality: Record<NetworkPathId, PathQuality | null> = {
    primary: null,
    hr02_5g: null,
  };

  async function checkQuality(): Promise<void> {
    const gateway = NETWORK_PATHS[activePath].gateway;
    const q = await pingGateway(gateway, exec);
    quality[activePath] = q;

    if (activePath === "primary" && !q.reachable) {
      consecutiveFailures++;
      if (consecutiveFailures >= failoverThreshold) {
        await doSwitch("hr02_5g");
        failoverActive = true;
        consecutiveFailures = 0;
      }
    } else if (activePath === "primary" && q.reachable) {
      consecutiveFailures = 0;
    }

    if (failoverActive && activePath === "hr02_5g") {
      // Probe primary gateway with a lightweight ping (may fail if unreachable from HR02 subnet)
      const primaryProbe = await pingGateway(NETWORK_PATHS.primary.gateway, exec);
      quality.primary = primaryProbe;
      if (primaryProbe.reachable) {
        consecutiveRecoveries++;
        if (consecutiveRecoveries >= failbackThreshold) {
          await doSwitch("primary");
          failoverActive = false;
          consecutiveRecoveries = 0;
        }
      } else {
        consecutiveRecoveries = 0;
      }
    }
  }

  async function doSwitch(target: NetworkPathId): Promise<SwitchResult> {
    const from = activePath;
    const start = Date.now();

    if (from === target) {
      return { success: true, from, to: target, duration_ms: 0 };
    }

    const connection = NETWORK_PATHS[target].ssid;
    const ok = await nmcliActivate(connection, exec);

    if (ok) {
      activePath = target;
      switchCount++;
      lastSwitch = new Date().toISOString();
      return { success: true, from, to: target, duration_ms: Date.now() - start };
    }

    return {
      success: false,
      from,
      to: target,
      duration_ms: Date.now() - start,
      error: `Failed to activate connection: ${connection}`,
    };
  }

  return {
    id: "dual-network",

    async start(): Promise<void> {
      const connection = await nmcliGetActiveConnection(exec);
      activePath = detectCurrentPath(connection);

      const gateway = NETWORK_PATHS[activePath].gateway;
      quality[activePath] = await pingGateway(gateway, exec);

      intervalId = setInterval(() => {
        checkQuality().catch(() => {});
      }, qualityIntervalMs);
    },

    stop(): void {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = undefined;
      }
    },

    getCurrentPath(): NetworkPathId {
      return activePath;
    },

    getState(): DualNetworkState {
      return {
        active_path: activePath,
        paths: { ...NETWORK_PATHS },
        quality: { ...quality },
        failover_active: failoverActive,
        last_switch: lastSwitch,
        switch_count: switchCount,
      };
    },

    async switchToPath(pathId: NetworkPathId): Promise<SwitchResult> {
      return doSwitch(pathId);
    },

    async testPathQuality(): Promise<PathQuality> {
      const gateway = NETWORK_PATHS[activePath].gateway;
      const q = await pingGateway(gateway, exec);
      quality[activePath] = q;
      return q;
    },
  };
}
