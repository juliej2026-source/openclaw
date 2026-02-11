// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export type UnifiConfig = {
  host: string;
  username: string;
  password: string;
  site: string;
};

export const UNIFI_API_KEY = "openclaw-network-2026-kelvin";

export const KNOWN_STATIONS: Record<string, string> = {
  "10.1.7.87": "Julie",
  "10.1.7.180": "SCRAPER", // decommissioned — functionality moved to IOT-HUB
  "10.1.7.239": "CLERK",
  "10.1.7.158": "IOT-HUB",
  "10.1.7.131": "Bravia TV",
};

export const DECOMMISSIONED_STATIONS = new Set(["10.1.7.180"]);

// ---------------------------------------------------------------------------
// UniFi API response types
// ---------------------------------------------------------------------------

export type UnifiDevice = {
  _id: string;
  mac: string;
  ip: string;
  name: string;
  model: string;
  type: string; // "ugw", "usw", "uap"
  version: string;
  uptime: number;
  state: number; // 1=connected
  adopted: boolean;
  satisfaction?: number;
  system_stats?: { cpu: string; mem: string; uptime: string };
  port_table?: UnifiPort[];
  num_sta?: number;
};

export type UnifiPort = {
  port_idx: number;
  name: string;
  up: boolean;
  speed: number;
  full_duplex?: boolean;
  rx_bytes: number;
  tx_bytes: number;
  poe_enable?: boolean;
  poe_power?: string;
};

export type UnifiClientEntry = {
  _id: string;
  mac: string;
  ip: string;
  hostname?: string;
  name?: string;
  oui?: string;
  network?: string;
  is_wired: boolean;
  is_guest?: boolean;
  rx_bytes: number;
  tx_bytes: number;
  tx_rate?: number;
  rx_rate?: number;
  uptime: number;
  last_seen?: number;
  satisfaction?: number;
  signal?: number;
  sw_mac?: string;
  sw_port?: number;
  ap_mac?: string;
};

export type UnifiHealthSubsystem = {
  subsystem: string; // "wan", "lan", "wlan"
  status: string; // "ok", "warn", "error"
  num_sta?: number;
  num_user?: number;
  num_ap?: number;
  num_sw?: number;
  num_adopted?: number;
  num_gw?: number;
  wan_ip?: string;
  isp_name?: string;
  latency?: number;
  uptime?: number;
  drops?: number;
  xput_up?: number;
  xput_down?: number;
  gw_version?: string;
  tx_bytes_r?: number;
  rx_bytes_r?: number;
};

export type UnifiAlert = {
  _id: string;
  key: string;
  msg: string;
  time: number;
  datetime?: string;
  subsystem?: string;
  archived: boolean;
};

export type UnifiEvent = {
  _id: string;
  key: string;
  msg: string;
  time: number;
  datetime?: string;
  subsystem?: string;
  user?: string;
};

// ---------------------------------------------------------------------------
// Enriched views
// ---------------------------------------------------------------------------

export type StationView = {
  ip: string;
  label: string;
  connected: boolean;
  mac?: string;
  is_wired?: boolean;
  uptime?: number;
  rx_bytes?: number;
  tx_bytes?: number;
  last_seen?: number;
  sw_port?: number;
};

export type UnifiSnapshot = {
  timestamp: string;
  stale: boolean;
  devices: UnifiDevice[];
  clients: UnifiClientEntry[];
  stations: StationView[];
  health: UnifiHealthSubsystem[];
  alerts: UnifiAlert[];
  events: UnifiEvent[];
};

// ---------------------------------------------------------------------------
// Polling
// ---------------------------------------------------------------------------

export type PollIntervals = {
  snapshotMs: number;
};

export const DEFAULT_POLL_INTERVALS: PollIntervals = {
  snapshotMs: 60_000,
};
