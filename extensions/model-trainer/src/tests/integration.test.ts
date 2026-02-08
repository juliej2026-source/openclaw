/**
 * Cross-plugin integration test.
 *
 * Validates that model-manager, meta-engine, and model-trainer
 * communicate correctly via shared filesystem at ~/.openclaw/.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { LocalModel } from "../../../model-manager/src/types.js";
import type { TrainingPair } from "../types.js";
import { scoreModels, type ScoringCandidate } from "../../../meta-engine/src/model-scorer.js";
import { PerformanceDb } from "../../../meta-engine/src/performance-db.js";
import { routePrompt } from "../../../meta-engine/src/router.js";
// meta-engine imports
import { classifyTask } from "../../../meta-engine/src/task-classifier.js";
// model-manager imports
import { ModelInventory } from "../../../model-manager/src/inventory.js";
import { registerAdapter, listAdapters } from "../adapters/adapter-store.js";
import { exportDataset, listDatasets } from "../dataset/formatter.js";
// model-trainer imports
import { validateDataset } from "../dataset/validator.js";
import { findTemplate } from "../training/config-templates.js";
import * as jobManager from "../training/job-manager.js";

let tmpDir: string;
const originalHome = process.env.HOME;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "integration-test-"));
  process.env.HOME = tmpDir;
});

afterEach(() => {
  process.env.HOME = originalHome;
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("cross-plugin integration", () => {
  it("model-manager inventory feeds into meta-engine scoring", () => {
    // Step 1: Populate model-manager inventory
    const inventory = new ModelInventory();
    const models: LocalModel[] = [
      {
        id: "codellama:7b",
        name: "codellama:7b",
        runtime: "ollama",
        sizeBytes: 4 * 1024 * 1024 * 1024,
        capabilities: ["code", "tool-use"],
        contextWindow: 16384,
        maxTokens: 4096,
        installedAt: new Date().toISOString(),
        usageCount: 0,
        family: "codellama",
        parameterCount: "7B",
      },
      {
        id: "qwen3:14b",
        name: "qwen3:14b",
        runtime: "ollama",
        sizeBytes: 8 * 1024 * 1024 * 1024,
        capabilities: ["code", "reasoning", "chat"],
        contextWindow: 32768,
        maxTokens: 8192,
        installedAt: new Date().toISOString(),
        usageCount: 5,
        family: "qwen",
        parameterCount: "14B",
      },
    ];
    inventory.replaceAll(models);

    // Step 2: Read inventory and convert to meta-engine candidates
    const inventoryModels = inventory.listAll();
    expect(inventoryModels.length).toBe(2);

    const candidates: ScoringCandidate[] = inventoryModels.map((m) => ({
      id: m.id,
      family: m.family ?? "unknown",
      parameterCount: m.parameterCount,
      capabilities: m.capabilities as ScoringCandidate["capabilities"],
      contextWindow: m.contextWindow,
      sizeBytes: m.sizeBytes,
    }));

    // Step 3: Use meta-engine to classify and route
    const classification = classifyTask("Write a Python function to sort a list");
    expect(classification.primary).toBe("coding");

    const perfDbDir = path.join(tmpDir, ".openclaw", "meta-engine");
    fs.mkdirSync(perfDbDir, { recursive: true });
    const perfDb = new PerformanceDb(path.join(perfDbDir, "performance.json"));

    const scores = scoreModels(candidates, classification, perfDb);
    expect(scores.length).toBe(2);

    // codellama should score higher for coding tasks
    const codeModel = scores.find((s) => s.modelId === "codellama:7b");
    expect(codeModel).toBeDefined();
    expect(codeModel?.breakdown.capabilityMatch).toBeGreaterThan(0);
  });

  it("meta-engine router works with model-manager inventory data", () => {
    // Populate inventory
    const inventory = new ModelInventory();
    inventory.replaceAll([
      {
        id: "llama3.3:8b",
        name: "llama3.3:8b",
        runtime: "ollama",
        sizeBytes: 4 * 1024 * 1024 * 1024,
        capabilities: ["chat", "reasoning"],
        contextWindow: 131072,
        maxTokens: 4096,
        installedAt: new Date().toISOString(),
        usageCount: 0,
        family: "llama",
        parameterCount: "8B",
      },
    ]);

    // Convert to candidates and route
    const candidates: ScoringCandidate[] = inventory.listAll().map((m) => ({
      id: m.id,
      family: m.family ?? "unknown",
      parameterCount: m.parameterCount,
      capabilities: m.capabilities as ScoringCandidate["capabilities"],
      contextWindow: m.contextWindow,
      sizeBytes: m.sizeBytes,
    }));

    const perfDbDir = path.join(tmpDir, ".openclaw", "meta-engine");
    fs.mkdirSync(perfDbDir, { recursive: true });
    const perfDb = new PerformanceDb(path.join(perfDbDir, "performance.json"));

    const decision = routePrompt("Tell me a joke", { candidates, perfDb });
    expect(decision).not.toBeNull();
    expect(decision?.selectedModel.model).toBe("llama3.3:8b");
    expect(decision?.taskClassification.primary).toBe("chat");
  });

  it("trainer uses config templates matched to model family", () => {
    // Inventory has a qwen model
    const inventory = new ModelInventory();
    inventory.replaceAll([
      {
        id: "qwen3:7b",
        name: "qwen3:7b",
        runtime: "ollama",
        sizeBytes: 4 * 1024 * 1024 * 1024,
        capabilities: ["chat", "code"],
        contextWindow: 32768,
        maxTokens: 8192,
        installedAt: new Date().toISOString(),
        usageCount: 0,
        family: "qwen",
        parameterCount: "7B",
      },
    ]);

    // Find matching config template
    const model = inventory.get("qwen3:7b");
    expect(model).toBeDefined();

    const template = findTemplate(model!.id, 16);
    expect(template.family).toBe("qwen");
    expect(template.vramTier).toBe("16gb");
    expect(template.hyperparams.batchSize).toBe(4);
  });

  it("full pipeline: collect → validate → export → create job → track adapter", () => {
    // Step 1: Create training pairs (simulating collector output)
    const pairs: TrainingPair[] = [
      {
        conversations: [
          { role: "user", content: "How do I use async/await in TypeScript?" },
          {
            role: "assistant",
            content:
              "You can use async/await by declaring a function as async, then using await before Promises.",
          },
        ],
        source: { sessionId: "s1", timestamp: new Date().toISOString() },
      },
      {
        conversations: [
          { role: "user", content: "Explain closures in JavaScript" },
          {
            role: "assistant",
            content:
              "A closure is a function that has access to variables from its outer scope even after the outer function returns.",
          },
        ],
        source: { sessionId: "s2", timestamp: new Date().toISOString() },
      },
    ];

    // Step 2: Validate
    const validation = validateDataset(pairs);
    expect(validation.valid.length).toBe(2);
    expect(validation.removed).toBe(0);

    // Step 3: Export dataset
    const dataset = exportDataset({
      pairs: validation.valid,
      name: "integration-test",
      format: "sharegpt",
      baseModel: "qwen3:7b",
    });
    expect(dataset.pairCount).toBe(2);
    expect(fs.existsSync(dataset.filePath)).toBe(true);

    // Step 4: Verify dataset is listed
    const datasets = listDatasets();
    expect(datasets.length).toBe(1);
    expect(datasets[0]?.name).toBe("integration-test");

    // Step 5: Create a training job
    const job = jobManager.createJob({
      baseModel: "qwen3:7b",
      datasetId: dataset.id,
      method: "ollama-modelfile",
      outputName: "my-custom-qwen",
    });
    expect(job.status).toBe("queued");

    // Step 6: Simulate completion and register adapter
    jobManager.updateJob(job.id, {
      status: "completed",
      completedAt: new Date().toISOString(),
      outputPath: path.join(tmpDir, "adapters", "test-adapter"),
    });

    registerAdapter({
      id: "adapter-test-1",
      name: "my-custom-qwen-adapter",
      baseModel: "qwen3:7b",
      datasetId: dataset.id,
      trainingJobId: job.id,
      path: path.join(tmpDir, "adapters", "test-adapter"),
      sizeBytes: 50 * 1024 * 1024,
      createdAt: new Date().toISOString(),
    });

    // Step 7: Verify adapter is tracked
    const adapters = listAdapters();
    expect(adapters.length).toBe(1);
    expect(adapters[0]?.name).toBe("my-custom-qwen-adapter");
    expect(adapters[0]?.trainingJobId).toBe(job.id);

    // Step 8: Verify the final job state
    const finalJob = jobManager.getJob(job.id);
    expect(finalJob?.status).toBe("completed");
  });

  it("performance data flows back into model scoring", () => {
    const perfDbDir = path.join(tmpDir, ".openclaw", "meta-engine");
    fs.mkdirSync(perfDbDir, { recursive: true });
    const perfDb = new PerformanceDb(path.join(perfDbDir, "performance.json"));

    // Record some performance data (simulating after-agent-hook)
    perfDb.record({
      modelId: "codellama:7b",
      taskType: "coding",
      success: true,
      durationMs: 1500,
      timestamp: new Date().toISOString(),
    });
    perfDb.record({
      modelId: "codellama:7b",
      taskType: "coding",
      success: true,
      durationMs: 2000,
      timestamp: new Date().toISOString(),
    });
    perfDb.record({
      modelId: "llama3:8b",
      taskType: "coding",
      success: false,
      durationMs: 5000,
      timestamp: new Date().toISOString(),
    });

    // Score with performance data
    const candidates: ScoringCandidate[] = [
      {
        id: "codellama:7b",
        family: "codellama",
        parameterCount: "7B",
        capabilities: ["code"],
        contextWindow: 16384,
        sizeBytes: 4e9,
      },
      {
        id: "llama3:8b",
        family: "llama",
        parameterCount: "8B",
        capabilities: ["chat", "reasoning"],
        contextWindow: 131072,
        sizeBytes: 4e9,
      },
    ];

    const classification = classifyTask("Fix this Python bug");
    const scores = scoreModels(candidates, classification, perfDb);

    const codellama = scores.find((s) => s.modelId === "codellama:7b");
    const llama = scores.find((s) => s.modelId === "llama3:8b");

    // codellama should have better performance history (100% success vs 0%)
    expect(codellama?.breakdown.performanceHistory).toBeGreaterThan(
      llama?.breakdown.performanceHistory ?? 0,
    );
  });
});
