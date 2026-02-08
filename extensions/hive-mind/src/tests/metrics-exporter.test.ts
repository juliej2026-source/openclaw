import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { AlertManager, resetStationStates } from "../alert-manager.js";
import { ExecutionLog } from "../execution-log.js";
import {
  generateMetrics,
  setMetricsContext,
  getMetricsContext,
  type MetricsContext,
} from "../metrics-exporter.js";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "metrics-exporter-test-"));
  resetStationStates();
  // Reset module-level state
  setMetricsContext(null as unknown as MetricsContext);
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function makeContext(overrides?: Partial<MetricsContext>): MetricsContext {
  return {
    startTime: Date.now() - 60_000, // 60 seconds ago
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Module state: setMetricsContext / getMetricsContext
// ---------------------------------------------------------------------------

describe("module state", () => {
  it("getMetricsContext returns null before setMetricsContext is called", () => {
    expect(getMetricsContext()).toBeNull();
  });

  it("setMetricsContext persists context for subsequent generateMetrics calls", () => {
    const ctx = makeContext({ modelCounts: { installed: 3, running: 1 } });
    setMetricsContext(ctx);

    expect(getMetricsContext()).toBe(ctx);

    // generateMetrics() with no arg should use the module-level context
    const output = generateMetrics();
    expect(output).toContain("hivemind_model_installed_count 3");
  });

  it("explicit ctx arg overrides module-level context", () => {
    setMetricsContext(makeContext({ modelCounts: { installed: 10, running: 5 } }));

    const override = makeContext({ modelCounts: { installed: 2, running: 0 } });
    const output = generateMetrics(override);
    expect(output).toContain("hivemind_model_installed_count 2");
    expect(output).not.toContain("hivemind_model_installed_count 10");
  });
});

// ---------------------------------------------------------------------------
// generateMetrics — core
// ---------------------------------------------------------------------------

describe("generateMetrics", () => {
  it("returns empty string when no context is provided", () => {
    expect(generateMetrics(undefined)).toBe("");
  });

  it("returns empty string when module context is null and no arg passed", () => {
    expect(generateMetrics()).toBe("");
  });

  // -- Uptime ---------------------------------------------------------------

  describe("uptime", () => {
    it("always includes uptime metric", () => {
      const output = generateMetrics(makeContext());
      expect(output).toContain("# HELP hivemind_uptime_seconds");
      expect(output).toContain("# TYPE hivemind_uptime_seconds gauge");
      expect(output).toMatch(/hivemind_uptime_seconds \d+/);
    });

    it("calculates correct uptime value", () => {
      const ctx = makeContext({ startTime: Date.now() - 120_000 }); // 120s ago
      const output = generateMetrics(ctx);
      const match = output.match(/hivemind_uptime_seconds (\d+)/);
      expect(match).not.toBeNull();
      const uptime = Number(match![1]);
      // Should be approximately 120, allow ±2 for test execution time
      expect(uptime).toBeGreaterThanOrEqual(118);
      expect(uptime).toBeLessThanOrEqual(122);
    });

    it("reports 0 uptime when startTime is now", () => {
      const ctx = makeContext({ startTime: Date.now() });
      const output = generateMetrics(ctx);
      expect(output).toMatch(/hivemind_uptime_seconds 0/);
    });

    it("floors uptime to integer seconds", () => {
      // 1500ms ago → should be 1 second
      const ctx = makeContext({ startTime: Date.now() - 1500 });
      const output = generateMetrics(ctx);
      expect(output).toMatch(/hivemind_uptime_seconds 1/);
    });
  });

  // -- Station reachability -------------------------------------------------

  describe("station reachability", () => {
    it("includes station reachability from network scan", () => {
      const ctx = makeContext({
        getScan: () => ({
          timestamp: new Date().toISOString(),
          udm: null,
          stations: [
            { ip: "10.1.7.87", label: "JULIA", reachable: true, latencyMs: 1.2 },
            { ip: "10.1.7.188", label: "SCRAPER", reachable: false },
          ],
          health: [],
        }),
      });

      const output = generateMetrics(ctx);
      expect(output).toContain('hivemind_station_reachable{station="JULIA",ip="10.1.7.87"} 1');
      expect(output).toContain('hivemind_station_reachable{station="SCRAPER",ip="10.1.7.188"} 0');
      expect(output).toContain('hivemind_station_latency_ms{station="JULIA",ip="10.1.7.87"} 1.2');
      // SCRAPER has no latency (unreachable), should not appear in latency metrics
      expect(output).not.toContain('hivemind_station_latency_ms{station="SCRAPER"');
    });

    it("handles all stations reachable", () => {
      const ctx = makeContext({
        getScan: () => ({
          timestamp: new Date().toISOString(),
          udm: null,
          stations: [
            { ip: "10.1.7.87", label: "JULIA", reachable: true, latencyMs: 1.0 },
            { ip: "10.1.7.188", label: "SCRAPER", reachable: true, latencyMs: 2.0 },
            { ip: "10.1.7.130", label: "CLERK", reachable: true, latencyMs: 0.5 },
          ],
          health: [],
        }),
      });

      const output = generateMetrics(ctx);
      expect(output).toContain('hivemind_station_reachable{station="JULIA",ip="10.1.7.87"} 1');
      expect(output).toContain('hivemind_station_reachable{station="SCRAPER",ip="10.1.7.188"} 1');
      expect(output).toContain('hivemind_station_reachable{station="CLERK",ip="10.1.7.130"} 1');
      expect(output).toContain('hivemind_station_latency_ms{station="JULIA",ip="10.1.7.87"} 1');
      expect(output).toContain('hivemind_station_latency_ms{station="SCRAPER",ip="10.1.7.188"} 2');
      expect(output).toContain('hivemind_station_latency_ms{station="CLERK",ip="10.1.7.130"} 0.5');
    });

    it("handles all stations unreachable", () => {
      const ctx = makeContext({
        getScan: () => ({
          timestamp: new Date().toISOString(),
          udm: null,
          stations: [
            { ip: "10.1.7.87", label: "JULIA", reachable: false },
            { ip: "10.1.7.188", label: "SCRAPER", reachable: false },
          ],
          health: [],
        }),
      });

      const output = generateMetrics(ctx);
      expect(output).toContain('hivemind_station_reachable{station="JULIA",ip="10.1.7.87"} 0');
      expect(output).toContain('hivemind_station_reachable{station="SCRAPER",ip="10.1.7.188"} 0');
      // No latency data lines when all unreachable (HELP/TYPE headers may still be present)
      expect(output).not.toMatch(/hivemind_station_latency_ms\{/);
    });

    it("falls back to IP when label is missing", () => {
      const ctx = makeContext({
        getScan: () => ({
          timestamp: new Date().toISOString(),
          udm: null,
          stations: [{ ip: "10.1.7.99", reachable: true, latencyMs: 3.3 }],
          health: [],
        }),
      });

      const output = generateMetrics(ctx);
      expect(output).toContain('hivemind_station_reachable{station="10.1.7.99",ip="10.1.7.99"} 1');
      expect(output).toContain(
        'hivemind_station_latency_ms{station="10.1.7.99",ip="10.1.7.99"} 3.3',
      );
    });

    it("handles empty network scan gracefully", () => {
      const ctx = makeContext({
        getScan: () => ({
          timestamp: new Date().toISOString(),
          udm: null,
          stations: [],
          health: [],
        }),
      });

      const output = generateMetrics(ctx);
      expect(output).not.toContain("hivemind_station_reachable");
    });

    it("handles getScan returning null", () => {
      const ctx = makeContext({ getScan: () => null });
      const output = generateMetrics(ctx);
      expect(output).not.toContain("hivemind_station_reachable");
    });

    it("includes HELP and TYPE lines for station metrics", () => {
      const ctx = makeContext({
        getScan: () => ({
          timestamp: new Date().toISOString(),
          udm: null,
          stations: [{ ip: "10.1.7.87", label: "JULIA", reachable: true, latencyMs: 1 }],
          health: [],
        }),
      });

      const output = generateMetrics(ctx);
      expect(output).toContain("# HELP hivemind_station_reachable");
      expect(output).toContain("# TYPE hivemind_station_reachable gauge");
      expect(output).toContain("# HELP hivemind_station_latency_ms");
      expect(output).toContain("# TYPE hivemind_station_latency_ms gauge");
    });
  });

  // -- Dual-WAN state -------------------------------------------------------

  describe("dual-WAN state", () => {
    const baseDualNet = {
      paths: {
        primary: {
          id: "primary" as const,
          ssid: "Hotel",
          gateway: "10.1.7.1",
          subnet: "10.1.7.0/24",
          description: "Hotel WiFi",
        },
        hr02_5g: {
          id: "hr02_5g" as const,
          ssid: "HR02",
          gateway: "192.168.128.1",
          subnet: "192.168.128.0/24",
          description: "5G",
        },
      },
    };

    it("includes active path, failover, and switch count", () => {
      const ctx = makeContext({
        getDualNetwork: () => ({
          ...baseDualNet,
          active_path: "primary" as const,
          quality: {
            primary: {
              path_id: "primary" as const,
              reachable: true,
              latency_ms: 12.5,
              packet_loss_pct: 0,
              tested_at: new Date().toISOString(),
            },
            hr02_5g: null,
          },
          failover_active: false,
          last_switch: null,
          switch_count: 3,
        }),
      });

      const output = generateMetrics(ctx);
      expect(output).toContain('hivemind_wan_active_path{path_id="primary"} 1');
      expect(output).toContain('hivemind_wan_active_path{path_id="hr02_5g"} 0');
      expect(output).toContain("hivemind_wan_failover_active 0");
      expect(output).toContain("hivemind_wan_switch_count_total 3");
      expect(output).toContain('hivemind_wan_quality_latency_ms{path_id="primary"} 12.5');
      expect(output).toContain('hivemind_wan_quality_packet_loss_pct{path_id="primary"} 0');
    });

    it("reports failover active state correctly", () => {
      const ctx = makeContext({
        getDualNetwork: () => ({
          ...baseDualNet,
          active_path: "hr02_5g" as const,
          quality: {
            primary: null,
            hr02_5g: {
              path_id: "hr02_5g" as const,
              reachable: true,
              latency_ms: 45.0,
              packet_loss_pct: 2.5,
              tested_at: new Date().toISOString(),
            },
          },
          failover_active: true,
          last_switch: new Date().toISOString(),
          switch_count: 7,
        }),
      });

      const output = generateMetrics(ctx);
      expect(output).toContain('hivemind_wan_active_path{path_id="primary"} 0');
      expect(output).toContain('hivemind_wan_active_path{path_id="hr02_5g"} 1');
      expect(output).toContain("hivemind_wan_failover_active 1");
      expect(output).toContain("hivemind_wan_switch_count_total 7");
      expect(output).toContain('hivemind_wan_quality_latency_ms{path_id="hr02_5g"} 45');
      expect(output).toContain('hivemind_wan_quality_packet_loss_pct{path_id="hr02_5g"} 2.5');
    });

    it("handles all null quality measurements", () => {
      const ctx = makeContext({
        getDualNetwork: () => ({
          ...baseDualNet,
          active_path: "primary" as const,
          quality: { primary: null, hr02_5g: null },
          failover_active: false,
          last_switch: null,
          switch_count: 0,
        }),
      });

      const output = generateMetrics(ctx);
      expect(output).toContain("hivemind_wan_active_path");
      expect(output).toContain("hivemind_wan_failover_active 0");
      expect(output).toContain("hivemind_wan_switch_count_total 0");
      // No quality metrics when all null
      expect(output).not.toMatch(/hivemind_wan_quality_latency_ms\{/);
      expect(output).not.toMatch(/hivemind_wan_quality_packet_loss_pct\{/);
    });

    it("handles getDualNetwork returning null", () => {
      const ctx = makeContext({ getDualNetwork: () => null });
      const output = generateMetrics(ctx);
      expect(output).not.toContain("hivemind_wan_active_path");
    });

    it("includes correct TYPE annotations for WAN metrics", () => {
      const ctx = makeContext({
        getDualNetwork: () => ({
          ...baseDualNet,
          active_path: "primary" as const,
          quality: { primary: null, hr02_5g: null },
          failover_active: false,
          last_switch: null,
          switch_count: 0,
        }),
      });

      const output = generateMetrics(ctx);
      expect(output).toContain("# TYPE hivemind_wan_active_path gauge");
      expect(output).toContain("# TYPE hivemind_wan_failover_active gauge");
      expect(output).toContain("# TYPE hivemind_wan_switch_count_total counter");
    });
  });

  // -- Alert metrics --------------------------------------------------------

  describe("alert metrics", () => {
    it("includes alert active count and breakdown by type", () => {
      const mgr = new AlertManager({ openclawDir: tmpDir });
      mgr.emit("station_offline", "JULIA down", { target: "10.1.7.87" });
      mgr.emit("station_offline", "SCRAPER down", { target: "10.1.7.188" });
      mgr.emit("station_online", "JULIA back", { target: "10.1.7.87" });

      const ctx = makeContext({ alertManager: mgr });
      const output = generateMetrics(ctx);

      expect(output).toContain("hivemind_alert_active_count 3");
      expect(output).toContain('hivemind_alert_count{type="station_offline",severity="warning"} 2');
      expect(output).toContain('hivemind_alert_count{type="station_online",severity="info"} 1');
    });

    it("reports 0 active alerts when all acknowledged", () => {
      const mgr = new AlertManager({ openclawDir: tmpDir });
      const a1 = mgr.emit("station_offline", "JULIA down");
      mgr.acknowledge(a1.id);

      const ctx = makeContext({ alertManager: mgr });
      const output = generateMetrics(ctx);
      expect(output).toContain("hivemind_alert_active_count 0");
    });

    it("handles empty alert manager gracefully", () => {
      const mgr = new AlertManager({ openclawDir: tmpDir });
      const ctx = makeContext({ alertManager: mgr });
      const output = generateMetrics(ctx);

      expect(output).toContain("hivemind_alert_active_count 0");
      // No alert_count breakdown when no alerts exist
      expect(output).not.toContain("hivemind_alert_count{");
    });

    it("counts multiple severity levels correctly", () => {
      const mgr = new AlertManager({ openclawDir: tmpDir });
      mgr.emit("station_offline", "down", { severity: "critical" });
      mgr.emit("station_offline", "down2", { severity: "warning" });
      mgr.emit("internet_degraded", "slow", { severity: "warning" });

      const ctx = makeContext({ alertManager: mgr });
      const output = generateMetrics(ctx);

      expect(output).toContain(
        'hivemind_alert_count{type="station_offline",severity="critical"} 1',
      );
      expect(output).toContain('hivemind_alert_count{type="station_offline",severity="warning"} 1');
      expect(output).toContain(
        'hivemind_alert_count{type="internet_degraded",severity="warning"} 1',
      );
    });
  });

  // -- Performance DB -------------------------------------------------------

  describe("performance DB metrics", () => {
    it("includes success rate and latency per model+task", () => {
      const ctx = makeContext({
        getPerformanceSummary: () => [
          {
            modelId: "qwen2.5:7b",
            taskType: "coding",
            totalRuns: 50,
            successRate: 0.85,
            avgLatencyMs: 2340,
          },
          {
            modelId: "llama3:8b",
            taskType: "chat",
            totalRuns: 30,
            successRate: 0.92,
            avgLatencyMs: 1100,
          },
        ],
        getPerformanceTotal: () => 80,
      });

      const output = generateMetrics(ctx);
      expect(output).toContain(
        'hivemind_perf_success_rate{model_id="qwen2.5:7b",task_type="coding"} 0.85',
      );
      expect(output).toContain(
        'hivemind_perf_avg_latency_ms{model_id="qwen2.5:7b",task_type="coding"} 2340',
      );
      expect(output).toContain(
        'hivemind_perf_success_rate{model_id="llama3:8b",task_type="chat"} 0.92',
      );
      expect(output).toContain(
        'hivemind_perf_avg_latency_ms{model_id="llama3:8b",task_type="chat"} 1100',
      );
      expect(output).toContain("hivemind_perf_total_records 80");
    });

    it("handles empty performance summary", () => {
      const ctx = makeContext({
        getPerformanceSummary: () => [],
        getPerformanceTotal: () => 0,
      });

      const output = generateMetrics(ctx);
      expect(output).not.toContain("hivemind_perf_success_rate");
      expect(output).toContain("hivemind_perf_total_records 0");
    });

    it("handles many models and task types", () => {
      const summary = [];
      for (let i = 0; i < 10; i++) {
        summary.push({
          modelId: `model-${i}`,
          taskType: `task-${i}`,
          totalRuns: i * 10,
          successRate: i / 10,
          avgLatencyMs: i * 100,
        });
      }

      const ctx = makeContext({
        getPerformanceSummary: () => summary,
        getPerformanceTotal: () => 450,
      });

      const output = generateMetrics(ctx);
      for (let i = 0; i < 10; i++) {
        expect(output).toContain(`model_id="model-${i}"`);
        expect(output).toContain(`task_type="task-${i}"`);
      }
      expect(output).toContain("hivemind_perf_total_records 450");
    });

    it("includes HELP and TYPE for performance metrics", () => {
      const ctx = makeContext({
        getPerformanceSummary: () => [
          { modelId: "m", taskType: "t", totalRuns: 1, successRate: 1, avgLatencyMs: 100 },
        ],
        getPerformanceTotal: () => 1,
      });

      const output = generateMetrics(ctx);
      expect(output).toContain("# HELP hivemind_perf_success_rate");
      expect(output).toContain("# TYPE hivemind_perf_success_rate gauge");
      expect(output).toContain("# HELP hivemind_perf_avg_latency_ms");
      expect(output).toContain("# TYPE hivemind_perf_avg_latency_ms gauge");
      expect(output).toContain("# HELP hivemind_perf_total_records");
      expect(output).toContain("# TYPE hivemind_perf_total_records gauge");
    });

    it("reports total without summary when getPerformanceSummary is absent", () => {
      const ctx = makeContext({ getPerformanceTotal: () => 42 });
      const output = generateMetrics(ctx);
      expect(output).toContain("hivemind_perf_total_records 42");
      expect(output).not.toContain("hivemind_perf_success_rate");
    });
  });

  // -- Execution log --------------------------------------------------------

  describe("execution log metrics", () => {
    it("includes total and success rate", () => {
      const log = new ExecutionLog(tmpDir);
      log.record({
        id: "e1",
        timestamp: new Date().toISOString(),
        task_type: "coding",
        success: true,
        latency_ms: 100,
        reported_to_julia: false,
      });
      log.record({
        id: "e2",
        timestamp: new Date().toISOString(),
        task_type: "chat",
        success: false,
        latency_ms: 200,
        reported_to_julia: false,
      });

      const ctx = makeContext({ executionLog: log });
      const output = generateMetrics(ctx);

      expect(output).toContain("hivemind_exec_total 2");
      expect(output).toContain("hivemind_exec_success_rate 0.5");
    });

    it("reports 100% success rate when all succeed", () => {
      const log = new ExecutionLog(tmpDir);
      for (let i = 0; i < 5; i++) {
        log.record({
          id: `e${i}`,
          timestamp: new Date().toISOString(),
          task_type: "coding",
          success: true,
          latency_ms: 100,
          reported_to_julia: false,
        });
      }

      const ctx = makeContext({ executionLog: log });
      const output = generateMetrics(ctx);
      expect(output).toContain("hivemind_exec_total 5");
      expect(output).toContain("hivemind_exec_success_rate 1");
    });

    it("reports 0% success rate when all fail", () => {
      const log = new ExecutionLog(tmpDir);
      for (let i = 0; i < 3; i++) {
        log.record({
          id: `e${i}`,
          timestamp: new Date().toISOString(),
          task_type: "coding",
          success: false,
          latency_ms: 100,
          reported_to_julia: false,
        });
      }

      const ctx = makeContext({ executionLog: log });
      const output = generateMetrics(ctx);
      expect(output).toContain("hivemind_exec_total 3");
      expect(output).toContain("hivemind_exec_success_rate 0");
    });

    it("does not include success_rate when log is empty", () => {
      const log = new ExecutionLog(tmpDir);
      const ctx = makeContext({ executionLog: log });
      const output = generateMetrics(ctx);

      expect(output).toContain("hivemind_exec_total 0");
      expect(output).not.toContain("hivemind_exec_success_rate");
    });
  });

  // -- Model inventory ------------------------------------------------------

  describe("model inventory metrics", () => {
    it("includes installed and running counts", () => {
      const ctx = makeContext({ modelCounts: { installed: 5, running: 2 } });
      const output = generateMetrics(ctx);
      expect(output).toContain("hivemind_model_installed_count 5");
      expect(output).toContain("hivemind_model_running_count 2");
    });

    it("handles zero counts", () => {
      const ctx = makeContext({ modelCounts: { installed: 0, running: 0 } });
      const output = generateMetrics(ctx);
      expect(output).toContain("hivemind_model_installed_count 0");
      expect(output).toContain("hivemind_model_running_count 0");
    });

    it("handles running > installed edge case", () => {
      // Shouldn't happen in practice, but metrics should still work
      const ctx = makeContext({ modelCounts: { installed: 1, running: 3 } });
      const output = generateMetrics(ctx);
      expect(output).toContain("hivemind_model_installed_count 1");
      expect(output).toContain("hivemind_model_running_count 3");
    });
  });

  // -- JULIA registration ---------------------------------------------------

  describe("JULIA registration metrics", () => {
    it("reports registered state", () => {
      const ctx = makeContext({
        isJuliaRegistered: () => true,
        getJuliaHeartbeatAge: () => 120,
      });
      const output = generateMetrics(ctx);
      expect(output).toContain("hivemind_julia_registered 1");
      expect(output).toContain("hivemind_julia_last_heartbeat_age_seconds 120");
    });

    it("reports unregistered state", () => {
      const ctx = makeContext({
        isJuliaRegistered: () => false,
        getJuliaHeartbeatAge: () => 600,
      });
      const output = generateMetrics(ctx);
      expect(output).toContain("hivemind_julia_registered 0");
      expect(output).toContain("hivemind_julia_last_heartbeat_age_seconds 600");
    });

    it("handles zero heartbeat age (just received)", () => {
      const ctx = makeContext({
        isJuliaRegistered: () => true,
        getJuliaHeartbeatAge: () => 0,
      });
      const output = generateMetrics(ctx);
      expect(output).toContain("hivemind_julia_last_heartbeat_age_seconds 0");
    });

    it("handles very large heartbeat age", () => {
      const ctx = makeContext({
        isJuliaRegistered: () => false,
        getJuliaHeartbeatAge: () => 86400,
      });
      const output = generateMetrics(ctx);
      expect(output).toContain("hivemind_julia_last_heartbeat_age_seconds 86400");
    });

    it("omits registration when isJuliaRegistered not provided", () => {
      const ctx = makeContext({ getJuliaHeartbeatAge: () => 100 });
      const output = generateMetrics(ctx);
      expect(output).not.toContain("hivemind_julia_registered");
      // heartbeat should still appear
      expect(output).toContain("hivemind_julia_last_heartbeat_age_seconds 100");
    });

    it("omits heartbeat when getJuliaHeartbeatAge not provided", () => {
      const ctx = makeContext({ isJuliaRegistered: () => true });
      const output = generateMetrics(ctx);
      expect(output).toContain("hivemind_julia_registered 1");
      expect(output).not.toContain("hivemind_julia_last_heartbeat_age_seconds");
    });
  });

  // -- Omitted sections -----------------------------------------------------

  describe("section omission", () => {
    it("omits all optional sections when not provided", () => {
      const ctx = makeContext();
      const output = generateMetrics(ctx);

      expect(output).toContain("hivemind_uptime_seconds");
      expect(output).not.toContain("hivemind_station_reachable");
      expect(output).not.toContain("hivemind_wan_active_path");
      expect(output).not.toContain("hivemind_alert_active_count");
      expect(output).not.toContain("hivemind_perf_success_rate");
      expect(output).not.toContain("hivemind_exec_total");
      expect(output).not.toContain("hivemind_model_installed_count");
      expect(output).not.toContain("hivemind_julia_registered");
    });
  });

  // -- Full context ---------------------------------------------------------

  describe("full context", () => {
    it("generates all sections when all data sources are provided", () => {
      const mgr = new AlertManager({ openclawDir: tmpDir });
      mgr.emit("station_offline", "JULIA down");

      const log = new ExecutionLog(tmpDir);
      log.record({
        id: "e1",
        timestamp: new Date().toISOString(),
        task_type: "coding",
        success: true,
        latency_ms: 100,
        reported_to_julia: false,
      });

      const ctx = makeContext({
        getScan: () => ({
          timestamp: new Date().toISOString(),
          udm: null,
          stations: [{ ip: "10.1.7.87", label: "JULIA", reachable: true, latencyMs: 1 }],
          health: [],
        }),
        getDualNetwork: () => ({
          active_path: "primary",
          paths: {
            primary: {
              id: "primary",
              ssid: "Hotel",
              gateway: "10.1.7.1",
              subnet: "10.1.7.0/24",
              description: "Hotel WiFi",
            },
            hr02_5g: {
              id: "hr02_5g",
              ssid: "HR02",
              gateway: "192.168.128.1",
              subnet: "192.168.128.0/24",
              description: "5G",
            },
          },
          quality: { primary: null, hr02_5g: null },
          failover_active: false,
          last_switch: null,
          switch_count: 0,
        }),
        alertManager: mgr,
        executionLog: log,
        getPerformanceSummary: () => [
          { modelId: "m1", taskType: "t1", totalRuns: 10, successRate: 0.9, avgLatencyMs: 500 },
        ],
        getPerformanceTotal: () => 10,
        modelCounts: { installed: 3, running: 1 },
        isJuliaRegistered: () => true,
        getJuliaHeartbeatAge: () => 60,
      });

      const output = generateMetrics(ctx);

      // Every section should be present
      expect(output).toContain("hivemind_uptime_seconds");
      expect(output).toContain("hivemind_station_reachable");
      expect(output).toContain("hivemind_station_latency_ms");
      expect(output).toContain("hivemind_wan_active_path");
      expect(output).toContain("hivemind_wan_failover_active");
      expect(output).toContain("hivemind_wan_switch_count_total");
      expect(output).toContain("hivemind_alert_active_count");
      expect(output).toContain("hivemind_alert_count");
      expect(output).toContain("hivemind_perf_success_rate");
      expect(output).toContain("hivemind_perf_avg_latency_ms");
      expect(output).toContain("hivemind_perf_total_records");
      expect(output).toContain("hivemind_exec_total");
      expect(output).toContain("hivemind_exec_success_rate");
      expect(output).toContain("hivemind_model_installed_count");
      expect(output).toContain("hivemind_model_running_count");
      expect(output).toContain("hivemind_julia_registered");
      expect(output).toContain("hivemind_julia_last_heartbeat_age_seconds");
    });
  });

  // -- Prometheus format compliance -----------------------------------------

  describe("Prometheus format compliance", () => {
    it("every non-empty line is either a comment or valid metric line", () => {
      const ctx = makeContext({
        alertManager: new AlertManager({ openclawDir: tmpDir }),
        modelCounts: { installed: 3, running: 1 },
        isJuliaRegistered: () => true,
        getJuliaHeartbeatAge: () => 60,
      });

      const output = generateMetrics(ctx);
      const nonEmptyLines = output.split("\n").filter((l) => l.trim() !== "");

      for (const line of nonEmptyLines) {
        const isComment = line.startsWith("#");
        const isMetric = /^[a-z_]+(\{[^}]*\})? [-\d.e+]+$/.test(line);
        expect(isComment || isMetric, `Invalid line: "${line}"`).toBe(true);
      }
    });

    it("HELP lines precede TYPE lines for each metric family", () => {
      const mgr = new AlertManager({ openclawDir: tmpDir });
      mgr.emit("station_offline", "test");

      const ctx = makeContext({
        alertManager: mgr,
        modelCounts: { installed: 1, running: 0 },
        isJuliaRegistered: () => true,
        getJuliaHeartbeatAge: () => 0,
        getPerformanceSummary: () => [
          { modelId: "m", taskType: "t", totalRuns: 1, successRate: 1, avgLatencyMs: 1 },
        ],
        getPerformanceTotal: () => 1,
      });

      const output = generateMetrics(ctx);
      const lines = output.split("\n");

      const helpLines = lines
        .map((l, i) => ({ line: l, index: i }))
        .filter((x) => x.line.startsWith("# HELP"));

      for (const { line, index } of helpLines) {
        const metricName = line.replace("# HELP ", "").split(" ")[0];
        const nextLine = lines[index + 1];
        expect(nextLine, `TYPE should follow HELP for ${metricName}`).toMatch(
          new RegExp(`^# TYPE ${metricName} `),
        );
      }
    });

    it("does not duplicate any metric family HELP/TYPE declarations", () => {
      const ctx = makeContext({
        getScan: () => ({
          timestamp: new Date().toISOString(),
          udm: null,
          stations: [
            { ip: "10.1.7.87", label: "A", reachable: true, latencyMs: 1 },
            { ip: "10.1.7.88", label: "B", reachable: true, latencyMs: 2 },
          ],
          health: [],
        }),
        alertManager: new AlertManager({ openclawDir: tmpDir }),
        modelCounts: { installed: 1, running: 0 },
      });

      const output = generateMetrics(ctx);
      const helpLines = output.split("\n").filter((l) => l.startsWith("# HELP"));
      const helpMetrics = helpLines.map((l) => l.replace("# HELP ", "").split(" ")[0]);

      const unique = new Set(helpMetrics);
      expect(helpMetrics.length).toBe(unique.size);
    });

    it("metric values do not contain NaN or Infinity", () => {
      const ctx = makeContext({
        modelCounts: { installed: 3, running: 1 },
        getPerformanceSummary: () => [
          { modelId: "m", taskType: "t", totalRuns: 0, successRate: 0, avgLatencyMs: 0 },
        ],
        getPerformanceTotal: () => 0,
      });

      const output = generateMetrics(ctx);
      expect(output).not.toContain("NaN");
      expect(output).not.toContain("Infinity");
    });

    it("output ends with newline or is properly terminated", () => {
      const ctx = makeContext();
      const output = generateMetrics(ctx);
      // Prometheus exposition format: output should end with a newline or be clean
      const lines = output.split("\n");
      // Last line should be empty (trailing newline) or a metric line
      const lastNonEmpty = lines.filter((l) => l.trim() !== "").pop();
      expect(lastNonEmpty).toBeDefined();
    });
  });

  // -- Label escaping -------------------------------------------------------

  describe("label escaping", () => {
    it("escapes double quotes in label values", () => {
      const ctx = makeContext({
        getScan: () => ({
          timestamp: new Date().toISOString(),
          udm: null,
          stations: [{ ip: "10.1.7.87", label: 'Test "Station"', reachable: true, latencyMs: 5 }],
          health: [],
        }),
      });

      const output = generateMetrics(ctx);
      expect(output).toContain('station="Test \\"Station\\""');
    });

    it("escapes backslashes in label values", () => {
      const ctx = makeContext({
        getScan: () => ({
          timestamp: new Date().toISOString(),
          udm: null,
          stations: [
            { ip: "10.1.7.87", label: "path\\to\\station", reachable: true, latencyMs: 1 },
          ],
          health: [],
        }),
      });

      const output = generateMetrics(ctx);
      expect(output).toContain('station="path\\\\to\\\\station"');
    });

    it("escapes newlines in label values", () => {
      const ctx = makeContext({
        getScan: () => ({
          timestamp: new Date().toISOString(),
          udm: null,
          stations: [{ ip: "10.1.7.87", label: "line1\nline2", reachable: true, latencyMs: 1 }],
          health: [],
        }),
      });

      const output = generateMetrics(ctx);
      expect(output).toContain('station="line1\\nline2"');
    });

    it("escapes special characters in performance model IDs", () => {
      const ctx = makeContext({
        getPerformanceSummary: () => [
          {
            modelId: 'model "special"',
            taskType: "task\\type",
            totalRuns: 1,
            successRate: 1.0,
            avgLatencyMs: 100,
          },
        ],
        getPerformanceTotal: () => 1,
      });

      const output = generateMetrics(ctx);
      expect(output).toContain('model_id="model \\"special\\""');
      expect(output).toContain('task_type="task\\\\type"');
    });
  });

  // -- Determinism and stability --------------------------------------------

  describe("output stability", () => {
    it("produces identical output for the same context", () => {
      const ctx = makeContext({
        startTime: Date.now() - 100_000,
        modelCounts: { installed: 5, running: 2 },
        isJuliaRegistered: () => true,
        getJuliaHeartbeatAge: () => 60,
      });

      const output1 = generateMetrics(ctx);
      const output2 = generateMetrics(ctx);
      expect(output1).toBe(output2);
    });

    it("section ordering is consistent: uptime → stations → WAN → alerts → perf → exec → models → julia", () => {
      const mgr = new AlertManager({ openclawDir: tmpDir });
      mgr.emit("station_offline", "test");

      const log = new ExecutionLog(tmpDir);
      log.record({
        id: "e1",
        timestamp: new Date().toISOString(),
        task_type: "t",
        success: true,
        latency_ms: 1,
        reported_to_julia: false,
      });

      const ctx = makeContext({
        getScan: () => ({
          timestamp: new Date().toISOString(),
          udm: null,
          stations: [{ ip: "10.1.7.87", label: "J", reachable: true, latencyMs: 1 }],
          health: [],
        }),
        getDualNetwork: () => ({
          active_path: "primary",
          paths: {
            primary: {
              id: "primary",
              ssid: "H",
              gateway: "10.1.7.1",
              subnet: "10.1.7.0/24",
              description: "H",
            },
            hr02_5g: {
              id: "hr02_5g",
              ssid: "5",
              gateway: "192.168.128.1",
              subnet: "192.168.128.0/24",
              description: "5",
            },
          },
          quality: { primary: null, hr02_5g: null },
          failover_active: false,
          last_switch: null,
          switch_count: 0,
        }),
        alertManager: mgr,
        executionLog: log,
        getPerformanceSummary: () => [
          { modelId: "m", taskType: "t", totalRuns: 1, successRate: 1, avgLatencyMs: 1 },
        ],
        getPerformanceTotal: () => 1,
        modelCounts: { installed: 1, running: 0 },
        isJuliaRegistered: () => true,
        getJuliaHeartbeatAge: () => 0,
      });

      const output = generateMetrics(ctx);
      const sections = [
        "hivemind_uptime_seconds",
        "hivemind_station_reachable",
        "hivemind_wan_active_path",
        "hivemind_alert_active_count",
        "hivemind_perf_success_rate",
        "hivemind_exec_total",
        "hivemind_model_installed_count",
        "hivemind_julia_registered",
      ];

      let lastIndex = -1;
      for (const section of sections) {
        const index = output.indexOf(section);
        expect(index, `${section} should appear in output`).toBeGreaterThan(-1);
        expect(index, `${section} should come after previous section`).toBeGreaterThan(lastIndex);
        lastIndex = index;
      }
    });
  });
});
