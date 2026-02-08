import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { LoraAdapter } from "../types.js";
import {
  registerAdapter,
  getAdapter,
  listAdapters,
  removeAdapter,
  updateAdapterEvalScore,
} from "../adapters/adapter-store.js";

let tmpDir: string;
const originalHome = process.env.HOME;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "trainer-adapters-"));
  process.env.HOME = tmpDir;
});

afterEach(() => {
  process.env.HOME = originalHome;
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function makeAdapter(id: string, name: string): LoraAdapter {
  return {
    id,
    name,
    baseModel: "qwen3:7b",
    datasetId: "test-dataset",
    trainingJobId: "job-123",
    path: "/tmp/adapters/" + id,
    sizeBytes: 1024 * 1024,
    createdAt: new Date().toISOString(),
  };
}

describe("adapter-store", () => {
  it("registers and retrieves an adapter", () => {
    const adapter = makeAdapter("a1", "my-adapter");
    registerAdapter(adapter);

    const fetched = getAdapter("a1");
    expect(fetched).toBeDefined();
    expect(fetched!.name).toBe("my-adapter");
  });

  it("lists all adapters", () => {
    registerAdapter(makeAdapter("a1", "first"));
    registerAdapter(makeAdapter("a2", "second"));

    const all = listAdapters();
    expect(all.length).toBe(2);
  });

  it("replaces adapter with same ID", () => {
    registerAdapter(makeAdapter("a1", "original"));
    registerAdapter({ ...makeAdapter("a1", "updated"), sizeBytes: 2048 });

    const all = listAdapters();
    expect(all.length).toBe(1);
    expect(all[0]?.name).toBe("updated");
    expect(all[0]?.sizeBytes).toBe(2048);
  });

  it("removes an adapter", () => {
    registerAdapter(makeAdapter("a1", "to-remove"));

    const removed = removeAdapter("a1");
    expect(removed).toBe(true);
    expect(listAdapters().length).toBe(0);
  });

  it("returns false when removing nonexistent adapter", () => {
    expect(removeAdapter("nonexistent")).toBe(false);
  });

  it("updates eval score", () => {
    registerAdapter(makeAdapter("a1", "scored"));

    const updated = updateAdapterEvalScore("a1", 0.85);
    expect(updated).toBe(true);

    const fetched = getAdapter("a1");
    expect(fetched!.evalScore).toBe(0.85);
  });

  it("returns false when updating score for nonexistent adapter", () => {
    expect(updateAdapterEvalScore("nonexistent", 0.5)).toBe(false);
  });

  it("persists to disk", () => {
    registerAdapter(makeAdapter("a1", "persisted"));

    const filePath = path.join(tmpDir, ".openclaw", "model-trainer", "adapters.json");
    expect(fs.existsSync(filePath)).toBe(true);

    const data = JSON.parse(fs.readFileSync(filePath, "utf-8")) as { adapters: unknown[] };
    expect(data.adapters.length).toBe(1);
  });
});
