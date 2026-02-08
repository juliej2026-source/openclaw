import fs from "node:fs";
import path from "node:path";
import type { PerformanceRecord, TaskType } from "./types.js";

/**
 * JSON-file-backed performance tracking database.
 *
 * Stores performance records at ~/.openclaw/meta-engine/performance.json.
 * Uses a simple JSON file to avoid native SQLite dependencies.
 * Records are periodically pruned to keep the file size manageable.
 */

const PERF_DIR = "meta-engine";
const PERF_FILE = "performance.json";
const MAX_RECORDS = 10_000;
const PRUNE_TO = 5_000;

type PerfData = {
  version: 1;
  records: PerformanceRecord[];
};

function defaultPerfData(): PerfData {
  return { version: 1, records: [] };
}

function resolveDbPath(openclawDir?: string): string {
  const base = openclawDir ?? path.join(process.env.HOME ?? "~", ".openclaw");
  return path.join(base, PERF_DIR, PERF_FILE);
}

export class PerformanceDb {
  private readonly filePath: string;
  private data: PerfData;

  constructor(openclawDir?: string) {
    this.filePath = resolveDbPath(openclawDir);
    this.data = this.load();
  }

  private load(): PerfData {
    try {
      const raw = fs.readFileSync(this.filePath, "utf-8");
      return JSON.parse(raw) as PerfData;
    } catch {
      return defaultPerfData();
    }
  }

  private save(): void {
    const dir = path.dirname(this.filePath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2) + "\n");
  }

  /** Record a performance observation. */
  record(entry: PerformanceRecord): void {
    this.data.records.push(entry);
    // Prune old records if over limit
    if (this.data.records.length > MAX_RECORDS) {
      // Keep the most recent records
      this.data.records = this.data.records.slice(-PRUNE_TO);
    }
    this.save();
  }

  /** Get all records for a model + task type combination. */
  getRecords(modelId: string, taskType?: TaskType): PerformanceRecord[] {
    return this.data.records.filter(
      (r) => r.modelId === modelId && (taskType == null || r.taskType === taskType),
    );
  }

  /**
   * Get the success rate (0-1) for a model on a specific task type.
   * Returns undefined if no data is available.
   */
  getSuccessRate(modelId: string, taskType: TaskType): number | undefined {
    const records = this.getRecords(modelId, taskType);
    if (records.length === 0) {
      return undefined;
    }
    const successes = records.filter((r) => r.success).length;
    return successes / records.length;
  }

  /**
   * Get the average latency (ms) for a model on a task type.
   * Returns undefined if no data is available.
   */
  getAverageLatency(modelId: string, taskType?: TaskType): number | undefined {
    const records = this.getRecords(modelId, taskType);
    if (records.length === 0) {
      return undefined;
    }
    const total = records.reduce((sum, r) => sum + r.durationMs, 0);
    return total / records.length;
  }

  /** Get summary statistics for all models. */
  getSummary(): Array<{
    modelId: string;
    taskType: TaskType;
    totalRuns: number;
    successRate: number;
    avgLatencyMs: number;
  }> {
    const grouped = new Map<string, PerformanceRecord[]>();
    for (const r of this.data.records) {
      const key = `${r.modelId}|${r.taskType}`;
      const existing = grouped.get(key);
      if (existing) {
        existing.push(r);
      } else {
        grouped.set(key, [r]);
      }
    }

    return [...grouped.entries()].map(([key, records]) => {
      const [modelId, taskType] = key.split("|") as [string, TaskType];
      const successes = records.filter((r) => r.success).length;
      const totalLatency = records.reduce((sum, r) => sum + r.durationMs, 0);
      return {
        modelId,
        taskType,
        totalRuns: records.length,
        successRate: successes / records.length,
        avgLatencyMs: totalLatency / records.length,
      };
    });
  }

  /** Get total number of records. */
  get totalRecords(): number {
    return this.data.records.length;
  }

  /** Clear all records. */
  reset(): void {
    this.data = defaultPerfData();
    this.save();
  }
}
