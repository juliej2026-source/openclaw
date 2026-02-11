import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { buildStationIdentity } from "../station-identity.js";
import { STATION_ID, ALL_CAPABILITIES } from "../types.js";

let tmpDir: string;
const originalHome = process.env.HOME;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "station-id-test-"));
  process.env.HOME = tmpDir;
});

afterEach(() => {
  process.env.HOME = originalHome;
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function writeInventory(models: unknown[]): void {
  const dir = path.join(tmpDir, ".openclaw", "model-manager");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "inventory.json"), JSON.stringify({ version: 1, models }));
}

function writePerformanceDb(records: unknown[]): void {
  const dir = path.join(tmpDir, ".openclaw", "meta-engine");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "performance.json"), JSON.stringify({ version: 1, records }));
}

describe("buildStationIdentity", () => {
  it("returns identity with correct station_id", () => {
    const identity = buildStationIdentity({ openclawDir: tmpDir });
    expect(identity.station_id).toBe(STATION_ID);
  });

  it("includes all 21 capabilities", () => {
    const identity = buildStationIdentity({ openclawDir: tmpDir });
    expect(identity.capabilities).toEqual(ALL_CAPABILITIES);
    expect(identity.capabilities).toHaveLength(21);
  });

  it("includes platform info from os module", () => {
    const identity = buildStationIdentity({ openclawDir: tmpDir });
    expect(identity.platform).toBe(process.platform);
    expect(identity.arch).toBe(process.arch);
    expect(identity.hostname).toBe(os.hostname());
    expect(typeof identity.uptime_seconds).toBe("number");
    expect(identity.uptime_seconds).toBeGreaterThan(0);
  });

  it("includes all 6 layer descriptors", () => {
    const identity = buildStationIdentity({ openclawDir: tmpDir });
    expect(identity.layers).toHaveProperty("model_manager");
    expect(identity.layers).toHaveProperty("meta_engine");
    expect(identity.layers).toHaveProperty("model_trainer");
    expect(identity.layers).toHaveProperty("neural_graph");
    expect(identity.layers).toHaveProperty("huggingface");
    expect(identity.layers).toHaveProperty("hotel_scraper");

    expect(identity.layers.model_manager.tools).toHaveLength(5);
    expect(identity.layers.meta_engine.tools).toHaveLength(3);
    expect(identity.layers.model_trainer.tools).toHaveLength(5);
    expect(identity.layers.huggingface.tools).toHaveLength(5);
    expect(identity.layers.hotel_scraper.tools).toHaveLength(4);
  });

  it("reads models from inventory.json when available", () => {
    writeInventory([
      { id: "qwen2.5:7b", family: "qwen", capabilities: ["chat", "coding"] },
      { id: "llama3:8b", family: "llama", capabilities: ["chat"] },
    ]);

    const identity = buildStationIdentity({ openclawDir: tmpDir });
    expect(identity.models).toHaveLength(2);
    expect(identity.models[0]?.id).toBe("qwen2.5:7b");
  });

  it("returns empty models when inventory.json does not exist", () => {
    const identity = buildStationIdentity({ openclawDir: tmpDir });
    expect(identity.models).toEqual([]);
  });

  it("sets layer status to active when data files exist", () => {
    writeInventory([{ id: "test:1b" }]);
    writePerformanceDb([]);

    const identity = buildStationIdentity({ openclawDir: tmpDir });
    expect(identity.layers.model_manager.status).toBe("active");
    expect(identity.layers.meta_engine.status).toBe("active");
  });

  it("sets layer status to unavailable when data files are missing", () => {
    const identity = buildStationIdentity({ openclawDir: tmpDir });
    expect(identity.layers.model_manager.status).toBe("unavailable");
    expect(identity.layers.meta_engine.status).toBe("unavailable");
  });
});
