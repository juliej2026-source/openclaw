import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { ExecutionLogEntry, ExecutionLogData } from "./types.js";

const DEFAULT_MAX_ENTRIES = 5_000;
const DEFAULT_PRUNE_TO = 2_500;
const LOG_DIR = "hive-mind";
const LOG_FILE = "executions.json";

export type ExecutionLogOptions = {
  maxEntries?: number;
  pruneTo?: number;
};

export class ExecutionLog {
  private readonly filePath: string;
  private readonly maxEntries: number;
  private readonly pruneTo: number;

  constructor(openclawDir?: string, opts?: ExecutionLogOptions) {
    const base = openclawDir ?? path.join(process.env.HOME ?? os.homedir(), ".openclaw");
    this.filePath = path.join(base, LOG_DIR, LOG_FILE);
    this.maxEntries = opts?.maxEntries ?? DEFAULT_MAX_ENTRIES;
    this.pruneTo = opts?.pruneTo ?? DEFAULT_PRUNE_TO;
  }

  private load(): ExecutionLogData {
    try {
      const raw = fs.readFileSync(this.filePath, "utf-8");
      return JSON.parse(raw) as ExecutionLogData;
    } catch {
      return { version: 1, entries: [] };
    }
  }

  private save(data: ExecutionLogData): void {
    const dir = path.dirname(this.filePath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2));
  }

  record(entry: ExecutionLogEntry): void {
    const data = this.load();
    data.entries.push(entry);

    if (data.entries.length > this.maxEntries) {
      // Keep the most recent entries
      data.entries = data.entries.slice(-this.pruneTo);
    }

    this.save(data);
  }

  getRecent(limit?: number): ExecutionLogEntry[] {
    const data = this.load();
    const sorted = [...data.entries].toReversed();
    return limit ? sorted.slice(0, limit) : sorted;
  }

  get totalEntries(): number {
    return this.load().entries.length;
  }

  reset(): void {
    this.save({ version: 1, entries: [] });
  }
}
