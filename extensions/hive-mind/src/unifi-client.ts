import type {
  UnifiConfig,
  UnifiDevice,
  UnifiClientEntry,
  UnifiHealthSubsystem,
  UnifiAlert,
  UnifiEvent,
} from "./unifi-types.js";

const DEFAULT_TIMEOUT_MS = 15_000;

export type UnifiClientOptions = {
  config: UnifiConfig;
  timeoutMs?: number;
  // Injected dispatcher for self-signed SSL (undici Agent) or testing
  dispatcher?: unknown;
};

export class UnifiClient {
  private readonly config: UnifiConfig;
  private readonly timeoutMs: number;
  private readonly dispatcher: unknown;
  private cookie: string | undefined;

  constructor(opts: UnifiClientOptions) {
    this.config = opts.config;
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.dispatcher = opts.dispatcher;
  }

  async login(): Promise<void> {
    const url = `https://${this.config.host}/api/auth/login`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: this.config.username,
        password: this.config.password,
      }),
      signal: AbortSignal.timeout(this.timeoutMs),
      ...(this.dispatcher ? { dispatcher: this.dispatcher } : {}),
    } as RequestInit);

    if (!res.ok) {
      throw new Error(`UniFi login failed: ${res.status} ${res.statusText}`);
    }

    const setCookie = res.headers.get("set-cookie") ?? "";
    const match = setCookie.match(/TOKEN=([^;]+)/);
    if (!match) {
      throw new Error("UniFi login: no TOKEN cookie in response");
    }
    this.cookie = match[1];
  }

  private siteUrl(endpoint: string): string {
    return `https://${this.config.host}/proxy/network/api/s/${this.config.site}/${endpoint}`;
  }

  private async request<T>(path: string): Promise<T> {
    if (!this.cookie) {
      await this.login();
    }

    const doFetch = async (): Promise<Response> => {
      return fetch(path, {
        headers: { Cookie: `TOKEN=${this.cookie}` },
        signal: AbortSignal.timeout(this.timeoutMs),
        ...(this.dispatcher ? { dispatcher: this.dispatcher } : {}),
      } as RequestInit);
    };

    let res = await doFetch();
    if (res.status === 401) {
      await this.login();
      res = await doFetch();
    }

    if (!res.ok) {
      throw new Error(`UniFi API error: ${res.status} ${res.statusText} (${path})`);
    }

    const body = (await res.json()) as { data?: T };
    return (body.data ?? body) as T;
  }

  async getDevices(): Promise<UnifiDevice[]> {
    return this.request<UnifiDevice[]>(this.siteUrl("stat/device"));
  }

  async getClients(): Promise<UnifiClientEntry[]> {
    return this.request<UnifiClientEntry[]>(this.siteUrl("stat/sta"));
  }

  async getHealth(): Promise<UnifiHealthSubsystem[]> {
    return this.request<UnifiHealthSubsystem[]>(this.siteUrl("stat/health"));
  }

  async getAlerts(): Promise<UnifiAlert[]> {
    return this.request<UnifiAlert[]>(this.siteUrl("stat/alarm"));
  }

  async getEvents(limit = 50): Promise<UnifiEvent[]> {
    return this.request<UnifiEvent[]>(this.siteUrl(`stat/event?_limit=${limit}`));
  }

  async isAvailable(): Promise<boolean> {
    try {
      await this.login();
      return true;
    } catch {
      return false;
    }
  }
}

export function loadUnifiConfig(): UnifiConfig {
  const host = process.env.UNIFI_HOST ?? "10.1.8.1";
  const username = process.env.UNIFI_USERNAME;
  const password = process.env.UNIFI_PASSWORD;
  const site = process.env.UNIFI_SITE ?? "default";

  if (!username || !password) {
    throw new Error("UNIFI_USERNAME and UNIFI_PASSWORD environment variables are required");
  }

  return { host, username, password, site };
}
