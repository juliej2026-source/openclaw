import type { AlertManager } from "./alert-manager.js";
import type { DualNetworkState } from "./dual-network.js";
import type { ExecutionLog } from "./execution-log.js";
import type { NetworkScanResult } from "./network-scanner.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PerformanceSummaryEntry = {
  modelId: string;
  taskType: string;
  totalRuns: number;
  successRate: number;
  avgLatencyMs: number;
};

export type MetricsContext = {
  getScan?: () => NetworkScanResult | null;
  getDualNetwork?: () => DualNetworkState | null;
  alertManager?: AlertManager;
  executionLog?: ExecutionLog;
  getPerformanceSummary?: () => PerformanceSummaryEntry[];
  getPerformanceTotal?: () => number;
  modelCounts?: { installed: number; running: number };
  isJuliaRegistered?: () => boolean;
  getJuliaHeartbeatAge?: () => number;
  startTime: number;
};

// ---------------------------------------------------------------------------
// Module state
// ---------------------------------------------------------------------------

let metricsContext: MetricsContext | null = null;

export function setMetricsContext(ctx: MetricsContext): void {
  metricsContext = ctx;
}

export function getMetricsContext(): MetricsContext | null {
  return metricsContext;
}

// ---------------------------------------------------------------------------
// Label helpers
// ---------------------------------------------------------------------------

function escapeLabel(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

function labels(pairs: Record<string, string>): string {
  const parts = Object.entries(pairs).map(([k, v]) => `${k}="${escapeLabel(v)}"`);
  return parts.length > 0 ? `{${parts.join(",")}}` : "";
}

// ---------------------------------------------------------------------------
// Metric generation
// ---------------------------------------------------------------------------

export function generateMetrics(ctx?: MetricsContext): string {
  const c = ctx ?? metricsContext;
  if (!c) {
    return "";
  }

  const lines: string[] = [];

  // -- System uptime
  const uptimeSeconds = Math.floor((Date.now() - c.startTime) / 1000);
  lines.push("# HELP hivemind_uptime_seconds IOT-HUB process uptime in seconds");
  lines.push("# TYPE hivemind_uptime_seconds gauge");
  lines.push(`hivemind_uptime_seconds ${uptimeSeconds}`);
  lines.push("");

  // -- Station reachability (from NetworkScanner)
  const scan = c.getScan?.();
  if (scan?.stations.length) {
    lines.push(
      "# HELP hivemind_station_reachable Whether a hive station is reachable (1=up, 0=down)",
    );
    lines.push("# TYPE hivemind_station_reachable gauge");
    for (const s of scan.stations) {
      const l = labels({ station: s.label ?? s.ip, ip: s.ip });
      lines.push(`hivemind_station_reachable${l} ${s.reachable ? 1 : 0}`);
    }
    lines.push("");

    lines.push("# HELP hivemind_station_latency_ms Station ping latency in milliseconds");
    lines.push("# TYPE hivemind_station_latency_ms gauge");
    for (const s of scan.stations) {
      if (s.latencyMs != null) {
        const l = labels({ station: s.label ?? s.ip, ip: s.ip });
        lines.push(`hivemind_station_latency_ms${l} ${s.latencyMs}`);
      }
    }
    lines.push("");
  }

  // -- Dual-WAN state (from DualNetworkManager)
  const dualNet = c.getDualNetwork?.();
  if (dualNet) {
    lines.push(
      "# HELP hivemind_wan_active_path Whether a WAN path is currently active (1=active, 0=standby)",
    );
    lines.push("# TYPE hivemind_wan_active_path gauge");
    for (const pathId of Object.keys(dualNet.paths)) {
      lines.push(
        `hivemind_wan_active_path${labels({ path_id: pathId })} ${pathId === dualNet.active_path ? 1 : 0}`,
      );
    }
    lines.push("");

    lines.push(
      "# HELP hivemind_wan_failover_active Whether failover mode is active (1=failover, 0=normal)",
    );
    lines.push("# TYPE hivemind_wan_failover_active gauge");
    lines.push(`hivemind_wan_failover_active ${dualNet.failover_active ? 1 : 0}`);
    lines.push("");

    lines.push("# HELP hivemind_wan_switch_count_total Total number of WAN path switches");
    lines.push("# TYPE hivemind_wan_switch_count_total counter");
    lines.push(`hivemind_wan_switch_count_total ${dualNet.switch_count}`);
    lines.push("");

    lines.push("# HELP hivemind_wan_quality_latency_ms WAN path latency in milliseconds");
    lines.push("# TYPE hivemind_wan_quality_latency_ms gauge");
    for (const [pathId, q] of Object.entries(dualNet.quality)) {
      if (q?.latency_ms != null) {
        lines.push(`hivemind_wan_quality_latency_ms${labels({ path_id: pathId })} ${q.latency_ms}`);
      }
    }
    lines.push("");

    lines.push("# HELP hivemind_wan_quality_packet_loss_pct WAN path packet loss percentage");
    lines.push("# TYPE hivemind_wan_quality_packet_loss_pct gauge");
    for (const [pathId, q] of Object.entries(dualNet.quality)) {
      if (q?.packet_loss_pct != null) {
        lines.push(
          `hivemind_wan_quality_packet_loss_pct${labels({ path_id: pathId })} ${q.packet_loss_pct}`,
        );
      }
    }
    lines.push("");
  }

  // -- Alerts (from AlertManager)
  if (c.alertManager) {
    const active = c.alertManager.getActive();
    lines.push("# HELP hivemind_alert_active_count Number of unacknowledged alerts");
    lines.push("# TYPE hivemind_alert_active_count gauge");
    lines.push(`hivemind_alert_active_count ${active.length}`);
    lines.push("");

    const alertCounts = new Map<string, number>();
    const allAlerts = c.alertManager.getRecent();
    for (const a of allAlerts) {
      const key = `${a.type}|${a.severity}`;
      alertCounts.set(key, (alertCounts.get(key) ?? 0) + 1);
    }

    if (alertCounts.size > 0) {
      lines.push("# HELP hivemind_alert_count Total alerts by type and severity");
      lines.push("# TYPE hivemind_alert_count gauge");
      for (const [key, count] of alertCounts) {
        const [type, severity] = key.split("|");
        lines.push(`hivemind_alert_count${labels({ type, severity })} ${count}`);
      }
      lines.push("");
    }
  }

  // -- Performance DB (from PerformanceDb.getSummary())
  if (c.getPerformanceSummary) {
    const summary = c.getPerformanceSummary();
    if (summary.length > 0) {
      lines.push("# HELP hivemind_perf_success_rate Model success rate by task type (0-1)");
      lines.push("# TYPE hivemind_perf_success_rate gauge");
      for (const s of summary) {
        const l = labels({ model_id: s.modelId, task_type: s.taskType });
        lines.push(`hivemind_perf_success_rate${l} ${s.successRate}`);
      }
      lines.push("");

      lines.push(
        "# HELP hivemind_perf_avg_latency_ms Model average latency by task type in milliseconds",
      );
      lines.push("# TYPE hivemind_perf_avg_latency_ms gauge");
      for (const s of summary) {
        const l = labels({ model_id: s.modelId, task_type: s.taskType });
        lines.push(`hivemind_perf_avg_latency_ms${l} ${s.avgLatencyMs}`);
      }
      lines.push("");
    }
  }

  if (c.getPerformanceTotal) {
    lines.push("# HELP hivemind_perf_total_records Total records in performance database");
    lines.push("# TYPE hivemind_perf_total_records gauge");
    lines.push(`hivemind_perf_total_records ${c.getPerformanceTotal()}`);
    lines.push("");
  }

  // -- Execution log
  if (c.executionLog) {
    const total = c.executionLog.totalEntries;
    lines.push("# HELP hivemind_exec_total Total command executions");
    lines.push("# TYPE hivemind_exec_total gauge");
    lines.push(`hivemind_exec_total ${total}`);
    lines.push("");

    if (total > 0) {
      const recent = c.executionLog.getRecent(1000);
      const successes = recent.filter((e) => e.success).length;
      const rate = recent.length > 0 ? successes / recent.length : 0;
      lines.push("# HELP hivemind_exec_success_rate Execution success rate (0-1)");
      lines.push("# TYPE hivemind_exec_success_rate gauge");
      lines.push(`hivemind_exec_success_rate ${rate}`);
      lines.push("");
    }
  }

  // -- Model inventory
  if (c.modelCounts) {
    lines.push("# HELP hivemind_model_installed_count Number of installed models");
    lines.push("# TYPE hivemind_model_installed_count gauge");
    lines.push(`hivemind_model_installed_count ${c.modelCounts.installed}`);
    lines.push("");

    lines.push("# HELP hivemind_model_running_count Number of currently running models");
    lines.push("# TYPE hivemind_model_running_count gauge");
    lines.push(`hivemind_model_running_count ${c.modelCounts.running}`);
    lines.push("");
  }

  // -- JULIA registration
  if (c.isJuliaRegistered) {
    lines.push(
      "# HELP hivemind_julia_registered Whether IOT-HUB is registered with JULIA (1=yes, 0=no)",
    );
    lines.push("# TYPE hivemind_julia_registered gauge");
    lines.push(`hivemind_julia_registered ${c.isJuliaRegistered() ? 1 : 0}`);
    lines.push("");
  }

  if (c.getJuliaHeartbeatAge) {
    lines.push(
      "# HELP hivemind_julia_last_heartbeat_age_seconds Seconds since last JULIA heartbeat",
    );
    lines.push("# TYPE hivemind_julia_last_heartbeat_age_seconds gauge");
    lines.push(`hivemind_julia_last_heartbeat_age_seconds ${c.getJuliaHeartbeatAge()}`);
    lines.push("");
  }

  return lines.join("\n");
}
