import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { LocalModel } from "../types.js";
import { ModelInventory } from "../inventory.js";

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "model-manager-test-"));
}

function makeModel(overrides?: Partial<LocalModel>): LocalModel {
  return {
    id: "test-model:7b",
    name: "test-model:7b",
    runtime: "ollama",
    ollamaTag: "test-model:7b",
    sizeBytes: 4_000_000_000,
    quantization: "Q4_K_M",
    parameterCount: "7B",
    family: "llama",
    capabilities: ["chat"],
    contextWindow: 131_072,
    maxTokens: 8192,
    installedAt: "2025-01-15T10:00:00Z",
    usageCount: 0,
    ...overrides,
  };
}

describe("ModelInventory", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTempDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("starts with an empty inventory", () => {
    const inv = new ModelInventory(tmpDir);
    expect(inv.listAll()).toEqual([]);
    expect(inv.totalSizeBytes()).toBe(0);
  });

  it("upserts and retrieves a model", () => {
    const inv = new ModelInventory(tmpDir);
    const model = makeModel();
    inv.upsert(model);

    expect(inv.listAll()).toHaveLength(1);
    expect(inv.get("test-model:7b")).toEqual(model);
  });

  it("updates existing model on upsert", () => {
    const inv = new ModelInventory(tmpDir);
    inv.upsert(makeModel());
    inv.upsert(makeModel({ sizeBytes: 5_000_000_000 }));

    expect(inv.listAll()).toHaveLength(1);
    expect(inv.get("test-model:7b")?.sizeBytes).toBe(5_000_000_000);
  });

  it("removes a model", () => {
    const inv = new ModelInventory(tmpDir);
    inv.upsert(makeModel());
    expect(inv.remove("test-model:7b")).toBe(true);
    expect(inv.listAll()).toHaveLength(0);
    expect(inv.remove("nonexistent")).toBe(false);
  });

  it("records usage", () => {
    const inv = new ModelInventory(tmpDir);
    inv.upsert(makeModel());
    inv.recordUsage("test-model:7b");
    inv.recordUsage("test-model:7b");

    const model = inv.get("test-model:7b");
    expect(model?.usageCount).toBe(2);
    expect(model?.lastUsed).toBeTruthy();
  });

  it("persists to disk and reloads", () => {
    const inv1 = new ModelInventory(tmpDir);
    inv1.upsert(makeModel());

    const inv2 = new ModelInventory(tmpDir);
    expect(inv2.listAll()).toHaveLength(1);
    expect(inv2.get("test-model:7b")?.id).toBe("test-model:7b");
  });

  it("filters by capability", () => {
    const inv = new ModelInventory(tmpDir);
    inv.upsert(makeModel({ id: "chat-model", capabilities: ["chat"] }));
    inv.upsert(makeModel({ id: "code-model", capabilities: ["code", "chat"] }));
    inv.upsert(makeModel({ id: "embed-model", capabilities: ["embedding"] }));

    expect(inv.listByCapability("code")).toHaveLength(1);
    expect(inv.listByCapability("chat")).toHaveLength(2);
    expect(inv.listByCapability("embedding")).toHaveLength(1);
  });

  it("filters by runtime", () => {
    const inv = new ModelInventory(tmpDir);
    inv.upsert(makeModel({ id: "ollama-model", runtime: "ollama" }));
    inv.upsert(makeModel({ id: "llama-model", runtime: "llamacpp" }));

    expect(inv.listByRuntime("ollama")).toHaveLength(1);
    expect(inv.listByRuntime("llamacpp")).toHaveLength(1);
  });

  it("replaceAll replaces the entire inventory", () => {
    const inv = new ModelInventory(tmpDir);
    inv.upsert(makeModel({ id: "old-model" }));
    inv.upsert(makeModel({ id: "another-old" }));

    inv.replaceAll([makeModel({ id: "new-model" })]);
    expect(inv.listAll()).toHaveLength(1);
    expect(inv.get("new-model")).toBeTruthy();
    expect(inv.get("old-model")).toBeUndefined();
  });

  it("calculates total size", () => {
    const inv = new ModelInventory(tmpDir);
    inv.upsert(makeModel({ id: "a", sizeBytes: 1_000 }));
    inv.upsert(makeModel({ id: "b", sizeBytes: 2_000 }));
    expect(inv.totalSizeBytes()).toBe(3_000);
  });
});
