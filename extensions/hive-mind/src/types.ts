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
  | "neural_graph";

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
// JULIA hive mind communication
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

export type RegistrationPayload = {
  agent_id: string;
  identity_data: {
    capabilities: StationCapability[];
    availableModels: string[];
    version: string;
    platform: string;
    layers: Record<string, LayerInfo>;
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
// Local execution log
// ---------------------------------------------------------------------------

export type ExecutionLogEntry = {
  id: string;
  timestamp: string;
  command?: string;
  task_type: string;
  success: boolean;
  latency_ms: number;
  reported_to_julia: boolean;
};

export type ExecutionLogData = {
  version: 1;
  entries: ExecutionLogEntry[];
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const STATION_ID = "iot-hub";
export const STATION_IP = "10.1.7.158";
export const STATION_PORT = 3001;
export const STATION_VERSION = "1.0.0";

export const JULIA_BASE_URL = "http://10.1.7.87:8000";
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
];
