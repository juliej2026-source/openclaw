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

async function getHuggingFaceManager() {
  const { HuggingFaceManager, loadHfToken } = await import("./huggingface-manager.js");
  const token = loadHfToken();
  return new HuggingFaceManager({ token });
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

let braviaInstance: {
  getLatestStatus: () => import("./bravia-client.js").BraviaStatus | null;
  client: import("./bravia-client.js").BraviaClient;
} | null = null;

export function setBraviaInstance(instance: typeof braviaInstance): void {
  braviaInstance = instance;
}

let cloudApacheInstance: {
  deploy: () => Promise<{ instanceId: string; publicIp: string }>;
  destroy: () => Promise<void>;
  getState: () => import("./alibaba-apache.js").CloudApacheState;
  start: () => Promise<void>;
  stop: () => void;
  fetchApacheStatus: () => Promise<import("./apache-status.js").ApacheStatus>;
  execCommand: (cmd: string) => Promise<{ stdout: string; stderr: string; code: number }>;
  pushContent: (content: string, remotePath: string) => Promise<void>;
  pushFile: (localPath: string, remotePath: string) => Promise<void>;
  deploySite: (localDir: string, remotePath?: string) => Promise<void>;
  fetchLogs: (lines?: number, type?: "access" | "error") => Promise<string>;
  getSshConfig: () => import("./cloud-ssh.js").SshConfig | null;
} | null = null;

export function setCloudApacheInstance(instance: typeof cloudApacheInstance): void {
  cloudApacheInstance = instance;
}

async function getNetworkScan() {
  if (networkScannerInstance) {
    return networkScannerInstance.getLatestScan();
  }
  // Fallback: do a one-shot scan
  const { fetchUdmSystemInfo, scanStations } = await import("./network-scanner.js");
  const [udm, stations] = await Promise.all([
    fetchUdmSystemInfo(process.env.UNIFI_HOST ?? "10.1.8.1"),
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
    return { available, host: process.env.UNIFI_HOST ?? "10.1.8.1" };
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

  // -- HuggingFace management -----------------------------------------------

  "hf:spaces": async (params) => {
    const mgr = await getHuggingFaceManager();
    const limit = typeof params.limit === "number" ? params.limit : 20;
    const author = typeof params.author === "string" ? params.author : undefined;
    const spaces = await mgr.listSpaces({ limit, author });
    return { count: spaces.length, spaces };
  },

  "hf:spaces:info": async (params) => {
    const id = params.id ?? params.space_id;
    if (!id || typeof id !== "string") throw new Error("Missing required parameter: id");
    const mgr = await getHuggingFaceManager();
    return mgr.getSpaceInfo(id);
  },

  "hf:datasets": async (params) => {
    const mgr = await getHuggingFaceManager();
    const limit = typeof params.limit === "number" ? params.limit : 20;
    const author = typeof params.author === "string" ? params.author : undefined;
    const datasets = await mgr.listDatasets({ limit, author });
    return { count: datasets.length, datasets };
  },

  "hf:datasets:info": async (params) => {
    const id = params.id ?? params.dataset_id;
    if (!id || typeof id !== "string") throw new Error("Missing required parameter: id");
    const mgr = await getHuggingFaceManager();
    return mgr.getDatasetInfo(id);
  },

  "hf:models": async (params) => {
    const mgr = await getHuggingFaceManager();
    const limit = typeof params.limit === "number" ? params.limit : 20;
    const author = typeof params.author === "string" ? params.author : undefined;
    const models = await mgr.listModels({ limit, author });
    return { count: models.length, models };
  },

  "hf:models:info": async (params) => {
    const id = params.id ?? params.model_id;
    if (!id || typeof id !== "string") throw new Error("Missing required parameter: id");
    const mgr = await getHuggingFaceManager();
    return mgr.getModelInfo(id);
  },

  "hf:jobs": async () => {
    const mgr = await getHuggingFaceManager();
    const jobs = await mgr.listJobs();
    return { count: jobs.length, jobs };
  },

  "hf:jobs:info": async (params) => {
    const id = params.id ?? params.job_id;
    if (!id || typeof id !== "string") throw new Error("Missing required parameter: id");
    const mgr = await getHuggingFaceManager();
    return mgr.getJobInfo(id);
  },

  "hf:status": async () => {
    const mgr = await getHuggingFaceManager();
    const [spaces, datasets, models, jobs] = await Promise.all([
      mgr.listSpaces({ limit: 100 }).catch(() => []),
      mgr.listDatasets({ limit: 100 }).catch(() => []),
      mgr.listModels({ limit: 100 }).catch(() => []),
      mgr.listJobs().catch(() => []),
    ]);
    return {
      spaces_count: spaces.length,
      datasets_count: datasets.length,
      models_count: models.length,
      jobs_count: jobs.length,
      active_jobs: (jobs as Array<{ status: string }>).filter((j) => j.status === "running").length,
    };
  },

  // -- SCRAPER station (peer dispatch) ---------------------------------------

  "scraper:status": async () => {
    const { PeerClient } = await import("./peer-client.js");
    const peer = new PeerClient();
    const health = await peer.checkPeerHealth("scraper");
    if (!health) {
      return { station: "scraper", reachable: false, error: "SCRAPER station unreachable" };
    }
    const result = await peer.dispatchCommand("scraper", { command: "ping" });
    return { station: "scraper", reachable: true, peer_data: result.data };
  },

  "scraper:prices": async (params) => {
    const { PeerClient } = await import("./peer-client.js");
    const peer = new PeerClient();
    return (
      await peer.dispatchCommand("scraper", {
        command: "scraper:prices",
        params,
      })
    ).data;
  },

  "scraper:jobs": async (params) => {
    const { PeerClient } = await import("./peer-client.js");
    const peer = new PeerClient();
    return (
      await peer.dispatchCommand("scraper", {
        command: "scraper:jobs",
        params,
      })
    ).data;
  },

  "scraper:run": async (params) => {
    const { PeerClient } = await import("./peer-client.js");
    const peer = new PeerClient();
    return (
      await peer.dispatchCommand("scraper", {
        command: "scraper:run",
        params,
      })
    ).data;
  },

  "peer:status": async () => {
    const { PeerClient } = await import("./peer-client.js");
    const peer = new PeerClient();
    const peers = peer.getPeers();
    const results = await Promise.all(
      peers.map(async (p) => ({
        station_id: p.station_id,
        ip: p.ip,
        port: p.port,
        platform: p.platform,
        llm_model: p.llm_model,
        reachable: await peer.checkPeerHealth(p.station_id),
        capabilities: p.capabilities,
      })),
    );
    return {
      peer_count: results.length,
      online: results.filter((r) => r.reachable).length,
      peers: results,
    };
  },

  "peer:tandem": async (params) => {
    const target = params.station ?? params.target;
    const taskType = params.task_type ?? params.command;
    if (!target || typeof target !== "string") {
      throw new Error("Missing required parameter: station");
    }
    if (!taskType || typeof taskType !== "string") {
      throw new Error("Missing required parameter: task_type");
    }
    const { PeerClient } = await import("./peer-client.js");
    const peer = new PeerClient();
    return peer.sendTandemTask(target, taskType, (params.payload as Record<string, unknown>) ?? {});
  },

  "peer:delegate": async (params) => {
    const target = params.station ?? params.target;
    const command = params.command;
    if (!target || typeof target !== "string") {
      throw new Error("Missing required parameter: station");
    }
    if (!command || typeof command !== "string") {
      throw new Error("Missing required parameter: command");
    }
    const { PeerClient } = await import("./peer-client.js");
    const peer = new PeerClient();
    return peer.delegateTask(target, command, (params.params as Record<string, unknown>) ?? {});
  },

  // -----------------------------------------------------------------------
  // BRAVIA TV control
  // -----------------------------------------------------------------------

  "bravia:status": async () => {
    if (!braviaInstance) {
      return { error: "BRAVIA poller not initialized" };
    }
    const status = braviaInstance.getLatestStatus();
    if (!status) {
      return { error: "No BRAVIA status available yet" };
    }
    return status;
  },

  "bravia:power": async (params) => {
    if (!braviaInstance) {
      return { error: "BRAVIA not initialized" };
    }
    const action = params.action as string | undefined;
    if (!action || !["on", "off", "toggle"].includes(action)) {
      return { error: "Missing or invalid action (on|off|toggle)" };
    }
    const current = braviaInstance.getLatestStatus()?.power;
    const turnOn = action === "on" || (action === "toggle" && current !== "active");
    await braviaInstance.client.setPower(turnOn);
    return { success: true, power: turnOn ? "active" : "standby" };
  },

  "bravia:volume": async (params) => {
    if (!braviaInstance) {
      return { error: "BRAVIA not initialized" };
    }
    const level = params.level as number | undefined;
    const mute = params.mute as boolean | undefined;

    if (level !== undefined) {
      await braviaInstance.client.setVolume(level);
    }
    if (mute !== undefined) {
      await braviaInstance.client.setMute(mute);
    }
    if (level === undefined && mute === undefined) {
      return braviaInstance.client.getVolume();
    }
    return { success: true, level, mute };
  },

  "bravia:input": async (params) => {
    if (!braviaInstance) {
      return { error: "BRAVIA not initialized" };
    }
    const port = params.port as number | undefined;
    if (!port || port < 1 || port > 4) {
      return { error: "Missing or invalid port (1-4)" };
    }
    await braviaInstance.client.switchInput(`extInput:hdmi?port=${port}`);
    return { success: true, input: `HDMI ${port}` };
  },

  "bravia:app": async (params) => {
    if (!braviaInstance) {
      return { error: "BRAVIA not initialized" };
    }
    const name = params.name as string | undefined;
    if (!name) {
      return { error: "Missing required parameter: name" };
    }
    // Common app shortcuts → IRCC codes
    const appKeys: Record<string, string> = {
      netflix: "Netflix",
      youtube: "YouTube",
      home: "Home",
    };
    const irccKey = appKeys[name.toLowerCase()];
    if (irccKey) {
      await braviaInstance.client.sendRemoteKey(irccKey);
    } else {
      await braviaInstance.client.launchApp(name);
    }
    return { success: true, app: name };
  },

  "bravia:remote": async (params) => {
    if (!braviaInstance) {
      return { error: "BRAVIA not initialized" };
    }
    const key = params.key as string | undefined;
    if (!key) {
      return { error: "Missing required parameter: key" };
    }
    await braviaInstance.client.sendRemoteKey(key);
    return { success: true, key };
  },

  "bravia:wake": async () => {
    if (!braviaInstance) {
      return { error: "BRAVIA not initialized" };
    }
    await braviaInstance.client.wakeOnLan();
    return { success: true, message: "WOL packet sent to 80:99:E7:27:A2:C6" };
  },

  "bravia:cast": async () => {
    if (!braviaInstance) {
      return { error: "BRAVIA not initialized" };
    }
    const cast = await braviaInstance.client.getCastInfo();
    if (!cast) {
      return { error: "Cast info unavailable" };
    }
    return cast;
  },

  // -----------------------------------------------------------------------
  // Alibaba Cloud Apache
  // -----------------------------------------------------------------------

  "cloud:deploy": async () => {
    if (!cloudApacheInstance) {
      return { error: "Cloud Apache manager not initialized (missing ALIBABA credentials)" };
    }
    const result = await cloudApacheInstance.deploy();
    // Start monitoring after deploy
    await cloudApacheInstance.start();
    return { success: true, ...result };
  },

  "cloud:status": async () => {
    if (!cloudApacheInstance) {
      return { error: "Cloud Apache manager not initialized" };
    }
    return cloudApacheInstance.getState();
  },

  "cloud:stop": async () => {
    if (!cloudApacheInstance) {
      return { error: "Cloud Apache manager not initialized" };
    }
    const state = cloudApacheInstance.getState();
    if (!state.instanceId) {
      return { error: "No instance deployed" };
    }
    cloudApacheInstance.stop();
    return { success: true, instanceId: state.instanceId };
  },

  "cloud:start": async () => {
    if (!cloudApacheInstance) {
      return { error: "Cloud Apache manager not initialized" };
    }
    await cloudApacheInstance.start();
    return { success: true };
  },

  "cloud:destroy": async () => {
    if (!cloudApacheInstance) {
      return { error: "Cloud Apache manager not initialized" };
    }
    cloudApacheInstance.stop();
    await cloudApacheInstance.destroy();
    return { success: true, message: "Cloud Apache instance destroyed" };
  },

  "cloud:exec": async (params) => {
    if (!cloudApacheInstance) {
      return { error: "Cloud Apache manager not initialized" };
    }
    const cmd = params.cmd as string | undefined;
    if (!cmd || typeof cmd !== "string") {
      throw new Error("Missing required parameter: cmd");
    }
    const state = cloudApacheInstance.getState();
    if (!state.deployed) {
      return { error: "No instance deployed" };
    }
    const result = await cloudApacheInstance.execCommand(cmd);
    return { success: result.code === 0, ...result };
  },

  "cloud:push": async (params) => {
    if (!cloudApacheInstance) {
      return { error: "Cloud Apache manager not initialized" };
    }
    const content = params.content as string | undefined;
    const remotePath = params.path as string | undefined;
    if (!content || typeof content !== "string") {
      throw new Error("Missing required parameter: content");
    }
    if (!remotePath || typeof remotePath !== "string") {
      throw new Error("Missing required parameter: path");
    }
    const state = cloudApacheInstance.getState();
    if (!state.deployed) {
      return { error: "No instance deployed" };
    }
    await cloudApacheInstance.pushContent(content, remotePath);
    return { success: true, path: remotePath, bytes: content.length };
  },

  "cloud:site": async (params) => {
    if (!cloudApacheInstance) {
      return { error: "Cloud Apache manager not initialized" };
    }
    const dir = params.dir as string | undefined;
    if (!dir || typeof dir !== "string") {
      throw new Error("Missing required parameter: dir");
    }
    const state = cloudApacheInstance.getState();
    if (!state.deployed) {
      return { error: "No instance deployed" };
    }
    const remote = (params.remote as string) ?? "/var/www/html";
    await cloudApacheInstance.deploySite(dir, remote);
    return { success: true, source: dir, destination: remote };
  },

  "cloud:logs": async (params) => {
    if (!cloudApacheInstance) {
      return { error: "Cloud Apache manager not initialized" };
    }
    const state = cloudApacheInstance.getState();
    if (!state.deployed) {
      return { error: "No instance deployed" };
    }
    const lines = typeof params.lines === "number" ? params.lines : 100;
    const type = (params.type as "access" | "error") ?? "access";
    const logs = await cloudApacheInstance.fetchLogs(lines, type);
    return { success: true, type, lines, output: logs };
  },

  "cloud:ssh": async () => {
    if (!cloudApacheInstance) {
      return { error: "Cloud Apache manager not initialized" };
    }
    const sshConfig = cloudApacheInstance.getSshConfig();
    if (!sshConfig) {
      return { error: "SSH not configured (instance may not be deployed with key pair)" };
    }
    return {
      host: sshConfig.host,
      user: sshConfig.user ?? "root",
      keyPath: sshConfig.keyPath,
      command: `ssh -i ${sshConfig.keyPath} ${sshConfig.user ?? "root"}@${sshConfig.host}`,
    };
  },
};

/** Returns all registered command names for capability reporting. */
export function getAvailableCommands(): string[] {
  return Object.keys(HANDLERS);
}

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
