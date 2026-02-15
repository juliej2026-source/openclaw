import dgram from "node:dgram";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const BRAVIA_DEFAULT_HOST = "10.1.8.194";
const DEFAULT_TIMEOUT = 5_000;
const CAST_PORT = 8008;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BraviaConfig = {
  host: string;
  psk?: string;
  timeoutMs?: number;
};

export type BraviaInput = {
  uri: string;
  title: string;
  connected: boolean;
  icon: string;
};

export type BraviaCastInfo = {
  name: string;
  buildVersion: string;
  ethernetConnected: boolean;
  ipAddress: string;
  uptime: number;
};

export type BraviaStatus = {
  power: "active" | "standby" | "unknown";
  model: string;
  apiVersion: string;
  volume: { level: number; muted: boolean; maxVolume: number };
  inputs: BraviaInput[];
  apps: { textInput: boolean; cursorDisplay: boolean; webBrowse: boolean };
  powerSaving: string;
  time: string;
  wolMac: string;
  soundbar: { connected: boolean; name: string } | null;
  cast: BraviaCastInfo | null;
  fetchedAt: string;
};

// ---------------------------------------------------------------------------
// BraviaClient
// ---------------------------------------------------------------------------

export class BraviaClient {
  private readonly host: string;
  private readonly psk: string | undefined;
  private readonly timeoutMs: number;
  private remoteCodeCache: Map<string, string> | null = null;

  constructor(config: BraviaConfig) {
    this.host = config.host;
    this.psk = config.psk;
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT;
  }

  // -----------------------------------------------------------------------
  // Low-level helpers
  // -----------------------------------------------------------------------

  private jsonRpcHeaders(withPsk: boolean): Record<string, string> {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (withPsk && this.psk) h["X-Auth-PSK"] = this.psk;
    return h;
  }

  private async callSony(
    service: string,
    method: string,
    params: unknown[] = [],
    version = "1.0",
    requirePsk = false,
  ): Promise<unknown> {
    const res = await fetch(`http://${this.host}/sony/${service}`, {
      method: "POST",
      headers: this.jsonRpcHeaders(requirePsk),
      body: JSON.stringify({ method, id: 1, params, version }),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!res.ok) throw new Error(`BRAVIA ${method} HTTP ${res.status}`);
    const data = (await res.json()) as Record<string, unknown>;
    if (data.error) {
      throw new Error(`BRAVIA ${method} error: ${JSON.stringify(data.error)}`);
    }
    return data.result;
  }

  // -----------------------------------------------------------------------
  // Read methods (no auth)
  // -----------------------------------------------------------------------

  async isReachable(): Promise<boolean> {
    try {
      const result = await this.callSony("system", "getPowerStatus");
      const status = ((result as unknown[])[0] as Record<string, string>)?.status;
      return status === "active" || status === "standby";
    } catch {
      return false;
    }
  }

  async getPowerStatus(): Promise<string> {
    try {
      const result = (await this.callSony("system", "getPowerStatus")) as unknown[];
      const status = (result[0] as Record<string, string>)?.status;
      return status ?? "unknown";
    } catch {
      return "unknown";
    }
  }

  async getVolume(): Promise<{ level: number; muted: boolean; maxVolume: number }> {
    try {
      const result = (await this.callSony("audio", "getVolumeInformation")) as unknown[];
      const entries = result[0] as Array<Record<string, unknown>>;
      const speaker = entries?.find?.((e) => e.target === "speaker") ?? entries?.[0];
      if (!speaker) return { level: 0, muted: false, maxVolume: 100 };
      return {
        level: (speaker.volume as number) ?? 0,
        muted: (speaker.mute as boolean) ?? false,
        maxVolume: (speaker.maxVolume as number) ?? 100,
      };
    } catch {
      return { level: 0, muted: false, maxVolume: 100 };
    }
  }

  async getInputs(): Promise<BraviaInput[]> {
    try {
      const result = (await this.callSony(
        "avContent",
        "getCurrentExternalInputsStatus",
      )) as unknown[];
      const raw = result[0] as Array<Record<string, unknown>>;
      return (raw ?? []).map((e) => ({
        uri: (e.uri as string) ?? "",
        title: (e.title as string) ?? "",
        connected: (e.connection as boolean) ?? false,
        icon: (e.icon as string) ?? "",
      }));
    } catch {
      return [];
    }
  }

  async getRemoteCodes(): Promise<Map<string, string>> {
    if (this.remoteCodeCache) return this.remoteCodeCache;

    const res = await fetch(`http://${this.host}/sony/system`, {
      method: "POST",
      headers: this.jsonRpcHeaders(false),
      body: JSON.stringify({
        method: "getRemoteControllerInfo",
        id: 1,
        params: [],
        version: "1.0",
      }),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    const data = (await res.json()) as { result: unknown[] };
    const codes = data.result[1] as Array<{ name: string; value: string }>;
    const map = new Map<string, string>();
    for (const c of codes ?? []) {
      map.set(c.name, c.value);
    }
    this.remoteCodeCache = map;
    return map;
  }

  async getCastInfo(): Promise<BraviaCastInfo | null> {
    try {
      const res = await fetch(`http://${this.host}:${CAST_PORT}/setup/eureka_info`, {
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      const data = (await res.json()) as Record<string, unknown>;
      return {
        name: (data.name as string) ?? "BRAVIA",
        buildVersion: (data.cast_build_revision as string) ?? "",
        ethernetConnected: (data.ethernet_connected as boolean) ?? false,
        ipAddress: (data.ip_address as string) ?? this.host,
        uptime: (data.uptime as number) ?? 0,
      };
    } catch {
      return null;
    }
  }

  async getStatus(): Promise<BraviaStatus> {
    const [power, iface, volume, inputs, appStatus, powerSave, time, supported, cast] =
      await Promise.all([
        this.getPowerStatus(),
        this.callSony("system", "getInterfaceInformation").catch(() => [{}]),
        this.getVolume(),
        this.getInputs(),
        this.callSony("appControl", "getApplicationStatusList").catch(() => [[]]),
        this.callSony("system", "getPowerSavingMode").catch(() => [{ mode: "unknown" }]),
        this.callSony("system", "getCurrentTime").catch(() => null),
        this.callSony("system", "getSystemSupportedFunction").catch(() => [[]]),
        this.getCastInfo(),
      ]);

    const ifaceData = (iface as unknown[])[0] as Record<string, string>;
    const appEntries = (appStatus as unknown[])[0] as Array<{ name: string; status: string }>;
    const powerSaveData = (powerSave as unknown[])[0] as Record<string, string>;
    const timeResult = time as unknown;
    const supportedFuncs = (supported as unknown[])[0] as Array<{ option: string; value: string }>;

    const appMap = new Map<string, boolean>();
    for (const e of appEntries ?? []) {
      appMap.set(e.name, e.status === "on");
    }

    const wolEntry = supportedFuncs?.find?.((f) => f.option === "WOL");
    const soundbar = inputs.find((i) => i.icon === "meta:playbackdevice" && i.connected);

    return {
      power: power as BraviaStatus["power"],
      model: ifaceData?.modelName ?? "unknown",
      apiVersion: ifaceData?.interfaceVersion ?? "unknown",
      volume,
      inputs,
      apps: {
        textInput: appMap.get("textInput") ?? false,
        cursorDisplay: appMap.get("cursorDisplay") ?? false,
        webBrowse: appMap.get("webBrowse") ?? false,
      },
      powerSaving: powerSaveData?.mode ?? "unknown",
      time: Array.isArray(timeResult) ? ((timeResult as string[])[0] ?? "") : "",
      wolMac: wolEntry?.value ?? "",
      soundbar: soundbar ? { connected: true, name: soundbar.title } : null,
      cast,
      fetchedAt: new Date().toISOString(),
    };
  }

  // -----------------------------------------------------------------------
  // Write methods (require PSK)
  // -----------------------------------------------------------------------

  async setPower(on: boolean): Promise<void> {
    await this.callSony("system", "setPowerStatus", [{ status: on }], "1.0", true);
  }

  async setVolume(level: number): Promise<void> {
    await this.callSony(
      "audio",
      "setAudioVolume",
      [{ target: "speaker", volume: String(level) }],
      "1.0",
      true,
    );
  }

  async setMute(muted: boolean): Promise<void> {
    await this.callSony("audio", "setAudioMute", [{ status: muted }], "1.0", true);
  }

  async switchInput(uri: string): Promise<void> {
    await this.callSony("avContent", "setPlayContent", [{ uri }], "1.0", true);
  }

  async launchApp(uri: string): Promise<void> {
    await this.callSony("appControl", "setActiveApp", [{ uri }], "1.0", true);
  }

  async sendIrcc(code: string): Promise<void> {
    const body = `<?xml version="1.0"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/"><s:Body><u:X_SendIRCC xmlns:u="urn:schemas-sony-com:service:IRCC:1"><IRCCCode>${code}</IRCCCode></u:X_SendIRCC></s:Body></s:Envelope>`;
    await fetch(`http://${this.host}/sony/IRCC`, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=UTF-8",
        SOAPACTION: '"urn:schemas-sony-com:service:IRCC:1#X_SendIRCC"',
        ...(this.psk ? { "X-Auth-PSK": this.psk } : {}),
      },
      body,
      signal: AbortSignal.timeout(this.timeoutMs),
    });
  }

  async sendRemoteKey(name: string): Promise<void> {
    const codes = await this.getRemoteCodes();
    const code = codes.get(name);
    if (!code) throw new Error(`Unknown remote key: "${name}"`);
    await this.sendIrcc(code);
  }

  async wakeOnLan(mac = "80:99:E7:27:A2:C6"): Promise<void> {
    const macBytes = Buffer.from(mac.replace(/:/g, ""), "hex");
    const magic = Buffer.alloc(102);
    magic.fill(0xff, 0, 6);
    for (let i = 0; i < 16; i++) {
      macBytes.copy(magic, 6 + i * 6);
    }
    const sock = dgram.createSocket("udp4");
    await new Promise<void>((resolve, reject) => {
      sock.send(magic, 0, magic.length, 9, "255.255.255.255", (err) => {
        sock.close();
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async reboot(): Promise<void> {
    await this.callSony("system", "requestReboot", [], "1.0", true);
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createBraviaClient(config?: Partial<BraviaConfig>): BraviaClient {
  return new BraviaClient({
    host: config?.host ?? process.env.BRAVIA_HOST ?? BRAVIA_DEFAULT_HOST,
    psk: config?.psk ?? process.env.BRAVIA_PSK,
    timeoutMs: config?.timeoutMs,
  });
}
