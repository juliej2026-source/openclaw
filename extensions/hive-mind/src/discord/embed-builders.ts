// ---------------------------------------------------------------------------
// Discord embed factory functions
// ---------------------------------------------------------------------------

import type { HiveAlert } from "../alert-manager.js";
import type { DualNetworkState } from "../dual-network.js";
import type { StationPingResult, NetworkScanResult } from "../network-scanner.js";
import type { ExecutionLogEntry } from "../types.js";
import { SEVERITY_COLORS, CONTEXT_COLORS } from "./types.js";

type Embed = {
  title: string;
  description?: string;
  color: number;
  fields: Array<{ name: string; value: string; inline?: boolean }>;
  timestamp: string;
  footer: { text: string };
};

const FOOTER = { text: "OpenClaw Hive Monitor" };

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + "\u2026" : s;
}

// ---------------------------------------------------------------------------
// Alert embed
// ---------------------------------------------------------------------------

export function buildAlertEmbed(alert: HiveAlert): Embed {
  const color = SEVERITY_COLORS[alert.severity] ?? SEVERITY_COLORS.info;
  const icon =
    alert.severity === "critical"
      ? "\u{1F6A8}"
      : alert.severity === "warning"
        ? "\u26A0\uFE0F"
        : "\u2139\uFE0F";

  const fields: Embed["fields"] = [
    { name: "Type", value: `\`${alert.type}\``, inline: true },
    { name: "Severity", value: `${icon} ${alert.severity}`, inline: true },
    { name: "Source", value: alert.source, inline: true },
  ];

  if (alert.target) {
    fields.push({ name: "Target", value: alert.target, inline: true });
  }

  if (alert.metadata) {
    const meta = Object.entries(alert.metadata)
      .slice(0, 5)
      .map(([k, v]) => `**${k}:** ${String(v)}`)
      .join("\n");
    if (meta) fields.push({ name: "Details", value: truncate(meta, 1024) });
  }

  return {
    title: truncate(`${icon} ${alert.message}`, 256),
    color,
    fields,
    timestamp: alert.timestamp,
    footer: FOOTER,
  };
}

// ---------------------------------------------------------------------------
// Station status embed
// ---------------------------------------------------------------------------

export function buildStationStatusEmbed(stations: StationPingResult[]): Embed {
  const online = stations.filter((s) => s.reachable).length;
  const total = stations.length;

  const lines = stations.map((s) => {
    const dot = s.reachable ? "\uD83D\uDFE2" : "\uD83D\uDD34";
    const latency = s.latencyMs != null ? `${s.latencyMs}ms` : "--";
    return `${dot} **${s.label ?? s.ip}** \`${s.ip}\` ${latency}`;
  });

  return {
    title: `Station Health: ${online}/${total} Online`,
    description: lines.join("\n"),
    color: online === total ? SEVERITY_COLORS.info : SEVERITY_COLORS.warning,
    fields: [],
    timestamp: new Date().toISOString(),
    footer: FOOTER,
  };
}

// ---------------------------------------------------------------------------
// Dashboard embed (system overview)
// ---------------------------------------------------------------------------

export type DashboardData = {
  stations?: StationPingResult[];
  activeAlerts?: number;
  wanStatus?: string;
  scraperStatus?: string;
  neuralPhase?: string;
  modelCount?: number;
  uptime?: number;
};

export function buildDashboardEmbed(data: DashboardData): Embed {
  const fields: Embed["fields"] = [];

  if (data.uptime != null) {
    const hours = Math.floor(data.uptime / 3600);
    const mins = Math.floor((data.uptime % 3600) / 60);
    fields.push({ name: "Uptime", value: `${hours}h ${mins}m`, inline: true });
  }

  if (data.stations) {
    const online = data.stations.filter((s) => s.reachable).length;
    fields.push({ name: "Stations", value: `${online}/${data.stations.length}`, inline: true });
  }

  if (data.wanStatus) {
    fields.push({ name: "WAN", value: data.wanStatus, inline: true });
  }

  if (data.activeAlerts != null) {
    fields.push({ name: "Active Alerts", value: String(data.activeAlerts), inline: true });
  }

  if (data.scraperStatus) {
    fields.push({ name: "Scraper", value: data.scraperStatus, inline: true });
  }

  if (data.neuralPhase) {
    fields.push({ name: "Neural Phase", value: data.neuralPhase, inline: true });
  }

  if (data.modelCount != null) {
    fields.push({ name: "Models", value: String(data.modelCount), inline: true });
  }

  return {
    title: "Hive Infrastructure Dashboard",
    description: `System overview at ${new Date().toLocaleTimeString("en-GB", { timeZone: "Asia/Tokyo" })} JST`,
    color: CONTEXT_COLORS.dashboard,
    fields,
    timestamp: new Date().toISOString(),
    footer: FOOTER,
  };
}

// ---------------------------------------------------------------------------
// Scraper job embed
// ---------------------------------------------------------------------------

export type ScraperJobData = {
  jobId: string;
  status: string;
  sources?: string[];
  pricesFound?: number;
  durationMs?: number;
};

export function buildScraperJobEmbed(job: ScraperJobData): Embed {
  const fields: Embed["fields"] = [
    { name: "Job ID", value: `\`${job.jobId}\``, inline: true },
    { name: "Status", value: job.status, inline: true },
  ];

  if (job.sources) {
    fields.push({ name: "Sources", value: job.sources.join(", "), inline: true });
  }
  if (job.pricesFound != null) {
    fields.push({ name: "Prices Found", value: String(job.pricesFound), inline: true });
  }
  if (job.durationMs != null) {
    fields.push({
      name: "Duration",
      value: `${(job.durationMs / 1000).toFixed(1)}s`,
      inline: true,
    });
  }

  return {
    title: `Scraper Job: ${job.status}`,
    color:
      job.status === "completed"
        ? SEVERITY_COLORS.info
        : job.status === "failed"
          ? SEVERITY_COLORS.critical
          : CONTEXT_COLORS.scraper,
    fields,
    timestamp: new Date().toISOString(),
    footer: FOOTER,
  };
}

// ---------------------------------------------------------------------------
// Neural status embed
// ---------------------------------------------------------------------------

export type NeuralStatusData = {
  phase?: string;
  nodeCount?: number;
  edgeCount?: number;
  fitness?: number;
  convexHealthy?: boolean;
};

export function buildNeuralStatusEmbed(data: NeuralStatusData): Embed {
  const fields: Embed["fields"] = [];

  if (data.phase) fields.push({ name: "Phase", value: data.phase, inline: true });
  if (data.nodeCount != null)
    fields.push({ name: "Nodes", value: String(data.nodeCount), inline: true });
  if (data.edgeCount != null)
    fields.push({ name: "Edges", value: String(data.edgeCount), inline: true });
  if (data.fitness != null)
    fields.push({ name: "Fitness", value: `${(data.fitness * 100).toFixed(1)}%`, inline: true });
  if (data.convexHealthy != null) {
    fields.push({
      name: "Convex",
      value: data.convexHealthy ? "Healthy" : "Degraded",
      inline: true,
    });
  }

  return {
    title: "Neural Graph Status",
    color: CONTEXT_COLORS.neural,
    fields,
    timestamp: new Date().toISOString(),
    footer: FOOTER,
  };
}

// ---------------------------------------------------------------------------
// Model list embed
// ---------------------------------------------------------------------------

export type ModelListData = {
  installed: number;
  running: number;
  models?: Array<{ id: string; running: boolean }>;
};

export function buildModelListEmbed(data: ModelListData): Embed {
  const fields: Embed["fields"] = [
    { name: "Installed", value: String(data.installed), inline: true },
    { name: "Running", value: String(data.running), inline: true },
  ];

  if (data.models && data.models.length > 0) {
    const list = data.models
      .slice(0, 15)
      .map((m) => `${m.running ? "\uD83D\uDFE2" : "\u26AA"} ${m.id}`)
      .join("\n");
    fields.push({ name: "Models", value: truncate(list, 1024) });
  }

  return {
    title: "Model Inventory",
    color: CONTEXT_COLORS.models,
    fields,
    timestamp: new Date().toISOString(),
    footer: FOOTER,
  };
}

// ---------------------------------------------------------------------------
// Execution embed
// ---------------------------------------------------------------------------

export type ExecutionData = {
  totalExecutions: number;
  successRate: number;
  recentCommands?: ExecutionLogEntry[];
};

export function buildExecutionEmbed(data: ExecutionData): Embed {
  const fields: Embed["fields"] = [
    { name: "Total Executions", value: String(data.totalExecutions), inline: true },
    { name: "Success Rate", value: `${(data.successRate * 100).toFixed(1)}%`, inline: true },
  ];

  if (data.recentCommands && data.recentCommands.length > 0) {
    const list = data.recentCommands
      .slice(0, 10)
      .map((e) => {
        const icon = e.success ? "\u2705" : "\u274C";
        return `${icon} \`${e.command ?? e.task_type}\` ${e.latency_ms}ms`;
      })
      .join("\n");
    fields.push({ name: "Recent Commands", value: truncate(list, 1024) });
  }

  return {
    title: "Execution Activity",
    color: CONTEXT_COLORS.execution,
    fields,
    timestamp: new Date().toISOString(),
    footer: FOOTER,
  };
}

// ---------------------------------------------------------------------------
// Topology text embed (ASCII art from scan)
// ---------------------------------------------------------------------------

export function buildTopologyTextEmbed(scan: NetworkScanResult): Embed {
  const stationLines = scan.stations.map((s) => {
    const dot = s.reachable ? "\u2588" : "\u2591";
    const lat = s.latencyMs != null ? `${s.latencyMs}ms` : "---";
    return `${dot} ${(s.label ?? s.ip).padEnd(12)} ${s.ip.padEnd(14)} ${lat}`;
  });

  const udmLine = scan.udm
    ? `UDM-Pro: ${scan.udm.name} (${scan.udm.model}) Internet: ${scan.udm.hasInternet ? "OK" : "DOWN"}`
    : "UDM-Pro: unreachable";

  const description = ["```", udmLine, "---", ...stationLines, "```"].join("\n");

  return {
    title: "Network Topology",
    description: truncate(description, 4096),
    color: CONTEXT_COLORS.network,
    fields: [],
    timestamp: scan.timestamp,
    footer: FOOTER,
  };
}
