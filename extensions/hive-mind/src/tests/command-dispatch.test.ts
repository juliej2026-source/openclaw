import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Mock sibling extension imports
vi.mock("../../meta-engine/src/task-classifier.js", () => ({
  classifyTask: vi.fn().mockReturnValue({
    primary: "coding",
    secondary: ["reasoning"],
    confidence: 0.9,
    contextLengthEstimate: 50,
    requiresVision: false,
    requiresToolUse: false,
    complexity: "moderate",
  }),
}));

vi.mock("../../meta-engine/src/model-scorer.js", () => ({
  scoreModels: vi.fn().mockReturnValue([
    { modelId: "qwen2.5:7b", score: 85, fitsHardware: true, breakdown: {} },
    { modelId: "llama3:8b", score: 72, fitsHardware: true, breakdown: {} },
  ]),
}));

vi.mock("../../meta-engine/src/performance-db.js", () => ({
  PerformanceDb: vi.fn().mockImplementation(function () {
    return {
      getSummary: vi.fn().mockReturnValue([]),
      totalRecords: 0,
    };
  }),
}));

vi.mock("../../meta-engine/src/router.js", () => ({
  routePrompt: vi.fn().mockReturnValue({
    selectedModel: { provider: "local-models", model: "qwen2.5:7b" },
    taskClassification: { primary: "coding", complexity: "moderate", confidence: 0.9 },
    topCandidates: [{ modelId: "qwen2.5:7b", score: 85 }],
    reason: "Best match for coding tasks",
    fallbackChain: [{ provider: "local-models", model: "llama3:8b" }],
  }),
}));

vi.mock("../../model-manager/src/hardware.js", () => ({
  detectHardware: vi.fn().mockResolvedValue({
    gpus: [{ name: "NVIDIA RTX 3060", vramBytes: 12_884_901_888 }],
    totalRamBytes: 34_359_738_368,
    availableRamBytes: 17_179_869_184,
    cpuCores: 8,
    platform: "linux",
    arch: "x64",
    ollamaAvailable: true,
    ollamaVersion: "0.5.0",
  }),
}));

vi.mock("../../model-manager/src/ollama-client.js", () => ({
  OllamaClient: vi.fn().mockImplementation(function () {
    return {
      isAvailable: vi.fn().mockResolvedValue(true),
      listModels: vi.fn().mockResolvedValue([
        { name: "qwen2.5:7b", size: 4_500_000_000 },
        { name: "llama3:8b", size: 4_700_000_000 },
      ]),
      listRunning: vi.fn().mockResolvedValue([{ name: "qwen2.5:7b", size: 4_500_000_000 }]),
    };
  }),
}));

vi.mock("../../model-trainer/src/training/job-manager.js", () => ({
  createJob: vi.fn().mockReturnValue({
    id: "job-1234",
    config: {
      baseModel: "qwen2.5:7b",
      datasetId: "ds-1",
      method: "ollama-modelfile",
      outputName: "test-out",
    },
    status: "queued",
  }),
}));

vi.mock("../../model-trainer/src/eval/evaluator.js", () => ({
  evaluateModel: vi.fn().mockResolvedValue({
    modelId: "qwen2.5:7b",
    testCases: 10,
    scores: { overall: 0.78, accuracy: 0.82, fluency: 0.74 },
    timestamp: "2026-02-07T00:00:00Z",
  }),
}));

vi.mock("../../model-manager/src/huggingface-client.js", () => ({
  searchHuggingFaceModels: vi.fn().mockResolvedValue([
    {
      id: "hf:TheBloke/Llama-2-7B-GGUF",
      source: "huggingface",
      name: "TheBloke/Llama-2-7B-GGUF",
      description: "text-generation",
      sizeBytes: 4_000_000_000,
      quantizations: ["Q4_K_M", "Q8_0"],
      downloads: 100_000,
      capabilities: ["chat", "reasoning"],
    },
  ]),
  listHuggingFaceGgufFiles: vi.fn().mockResolvedValue([
    {
      filename: "llama-2-7b.Q4_K_M.gguf",
      size: 4_000_000_000,
      downloadUrl:
        "https://huggingface.co/TheBloke/Llama-2-7B-GGUF/resolve/main/llama-2-7b.Q4_K_M.gguf",
    },
  ]),
}));

vi.mock("../execution-log.js", () => ({
  ExecutionLog: vi.fn().mockImplementation(function () {
    return {
      record: vi.fn(),
      getRecent: vi.fn().mockReturnValue([]),
      totalEntries: 0,
      reset: vi.fn(),
    };
  }),
}));

import { AlertManager } from "../alert-manager.js";
import { dispatchCommand, setAlertManagerInstance } from "../command-dispatch.js";

let tmpDir: string;
const originalHome = process.env.HOME;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cmd-dispatch-test-"));
  process.env.HOME = tmpDir;
  // Create inventory so meta:score can read it
  const invDir = path.join(tmpDir, ".openclaw", "model-manager");
  fs.mkdirSync(invDir, { recursive: true });
  fs.writeFileSync(
    path.join(invDir, "inventory.json"),
    JSON.stringify({
      version: 1,
      models: [
        {
          id: "qwen2.5:7b",
          family: "qwen",
          parameterCount: "7B",
          contextWindow: 131072,
          capabilities: ["chat", "coding"],
        },
      ],
    }),
  );
});

afterEach(() => {
  process.env.HOME = originalHome;
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("dispatchCommand", () => {
  describe("ping", () => {
    it("returns status and uptime", async () => {
      const result = await dispatchCommand({ command: "ping" });
      expect(result.success).toBe(true);
      expect(result.command).toBe("ping");
      expect(result.data).toHaveProperty("status", "online");
      expect(result.data).toHaveProperty("uptime_seconds");
    });
  });

  describe("capabilities", () => {
    it("returns full station identity", async () => {
      const result = await dispatchCommand({ command: "capabilities" });
      expect(result.success).toBe(true);
      const data = result.data as Record<string, unknown>;
      expect(data).toHaveProperty("station_id", "iot-hub");
      expect(data).toHaveProperty("capabilities");
      expect(data).toHaveProperty("layers");
    });
  });

  describe("meta:classify", () => {
    it("classifies text and returns task type", async () => {
      const result = await dispatchCommand({
        command: "meta:classify",
        params: { text: "Write a Python function to sort a list" },
      });
      expect(result.success).toBe(true);
      const data = result.data as Record<string, unknown>;
      expect(data).toHaveProperty("primary", "coding");
      expect(data).toHaveProperty("confidence");
      expect(data).toHaveProperty("complexity");
    });

    it("fails when text param is missing", async () => {
      const result = await dispatchCommand({
        command: "meta:classify",
        params: {},
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain("text");
    });
  });

  describe("meta:score", () => {
    it("scores models for a task type", async () => {
      const result = await dispatchCommand({
        command: "meta:score",
        params: { task_type: "coding" },
      });
      expect(result.success).toBe(true);
      const data = result.data as { scores: unknown[] };
      expect(data.scores).toBeDefined();
      expect(Array.isArray(data.scores)).toBe(true);
    });
  });

  describe("meta:recommend", () => {
    it("returns routing recommendation for a task", async () => {
      const result = await dispatchCommand({
        command: "meta:recommend",
        params: { text: "Debug a memory leak in my Node.js app" },
      });
      expect(result.success).toBe(true);
      const data = result.data as Record<string, unknown>;
      expect(data).toHaveProperty("selectedModel");
      expect(data).toHaveProperty("reason");
      expect(data).toHaveProperty("fallbackChain");
    });

    it("fails when text param is missing", async () => {
      const result = await dispatchCommand({
        command: "meta:recommend",
        params: {},
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain("text");
    });
  });

  describe("meta:hardware", () => {
    it("returns hardware info", async () => {
      const result = await dispatchCommand({ command: "meta:hardware" });
      expect(result.success).toBe(true);
      const data = result.data as Record<string, unknown>;
      expect(data).toHaveProperty("gpus");
      expect(data).toHaveProperty("totalRamBytes");
      expect(data).toHaveProperty("cpuCores");
    });
  });

  describe("meta:models", () => {
    it("returns installed and running models", async () => {
      const result = await dispatchCommand({ command: "meta:models" });
      expect(result.success).toBe(true);
      const data = result.data as Record<string, unknown>;
      expect(data).toHaveProperty("installed");
      expect(data).toHaveProperty("running");
      expect(data).toHaveProperty("installed_count");
      expect(data).toHaveProperty("running_count");
    });
  });

  describe("meta:status", () => {
    it("returns combined status", async () => {
      const result = await dispatchCommand({ command: "meta:status" });
      expect(result.success).toBe(true);
      const data = result.data as Record<string, unknown>;
      expect(data).toHaveProperty("hardware");
      expect(data).toHaveProperty("models");
      expect(data).toHaveProperty("engine");
    });
  });

  describe("meta:train", () => {
    it("creates a training job", async () => {
      const result = await dispatchCommand({
        command: "meta:train",
        params: {
          dataset: "ds-1",
          base_model: "qwen2.5:7b",
          method: "ollama-modelfile",
        },
      });
      expect(result.success).toBe(true);
      const data = result.data as Record<string, unknown>;
      expect(data).toHaveProperty("job_id");
      expect(data).toHaveProperty("status", "queued");
    });

    it("fails when required params are missing", async () => {
      const result = await dispatchCommand({
        command: "meta:train",
        params: {},
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain("dataset");
    });
  });

  describe("meta:evaluate", () => {
    it("evaluates a model", async () => {
      const result = await dispatchCommand({
        command: "meta:evaluate",
        params: { model: "qwen2.5:7b" },
      });
      expect(result.success).toBe(true);
      const data = result.data as Record<string, unknown>;
      expect(data).toHaveProperty("scores");
    });

    it("fails when model param is missing", async () => {
      const result = await dispatchCommand({
        command: "meta:evaluate",
        params: {},
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain("model");
    });
  });

  describe("meta:search", () => {
    it("searches HuggingFace for GGUF models", async () => {
      const result = await dispatchCommand({
        command: "meta:search",
        params: { query: "llama", limit: 2 },
      });
      expect(result.success).toBe(true);
      const data = result.data as { query: string; result_count: number; models: unknown[] };
      expect(data.query).toBe("llama");
      expect(typeof data.result_count).toBe("number");
      expect(Array.isArray(data.models)).toBe(true);
    });

    it("fails when query param is missing", async () => {
      const result = await dispatchCommand({
        command: "meta:search",
        params: {},
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain("query");
    });
  });

  describe("meta:search:files", () => {
    it("lists GGUF files for a HuggingFace repo", async () => {
      const result = await dispatchCommand({
        command: "meta:search:files",
        params: { repo: "TheBloke/Llama-2-7B-GGUF" },
      });
      expect(result.success).toBe(true);
      const data = result.data as { repo: string; file_count: number; files: unknown[] };
      expect(data.repo).toBe("TheBloke/Llama-2-7B-GGUF");
      expect(typeof data.file_count).toBe("number");
      expect(Array.isArray(data.files)).toBe(true);
    });

    it("fails when repo param is missing", async () => {
      const result = await dispatchCommand({
        command: "meta:search:files",
        params: {},
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain("repo");
    });
  });

  describe("meta:dashboard", () => {
    it("returns combined dashboard data", async () => {
      const result = await dispatchCommand({ command: "meta:dashboard" });
      expect(result.success).toBe(true);
      const data = result.data as Record<string, unknown>;
      expect(data).toHaveProperty("station_id", "iot-hub");
      expect(data).toHaveProperty("timestamp");
      expect(data).toHaveProperty("uptime_seconds");
      expect(data).toHaveProperty("hardware");
      expect(data).toHaveProperty("models");
      expect(data).toHaveProperty("performance");
      expect(data).toHaveProperty("executions");
    });
  });

  describe("network:alerts", () => {
    beforeEach(() => {
      const mgr = new AlertManager({ openclawDir: tmpDir });
      mgr.emit("station_offline", "Test station down", { target: "10.1.8.87" });
      mgr.emit("station_online", "Test station up", { target: "10.1.8.87" });
      setAlertManagerInstance(mgr);
    });

    it("returns recent alerts", async () => {
      const result = await dispatchCommand({
        command: "network:alerts",
        params: { limit: 10 },
      });
      expect(result.success).toBe(true);
      const data = result.data as { alert_count: number; total: number; alerts: unknown[] };
      expect(data.alert_count).toBe(2);
      expect(data.total).toBe(2);
    });

    it("returns only active (unacknowledged) alerts", async () => {
      const result = await dispatchCommand({
        command: "network:alerts",
        params: { active: true },
      });
      expect(result.success).toBe(true);
      const data = result.data as { alert_count: number; alerts: unknown[] };
      expect(data.alert_count).toBe(2);
    });
  });

  describe("network:alerts:ack", () => {
    it("acknowledges an alert by ID", async () => {
      const mgr = new AlertManager({ openclawDir: tmpDir });
      const alert = mgr.emit("station_offline", "Down");
      setAlertManagerInstance(mgr);

      const result = await dispatchCommand({
        command: "network:alerts:ack",
        params: { id: alert.id },
      });
      expect(result.success).toBe(true);
      const data = result.data as { acknowledged: boolean };
      expect(data.acknowledged).toBe(true);
    });

    it("fails when id param is missing", async () => {
      const mgr = new AlertManager({ openclawDir: tmpDir });
      setAlertManagerInstance(mgr);

      const result = await dispatchCommand({
        command: "network:alerts:ack",
        params: {},
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain("id");
    });
  });

  describe("unknown command", () => {
    it("returns error for unknown command", async () => {
      const result = await dispatchCommand({ command: "nonexistent" });
      expect(result.success).toBe(false);
      expect(result.error).toContain("Unknown command");
    });
  });

  describe("response metadata", () => {
    it("includes latency_ms in every response", async () => {
      const result = await dispatchCommand({ command: "ping" });
      expect(typeof result.latency_ms).toBe("number");
      expect(result.latency_ms).toBeGreaterThanOrEqual(0);
    });

    it("preserves request_id in response", async () => {
      const result = await dispatchCommand({
        command: "ping",
        request_id: "req-123",
      });
      expect(result.request_id).toBe("req-123");
    });
  });
});
