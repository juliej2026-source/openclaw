import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { ScoringCandidate } from "../model-scorer.js";
import type { RouterOptions } from "../router.js";
import { PerformanceDb } from "../performance-db.js";
import {
  createMetaOverrideTool,
  getSessionOverride,
  clearAllOverrides,
} from "../tools/meta-override-tool.js";
import { createMetaSelectTool } from "../tools/meta-select-tool.js";
import { createMetaStatusTool } from "../tools/meta-status-tool.js";

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "meta-tools-test-"));
}

/** Parse the JSON text from a tool result's content[0].text. */
function parseToolResult(result: { content: Array<{ type: string; text: string }> }): unknown {
  return JSON.parse(result.content[0].text);
}

const testCandidates: ScoringCandidate[] = [
  {
    id: "qwen3:14b",
    family: "qwen",
    parameterCount: "14B",
    contextWindow: 131072,
    capabilities: ["chat", "code", "reasoning"],
  },
  {
    id: "codellama:13b",
    family: "codellama",
    parameterCount: "13B",
    contextWindow: 131072,
    capabilities: ["code", "chat"],
  },
  {
    id: "llama3.3:8b",
    family: "llama",
    parameterCount: "8B",
    contextWindow: 131072,
    capabilities: ["chat"],
  },
];

describe("createMetaSelectTool", () => {
  let tmpDir: string;
  let perfDb: PerformanceDb;

  beforeEach(() => {
    tmpDir = makeTempDir();
    perfDb = new PerformanceDb(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns null recommendation when no router opts", async () => {
    const tool = createMetaSelectTool(() => null);
    const result = await tool.execute("call-1", { task: "write some code" });
    const parsed = parseToolResult(result as { content: Array<{ type: string; text: string }> });

    expect(parsed).toEqual({
      recommendation: null,
      reason: "No local models available. Use local_model_pull to download models first.",
    });
  });

  it("returns null recommendation when candidates empty", async () => {
    const tool = createMetaSelectTool(() => ({
      candidates: [],
      perfDb,
    }));
    const result = await tool.execute("call-2", { task: "write some code" });
    const parsed = parseToolResult(result as { content: Array<{ type: string; text: string }> });

    expect(parsed).toHaveProperty("recommendation", null);
  });

  it("returns recommendation with task type, model, and score for a valid task", async () => {
    const opts: RouterOptions = {
      candidates: testCandidates,
      perfDb,
    };
    const tool = createMetaSelectTool(() => opts);
    const result = await tool.execute("call-3", {
      task: "implement a sorting algorithm in python",
    });
    const parsed = parseToolResult(
      result as { content: Array<{ type: string; text: string }> },
    ) as Record<string, unknown>;

    expect(parsed.recommendation).toBeDefined();
    expect(parsed.recommendation).not.toBeNull();
    expect(parsed).toHaveProperty("taskType");
    expect(parsed).toHaveProperty("score");
    expect(parsed).toHaveProperty("reason");
    expect(parsed).toHaveProperty("complexity");
    expect(parsed).toHaveProperty("confidence");
    expect(parsed).toHaveProperty("topCandidates");
    expect(parsed).toHaveProperty("fallbacks");

    // The recommendation should be a model object with provider and model
    const rec = parsed.recommendation as Record<string, unknown>;
    expect(rec).toHaveProperty("provider");
    expect(rec).toHaveProperty("model");
  });

  it("throws when task arg is empty", async () => {
    const tool = createMetaSelectTool(() => null);
    await expect(tool.execute("call-4", { task: "" })).rejects.toThrow(
      "task description is required",
    );
  });

  it("throws when task arg is whitespace only", async () => {
    const tool = createMetaSelectTool(() => null);
    await expect(tool.execute("call-5", { task: "   " })).rejects.toThrow(
      "task description is required",
    );
  });

  it("returns topCandidates with at most 3 entries", async () => {
    const opts: RouterOptions = {
      candidates: testCandidates,
      perfDb,
    };
    const tool = createMetaSelectTool(() => opts);
    const result = await tool.execute("call-6", { task: "write a REST API endpoint" });
    const parsed = parseToolResult(
      result as { content: Array<{ type: string; text: string }> },
    ) as Record<string, unknown>;

    const topCandidates = parsed.topCandidates as Array<Record<string, unknown>>;
    expect(topCandidates.length).toBeLessThanOrEqual(3);
    for (const candidate of topCandidates) {
      expect(candidate).toHaveProperty("model");
      expect(candidate).toHaveProperty("score");
      expect(candidate).toHaveProperty("fitsHardware");
    }
  });

  it("result has details property matching content payload", async () => {
    const opts: RouterOptions = {
      candidates: testCandidates,
      perfDb,
    };
    const tool = createMetaSelectTool(() => opts);
    const result = (await tool.execute("call-7", { task: "refactor this code" })) as {
      content: Array<{ type: string; text: string }>;
      details?: unknown;
    };

    expect(result.details).toBeDefined();
    const textParsed = JSON.parse(result.content[0].text);
    expect(result.details).toEqual(textParsed);
  });
});

describe("createMetaStatusTool", () => {
  let tmpDir: string;
  let perfDb: PerformanceDb;

  beforeEach(() => {
    tmpDir = makeTempDir();
    perfDb = new PerformanceDb(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns available model count and performance records", async () => {
    // Add some performance records
    perfDb.record({
      modelId: "qwen3:14b",
      taskType: "coding",
      success: true,
      durationMs: 5000,
      timestamp: new Date().toISOString(),
    });
    perfDb.record({
      modelId: "qwen3:14b",
      taskType: "coding",
      success: false,
      durationMs: 10000,
      timestamp: new Date().toISOString(),
    });
    perfDb.record({
      modelId: "llama3.3:8b",
      taskType: "chat",
      success: true,
      durationMs: 1000,
      timestamp: new Date().toISOString(),
    });

    const tool = createMetaStatusTool(perfDb, () => 5);
    const result = await tool.execute("call-1", {});
    const parsed = parseToolResult(
      result as { content: Array<{ type: string; text: string }> },
    ) as Record<string, unknown>;

    expect(parsed.availableModels).toBe(5);
    expect(parsed.totalPerformanceRecords).toBe(3);
    expect(parsed.modelPerformance).toBeInstanceOf(Array);

    const perf = parsed.modelPerformance as Array<Record<string, unknown>>;
    expect(perf.length).toBeGreaterThanOrEqual(2);

    // Verify structure of performance entries
    for (const entry of perf) {
      expect(entry).toHaveProperty("model");
      expect(entry).toHaveProperty("taskType");
      expect(entry).toHaveProperty("runs");
      expect(entry).toHaveProperty("successRate");
      expect(entry).toHaveProperty("avgLatency");
    }
  });

  it("shows empty performance when no records", async () => {
    const tool = createMetaStatusTool(perfDb, () => 3);
    const result = await tool.execute("call-2", {});
    const parsed = parseToolResult(
      result as { content: Array<{ type: string; text: string }> },
    ) as Record<string, unknown>;

    expect(parsed.availableModels).toBe(3);
    expect(parsed.totalPerformanceRecords).toBe(0);
    expect(parsed.modelPerformance).toEqual([]);
  });

  it("returns zero available models when getCandidateCount returns 0", async () => {
    const tool = createMetaStatusTool(perfDb, () => 0);
    const result = await tool.execute("call-3", {});
    const parsed = parseToolResult(
      result as { content: Array<{ type: string; text: string }> },
    ) as Record<string, unknown>;

    expect(parsed.availableModels).toBe(0);
  });

  it("performance entries are sorted by success rate descending", async () => {
    perfDb.record({
      modelId: "m1",
      taskType: "coding",
      success: true,
      durationMs: 1000,
      timestamp: "",
    });
    perfDb.record({
      modelId: "m2",
      taskType: "chat",
      success: false,
      durationMs: 1000,
      timestamp: "",
    });
    perfDb.record({
      modelId: "m3",
      taskType: "reasoning",
      success: true,
      durationMs: 500,
      timestamp: "",
    });

    const tool = createMetaStatusTool(perfDb, () => 3);
    const result = await tool.execute("call-4", {});
    const parsed = parseToolResult(
      result as { content: Array<{ type: string; text: string }> },
    ) as Record<string, unknown>;

    const perf = parsed.modelPerformance as Array<Record<string, unknown>>;

    // Successful models (100%) should be before failed ones (0%)
    // Parse success rates for comparison
    const rates = perf.map((p) => parseFloat(p.successRate as string));
    for (let i = 1; i < rates.length; i++) {
      expect(rates[i]).toBeLessThanOrEqual(rates[i - 1]);
    }
  });

  it("result has details property", async () => {
    const tool = createMetaStatusTool(perfDb, () => 2);
    const result = (await tool.execute("call-5", {})) as {
      content: Array<{ type: string; text: string }>;
      details?: unknown;
    };

    expect(result.details).toBeDefined();
  });
});

describe("createMetaOverrideTool", () => {
  beforeEach(() => {
    clearAllOverrides();
  });

  afterEach(() => {
    clearAllOverrides();
  });

  it("sets a model override, returns success", async () => {
    const tool = createMetaOverrideTool();
    const result = await tool.execute("call-1", { model: "local-models/qwen3:14b" });
    const parsed = parseToolResult(
      result as { content: Array<{ type: string; text: string }> },
    ) as Record<string, unknown>;

    expect(parsed.success).toBe(true);
    expect(parsed.message).toContain("local-models/qwen3:14b");
    expect(parsed.model).toBe("local-models/qwen3:14b");
  });

  it("clears override with 'clear' model", async () => {
    const tool = createMetaOverrideTool();

    // Set an override first
    await tool.execute("call-1", { model: "local-models/qwen3:14b" });

    // Verify it was set
    expect(getSessionOverride("current")).toBe("local-models/qwen3:14b");

    // Clear it
    const result = await tool.execute("call-2", { model: "clear" });
    const parsed = parseToolResult(
      result as { content: Array<{ type: string; text: string }> },
    ) as Record<string, unknown>;

    expect(parsed.success).toBe(true);
    expect(parsed.message).toContain("override cleared");
    expect(getSessionOverride("current")).toBeUndefined();
  });

  it("throws when model arg is empty", async () => {
    const tool = createMetaOverrideTool();
    await expect(tool.execute("call-3", { model: "" })).rejects.toThrow("model is required");
  });

  it("throws when model arg is whitespace only", async () => {
    const tool = createMetaOverrideTool();
    await expect(tool.execute("call-4", { model: "   " })).rejects.toThrow("model is required");
  });

  it("overwrites previous override", async () => {
    const tool = createMetaOverrideTool();

    await tool.execute("call-1", { model: "model-a" });
    expect(getSessionOverride("current")).toBe("model-a");

    await tool.execute("call-2", { model: "model-b" });
    expect(getSessionOverride("current")).toBe("model-b");
  });
});

describe("getSessionOverride", () => {
  beforeEach(() => {
    clearAllOverrides();
  });

  afterEach(() => {
    clearAllOverrides();
  });

  it("returns undefined when no override is set", () => {
    expect(getSessionOverride("some-session")).toBeUndefined();
  });

  it("returns the override after it has been set via the tool", async () => {
    const tool = createMetaOverrideTool();
    await tool.execute("call-1", { model: "test-model" });
    // The tool uses "current" as the session key
    expect(getSessionOverride("current")).toBe("test-model");
  });

  it("returns undefined for a different session key", async () => {
    const tool = createMetaOverrideTool();
    await tool.execute("call-1", { model: "test-model" });
    expect(getSessionOverride("other-session")).toBeUndefined();
  });
});

describe("clearAllOverrides", () => {
  afterEach(() => {
    clearAllOverrides();
  });

  it("clears all session overrides", async () => {
    const tool = createMetaOverrideTool();
    await tool.execute("call-1", { model: "model-1" });
    expect(getSessionOverride("current")).toBe("model-1");

    clearAllOverrides();

    expect(getSessionOverride("current")).toBeUndefined();
  });

  it("is idempotent when no overrides exist", () => {
    expect(() => clearAllOverrides()).not.toThrow();
  });
});
