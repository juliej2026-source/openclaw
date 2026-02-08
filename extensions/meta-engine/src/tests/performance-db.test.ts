import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { PerformanceDb } from "../performance-db.js";

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "meta-perf-test-"));
}

describe("PerformanceDb", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTempDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("starts empty", () => {
    const db = new PerformanceDb(tmpDir);
    expect(db.totalRecords).toBe(0);
    expect(db.getSummary()).toEqual([]);
  });

  it("records and retrieves performance data", () => {
    const db = new PerformanceDb(tmpDir);
    db.record({
      modelId: "qwen3:14b",
      taskType: "coding",
      success: true,
      durationMs: 5000,
      timestamp: "2025-01-15T10:00:00Z",
    });
    expect(db.totalRecords).toBe(1);
    expect(db.getRecords("qwen3:14b", "coding")).toHaveLength(1);
  });

  it("calculates success rate", () => {
    const db = new PerformanceDb(tmpDir);
    db.record({
      modelId: "m1",
      taskType: "coding",
      success: true,
      durationMs: 1000,
      timestamp: "",
    });
    db.record({
      modelId: "m1",
      taskType: "coding",
      success: true,
      durationMs: 2000,
      timestamp: "",
    });
    db.record({
      modelId: "m1",
      taskType: "coding",
      success: false,
      durationMs: 3000,
      timestamp: "",
    });

    expect(db.getSuccessRate("m1", "coding")).toBeCloseTo(2 / 3);
  });

  it("returns undefined for models with no data", () => {
    const db = new PerformanceDb(tmpDir);
    expect(db.getSuccessRate("unknown", "coding")).toBeUndefined();
    expect(db.getAverageLatency("unknown")).toBeUndefined();
  });

  it("calculates average latency", () => {
    const db = new PerformanceDb(tmpDir);
    db.record({ modelId: "m1", taskType: "chat", success: true, durationMs: 1000, timestamp: "" });
    db.record({ modelId: "m1", taskType: "chat", success: true, durationMs: 3000, timestamp: "" });

    expect(db.getAverageLatency("m1", "chat")).toBe(2000);
  });

  it("generates summary grouped by model and task", () => {
    const db = new PerformanceDb(tmpDir);
    db.record({
      modelId: "m1",
      taskType: "coding",
      success: true,
      durationMs: 1000,
      timestamp: "",
    });
    db.record({
      modelId: "m1",
      taskType: "coding",
      success: false,
      durationMs: 2000,
      timestamp: "",
    });
    db.record({ modelId: "m2", taskType: "chat", success: true, durationMs: 500, timestamp: "" });

    const summary = db.getSummary();
    expect(summary).toHaveLength(2);

    const m1 = summary.find((s) => s.modelId === "m1");
    expect(m1?.totalRuns).toBe(2);
    expect(m1?.successRate).toBe(0.5);
    expect(m1?.avgLatencyMs).toBe(1500);
  });

  it("persists to disk", () => {
    const db1 = new PerformanceDb(tmpDir);
    db1.record({ modelId: "m1", taskType: "chat", success: true, durationMs: 100, timestamp: "" });

    const db2 = new PerformanceDb(tmpDir);
    expect(db2.totalRecords).toBe(1);
  });

  it("resets all data", () => {
    const db = new PerformanceDb(tmpDir);
    db.record({ modelId: "m1", taskType: "chat", success: true, durationMs: 100, timestamp: "" });
    db.reset();
    expect(db.totalRecords).toBe(0);
  });
});
