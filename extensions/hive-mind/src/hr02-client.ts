// ---------------------------------------------------------------------------
// NTT Docomo HR02 5G Modem Client
// Admin interface at http://192.168.128.1 (reachable only on HR02 WiFi)
// ---------------------------------------------------------------------------

export const HR02_ADMIN_URL = "http://192.168.128.1";
const DEFAULT_TIMEOUT_MS = 5_000;

export type Hr02Status = {
  connected: boolean;
  signal_strength_pct: number | null;
  band: string | null;
  technology: string | null;
  download_speed_mbps: number | null;
  upload_speed_mbps: number | null;
  ip_address: string | null;
  uptime_seconds: number | null;
  fetched_at: string;
};

export type Hr02ClientOptions = {
  adminUrl?: string;
  timeoutMs?: number;
};

export class Hr02Client {
  private readonly adminUrl: string;
  private readonly timeoutMs: number;

  constructor(opts?: Hr02ClientOptions) {
    this.adminUrl = opts?.adminUrl ?? HR02_ADMIN_URL;
    this.timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async isReachable(): Promise<boolean> {
    try {
      await fetch(`${this.adminUrl}/`, {
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      return true;
    } catch {
      return false;
    }
  }

  async getStatus(): Promise<Hr02Status> {
    const res = await fetch(`${this.adminUrl}/api/monitoring/status`, {
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    const data = (await res.json()) as Record<string, unknown>;

    return {
      connected: true,
      signal_strength_pct: typeof data.signal_strength === "number" ? data.signal_strength : null,
      band: typeof data.band === "string" ? data.band : null,
      technology: typeof data.technology === "string" ? data.technology : null,
      download_speed_mbps: typeof data.download_speed === "number" ? data.download_speed : null,
      upload_speed_mbps: typeof data.upload_speed === "number" ? data.upload_speed : null,
      ip_address: typeof data.ip_address === "string" ? data.ip_address : null,
      uptime_seconds: typeof data.uptime === "number" ? data.uptime : null,
      fetched_at: new Date().toISOString(),
    };
  }
}

// ---------------------------------------------------------------------------
// Convenience function: returns status or disconnected stub
// ---------------------------------------------------------------------------

function disconnectedStub(): Hr02Status {
  return {
    connected: false,
    signal_strength_pct: null,
    band: null,
    technology: null,
    download_speed_mbps: null,
    upload_speed_mbps: null,
    ip_address: null,
    uptime_seconds: null,
    fetched_at: new Date().toISOString(),
  };
}

export async function fetchHr02Status(opts?: Hr02ClientOptions): Promise<Hr02Status> {
  try {
    const client = new Hr02Client(opts);
    return await client.getStatus();
  } catch {
    return disconnectedStub();
  }
}
