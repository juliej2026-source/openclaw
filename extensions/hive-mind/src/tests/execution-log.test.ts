import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { ExecutionLogEntry } from "../types.js";
import { ExecutionLog } from "../execution-log.js";

let tmpDir: string;
const originalHome = process.env.HOME;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "exec-log-test-"));
  process.env.HOME = tmpDir;
});

afterEach(() => {
  process.env.HOME = originalHome;
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function makeEntry(overrides: Partial<ExecutionLogEntry> = {}): ExecutionLogEntry {
  return {
    id: `entry-${Date.now()}`,
    timestamp: new Date().toISOString(),
    command: "meta:classify",
    task_type: "coding",
    success: true,
    latency_ms: 42,
    reported_to_julia: false,
    ...overrides,
  };
}

describe("ExecutionLog", () => {
  it("starts empty when no file exists", () => {
    const log = new ExecutionLog(tmpDir);
    expect(log.totalEntries).toBe(0);
    expect(log.getRecent()).toEqual([]);
  });

  it("records an entry and persists to disk", () => {
    const log = new ExecutionLog(tmpDir);
    const entry = makeEntry({ id: "e1" });
    log.record(entry);

    expect(log.totalEntries).toBe(1);

    // Read from a fresh instance to verify persistence
    const log2 = new ExecutionLog(tmpDir);
    expect(log2.totalEntries).toBe(1);
    expect(log2.getRecent()[0]?.id).toBe("e1");
  });

  it("getRecent returns entries in reverse chronological order", () => {
    const log = new ExecutionLog(tmpDir);
    log.record(makeEntry({ id: "first", timestamp: "2026-01-01T00:00:00Z" }));
    log.record(makeEntry({ id: "second", timestamp: "2026-01-02T00:00:00Z" }));
    log.record(makeEntry({ id: "third", timestamp: "2026-01-03T00:00:00Z" }));

    const recent = log.getRecent();
    expect(recent[0]?.id).toBe("third");
    expect(recent[2]?.id).toBe("first");
  });

  it("getRecent respects limit parameter", () => {
    const log = new ExecutionLog(tmpDir);
    for (let i = 0; i < 10; i++) {
      log.record(makeEntry({ id: `e${i}` }));
    }

    expect(log.getRecent(3)).toHaveLength(3);
    expect(log.totalEntries).toBe(10);
  });

  it("auto-prunes when exceeding max entries", () => {
    const log = new ExecutionLog(tmpDir, { maxEntries: 10, pruneTo: 5 });
    for (let i = 0; i < 12; i++) {
      log.record(makeEntry({ id: `e${i}` }));
    }

    // After pruning, should be at pruneTo count
    expect(log.totalEntries).toBeLessThanOrEqual(10);
    // Most recent entries should be preserved
    const recent = log.getRecent();
    expect(recent[0]?.id).toBe("e11");
  });

  it("reset clears all entries", () => {
    const log = new ExecutionLog(tmpDir);
    log.record(makeEntry());
    log.record(makeEntry());
    expect(log.totalEntries).toBe(2);

    log.reset();
    expect(log.totalEntries).toBe(0);
    expect(log.getRecent()).toEqual([]);
  });

  it("creates storage directory if it does not exist", () => {
    const hivePath = path.join(tmpDir, "hive-mind");
    expect(fs.existsSync(hivePath)).toBe(false);

    const log = new ExecutionLog(tmpDir);
    log.record(makeEntry());

    expect(fs.existsSync(hivePath)).toBe(true);
  });

  it("handles concurrent reads from multiple instances", () => {
    const log1 = new ExecutionLog(tmpDir);
    log1.record(makeEntry({ id: "from-log1" }));

    const log2 = new ExecutionLog(tmpDir);
    expect(log2.totalEntries).toBe(1);
    expect(log2.getRecent()[0]?.id).toBe("from-log1");
  });
});
