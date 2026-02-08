import fs from "node:fs";
import path from "node:path";
import type { LocalModel, ModelCapability, ModelRuntime } from "./types.js";

/**
 * JSON-file-backed model inventory.
 *
 * Stores the model catalog at ~/.openclaw/model-manager/inventory.json.
 * Uses a simple JSON file instead of SQLite to avoid a native dependency;
 * the dataset is small (dozens of models at most) so this is adequate.
 */

const INVENTORY_DIR = "model-manager";
const INVENTORY_FILE = "inventory.json";

type InventoryData = {
  version: 1;
  models: LocalModel[];
};

function defaultInventory(): InventoryData {
  return { version: 1, models: [] };
}

function resolveInventoryPath(openclawDir?: string): string {
  const base = openclawDir ?? path.join(process.env.HOME ?? "~", ".openclaw");
  return path.join(base, INVENTORY_DIR, INVENTORY_FILE);
}

function loadInventory(filePath: string): InventoryData {
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as InventoryData;
  } catch {
    return defaultInventory();
  }
}

function saveInventory(filePath: string, data: InventoryData): void {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n");
}

export class ModelInventory {
  private readonly filePath: string;
  private data: InventoryData;

  constructor(openclawDir?: string) {
    this.filePath = resolveInventoryPath(openclawDir);
    this.data = loadInventory(this.filePath);
  }

  /** Get all models in the inventory. */
  listAll(): LocalModel[] {
    return [...this.data.models];
  }

  /** Get models filtered by capability. */
  listByCapability(capability: ModelCapability): LocalModel[] {
    return this.data.models.filter((m) => m.capabilities.includes(capability));
  }

  /** Get models filtered by runtime. */
  listByRuntime(runtime: ModelRuntime): LocalModel[] {
    return this.data.models.filter((m) => m.runtime === runtime);
  }

  /** Find a model by ID. */
  get(id: string): LocalModel | undefined {
    return this.data.models.find((m) => m.id === id);
  }

  /** Add or update a model in the inventory. */
  upsert(model: LocalModel): void {
    const idx = this.data.models.findIndex((m) => m.id === model.id);
    if (idx >= 0) {
      this.data.models[idx] = model;
    } else {
      this.data.models.push(model);
    }
    saveInventory(this.filePath, this.data);
  }

  /** Remove a model from the inventory. */
  remove(id: string): boolean {
    const before = this.data.models.length;
    this.data.models = this.data.models.filter((m) => m.id !== id);
    if (this.data.models.length < before) {
      saveInventory(this.filePath, this.data);
      return true;
    }
    return false;
  }

  /** Record that a model was used. */
  recordUsage(id: string): void {
    const model = this.data.models.find((m) => m.id === id);
    if (model) {
      model.usageCount += 1;
      model.lastUsed = new Date().toISOString();
      saveInventory(this.filePath, this.data);
    }
  }

  /** Replace all models in the inventory (used during full rediscovery). */
  replaceAll(models: LocalModel[]): void {
    this.data.models = models;
    saveInventory(this.filePath, this.data);
  }

  /** Get total disk space used by all tracked models. */
  totalSizeBytes(): number {
    return this.data.models.reduce((sum, m) => sum + m.sizeBytes, 0);
  }

  /** Reload from disk (e.g., after another process updated it). */
  reload(): void {
    this.data = loadInventory(this.filePath);
  }
}
