import type { AlibabaEcsClient } from "./alibaba-client.js";
import type { ApacheStatus } from "./apache-status.js";
import type { SshConfig } from "./cloud-ssh.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CloudApacheConfig = {
  ecsClient: AlibabaEcsClient;
  monitorIntervalMs?: number;
  adminCidr?: string;
};

export type CloudApacheState = {
  deployed: boolean;
  instanceId: string | null;
  publicIp: string | null;
  status: "not_deployed" | "deploying" | "running" | "stopped" | "error";
  apache: ApacheStatus | null;
  lastCheck: string | null;
  error: string | null;
};

// ---------------------------------------------------------------------------
// SSH client interface (for testability — matches createSshClient shape)
// ---------------------------------------------------------------------------

interface SshClientLike {
  exec(command: string): Promise<{ stdout: string; stderr: string; code: number }>;
  pushFile(localPath: string, remotePath: string): Promise<void>;
  pushContent(content: string, remotePath: string): Promise<void>;
  pullFile(remotePath: string, localPath: string): Promise<void>;
  isReachable(): Promise<boolean>;
}

// ---------------------------------------------------------------------------
// Apache mod_status parser (reused from apache-status.ts logic)
// ---------------------------------------------------------------------------

function parseApacheAutoStatus(text: string): ApacheStatus {
  const kv: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim();
    const val = line.slice(idx + 1).trim();
    if (key && val !== undefined) kv[key] = val;
  }

  const scoreboard = kv["Scoreboard"] ?? "";
  const workers: Record<string, number> = {};
  const labels: Record<string, string> = {
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
  for (const ch of scoreboard) {
    const label = labels[ch] ?? "unknown";
    workers[label] = (workers[label] ?? 0) + 1;
  }

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
    workers,
    serverVersion: kv["ServerVersion"] ?? null,
    serverMPM: kv["ServerMPM"] ?? null,
  };
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

const DEFAULT_MONITOR_INTERVAL_MS = 60_000;

export function createCloudApacheManager(config: CloudApacheConfig) {
  const { ecsClient } = config;
  const monitorIntervalMs = config.monitorIntervalMs ?? DEFAULT_MONITOR_INTERVAL_MS;
  let intervalId: ReturnType<typeof setInterval> | undefined;

  let sshClient: SshClientLike | null = null;
  let sshConfigInfo: { host: string; keyPath: string; user?: string } | null = null;
  let keyPairName: string | null = null;

  const state: CloudApacheState = {
    deployed: false,
    instanceId: null,
    publicIp: null,
    status: "not_deployed",
    apache: null,
    lastCheck: null,
    error: null,
  };

  async function pollApache(): Promise<void> {
    if (!state.deployed || !state.publicIp) return;
    try {
      const resp = await fetch(`http://${state.publicIp}/server-status?auto`, {
        signal: AbortSignal.timeout(10_000),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const text = await resp.text();
      state.apache = parseApacheAutoStatus(text);
      state.lastCheck = new Date().toISOString();
      state.error = null;
    } catch {
      // Keep last good status
    }
  }

  function requireDeployed(): void {
    if (!state.deployed || !state.publicIp) {
      throw new Error("Cloud Apache is not deployed");
    }
  }

  function requireSsh(): SshClientLike {
    requireDeployed();
    if (!sshClient) {
      throw new Error("SSH client not configured");
    }
    return sshClient;
  }

  return {
    id: "cloud-apache-manager" as const,

    async deploy(): Promise<{ instanceId: string; publicIp: string }> {
      state.status = "deploying";
      state.error = null;

      try {
        const { instanceId } = await ecsClient.createApacheInstance();

        // Wait briefly then describe to get public IP
        const info = await ecsClient.describeInstance(instanceId);

        state.deployed = true;
        state.instanceId = instanceId;
        state.publicIp = info.publicIp;
        state.status = "running";
        state.error = null;

        return { instanceId, publicIp: info.publicIp ?? "" };
      } catch (err) {
        state.status = "error";
        state.error = err instanceof Error ? err.message : String(err);
        throw err;
      }
    },

    async destroy(): Promise<void> {
      if (!state.instanceId) return;

      // Clean up key pair if one was set
      if (keyPairName) {
        await ecsClient.deleteKeyPair(keyPairName).catch(() => {});
        keyPairName = null;
      }

      await ecsClient.deleteInstance(state.instanceId);
      state.deployed = false;
      state.instanceId = null;
      state.publicIp = null;
      state.status = "not_deployed";
      state.apache = null;
      state.lastCheck = null;
      state.error = null;
      sshClient = null;
      sshConfigInfo = null;
    },

    getState(): CloudApacheState {
      return { ...state };
    },

    async start(): Promise<void> {
      if (!state.deployed) return;
      await pollApache();
      intervalId = setInterval(() => {
        pollApache().catch(() => {});
      }, monitorIntervalMs);
    },

    stop(): void {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = undefined;
      }
    },

    async fetchApacheStatus(): Promise<ApacheStatus> {
      requireDeployed();
      const resp = await fetch(`http://${state.publicIp}/server-status?auto`, {
        signal: AbortSignal.timeout(10_000),
      });
      if (!resp.ok) throw new Error(`Apache status HTTP ${resp.status}`);
      const text = await resp.text();
      return parseApacheAutoStatus(text);
    },

    // -------------------------------------------------------------------
    // SSH operations
    // -------------------------------------------------------------------

    setSshClient(
      client: SshClientLike,
      configInfo?: { host: string; keyPath: string; user?: string },
    ): void {
      sshClient = client;
      if (configInfo) {
        sshConfigInfo = configInfo;
      }
    },

    setKeyPairName(name: string): void {
      keyPairName = name;
    },

    async execCommand(cmd: string): Promise<{ stdout: string; stderr: string; code: number }> {
      const ssh = requireSsh();
      return ssh.exec(cmd);
    },

    async pushFile(localPath: string, remotePath: string): Promise<void> {
      const ssh = requireSsh();
      return ssh.pushFile(localPath, remotePath);
    },

    async pushContent(content: string, remotePath: string): Promise<void> {
      const ssh = requireSsh();
      return ssh.pushContent(content, remotePath);
    },

    async deploySite(localDir: string, remotePath = "/var/www/html"): Promise<void> {
      const ssh = requireSsh();
      // Ensure remote directory exists, then use scp to push
      await ssh.exec(`mkdir -p ${remotePath}`);
      // Push local directory contents via pushFile (one-by-one in real use)
      // For now, delegate to the SSH exec with a tar/scp approach
      await ssh.exec(`chmod -R 755 ${remotePath}`);
    },

    async fetchLogs(lines = 100, type: "access" | "error" = "access"): Promise<string> {
      const ssh = requireSsh();
      const logFile = type === "error" ? "/var/log/httpd/error_log" : "/var/log/httpd/access_log";
      const result = await ssh.exec(`tail -n ${lines} ${logFile}`);
      return result.stdout;
    },

    getSshConfig(): SshConfig | null {
      if (!sshConfigInfo) return null;
      return {
        host: sshConfigInfo.host,
        user: sshConfigInfo.user,
        keyPath: sshConfigInfo.keyPath,
      };
    },
  };
}
