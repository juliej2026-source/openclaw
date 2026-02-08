import type { UnifiHealthSubsystem } from "./unifi-types.js";
import { KNOWN_STATIONS } from "./unifi-types.js";

// ---------------------------------------------------------------------------
// UDM Pro system info (unauthenticated /api/system endpoint)
// ---------------------------------------------------------------------------

export type UdmSystemInfo = {
  name: string;
  mac: string;
  model: string;
  cloudConnected: boolean;
  hasInternet: boolean;
  isSsoEnabled: boolean;
  remoteAccessEnabled: boolean;
  deviceState: string;
  directConnectDomain?: string;
  lastChecked: string;
};

export async function fetchUdmSystemInfo(host: string): Promise<UdmSystemInfo | null> {
  try {
    const res = await fetch(`https://${host}/api/system`, {
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) {
      return null;
    }
    const data = (await res.json()) as Record<string, unknown>;
    const hw = data.hardware as Record<string, string> | undefined;
    return {
      name: String(data.name ?? ""),
      mac: String(data.mac ?? ""),
      model: hw?.shortname ?? "unknown",
      cloudConnected: Boolean(data.cloudConnected),
      hasInternet: Boolean(data.hasInternet),
      isSsoEnabled: Boolean(data.isSsoEnabled),
      remoteAccessEnabled: Boolean(data.remoteAccessEnabled),
      deviceState: String(data.deviceState ?? "unknown"),
      directConnectDomain: data.directConnectDomain ? String(data.directConnectDomain) : undefined,
      lastChecked: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Station ping (HTTP health check)
// ---------------------------------------------------------------------------

export type StationPingResult = {
  ip: string;
  label?: string;
  reachable: boolean;
  latencyMs?: number;
};

export async function pingStation(ip: string, port: number): Promise<StationPingResult> {
  const label = KNOWN_STATIONS[ip];
  const start = Date.now();
  try {
    await fetch(`http://${ip}:${port}/health`, {
      signal: AbortSignal.timeout(3_000),
    });
    return {
      ip,
      label,
      reachable: true,
      latencyMs: Date.now() - start,
    };
  } catch {
    return { ip, label, reachable: false };
  }
}

export async function scanStations(port: number): Promise<StationPingResult[]> {
  const ips = Object.keys(KNOWN_STATIONS);
  return Promise.all(ips.map((ip) => pingStation(ip, port)));
}

// ---------------------------------------------------------------------------
// Network scan result
// ---------------------------------------------------------------------------

export type NetworkScanResult = {
  timestamp: string;
  udm: UdmSystemInfo | null;
  stations: StationPingResult[];
  health: UnifiHealthSubsystem[];
};

// ---------------------------------------------------------------------------
// Network scanner (background polling)
// ---------------------------------------------------------------------------

export type NetworkScannerOptions = {
  udmHost: string;
  stationPort: number;
  intervalMs?: number;
};

export function createNetworkScanner(opts: NetworkScannerOptions) {
  const { udmHost, stationPort } = opts;
  const intervalMs = opts.intervalMs ?? 30_000;
  let intervalId: ReturnType<typeof setInterval> | undefined;
  let latestScan: NetworkScanResult | null = null;

  async function scan(): Promise<void> {
    const [udm, stations] = await Promise.all([
      fetchUdmSystemInfo(udmHost),
      scanStations(stationPort),
    ]);

    const health: UnifiHealthSubsystem[] = [];
    if (udm) {
      health.push({
        subsystem: "wan",
        status: udm.hasInternet ? "ok" : "error",
        wan_ip: udm.directConnectDomain,
        gw_version: udm.deviceState,
      });
    }

    latestScan = {
      timestamp: new Date().toISOString(),
      udm,
      stations,
      health,
    };
  }

  return {
    id: "network-scanner",

    async start(): Promise<void> {
      await scan();
      intervalId = setInterval(() => {
        scan().catch(() => {});
      }, intervalMs);
    },

    stop(): void {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = undefined;
      }
    },

    getLatestScan(): NetworkScanResult | null {
      return latestScan;
    },
  };
}
