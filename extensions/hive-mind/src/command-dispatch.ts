import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { NetworkCommand, CommandResponse } from "./types.js";
import { buildStationIdentity } from "./station-identity.js";
import { STATION_ID } from "./types.js";

// ---------------------------------------------------------------------------
// Lazy imports from sibling extensions — resolved at first call
// ---------------------------------------------------------------------------

async function getClassifyTask() {
  const mod = await import("../../meta-engine/src/task-classifier.js");
  return mod.classifyTask;
}

async function getScoreModels() {
  const mod = await import("../../meta-engine/src/model-scorer.js");
  return mod.scoreModels;
}

async function getPerformanceDb() {
  const mod = await import("../../meta-engine/src/performance-db.js");
  return mod.PerformanceDb;
}

async function getRoutePrompt() {
  const mod = await import("../../meta-engine/src/router.js");
  return mod.routePrompt;
}

async function getDetectHardware() {
  const mod = await import("../../model-manager/src/hardware.js");
  return mod.detectHardware;
}

async function getOllamaClient() {
  const mod = await import("../../model-manager/src/ollama-client.js");
  return mod.OllamaClient;
}

async function getCreateJob() {
  const mod = await import("../../model-trainer/src/training/job-manager.js");
  return mod.createJob;
}

async function getListJobs() {
  const mod = await import("../../model-trainer/src/training/job-manager.js");
  return mod.listJobs;
}

async function getListAdapters() {
  const mod = await import("../../model-trainer/src/adapters/adapter-store.js");
  return mod.listAdapters;
}

async function getEvaluateModel() {
  const mod = await import("../../model-trainer/src/eval/evaluator.js");
  return mod.evaluateModel;
}

async function getSearchHuggingFace() {
  const mod = await import("../../model-manager/src/huggingface-client.js");
  return mod.searchHuggingFaceModels;
}

async function getListHuggingFaceGguf() {
  const mod = await import("../../model-manager/src/huggingface-client.js");
  return mod.listHuggingFaceGgufFiles;
}

async function getUnifiClient() {
  const { UnifiClient, loadUnifiConfig } = await import("./unifi-client.js");
  const config = loadUnifiConfig();
  return new UnifiClient({ config });
}

async function getUnifiSnapshot() {
  const { getCachedSnapshot } = await import("./unifi-api.js");
  return getCachedSnapshot();
}

async function getUnifiCloudClient() {
  const { UnifiCloudClient, loadCloudApiKey } = await import("./unifi-cloud-client.js");
  const apiKey = loadCloudApiKey();
  return new UnifiCloudClient({ apiKey });
}

async function getNeuralStatus() {
  const { handleNeuralStatus } = await import("../../neural-graph/src/api-handlers.js");
  return handleNeuralStatus;
}

async function getNeuralTopology() {
  const { handleNeuralTopology } = await import("../../neural-graph/src/api-handlers.js");
  return handleNeuralTopology;
}

async function getNeuralEvolve() {
  const { handleNeuralEvolve } = await import("../../neural-graph/src/api-handlers.js");
  return handleNeuralEvolve;
}

async function getNeuralQuery() {
  const { handleNeuralQuery } = await import("../../neural-graph/src/api-handlers.js");
  return handleNeuralQuery;
}

let networkScannerInstance: {
  getLatestScan: () => import("./network-scanner.js").NetworkScanResult | null;
} | null = null;

export function setNetworkScannerInstance(scanner: typeof networkScannerInstance): void {
  networkScannerInstance = scanner;
}

let dualNetworkInstance: {
  getState: () => import("./dual-network.js").DualNetworkState;
  getCurrentPath: () => import("./dual-network.js").NetworkPathId;
  switchToPath: (
    pathId: import("./dual-network.js").NetworkPathId,
  ) => Promise<import("./dual-network.js").SwitchResult>;
  testPathQuality: () => Promise<import("./dual-network.js").PathQuality>;
} | null = null;

export function setDualNetworkInstance(manager: typeof dualNetworkInstance): void {
  dualNetworkInstance = manager;
}

let alertManagerInstance: {
  emit: (
    type: import("./alert-manager.js").AlertType,
    message: string,
    opts?: {
      target?: string;
      severity?: import("./alert-manager.js").AlertSeverity;
      metadata?: Record<string, unknown>;
    },
  ) => import("./alert-manager.js").HiveAlert;
  getRecent: (limit?: number) => import("./alert-manager.js").HiveAlert[];
  getActive: () => import("./alert-manager.js").HiveAlert[];
  acknowledge: (alertId: string) => boolean;
  totalAlerts: number;
} | null = null;

export function setAlertManagerInstance(manager: typeof alertManagerInstance): void {
  alertManagerInstance = manager;
}

async function getNetworkScan() {
  if (networkScannerInstance) {
    return networkScannerInstance.getLatestScan();
  }
  // Fallback: do a one-shot scan
  const { fetchUdmSystemInfo, scanStations } = await import("./network-scanner.js");
  const [udm, stations] = await Promise.all([
    fetchUdmSystemInfo(process.env.UNIFI_HOST ?? "10.1.7.1"),
    scanStations(3001),
  ]);
  return { timestamp: new Date().toISOString(), udm, stations, health: [] };
}

// ---------------------------------------------------------------------------
// Inventory reader (same pattern as meta-engine/index.ts)
// ---------------------------------------------------------------------------

function readInventoryCandidates(): Array<{
  id: string;
  family?: string;
  parameterCount?: string;
  contextWindow: number;
  capabilities: string[];
  vramRequired?: number;
}> {
  try {
    const inventoryPath = path.join(
      process.env.HOME ?? os.homedir(),
      ".openclaw",
      "model-manager",
      "inventory.json",
    );
    const raw = fs.readFileSync(inventoryPath, "utf-8");
    const data = JSON.parse(raw) as { models?: Array<Record<string, unknown>> };
    return (data.models ?? []).map((m) => ({
      id: String(m.id ?? ""),
      family: m.family ? String(m.family) : undefined,
      parameterCount: m.parameterCount ? String(m.parameterCount) : undefined,
      contextWindow: (m.contextWindow as number) ?? 131_072,
      capabilities: Array.isArray(m.capabilities) ? (m.capabilities as string[]) : [],
      vramRequired: m.vramRequired as number | undefined,
    }));
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Command handlers
// ---------------------------------------------------------------------------

type CommandHandler = (params: Record<string, unknown>) => Promise<unknown>;

const HANDLERS: Record<string, CommandHandler> = {
  ping: async () => ({
    station_id: STATION_ID,
    status: "online",
    uptime_seconds: Math.floor(os.uptime()),
  }),

  capabilities: async () => buildStationIdentity(),

  "meta:classify": async (params) => {
    const text = params.text ?? params.task;
    if (!text || typeof text !== "string") {
      throw new Error("Missing required parameter: text");
    }
    const classifyTask = await getClassifyTask();
    return classifyTask(text);
  },

  "meta:score": async (params) => {
    const candidates = readInventoryCandidates();
    const taskType = params.task_type ?? "chat";
    // Build a minimal classification for scoring
    const classifyTask = await getClassifyTask();
    const classification = classifyTask(String(taskType));
    const scoreModels = await getScoreModels();
    const PerformanceDb = await getPerformanceDb();
    const perfDb = new PerformanceDb();
    const scores = scoreModels(candidates, classification, perfDb);
    return { task_type: taskType, scores };
  },

  "meta:recommend": async (params) => {
    const text = params.text ?? params.task;
    if (!text || typeof text !== "string") {
      throw new Error("Missing required parameter: text");
    }
    const candidates = readInventoryCandidates();
    const routePrompt = await getRoutePrompt();
    const PerformanceDb = await getPerformanceDb();
    const perfDb = new PerformanceDb();
    const decision = routePrompt(text, { candidates, perfDb });
    return decision;
  },

  "meta:hardware": async () => {
    const detectHardware = await getDetectHardware();
    return detectHardware();
  },

  "meta:models": async () => {
    const OllamaClient = await getOllamaClient();
    const client = new OllamaClient();
    const [installed, running] = await Promise.all([
      client.listModels().catch(() => []),
      client.listRunning().catch(() => []),
    ]);
    return {
      installed,
      running,
      installed_count: installed.length,
      running_count: running.length,
    };
  },

  "meta:status": async () => {
    const [hardware, models, engine] = await Promise.all([
      HANDLERS["meta:hardware"]!({}),
      HANDLERS["meta:models"]!({}),
      (async () => {
        const PerformanceDb = await getPerformanceDb();
        const perfDb = new PerformanceDb();
        return { summary: perfDb.getSummary(), totalRecords: perfDb.totalRecords };
      })(),
    ]);
    return { hardware, models, engine };
  },

  "meta:train": async (params) => {
    const dataset = params.dataset;
    const baseModel = params.base_model;
    const method = params.method ?? "ollama-modelfile";
    if (!dataset || typeof dataset !== "string") {
      throw new Error("Missing required parameter: dataset");
    }
    if (!baseModel || typeof baseModel !== "string") {
      throw new Error("Missing required parameter: base_model");
    }
    const createJob = await getCreateJob();
    const job = createJob({
      baseModel,
      datasetId: dataset,
      method: method as "ollama-modelfile" | "unsloth-qlora",
      outputName: `${baseModel.replace(/[/:]/g, "-")}-finetuned`,
    });
    return { accepted: true, job_id: job.id, status: job.status };
  },

  "unifi:status": async () => {
    const client = await getUnifiClient();
    const available = await client.isAvailable();
    return { available, host: process.env.UNIFI_HOST ?? "10.1.7.1" };
  },

  "unifi:devices": async () => {
    const snap = await getUnifiSnapshot();
    if (!snap) {
      return { error: "No snapshot available yet" };
    }
    return { devices: snap.devices, timestamp: snap.timestamp, stale: snap.stale };
  },

  "unifi:clients": async () => {
    const snap = await getUnifiSnapshot();
    if (!snap) {
      return { error: "No snapshot available yet" };
    }
    return { clients: snap.clients, timestamp: snap.timestamp, stale: snap.stale };
  },

  "unifi:health": async () => {
    const snap = await getUnifiSnapshot();
    if (!snap) {
      return { error: "No snapshot available yet" };
    }
    return { health: snap.health, timestamp: snap.timestamp, stale: snap.stale };
  },

  "unifi:stations": async () => {
    const snap = await getUnifiSnapshot();
    if (!snap) {
      return { error: "No snapshot available yet" };
    }
    return { stations: snap.stations, timestamp: snap.timestamp, stale: snap.stale };
  },

  "unifi:alerts": async () => {
    const snap = await getUnifiSnapshot();
    if (!snap) {
      return { error: "No snapshot available yet" };
    }
    return { alerts: snap.alerts, timestamp: snap.timestamp, stale: snap.stale };
  },

  "unifi:snapshot": async () => {
    const snap = await getUnifiSnapshot();
    if (!snap) {
      return { error: "No snapshot available yet" };
    }
    return snap;
  },

  "unifi:cloud:discover": async () => {
    const cloud = await getUnifiCloudClient();
    const [hosts, sites, devices] = await Promise.all([
      cloud.getHosts(),
      cloud.getSites(),
      cloud.getDevices(),
    ]);
    return {
      hosts: hosts.map((h) => ({
        id: h.id,
        name: h.name,
        type: h.type,
        ip: h.reportedState?.ip,
        hostname: h.reportedState?.hostname,
        version: h.reportedState?.version,
        uptime: h.reportedState?.uptime,
      })),
      sites: sites.map((s) => ({
        siteId: s.siteId,
        name: s.meta?.name,
        devices: s.statistics?.counts,
      })),
      devices: devices.map((d) => ({
        mac: d.mac,
        name: d.name,
        model: d.model,
        type: d.type,
        state: d.state,
        ip: d.ip,
      })),
      summary: {
        hosts_count: hosts.length,
        sites_count: sites.length,
        devices_count: devices.length,
      },
    };
  },

  "unifi:cloud:status": async () => {
    const cloud = await getUnifiCloudClient();
    const available = await cloud.isAvailable();
    return { cloud_api: available ? "connected" : "unreachable" };
  },

  "network:scan": async () => {
    const scan = await getNetworkScan();
    if (!scan) {
      return { error: "No scan data available yet" };
    }
    return scan;
  },

  "network:udm": async () => {
    const scan = await getNetworkScan();
    return { udm: scan?.udm ?? null };
  },

  "network:stations": async () => {
    const scan = await getNetworkScan();
    return {
      stations: scan?.stations ?? [],
      timestamp: scan?.timestamp,
    };
  },

  "network:path": async () => {
    if (!dualNetworkInstance) {
      return { error: "Dual network manager not initialized" };
    }
    return dualNetworkInstance.getState();
  },

  "network:switch": async (params) => {
    if (!dualNetworkInstance) {
      return { error: "Dual network manager not initialized" };
    }
    const target = params.path ?? params.target;
    if (!target || (target !== "primary" && target !== "hr02_5g")) {
      throw new Error("Missing or invalid parameter: path (must be 'primary' or 'hr02_5g')");
    }
    return dualNetworkInstance.switchToPath(target);
  },

  "network:5g": async () => {
    const { fetchHr02Status } = await import("./hr02-client.js");
    return fetchHr02Status();
  },

  "network:alerts": async (params) => {
    if (!alertManagerInstance) {
      return { error: "Alert manager not initialized" };
    }
    const limit = typeof params.limit === "number" ? params.limit : 20;
    const activeOnly = params.active === true;
    const alerts = activeOnly
      ? alertManagerInstance.getActive()
      : alertManagerInstance.getRecent(limit);
    return {
      alert_count: alerts.length,
      total: alertManagerInstance.totalAlerts,
      alerts,
    };
  },

  "network:alerts:ack": async (params) => {
    if (!alertManagerInstance) {
      return { error: "Alert manager not initialized" };
    }
    const alertId = params.id ?? params.alert_id;
    if (!alertId || typeof alertId !== "string") {
      throw new Error("Missing required parameter: id");
    }
    const acknowledged = alertManagerInstance.acknowledge(alertId);
    return { acknowledged, alert_id: alertId };
  },

  "network:failover": async () => {
    if (!dualNetworkInstance) {
      return { error: "Dual network manager not initialized" };
    }
    const state = dualNetworkInstance.getState();
    return {
      failover_active: state.failover_active,
      active_path: state.active_path,
      switch_count: state.switch_count,
      last_switch: state.last_switch,
      quality: state.quality,
    };
  },

  "meta:train:jobs": async (params) => {
    const listJobs = await getListJobs();
    const status = typeof params.status === "string" ? params.status : undefined;
    const jobs = listJobs(status as Parameters<typeof listJobs>[0]);
    return { jobs };
  },

  "meta:train:adapters": async () => {
    const listAdapters = await getListAdapters();
    const adapters = listAdapters();
    return { adapters };
  },

  "meta:dashboard": async () => {
    const [hardware, models, engine, network, failover, execLog] = await Promise.all([
      HANDLERS["meta:hardware"]!({}),
      HANDLERS["meta:models"]!({}),
      (async () => {
        const PerformanceDb = await getPerformanceDb();
        const perfDb = new PerformanceDb();
        return { summary: perfDb.getSummary(), totalRecords: perfDb.totalRecords };
      })(),
      getNetworkScan(),
      (async () => {
        if (!dualNetworkInstance) {
          return null;
        }
        return dualNetworkInstance.getState();
      })(),
      (async () => {
        const { ExecutionLog } = await import("./execution-log.js");
        const log = new ExecutionLog();
        return { total: log.totalEntries, recent: log.getRecent(10) };
      })(),
    ]);

    return {
      station_id: STATION_ID,
      timestamp: new Date().toISOString(),
      uptime_seconds: Math.floor(os.uptime()),
      hardware,
      models,
      performance: engine,
      network: network
        ? {
            stations: network.stations,
            udm: network.udm,
            last_scan: network.timestamp,
          }
        : null,
      dual_wan: failover,
      executions: execLog,
    };
  },

  "meta:search": async (params) => {
    const query = params.query ?? params.q;
    if (!query || typeof query !== "string") {
      throw new Error("Missing required parameter: query");
    }
    const limit = typeof params.limit === "number" ? params.limit : 20;
    const searchHuggingFace = await getSearchHuggingFace();
    const results = await searchHuggingFace(query, { limit });
    return {
      query,
      result_count: results.length,
      models: results,
    };
  },

  "meta:search:files": async (params) => {
    const repo = params.repo ?? params.repo_id;
    if (!repo || typeof repo !== "string") {
      throw new Error("Missing required parameter: repo");
    }
    const listGguf = await getListHuggingFaceGguf();
    const files = await listGguf(repo);
    return {
      repo,
      file_count: files.length,
      files,
    };
  },

  "meta:evaluate": async (params) => {
    const model = params.model;
    if (!model || typeof model !== "string") {
      throw new Error("Missing required parameter: model");
    }
    const evaluateModel = await getEvaluateModel();
    const result = await evaluateModel({
      modelId: model,
      datasetPath: String(params.dataset ?? ""),
      baseModelId: params.base ? String(params.base) : undefined,
      maxCases: params.max_cases ? Number(params.max_cases) : undefined,
    });
    return result;
  },

  "neural:status": async () => {
    const handler = await getNeuralStatus();
    return handler(STATION_ID);
  },

  "neural:topology": async () => {
    const handler = await getNeuralTopology();
    return handler(STATION_ID);
  },

  "neural:evolve": async () => {
    const handler = await getNeuralEvolve();
    return handler(STATION_ID);
  },

  "neural:query": async (params) => {
    const task = params.task ?? params.text;
    if (!task || typeof task !== "string") {
      throw new Error("Missing required parameter: task");
    }
    const handler = await getNeuralQuery();
    return handler({
      task,
      taskType: params.task_type as string | undefined,
      complexity: params.complexity as string | undefined,
      stationId: STATION_ID,
    });
  },
};

// ---------------------------------------------------------------------------
// Execution tracking (injected from index.ts for the learning loop, UC-4)
// ---------------------------------------------------------------------------

type ExecutionTracker = (opts: { command: string; success: boolean; latencyMs: number }) => void;

let executionTracker: ExecutionTracker | null = null;

export function setExecutionTracker(tracker: ExecutionTracker): void {
  executionTracker = tracker;
}

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

export async function dispatchCommand(cmd: NetworkCommand): Promise<CommandResponse> {
  const start = Date.now();
  const handler = HANDLERS[cmd.command];

  if (!handler) {
    return {
      success: false,
      command: cmd.command,
      request_id: cmd.request_id,
      error: `Unknown command: ${cmd.command}`,
      latency_ms: Date.now() - start,
    };
  }

  try {
    const data = await handler(cmd.params ?? {});
    const latencyMs = Date.now() - start;
    // Feed the learning loop (UC-4): track every successful command
    executionTracker?.({ command: cmd.command, success: true, latencyMs });
    return {
      success: true,
      command: cmd.command,
      request_id: cmd.request_id,
      data,
      latency_ms: latencyMs,
    };
  } catch (err) {
    const latencyMs = Date.now() - start;
    executionTracker?.({ command: cmd.command, success: false, latencyMs });
    return {
      success: false,
      command: cmd.command,
      request_id: cmd.request_id,
      error: err instanceof Error ? err.message : String(err),
      latency_ms: latencyMs,
    };
  }
}
