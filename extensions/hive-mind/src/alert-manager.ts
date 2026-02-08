import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { STATION_ID } from "./types.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AlertSeverity = "info" | "warning" | "critical";

export type AlertType =
  | "station_offline"
  | "station_online"
  | "failover_triggered"
  | "failover_recovered"
  | "internet_degraded"
  | "internet_restored";

export type HiveAlert = {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  source: string;
  target?: string;
  timestamp: string;
  acknowledged: boolean;
  metadata?: Record<string, unknown>;
};

type AlertData = {
  version: 1;
  alerts: HiveAlert[];
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ALERT_DIR = "hive-mind";
const ALERT_FILE = "alerts.json";
const MAX_ALERTS = 1_000;
const PRUNE_TO = 500;

// ---------------------------------------------------------------------------
// Alert Manager
// ---------------------------------------------------------------------------

export type AlertManagerOptions = {
  openclawDir?: string;
  onAlert?: (alert: HiveAlert) => void;
};

export class AlertManager {
  private readonly filePath: string;
  private readonly onAlert?: (alert: HiveAlert) => void;

  constructor(opts?: AlertManagerOptions) {
    const base = opts?.openclawDir ?? path.join(process.env.HOME ?? os.homedir(), ".openclaw");
    this.filePath = path.join(base, ALERT_DIR, ALERT_FILE);
    this.onAlert = opts?.onAlert;
  }

  private load(): AlertData {
    try {
      const raw = fs.readFileSync(this.filePath, "utf-8");
      return JSON.parse(raw) as AlertData;
    } catch {
      return { version: 1, alerts: [] };
    }
  }

  private save(data: AlertData): void {
    const dir = path.dirname(this.filePath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2));
  }

  /** Emit a new alert and persist it. */
  emit(
    type: AlertType,
    message: string,
    opts?: {
      target?: string;
      severity?: AlertSeverity;
      metadata?: Record<string, unknown>;
    },
  ): HiveAlert {
    const alert: HiveAlert = {
      id: `alert-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type,
      severity: opts?.severity ?? inferSeverity(type),
      message,
      source: STATION_ID,
      target: opts?.target,
      timestamp: new Date().toISOString(),
      acknowledged: false,
      metadata: opts?.metadata,
    };

    const data = this.load();
    data.alerts.push(alert);

    if (data.alerts.length > MAX_ALERTS) {
      data.alerts = data.alerts.slice(-PRUNE_TO);
    }

    this.save(data);
    this.onAlert?.(alert);
    return alert;
  }

  /** Get recent alerts, newest first. */
  getRecent(limit?: number): HiveAlert[] {
    const data = this.load();
    const sorted = [...data.alerts].toReversed();
    return limit ? sorted.slice(0, limit) : sorted;
  }

  /** Get unacknowledged alerts. */
  getActive(): HiveAlert[] {
    const data = this.load();
    return data.alerts.filter((a) => !a.acknowledged).toReversed();
  }

  /** Acknowledge an alert by ID. */
  acknowledge(alertId: string): boolean {
    const data = this.load();
    const alert = data.alerts.find((a) => a.id === alertId);
    if (!alert) {
      return false;
    }
    alert.acknowledged = true;
    this.save(data);
    return true;
  }

  /** Get total alert count. */
  get totalAlerts(): number {
    return this.load().alerts.length;
  }

  /** Clear all alerts. */
  reset(): void {
    this.save({ version: 1, alerts: [] });
  }
}

function inferSeverity(type: AlertType): AlertSeverity {
  switch (type) {
    case "station_offline":
    case "failover_triggered":
    case "internet_degraded":
      return "warning";
    case "station_online":
    case "failover_recovered":
    case "internet_restored":
      return "info";
    default:
      return "info";
  }
}

// ---------------------------------------------------------------------------
// Network scan diffing — detect station state changes
// ---------------------------------------------------------------------------

type StationState = { ip: string; label?: string; reachable: boolean };

let previousStationStates: Map<string, boolean> = new Map();

/**
 * Compare a new scan result with the previous one and emit alerts for changes.
 * Call this after each network scan cycle.
 */
export function diffStationStates(
  stations: StationState[],
  alertManager: AlertManager,
): HiveAlert[] {
  const emitted: HiveAlert[] = [];

  for (const station of stations) {
    const wasReachable = previousStationStates.get(station.ip);

    // Skip first scan (no previous state to compare)
    if (wasReachable === undefined) {
      previousStationStates.set(station.ip, station.reachable);
      continue;
    }

    const name = station.label ?? station.ip;

    if (wasReachable && !station.reachable) {
      emitted.push(
        alertManager.emit("station_offline", `Station ${name} (${station.ip}) went offline`, {
          target: station.ip,
          metadata: { station_label: name },
        }),
      );
    } else if (!wasReachable && station.reachable) {
      emitted.push(
        alertManager.emit("station_online", `Station ${name} (${station.ip}) came back online`, {
          target: station.ip,
          severity: "info",
          metadata: { station_label: name },
        }),
      );
    }

    previousStationStates.set(station.ip, station.reachable);
  }

  return emitted;
}

/**
 * Emit failover-related alerts.
 */
export function emitFailoverAlert(
  alertManager: AlertManager,
  triggered: boolean,
  fromPath: string,
  toPath: string,
): HiveAlert {
  if (triggered) {
    return alertManager.emit(
      "failover_triggered",
      `Failover triggered: switching from ${fromPath} to ${toPath}`,
      {
        severity: "warning",
        metadata: { from_path: fromPath, to_path: toPath },
      },
    );
  }
  return alertManager.emit(
    "failover_recovered",
    `Failover recovered: switched back from ${toPath} to ${fromPath}`,
    {
      severity: "info",
      metadata: { from_path: toPath, to_path: fromPath },
    },
  );
}

/** Reset internal state (for testing). */
export function resetStationStates(): void {
  previousStationStates = new Map();
}
