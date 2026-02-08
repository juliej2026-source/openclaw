import type { UnifiDevice, UnifiHealthSubsystem } from "./unifi-types.js";

// ---------------------------------------------------------------------------
// UniFi Site Manager Cloud API (api.ui.com)
// Read-only, API-key authenticated — no password required
// Docs: https://developer.ui.com/site-manager-api/gettingstarted
// ---------------------------------------------------------------------------

const CLOUD_BASE_URL = "https://api.ui.com";
const DEFAULT_TIMEOUT_MS = 15_000;

export type CloudHost = {
  id: string;
  hardwareId?: string;
  type?: string;
  name?: string;
  ipAddress?: string;
  firmwareVersion?: string;
  isBlocked?: boolean;
  lastConnectionStateChange?: string;
  reportedState?: {
    hostname?: string;
    version?: string;
    ip?: string;
    mac?: string;
    uptime?: number;
    hardware?: { shortname?: string; uuid?: string };
  };
};

export type CloudSite = {
  siteId: string;
  meta?: { name?: string; desc?: string; timezone?: string };
  statistics?: { counts?: { totalDevice?: number; uap?: number; usw?: number; ugw?: number } };
  isOwner?: boolean;
  hostId?: string;
};

export type CloudDevice = {
  id?: string;
  mac: string;
  ip?: string;
  name?: string;
  model?: string;
  firmwareVersion?: string;
  type?: string;
  state?: string;
  features?: Record<string, unknown>;
};

export type CloudIspMetrics = {
  periods?: Array<{
    latency?: number;
    uptime?: number;
    downstreamBandwidth?: number;
    upstreamBandwidth?: number;
  }>;
};

export type UnifiCloudClientOptions = {
  apiKey: string;
  timeoutMs?: number;
};

export class UnifiCloudClient {
  private readonly apiKey: string;
  private readonly timeoutMs: number;

  constructor(opts: UnifiCloudClientOptions) {
    this.apiKey = opts.apiKey;
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  private async request<T>(path: string): Promise<T> {
    const url = `${CLOUD_BASE_URL}${path}`;
    const res = await fetch(url, {
      headers: {
        "X-API-Key": this.apiKey,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    if (!res.ok) {
      throw new Error(`UniFi Cloud API error: ${res.status} ${res.statusText} (${path})`);
    }

    return (await res.json()) as T;
  }

  async getHosts(): Promise<CloudHost[]> {
    const body = await this.request<{ data?: CloudHost[] }>("/ea/hosts");
    return body.data ?? [];
  }

  async getHostById(hostId: string): Promise<CloudHost | null> {
    try {
      const body = await this.request<{ data?: CloudHost }>(`/ea/hosts/${hostId}`);
      return body.data ?? null;
    } catch {
      return null;
    }
  }

  async getSites(): Promise<CloudSite[]> {
    const body = await this.request<{ data?: CloudSite[] }>("/ea/sites");
    return body.data ?? [];
  }

  async getDevices(hostId?: string): Promise<CloudDevice[]> {
    const query = hostId ? `?hostIds=${hostId}` : "";
    const body = await this.request<{ data?: CloudDevice[] }>(`/ea/devices${query}`);
    return body.data ?? [];
  }

  async getIspMetrics(siteId: string): Promise<CloudIspMetrics> {
    return this.request<CloudIspMetrics>(`/ea/isp-metrics/site/${siteId}`);
  }

  async isAvailable(): Promise<boolean> {
    try {
      await this.getHosts();
      return true;
    } catch {
      return false;
    }
  }

  // Map cloud devices to the local UnifiDevice format for compatibility
  mapToLocalDevices(cloudDevices: CloudDevice[]): UnifiDevice[] {
    return cloudDevices.map((d) => ({
      _id: d.id ?? d.mac,
      mac: d.mac,
      ip: d.ip ?? "",
      name: d.name ?? "",
      model: d.model ?? "",
      type: d.type ?? "",
      version: d.firmwareVersion ?? "",
      uptime: 0,
      state: d.state === "ONLINE" ? 1 : 0,
      adopted: true,
    }));
  }

  // Build basic health view from cloud host data
  mapToLocalHealth(host: CloudHost): UnifiHealthSubsystem[] {
    const health: UnifiHealthSubsystem[] = [];
    if (host.reportedState) {
      health.push({
        subsystem: "wan",
        status: host.isBlocked ? "error" : "ok",
        uptime: host.reportedState.uptime,
      });
    }
    return health;
  }
}

// ---------------------------------------------------------------------------
// Config loader
// ---------------------------------------------------------------------------

export function loadCloudApiKey(): string {
  const key = process.env.UNIFI_CLOUD_API_KEY;
  if (!key) {
    throw new Error("UNIFI_CLOUD_API_KEY environment variable is required");
  }
  return key;
}
