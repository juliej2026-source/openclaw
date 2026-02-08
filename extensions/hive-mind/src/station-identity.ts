import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { StationIdentity, LayerInfo, LayerStatus, ModelSummary } from "./types.js";
import {
  STATION_ID,
  STATION_IP,
  STATION_PORT,
  STATION_VERSION,
  ALL_CAPABILITIES,
} from "./types.js";

type IdentityOptions = {
  openclawDir?: string;
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
  };
}
