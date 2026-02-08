import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LocalModel } from "../types.js";
import { ModelInventory } from "../inventory.js";
import { createHardwareInfoTool } from "../tools/hardware-info-tool.js";
import { createModelInfoTool } from "../tools/model-info-tool.js";
import { createModelListTool } from "../tools/model-list-tool.js";
import { createModelRemoveTool } from "../tools/model-remove-tool.js";

// ---------------------------------------------------------------------------
// Mock OllamaClient so tools never make real network calls
// ---------------------------------------------------------------------------
vi.mock("../ollama-client.js", () => {
  // Must use `function` (not arrow) so it can be called with `new`
  const OllamaClient = vi.fn().mockImplementation(function () {
    return {
      isAvailable: vi.fn().mockResolvedValue(false),
      showModel: vi.fn().mockRejectedValue(new Error("mocked: ollama unavailable")),
      deleteModel: vi.fn().mockRejectedValue(new Error("mocked: ollama unavailable")),
      listModels: vi.fn().mockResolvedValue([]),
      pullAndWait: vi.fn().mockResolvedValue({ success: false, finalStatus: "mocked" }),
    };
  });
  return { OllamaClient };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "model-manager-tools-test-"));
}

function makeModel(overrides?: Partial<LocalModel>): LocalModel {
  return {
    id: "qwen3:14b",
    name: "qwen3:14b",
    runtime: "ollama",
    ollamaTag: "qwen3:14b",
    sizeBytes: 8_500_000_000,
    quantization: "Q4_K_M",
    parameterCount: "14B",
    family: "qwen",
    capabilities: ["chat", "code", "tool-use"],
    contextWindow: 131_072,
    maxTokens: 8192,
    installedAt: "2025-06-01T12:00:00Z",
    usageCount: 5,
    lastUsed: "2025-06-10T08:30:00Z",
    ...overrides,
  };
}

function makeCodeModel(): LocalModel {
  return makeModel({
    id: "codellama:13b",
    name: "codellama:13b",
    ollamaTag: "codellama:13b",
    sizeBytes: 7_000_000_000,
    parameterCount: "13B",
    family: "codellama",
    capabilities: ["code", "chat", "tool-use"],
    usageCount: 10,
  });
}

function makeLlamaCppModel(): LocalModel {
  return makeModel({
    id: "hf:TheBloke/Llama-2-7B-GGUF:Q4_K_M",
    name: "Llama-2-7B Q4_K_M",
    runtime: "llamacpp",
    ollamaTag: undefined,
    filePath: "/models/llama-2-7b.Q4_K_M.gguf",
    sizeBytes: 4_000_000_000,
    parameterCount: "7B",
    family: "llama",
    capabilities: ["chat"],
    usageCount: 0,
    lastUsed: undefined,
  });
}

function makeEmbeddingModel(): LocalModel {
  return makeModel({
    id: "nomic-embed-text:latest",
    name: "nomic-embed-text:latest",
    ollamaTag: "nomic-embed-text:latest",
    sizeBytes: 270_000_000,
    parameterCount: "137M",
    family: "nomic",
    capabilities: ["embedding"],
    usageCount: 100,
  });
}

// ---------------------------------------------------------------------------
// createModelListTool
// ---------------------------------------------------------------------------

describe("createModelListTool", () => {
  let tmpDir: string;
  let inventory: ModelInventory;

  beforeEach(() => {
    tmpDir = makeTempDir();
    const openclawDir = path.join(tmpDir, ".openclaw");
    inventory = new ModelInventory(openclawDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("has expected tool shape", () => {
    const tool = createModelListTool(inventory);
    expect(tool.name).toBe("local_model_list");
    expect(tool.label).toBe("Local Models");
    expect(typeof tool.description).toBe("string");
    expect(tool.parameters).toBeDefined();
    expect(typeof tool.execute).toBe("function");
  });

  it("returns all models with summary fields", async () => {
    inventory.replaceAll([makeModel(), makeCodeModel(), makeEmbeddingModel()]);

    const tool = createModelListTool(inventory);
    const result = await tool.execute("test-call", {});
    const payload = JSON.parse(result.content[0].text);

    expect(payload.totalModels).toBe(3);
    expect(payload.models).toHaveLength(3);

    const first = payload.models[0];
    expect(first).toHaveProperty("id");
    expect(first).toHaveProperty("name");
    expect(first).toHaveProperty("runtime");
    expect(first).toHaveProperty("size");
    expect(first).toHaveProperty("parameters");
    expect(first).toHaveProperty("capabilities");
    expect(first).toHaveProperty("quantization");
    expect(first).toHaveProperty("contextWindow");
    expect(first).toHaveProperty("usageCount");
    expect(first).toHaveProperty("lastUsed");
  });

  it("filters by capability parameter", async () => {
    inventory.replaceAll([makeModel(), makeCodeModel(), makeEmbeddingModel()]);

    const tool = createModelListTool(inventory);
    const result = await tool.execute("test-call", { capability: "embedding" });
    const payload = JSON.parse(result.content[0].text);

    expect(payload.totalModels).toBe(1);
    expect(payload.models[0].id).toBe("nomic-embed-text:latest");
  });

  it("filters by runtime parameter", async () => {
    inventory.replaceAll([makeModel(), makeLlamaCppModel()]);

    const tool = createModelListTool(inventory);
    const result = await tool.execute("test-call", { runtime: "llamacpp" });
    const payload = JSON.parse(result.content[0].text);

    expect(payload.totalModels).toBe(1);
    expect(payload.models[0].id).toBe("hf:TheBloke/Llama-2-7B-GGUF:Q4_K_M");
  });

  it("returns empty when no models", async () => {
    const tool = createModelListTool(inventory);
    const result = await tool.execute("test-call", {});
    const payload = JSON.parse(result.content[0].text);

    expect(payload.totalModels).toBe(0);
    expect(payload.models).toEqual([]);
  });

  it("returns empty when no models match filter", async () => {
    inventory.replaceAll([makeModel()]);

    const tool = createModelListTool(inventory);
    const result = await tool.execute("test-call", { capability: "embedding" });
    const payload = JSON.parse(result.content[0].text);

    expect(payload.totalModels).toBe(0);
    expect(payload.models).toEqual([]);
  });

  it("filters by both capability and runtime simultaneously", async () => {
    inventory.replaceAll([
      makeModel(), // ollama, chat+code+tool-use
      makeCodeModel(), // ollama, code+chat+tool-use
      makeLlamaCppModel(), // llamacpp, chat
    ]);

    const tool = createModelListTool(inventory);
    const result = await tool.execute("test-call", {
      capability: "chat",
      runtime: "ollama",
    });
    const payload = JSON.parse(result.content[0].text);

    // Both ollama models have "chat", the llamacpp model is filtered out by runtime
    expect(payload.totalModels).toBe(2);
  });

  it("includes totalSize in output", async () => {
    inventory.replaceAll([makeModel()]);

    const tool = createModelListTool(inventory);
    const result = await tool.execute("test-call", {});
    const payload = JSON.parse(result.content[0].text);

    expect(payload.totalSize).toBeDefined();
    expect(typeof payload.totalSize).toBe("string");
  });
});

// ---------------------------------------------------------------------------
// createModelInfoTool
// ---------------------------------------------------------------------------

describe("createModelInfoTool", () => {
  let tmpDir: string;
  let inventory: ModelInventory;

  beforeEach(() => {
    tmpDir = makeTempDir();
    const openclawDir = path.join(tmpDir, ".openclaw");
    inventory = new ModelInventory(openclawDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("has expected tool shape", () => {
    const tool = createModelInfoTool(inventory);
    expect(tool.name).toBe("local_model_info");
    expect(tool.label).toBe("Model Info");
    expect(typeof tool.description).toBe("string");
    expect(typeof tool.execute).toBe("function");
  });

  it("returns model details for a valid model ID", async () => {
    inventory.replaceAll([makeModel()]);

    const tool = createModelInfoTool(inventory);
    const result = await tool.execute("test-call", { model: "qwen3:14b" });
    const payload = JSON.parse(result.content[0].text);

    expect(payload.id).toBe("qwen3:14b");
    expect(payload.name).toBe("qwen3:14b");
    expect(payload.runtime).toBe("ollama");
    expect(payload.quantization).toBe("Q4_K_M");
    expect(payload.parameterCount).toBe("14B");
    expect(payload.family).toBe("qwen");
    expect(payload.capabilities).toEqual(["chat", "code", "tool-use"]);
    expect(payload.contextWindow).toBe(131_072);
    expect(payload.maxTokens).toBe(8192);
    expect(payload.sizeBytes).toBe(8_500_000_000);
    expect(payload.size).toBeDefined(); // formatted string
    expect(payload.installedAt).toBe("2025-06-01T12:00:00Z");
    expect(payload.usageCount).toBe(5);
    expect(payload.lastUsed).toBe("2025-06-10T08:30:00Z");
  });

  it("returns error JSON for missing model ID", async () => {
    const tool = createModelInfoTool(inventory);
    const result = await tool.execute("test-call", { model: "nonexistent:7b" });
    const payload = JSON.parse(result.content[0].text);

    expect(payload.error).toMatch(/not found in inventory/);
    expect(payload.error).toContain("nonexistent:7b");
  });

  it("throws when model ID arg is empty string", async () => {
    const tool = createModelInfoTool(inventory);

    await expect(tool.execute("test-call", { model: "" })).rejects.toThrow(/model ID is required/);
  });

  it("throws when model arg is missing", async () => {
    const tool = createModelInfoTool(inventory);

    await expect(tool.execute("test-call", {})).rejects.toThrow(/model ID is required/);
  });

  it("trims whitespace from model ID", async () => {
    inventory.replaceAll([makeModel()]);

    const tool = createModelInfoTool(inventory);
    const result = await tool.execute("test-call", { model: "  qwen3:14b  " });
    const payload = JSON.parse(result.content[0].text);

    expect(payload.id).toBe("qwen3:14b");
  });

  it("reports vramRequired as unknown when not set", async () => {
    inventory.replaceAll([makeModel({ vramRequired: undefined })]);

    const tool = createModelInfoTool(inventory);
    const result = await tool.execute("test-call", { model: "qwen3:14b" });
    const payload = JSON.parse(result.content[0].text);

    expect(payload.vramRequired).toBe("unknown");
  });

  it("formats vramRequired when set", async () => {
    inventory.replaceAll([makeModel({ vramRequired: 6_000_000_000 })]);

    const tool = createModelInfoTool(inventory);
    const result = await tool.execute("test-call", { model: "qwen3:14b" });
    const payload = JSON.parse(result.content[0].text);

    expect(payload.vramRequired).toBeDefined();
    expect(payload.vramRequired).not.toBe("unknown");
    // Should be a formatted bytes string like "5.6 GB"
    expect(typeof payload.vramRequired).toBe("string");
  });

  it("includes ollamaDetails as undefined when Ollama is unavailable", async () => {
    inventory.replaceAll([makeModel()]);

    const tool = createModelInfoTool(inventory);
    const result = await tool.execute("test-call", { model: "qwen3:14b" });
    const payload = JSON.parse(result.content[0].text);

    // OllamaClient is mocked to throw, so ollamaDetails should be absent/undefined
    // JSON.stringify omits undefined values
    expect(payload.ollamaDetails).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// createModelRemoveTool
// ---------------------------------------------------------------------------

describe("createModelRemoveTool", () => {
  let tmpDir: string;
  let inventory: ModelInventory;

  beforeEach(() => {
    tmpDir = makeTempDir();
    const openclawDir = path.join(tmpDir, ".openclaw");
    inventory = new ModelInventory(openclawDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("has expected tool shape", () => {
    const tool = createModelRemoveTool(inventory);
    expect(tool.name).toBe("local_model_remove");
    expect(tool.label).toBe("Remove Model");
    expect(typeof tool.description).toBe("string");
    expect(typeof tool.execute).toBe("function");
  });

  it("returns error for model not in inventory", async () => {
    const tool = createModelRemoveTool(inventory);
    const result = await tool.execute("test-call", { model: "nonexistent:7b" });
    const payload = JSON.parse(result.content[0].text);

    expect(payload.success).toBe(false);
    expect(payload.error).toMatch(/not found in inventory/);
    expect(payload.error).toContain("nonexistent:7b");
  });

  it("throws when model arg is empty", async () => {
    const tool = createModelRemoveTool(inventory);

    await expect(tool.execute("test-call", { model: "" })).rejects.toThrow(/model ID is required/);
  });

  it("throws when model arg is missing", async () => {
    const tool = createModelRemoveTool(inventory);

    await expect(tool.execute("test-call", {})).rejects.toThrow(/model ID is required/);
  });

  it("removes a llamacpp model from inventory (no Ollama interaction)", async () => {
    const model = makeLlamaCppModel();
    inventory.replaceAll([model]);

    const tool = createModelRemoveTool(inventory);
    const result = await tool.execute("test-call", {
      model: "hf:TheBloke/Llama-2-7B-GGUF:Q4_K_M",
    });
    const payload = JSON.parse(result.content[0].text);

    expect(payload.success).toBe(true);
    expect(payload.model).toBe("hf:TheBloke/Llama-2-7B-GGUF:Q4_K_M");
    expect(payload.message).toContain("Removed");

    // Verify it's actually gone from inventory
    expect(inventory.get("hf:TheBloke/Llama-2-7B-GGUF:Q4_K_M")).toBeUndefined();
  });

  it("removes an ollama model from inventory when Ollama is unavailable", async () => {
    // OllamaClient is mocked with isAvailable returning false
    const model = makeModel();
    inventory.replaceAll([model]);

    const tool = createModelRemoveTool(inventory);
    const result = await tool.execute("test-call", { model: "qwen3:14b" });
    const payload = JSON.parse(result.content[0].text);

    expect(payload.success).toBe(true);
    expect(inventory.get("qwen3:14b")).toBeUndefined();
  });

  it("trims whitespace from model ID", async () => {
    inventory.replaceAll([makeLlamaCppModel()]);

    const tool = createModelRemoveTool(inventory);
    const result = await tool.execute("test-call", {
      model: "  hf:TheBloke/Llama-2-7B-GGUF:Q4_K_M  ",
    });
    const payload = JSON.parse(result.content[0].text);

    expect(payload.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// createHardwareInfoTool
// ---------------------------------------------------------------------------

describe("createHardwareInfoTool", () => {
  it("has expected tool shape", () => {
    const tool = createHardwareInfoTool();
    expect(tool.name).toBe("local_hardware_info");
    expect(tool.label).toBe("Hardware Info");
    expect(typeof tool.description).toBe("string");
    expect(typeof tool.execute).toBe("function");
  });

  it("returns hardware info with gpus, ram, cpu, ollama, recommendations fields", async () => {
    const tool = createHardwareInfoTool();
    const result = await tool.execute("test-call", {});
    const payload = JSON.parse(result.content[0].text);

    // Top-level structure
    expect(payload).toHaveProperty("gpus");
    expect(payload).toHaveProperty("ram");
    expect(payload).toHaveProperty("cpu");
    expect(payload).toHaveProperty("ollama");
    expect(payload).toHaveProperty("recommendations");

    // RAM subfields
    expect(payload.ram).toHaveProperty("total");
    expect(payload.ram).toHaveProperty("available");
    expect(payload.ram).toHaveProperty("totalBytes");
    expect(payload.ram).toHaveProperty("availableBytes");
    expect(payload.ram.totalBytes).toBeGreaterThan(0);
    expect(payload.ram.availableBytes).toBeGreaterThan(0);

    // CPU subfields
    expect(payload.cpu).toHaveProperty("cores");
    expect(payload.cpu).toHaveProperty("platform");
    expect(payload.cpu).toHaveProperty("arch");
    expect(payload.cpu.cores).toBeGreaterThan(0);
    expect(typeof payload.cpu.platform).toBe("string");
    expect(typeof payload.cpu.arch).toBe("string");

    // Ollama subfields
    expect(payload.ollama).toHaveProperty("available");
    expect(typeof payload.ollama.available).toBe("boolean");

    // GPUs is an array
    expect(Array.isArray(payload.gpus)).toBe(true);
  });

  it("has recommendations array", async () => {
    const tool = createHardwareInfoTool();
    const result = await tool.execute("test-call", {});
    const payload = JSON.parse(result.content[0].text);

    expect(Array.isArray(payload.recommendations)).toBe(true);
    // Should always have at least one recommendation (GPU or Ollama related)
    expect(payload.recommendations.length).toBeGreaterThan(0);
    // Each recommendation is a string
    for (const rec of payload.recommendations) {
      expect(typeof rec).toBe("string");
    }
  });

  it("returns valid JSON in content", async () => {
    const tool = createHardwareInfoTool();
    const result = await tool.execute("test-call", {});

    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe("text");
    // Should parse without throwing
    expect(() => JSON.parse(result.content[0].text)).not.toThrow();
  });

  it("includes details in result", async () => {
    const tool = createHardwareInfoTool();
    const result = await tool.execute("test-call", {});

    expect(result.details).toBeDefined();
    expect(result.details).toHaveProperty("gpus");
    expect(result.details).toHaveProperty("ram");
    expect(result.details).toHaveProperty("cpu");
    expect(result.details).toHaveProperty("ollama");
    expect(result.details).toHaveProperty("recommendations");
  });
});
