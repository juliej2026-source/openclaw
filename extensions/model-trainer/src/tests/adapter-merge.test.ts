import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Shared async mock accessible to both the vi.mock factory and tests
const asyncExecFile = vi.hoisted(() => vi.fn(async () => ({ stdout: "success\n", stderr: "" })));

vi.mock("node:child_process", () => {
  // Callback-style mock (for argument inspection via toHaveBeenCalledWith)
  const execFileMock = vi.fn(
    (
      _cmd: string,
      _args: string[],
      _opts: unknown,
      callback: (err: Error | null, stdout: string, stderr: string) => void,
    ) => {
      callback(null, "success\n", "");
    },
  );

  // Attach custom promisify so `promisify(execFile)` returns our async mock
  (execFileMock as Record<symbol, unknown>)[promisify.custom] = asyncExecFile;

  return { execFile: execFileMock };
});

import type { LoraAdapter } from "../types.js";
import { isAdapterOnDisk, mergeAdapterToOllama } from "../adapters/adapter-merge.js";

let tmpDir: string;
const originalHome = process.env.HOME;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "adapter-merge-test-"));
  process.env.HOME = tmpDir;
  vi.clearAllMocks();
  // Reset asyncExecFile to default success behavior after clearAllMocks
  asyncExecFile.mockResolvedValue({ stdout: "success\n", stderr: "" });
});

afterEach(() => {
  process.env.HOME = originalHome;
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function trainerDir(): string {
  return path.join(tmpDir, ".openclaw", "model-trainer");
}

function makeAdapter(overrides: Partial<LoraAdapter> = {}): LoraAdapter {
  return {
    id: "adapter-001",
    name: "test-adapter",
    baseModel: "llama3:8b",
    datasetId: "ds-001",
    trainingJobId: "job-001",
    path: path.join(tmpDir, "adapters", "test-adapter"),
    sizeBytes: 1024 * 1024,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("isAdapterOnDisk", () => {
  it("returns true when adapter path exists and is a directory", () => {
    const adapterPath = path.join(tmpDir, "adapters", "test-adapter");
    fs.mkdirSync(adapterPath, { recursive: true });

    const adapter = makeAdapter({ path: adapterPath });
    expect(isAdapterOnDisk(adapter)).toBe(true);
  });

  it("returns false when path does not exist", () => {
    const adapter = makeAdapter({
      path: path.join(tmpDir, "nonexistent", "adapter"),
    });
    expect(isAdapterOnDisk(adapter)).toBe(false);
  });

  it("returns false when path is a file, not a directory", () => {
    const filePath = path.join(tmpDir, "adapters", "not-a-dir");
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, "not a directory");

    const adapter = makeAdapter({ path: filePath });
    expect(isAdapterOnDisk(adapter)).toBe(false);
  });
});

describe("mergeAdapterToOllama", () => {
  it("creates Modelfile with ADAPTER directive when adapter_config.json exists (PEFT format)", async () => {
    const adapterPath = path.join(tmpDir, "adapters", "peft-adapter");
    fs.mkdirSync(adapterPath, { recursive: true });

    // Create adapter_config.json to signal PEFT format
    fs.writeFileSync(
      path.join(adapterPath, "adapter_config.json"),
      JSON.stringify({
        peft_type: "LORA",
        base_model_name_or_path: "meta-llama/Llama-3-8B",
        r: 16,
        lora_alpha: 32,
      }),
    );

    const adapter = makeAdapter({
      path: adapterPath,
      baseModel: "llama3:8b",
    });

    const result = await mergeAdapterToOllama(adapter, "merged-peft-model");

    expect(result.success).toBe(true);

    // Verify Modelfile content
    const modelfilePath = path.join(trainerDir(), "modelfiles", "merged-peft-model.Modelfile");
    expect(fs.existsSync(modelfilePath)).toBe(true);

    const content = fs.readFileSync(modelfilePath, "utf-8");
    expect(content).toContain(`FROM ${adapter.baseModel}`);
    expect(content).toContain(`ADAPTER ${adapterPath}`);
    // Should NOT contain SYSTEM fallback
    expect(content).not.toContain("SYSTEM");
  });

  it("creates Modelfile with SYSTEM fallback when no adapter_config.json", async () => {
    const adapterPath = path.join(tmpDir, "adapters", "plain-adapter");
    fs.mkdirSync(adapterPath, { recursive: true });
    // No adapter_config.json

    const adapter = makeAdapter({
      path: adapterPath,
      name: "my-plain-adapter",
      baseModel: "llama3:8b",
    });

    const result = await mergeAdapterToOllama(adapter, "merged-plain-model");

    expect(result.success).toBe(true);

    const modelfilePath = path.join(trainerDir(), "modelfiles", "merged-plain-model.Modelfile");
    expect(fs.existsSync(modelfilePath)).toBe(true);

    const content = fs.readFileSync(modelfilePath, "utf-8");
    expect(content).toContain(`FROM ${adapter.baseModel}`);
    expect(content).toContain("SYSTEM");
    expect(content).toContain("Fine-tuned model based on");
    expect(content).toContain(adapter.name);
    expect(content).not.toContain("ADAPTER");
  });

  it("calls ollama create with correct arguments", async () => {
    const adapterPath = path.join(tmpDir, "adapters", "call-check");
    fs.mkdirSync(adapterPath, { recursive: true });

    const adapter = makeAdapter({ path: adapterPath });

    await mergeAdapterToOllama(adapter, "my-output-model");

    // The async mock was called (via promisify.custom)
    expect(asyncExecFile).toHaveBeenCalled();
  });

  it("returns success:false on ollama create failure (command error)", async () => {
    const adapterPath = path.join(tmpDir, "adapters", "fail-adapter");
    fs.mkdirSync(adapterPath, { recursive: true });

    const adapter = makeAdapter({ path: adapterPath });

    // Make the promisified execFile reject
    asyncExecFile.mockRejectedValueOnce(new Error("connection refused: is ollama running?"));

    const result = await mergeAdapterToOllama(adapter, "fail-model");

    expect(result.success).toBe(false);
    expect(result.error).toContain("connection refused");
  });

  it("returns success:false when stderr contains error keyword", async () => {
    const adapterPath = path.join(tmpDir, "adapters", "stderr-adapter");
    fs.mkdirSync(adapterPath, { recursive: true });

    const adapter = makeAdapter({ path: adapterPath });

    // Return stderr with an error message (no thrown error)
    asyncExecFile.mockResolvedValueOnce({
      stdout: "",
      stderr: "Error: model format not supported",
    });

    const result = await mergeAdapterToOllama(adapter, "stderr-model");

    expect(result.success).toBe(false);
    expect(result.error).toContain("model format not supported");
  });

  it("creates the modelfiles directory if it does not exist", async () => {
    const adapterPath = path.join(tmpDir, "adapters", "dir-create");
    fs.mkdirSync(adapterPath, { recursive: true });

    const adapter = makeAdapter({ path: adapterPath });

    const modelfilesDir = path.join(trainerDir(), "modelfiles");
    expect(fs.existsSync(modelfilesDir)).toBe(false);

    await mergeAdapterToOllama(adapter, "dir-test-model");

    expect(fs.existsSync(modelfilesDir)).toBe(true);
  });
});
