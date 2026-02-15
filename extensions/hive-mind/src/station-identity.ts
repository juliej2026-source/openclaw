import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type {
  StationIdentity,
  LayerInfo,
  LayerStatus,
  ModelSummary,
  RuntimeState,
} from "./types.js";
import {
  STATION_ID,
  STATION_IP,
  STATION_PORT,
  STATION_VERSION,
  ALL_CAPABILITIES,
} from "./types.js";

export type RuntimeContext = {
  discordConnected?: boolean;
  discordGatewayActive?: boolean;
  discordGuildId?: string;
  discordChannels?: string[];
  discordSlashCommandCount?: number;
  activeWanPath?: string;
  failoverActive?: boolean;
  scannerRunning?: boolean;
  stationsOnline?: number;
  stationsTotal?: number;
  activeAlertCount?: number;
  totalAlertCount?: number;
};

type IdentityOptions = {
  openclawDir?: string;
  runtimeContext?: RuntimeContext;
  commands?: string[];
  endpoints?: Array<{ path: string; method: string }>;
};

function resolveOpenclawDir(opts?: IdentityOptions): string {
  return opts?.openclawDir
    ? path.join(opts.openclawDir, ".openclaw")
    : path.join(process.env.HOME ?? os.homedir(), ".openclaw");
}

function fileExists(filePath: string): boolean {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function readJsonSafe<T>(filePath: string, fallback: T): T {
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function loadModels(openclawDir: string): ModelSummary[] {
  const inventoryPath = path.join(openclawDir, "model-manager", "inventory.json");
  const data = readJsonSafe<{ models?: Array<Record<string, unknown>> }>(inventoryPath, {});
  if (!data.models) {
    return [];
  }

  return data.models.map((m) => ({
    id: String(m.id ?? ""),
    family: m.family ? String(m.family) : undefined,
    parameterCount: m.parameterCount ? String(m.parameterCount) : undefined,
    capabilities: Array.isArray(m.capabilities) ? (m.capabilities as string[]) : [],
    running: false,
  }));
}

function detectLayerStatus(openclawDir: string, subdir: string, dataFile: string): LayerStatus {
  const filePath = path.join(openclawDir, subdir, dataFile);
  return fileExists(filePath) ? "active" : "unavailable";
}

function detectHuggingFaceStatus(): LayerStatus {
  if (process.env.HF_TOKEN) return "active";
  try {
    const tokenPath = path.join(process.env.HOME ?? os.homedir(), ".cache", "huggingface", "token");
    return fileExists(tokenPath) ? "active" : "unavailable";
  } catch {
    return "unavailable";
  }
}

function detectNeuralGraphStatus(): LayerStatus {
  // Check if Convex is reachable (non-blocking best-effort)
  try {
    const url = process.env.CONVEX_URL ?? "http://127.0.0.1:3210";
    // Sync check: if the neural-graph extension directory exists, mark active
    const extensionPath = path.resolve(import.meta.dirname, "../../neural-graph/index.ts");
    return fileExists(extensionPath) ? "active" : "unavailable";
  } catch {
    return "unavailable";
  }
}

function detectDiscordStatus(): LayerStatus {
  return process.env.DISCORD_BOT_TOKEN ? "active" : "unavailable";
}

function buildLayers(openclawDir: string): Record<string, LayerInfo> {
  return {
    model_manager: {
      name: "Model Manager",
      description:
        "Hardware detection, model discovery, lifecycle management, inventory, HuggingFace search",
      tools: [
        "local_model_list",
        "local_model_pull",
        "local_model_remove",
        "local_model_info",
        "local_hardware_info",
      ],
      cli_commands: 6,
      hooks: ["gateway_start"],
      providers: ["local-models"],
      status: detectLayerStatus(openclawDir, "model-manager", "inventory.json"),
    },
    meta_engine: {
      name: "Meta-Engine",
      description: "Task classification, model scoring, performance tracking, autonomous routing",
      tools: ["meta_model_select", "meta_model_status", "meta_model_override"],
      cli_commands: 3,
      hooks: ["before_agent_start", "agent_end"],
      providers: [],
      status: detectLayerStatus(openclawDir, "meta-engine", "performance.json"),
    },
    model_trainer: {
      name: "Model Trainer",
      description:
        "Dataset collection, validation, training (Ollama Modelfile + QLoRA), adapter management, evaluation",
      tools: [
        "training_data_collect",
        "training_start",
        "training_status",
        "adapter_list",
        "model_eval",
      ],
      cli_commands: 6,
      hooks: ["agent_end"],
      providers: [],
      // Trainer doesn't need a persistent data file to be "active" — it creates on demand
      status: "active",
    },
    neural_graph: {
      name: "Neural Graph",
      description:
        "LangGraph + Convex backbone — graph orchestration, maturation lifecycle, evolution, cross-station replication",
      tools: ["neural_query", "neural_topology", "neural_evolve", "neural_approve"],
      cli_commands: 4,
      hooks: ["gateway_start", "agent_end"],
      providers: ["convex", "langgraph"],
      status: detectNeuralGraphStatus(),
    },
    huggingface: {
      name: "HuggingFace Manager",
      description: "HF Hub account management — spaces, datasets, models, and jobs",
      tools: ["hf_spaces_list", "hf_datasets_list", "hf_models_list", "hf_jobs_list", "hf_status"],
      cli_commands: 0,
      hooks: [],
      providers: ["huggingface"],
      status: detectHuggingFaceStatus(),
    },
    hotel_scraper: {
      name: "Hotel Scraper",
      description:
        "Niseko hotel price comparison — 5 data sources, entity resolution, scheduling, Prometheus metrics",
      tools: ["hotel_scrape", "hotel_prices", "hotel_compare", "hotel_resolve"],
      cli_commands: 6,
      hooks: ["gateway_start"],
      providers: ["ratehawk", "apify", "nisade", "playwright", "roomboss"],
      status: "active",
    },
    discord_gateway: {
      name: "Discord Gateway",
      description:
        "Bidirectional Discord control — REST notifications, WebSocket Gateway, slash commands, message commands, button interactions, 7 channels",
      tools: ["discord_notify", "discord_slash", "discord_message", "discord_button"],
      cli_commands: 0,
      hooks: ["alert_fired", "scan_complete", "failover_triggered"],
      providers: ["discord"],
      status: detectDiscordStatus(),
    },
    network_control: {
      name: "Network Control",
      description:
        "Dual-WAN management, failover, alert lifecycle, 5G modem control, network scanning",
      tools: ["network_scan", "network_switch", "alert_ack", "failover_status"],
      cli_commands: 0,
      hooks: ["scan_complete"],
      providers: ["udm-pro", "hr02-5g"],
      status: "active",
    },
  };
}

function buildRuntimeState(ctx?: RuntimeContext): RuntimeState | undefined {
  if (!ctx) return undefined;
  return {
    discord:
      ctx.discordConnected != null
        ? {
            connected: ctx.discordConnected,
            gateway_active: ctx.discordGatewayActive ?? false,
            guild_id: ctx.discordGuildId,
            channels: ctx.discordChannels ?? [],
            slash_commands: ctx.discordSlashCommandCount ?? 0,
          }
        : undefined,
    network:
      ctx.activeWanPath != null
        ? {
            active_path: ctx.activeWanPath,
            failover_active: ctx.failoverActive ?? false,
            scanner_running: ctx.scannerRunning ?? false,
            stations_online: ctx.stationsOnline ?? 0,
            stations_total: ctx.stationsTotal ?? 0,
          }
        : undefined,
    alerts:
      ctx.activeAlertCount != null
        ? {
            active_count: ctx.activeAlertCount,
            total_count: ctx.totalAlertCount ?? 0,
          }
        : undefined,
    uptime_seconds: Math.floor(os.uptime()),
  };
}

export function buildStationIdentity(opts?: IdentityOptions): StationIdentity {
  const openclawDir = resolveOpenclawDir(opts);

  return {
    station_id: STATION_ID,
    hostname: os.hostname(),
    ip_address: STATION_IP,
    port: STATION_PORT,
    platform: process.platform,
    arch: process.arch,
    version: STATION_VERSION,
    uptime_seconds: Math.floor(os.uptime()),
    capabilities: [...ALL_CAPABILITIES],
    layers: buildLayers(openclawDir),
    models: loadModels(openclawDir),
    commands: opts?.commands,
    endpoints: opts?.endpoints,
    runtime: buildRuntimeState(opts?.runtimeContext),
  };
}
