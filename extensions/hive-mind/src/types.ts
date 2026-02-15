// ---------------------------------------------------------------------------
// Station identity
// ---------------------------------------------------------------------------

export type StationCapability =
  | "model_management"
  | "model_training"
  | "task_classification"
  | "hardware_detection"
  | "model_scoring"
  | "dataset_curation"
  | "lora_adapters"
  | "model_evaluation"
  | "huggingface_search"
  | "iot"
  | "smart_home"
  | "sensors"
  | "network_monitoring"
  | "dual_wan"
  | "linux"
  | "neural_graph"
  | "web_scraping"
  | "data_collection"
  | "huggingface_management"
  | "hotel_scraping"
  | "price_comparison"
  | "discord_notifications"
  | "discord_gateway"
  | "discord_commands"
  | "network_control"
  | "alert_management"
  | "niseko_intel"
  | "price_monitoring"
  | "anomaly_detection"
  | "local_llm"
  | "family_report"
  | "tandem_tasks"
  | "julie_delegation"
  | "bravia_control"
  | "cloud_apache";

export type LayerStatus = "active" | "degraded" | "unavailable";

export type LayerInfo = {
  name: string;
  description: string;
  tools: string[];
  cli_commands: number;
  hooks: string[];
  providers: string[];
  status: LayerStatus;
};

export type ModelSummary = {
  id: string;
  family?: string;
  parameterCount?: string;
  capabilities: string[];
  running: boolean;
};

export type StationIdentity = {
  station_id: string;
  hostname: string;
  ip_address: string;
  port: number;
  platform: string;
  arch: string;
  version: string;
  uptime_seconds: number;
  capabilities: StationCapability[];
  layers: Record<string, LayerInfo>;
  models: ModelSummary[];
  commands?: string[];
  endpoints?: Array<{ path: string; method: string }>;
  runtime?: RuntimeState;
  last_registered?: string;
};

// ---------------------------------------------------------------------------
// Network command protocol
// ---------------------------------------------------------------------------

export type NetworkCommand = {
  command: string;
  params?: Record<string, unknown>;
  request_id?: string;
};

export type CommandResponse = {
  success: boolean;
  command: string;
  request_id?: string;
  data?: unknown;
  error?: string;
  latency_ms: number;
};

// ---------------------------------------------------------------------------
// Julie hive mind communication
// ---------------------------------------------------------------------------

export type ExecutionRecord = {
  station_id: string;
  agent_id?: string;
  task_type: string;
  success: boolean;
  latency_ms: number;
  quality_score?: number;
  capabilities_used: string[];
  timestamp: string;
};

export type RuntimeState = {
  discord?: {
    connected: boolean;
    gateway_active: boolean;
    guild_id?: string;
    channels: string[];
    slash_commands: number;
  };
  network?: {
    active_path: string;
    failover_active: boolean;
    scanner_running: boolean;
    stations_online: number;
    stations_total: number;
  };
  alerts?: {
    active_count: number;
    total_count: number;
  };
  uptime_seconds: number;
};

export type RegistrationPayload = {
  agent_id: string;
  identity_data: {
    capabilities: StationCapability[];
    availableModels: string[];
    version: string;
    platform: string;
    layers: Record<string, LayerInfo>;
    commands?: string[];
    endpoints?: Array<{ path: string; method: string }>;
    runtime?: RuntimeState;
  };
};

export type RegistrationResponse = {
  success: boolean;
  agent_id: string;
  capabilities?: StationCapability[];
  dynamic?: boolean;
};

export type ExecutionReportResponse = {
  received: boolean;
};

// ---------------------------------------------------------------------------
// Tandem tasks & delegation (peer-to-peer protocol)
// ---------------------------------------------------------------------------

export type TandemTaskRequest = {
  task_id: string;
  from_station: string;
  task_type: string;
  payload: Record<string, unknown>;
  callback_url: string;
  timeout_ms?: number;
};

export type TandemTaskResponse = {
  accepted: boolean;
  task_id: string;
  station_id: string;
  error?: string;
};

export type TandemTaskCallback = {
  task_id: string;
  station_id: string;
  success: boolean;
  result?: unknown;
  error?: string;
  latency_ms: number;
};

export type DelegationRequest = {
  task_id: string;
  from_station: string;
  delegated_by?: string;
  command: string;
  params?: Record<string, unknown>;
  callback_url?: string;
};

export type DelegationResponse = {
  accepted: boolean;
  task_id: string;
  station_id: string;
  error?: string;
};

export type PeerStation = {
  station_id: string;
  ip: string;
  port: number;
  capabilities: string[];
  endpoints: Array<{ path: string; method: string }>;
  platform?: string;
  llm_model?: string;
  last_seen?: string;
  reachable: boolean;
};

// ---------------------------------------------------------------------------
// Local execution log
// ---------------------------------------------------------------------------

export type ExecutionLogEntry = {
  id: string;
  timestamp: string;
  command?: string;
  task_type: string;
  success: boolean;
  latency_ms: number;
  reported_to_julie: boolean;
};

export type ExecutionLogData = {
  version: 1;
  entries: ExecutionLogEntry[];
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const STATION_ID = "iot-hub";
export const STATION_IP = "10.1.8.158";
export const STATION_PORT = 3001;
export const STATION_VERSION = "1.0.0";

export const JULIE_BASE_URL = "http://10.1.8.143:8000";
export const REGISTRATION_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export const ALL_CAPABILITIES: StationCapability[] = [
  "model_management",
  "model_training",
  "task_classification",
  "hardware_detection",
  "model_scoring",
  "dataset_curation",
  "lora_adapters",
  "model_evaluation",
  "huggingface_search",
  "iot",
  "smart_home",
  "sensors",
  "network_monitoring",
  "dual_wan",
  "linux",
  "neural_graph",
  "web_scraping",
  "data_collection",
  "huggingface_management",
  "hotel_scraping",
  "price_comparison",
  "discord_notifications",
  "discord_gateway",
  "discord_commands",
  "network_control",
  "alert_management",
  "tandem_tasks",
  "julie_delegation",
  "bravia_control",
  "cloud_apache",
];

/** Known peer stations for tandem/delegation routing. */
export const PEER_STATIONS: PeerStation[] = [
  {
    station_id: "julie",
    ip: "10.1.8.143",
    port: 8000,
    capabilities: [
      "social_monitoring",
      "telegram_integration",
      "social_analytics",
      "content_analysis",
      "sentiment_analysis",
      "trend_detection",
      "julie_delegation",
      "tandem_tasks",
    ],
    endpoints: [
      { path: "/health", method: "GET" },
      { path: "/api/network/ping", method: "GET" },
      { path: "/api/network/command", method: "POST" },
      { path: "/api/v1/orchestration/hive/register", method: "POST" },
      { path: "/api/v1/orchestration/hive/record", method: "POST" },
      { path: "/api/network/delegation/inbound", method: "POST" },
      { path: "/api/network/delegation/callback", method: "POST" },
      { path: "/api/network/tandem", method: "POST" },
      { path: "/api/network/tandem/callback", method: "POST" },
    ],
    platform: "linux",
    reachable: false,
  },
  {
    station_id: "caesar",
    ip: "10.1.8.82",
    port: 3001,
    capabilities: ["tandem_tasks", "julie_delegation"],
    endpoints: [
      { path: "/health", method: "GET" },
      { path: "/api/network/ping", method: "GET" },
      { path: "/api/network/command", method: "POST" },
      { path: "/api/network/delegation/inbound", method: "POST" },
      { path: "/api/network/delegation/callback", method: "POST" },
      { path: "/api/network/tandem", method: "POST" },
      { path: "/api/network/tandem/callback", method: "POST" },
    ],
    reachable: false,
  },
];
