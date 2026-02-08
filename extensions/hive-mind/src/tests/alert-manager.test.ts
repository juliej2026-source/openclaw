import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  AlertManager,
  diffStationStates,
  emitFailoverAlert,
  resetStationStates,
} from "../alert-manager.js";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "alert-manager-test-"));
  resetStationStates();
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("AlertManager", () => {
  it("emits and persists an alert", () => {
    const mgr = new AlertManager({ openclawDir: tmpDir });
    const alert = mgr.emit("station_offline", "JULIA went offline", {
      target: "10.1.7.87",
    });

    expect(alert.type).toBe("station_offline");
    expect(alert.severity).toBe("warning");
    expect(alert.message).toBe("JULIA went offline");
    expect(alert.source).toBe("iot-hub");
    expect(alert.target).toBe("10.1.7.87");
    expect(alert.acknowledged).toBe(false);
    expect(alert.id).toMatch(/^alert-/);
  });

  it("retrieves recent alerts in reverse order", () => {
    const mgr = new AlertManager({ openclawDir: tmpDir });
    mgr.emit("station_offline", "Station A down");
    mgr.emit("station_online", "Station A back");
    mgr.emit("internet_degraded", "Packet loss detected");

    const recent = mgr.getRecent(2);
    expect(recent).toHaveLength(2);
    expect(recent[0].type).toBe("internet_degraded");
    expect(recent[1].type).toBe("station_online");
  });

  it("acknowledges an alert", () => {
    const mgr = new AlertManager({ openclawDir: tmpDir });
    const alert = mgr.emit("station_offline", "Down");

    expect(mgr.acknowledge(alert.id)).toBe(true);

    const active = mgr.getActive();
    expect(active).toHaveLength(0);
  });

  it("returns false for unknown alert ID", () => {
    const mgr = new AlertManager({ openclawDir: tmpDir });
    expect(mgr.acknowledge("nonexistent")).toBe(false);
  });

  it("getActive returns only unacknowledged alerts", () => {
    const mgr = new AlertManager({ openclawDir: tmpDir });
    const a1 = mgr.emit("station_offline", "Down 1");
    mgr.emit("station_offline", "Down 2");

    mgr.acknowledge(a1.id);

    const active = mgr.getActive();
    expect(active).toHaveLength(1);
    expect(active[0].message).toBe("Down 2");
  });

  it("tracks total alert count", () => {
    const mgr = new AlertManager({ openclawDir: tmpDir });
    expect(mgr.totalAlerts).toBe(0);

    mgr.emit("station_offline", "A");
    mgr.emit("station_online", "B");

    expect(mgr.totalAlerts).toBe(2);
  });

  it("resets all alerts", () => {
    const mgr = new AlertManager({ openclawDir: tmpDir });
    mgr.emit("station_offline", "A");
    mgr.emit("station_online", "B");
    mgr.reset();

    expect(mgr.totalAlerts).toBe(0);
  });

  it("calls onAlert callback", () => {
    const callback = vi.fn();
    const mgr = new AlertManager({ openclawDir: tmpDir, onAlert: callback });
    const alert = mgr.emit("failover_triggered", "Switching to 5G");

    expect(callback).toHaveBeenCalledOnce();
    expect(callback).toHaveBeenCalledWith(alert);
  });

  it("infers correct severity for each alert type", () => {
    const mgr = new AlertManager({ openclawDir: tmpDir });

    expect(mgr.emit("station_offline", "x").severity).toBe("warning");
    expect(mgr.emit("station_online", "x").severity).toBe("info");
    expect(mgr.emit("failover_triggered", "x").severity).toBe("warning");
    expect(mgr.emit("failover_recovered", "x").severity).toBe("info");
    expect(mgr.emit("internet_degraded", "x").severity).toBe("warning");
    expect(mgr.emit("internet_restored", "x").severity).toBe("info");
  });

  it("allows severity override", () => {
    const mgr = new AlertManager({ openclawDir: tmpDir });
    const alert = mgr.emit("station_offline", "Critical failure", {
      severity: "critical",
    });
    expect(alert.severity).toBe("critical");
  });
});

describe("diffStationStates", () => {
  it("emits station_offline when station becomes unreachable", () => {
    const mgr = new AlertManager({ openclawDir: tmpDir });
    const stations = [
      { ip: "10.1.7.87", label: "JULIA", reachable: true },
      { ip: "10.1.7.188", label: "SCRAPER", reachable: true },
    ];

    // First scan: establishes baseline (no alerts)
    diffStationStates(stations, mgr);

    // Second scan: SCRAPER goes down
    const alerts = diffStationStates(
      [
        { ip: "10.1.7.87", label: "JULIA", reachable: true },
        { ip: "10.1.7.188", label: "SCRAPER", reachable: false },
      ],
      mgr,
    );

    expect(alerts).toHaveLength(1);
    expect(alerts[0].type).toBe("station_offline");
    expect(alerts[0].target).toBe("10.1.7.188");
  });

  it("emits station_online when station recovers", () => {
    const mgr = new AlertManager({ openclawDir: tmpDir });

    // Baseline
    diffStationStates([{ ip: "10.1.7.87", label: "JULIA", reachable: false }], mgr);

    // Recovery
    const alerts = diffStationStates([{ ip: "10.1.7.87", label: "JULIA", reachable: true }], mgr);

    expect(alerts).toHaveLength(1);
    expect(alerts[0].type).toBe("station_online");
  });

  it("emits no alerts when state is unchanged", () => {
    const mgr = new AlertManager({ openclawDir: tmpDir });
    const stations = [{ ip: "10.1.7.87", label: "JULIA", reachable: true }];

    diffStationStates(stations, mgr);
    const alerts = diffStationStates(stations, mgr);

    expect(alerts).toHaveLength(0);
  });
});

describe("emitFailoverAlert", () => {
  it("emits failover_triggered alert", () => {
    const mgr = new AlertManager({ openclawDir: tmpDir });
    const alert = emitFailoverAlert(mgr, true, "primary", "hr02_5g");

    expect(alert.type).toBe("failover_triggered");
    expect(alert.severity).toBe("warning");
    expect(alert.metadata).toEqual({ from_path: "primary", to_path: "hr02_5g" });
  });

  it("emits failover_recovered alert", () => {
    const mgr = new AlertManager({ openclawDir: tmpDir });
    const alert = emitFailoverAlert(mgr, false, "primary", "hr02_5g");

    expect(alert.type).toBe("failover_recovered");
    expect(alert.severity).toBe("info");
  });
});
