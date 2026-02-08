import fs from "node:fs";
import path from "node:path";
import type { LoraAdapter } from "../types.js";

function trainerDir(): string {
  return path.join(process.env.HOME ?? "~", ".openclaw", "model-trainer");
}

function adaptersFile(): string {
  return path.join(trainerDir(), "adapters.json");
}

type AdaptersData = {
  version: 1;
  adapters: LoraAdapter[];
};

function loadAdapters(): AdaptersData {
  try {
    const raw = fs.readFileSync(adaptersFile(), "utf-8");
    return JSON.parse(raw) as AdaptersData;
  } catch {
    return { version: 1, adapters: [] };
  }
}

function saveAdapters(data: AdaptersData): void {
  fs.mkdirSync(trainerDir(), { recursive: true });
  fs.writeFileSync(adaptersFile(), JSON.stringify(data, null, 2) + "\n");
}

/** Register a new LoRA adapter. */
export function registerAdapter(adapter: LoraAdapter): void {
  const data = loadAdapters();
  // Replace if same ID exists
  const idx = data.adapters.findIndex((a) => a.id === adapter.id);
  if (idx >= 0) {
    data.adapters[idx] = adapter;
  } else {
    data.adapters.push(adapter);
  }
  saveAdapters(data);
}

/** Get an adapter by ID. */
export function getAdapter(adapterId: string): LoraAdapter | undefined {
  return loadAdapters().adapters.find((a) => a.id === adapterId);
}

/** List all registered adapters. */
export function listAdapters(): LoraAdapter[] {
  return loadAdapters().adapters;
}

/** Remove an adapter by ID (metadata only — does not delete files). */
export function removeAdapter(adapterId: string): boolean {
  const data = loadAdapters();
  const idx = data.adapters.findIndex((a) => a.id === adapterId);
  if (idx < 0) {
    return false;
  }
  data.adapters.splice(idx, 1);
  saveAdapters(data);
  return true;
}

/** Update eval score on an adapter. */
export function updateAdapterEvalScore(adapterId: string, score: number): boolean {
  const data = loadAdapters();
  const adapter = data.adapters.find((a) => a.id === adapterId);
  if (!adapter) {
    return false;
  }
  adapter.evalScore = score;
  saveAdapters(data);
  return true;
}

/**
 * Create an adapter record from a completed training job.
 * Reads the adapter directory to calculate size.
 */
export function createAdapterFromJob(opts: {
  jobId: string;
  name: string;
  baseModel: string;
  datasetId: string;
  outputPath: string;
}): LoraAdapter {
  let sizeBytes = 0;
  try {
    if (fs.existsSync(opts.outputPath)) {
      const files = fs.readdirSync(opts.outputPath);
      for (const f of files) {
        const stat = fs.statSync(path.join(opts.outputPath, f));
        if (stat.isFile()) {
          sizeBytes += stat.size;
        }
      }
    }
  } catch {
    // Size unknown
  }

  const adapter: LoraAdapter = {
    id: `adapter-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: opts.name,
    baseModel: opts.baseModel,
    datasetId: opts.datasetId,
    trainingJobId: opts.jobId,
    path: opts.outputPath,
    sizeBytes,
    createdAt: new Date().toISOString(),
  };

  registerAdapter(adapter);
  return adapter;
}
