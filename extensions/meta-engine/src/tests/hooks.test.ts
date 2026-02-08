import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { ScoringCandidate } from "../model-scorer.js";
import type { RouterOptions } from "../router.js";
import type { RoutingDecision } from "../types.js";
import { createAgentEndHook } from "../hooks/after-agent-hook.js";
import { createBeforeAgentHook, buildRoutingContext } from "../hooks/before-agent-hook.js";
import { PerformanceDb } from "../performance-db.js";

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "meta-hooks-test-"));
}

// Reusable candidates for router opts
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

describe("buildRoutingContext", () => {
  it("formats a RoutingDecision into a readable context string", () => {
    const decision: RoutingDecision = {
      selectedModel: { provider: "local-models", model: "qwen3:14b" },
      taskClassification: {
        primary: "coding",
        secondary: ["reasoning"],
        confidence: 0.9,
        contextLengthEstimate: 200,
        requiresVision: false,
        requiresToolUse: false,
        complexity: "moderate",
      },
      topCandidates: [],
      reason: "Best capability match for coding tasks",
      fallbackChain: [{ provider: "local-models", model: "codellama:13b" }],
    };

    const context = buildRoutingContext(decision);

    expect(context).toContain("[Meta-Engine Routing]");
    expect(context).toContain("Task type: coding (moderate)");
    expect(context).toContain("Recommended local model: local-models/qwen3:14b");
    expect(context).toContain("Reason: Best capability match for coding tasks");
    expect(context).toContain("Fallback models: local-models/codellama:13b");
  });

  it("omits fallback line when fallbackChain is empty", () => {
    const decision: RoutingDecision = {
      selectedModel: { provider: "local-models", model: "qwen3:14b" },
      taskClassification: {
        primary: "chat",
        secondary: [],
        confidence: 0.3,
        contextLengthEstimate: 10,
        requiresVision: false,
        requiresToolUse: false,
        complexity: "simple",
      },
      topCandidates: [],
      reason: "Default chat model",
      fallbackChain: [],
    };

    const context = buildRoutingContext(decision);

    expect(context).toContain("[Meta-Engine Routing]");
    expect(context).toContain("Task type: chat (simple)");
    expect(context).not.toContain("Fallback models:");
  });

  it("lists multiple fallback models separated by commas", () => {
    const decision: RoutingDecision = {
      selectedModel: { provider: "local-models", model: "qwen3:14b" },
      taskClassification: {
        primary: "coding",
        secondary: [],
        confidence: 0.8,
        contextLengthEstimate: 100,
        requiresVision: false,
        requiresToolUse: false,
        complexity: "moderate",
      },
      topCandidates: [],
      reason: "Top scorer",
      fallbackChain: [
        { provider: "local-models", model: "codellama:13b" },
        { provider: "local-models", model: "llama3.3:8b" },
      ],
    };

    const context = buildRoutingContext(decision);
    expect(context).toContain(
      "Fallback models: local-models/codellama:13b, local-models/llama3.3:8b",
    );
  });
});

describe("createBeforeAgentHook", () => {
  let tmpDir: string;
  let perfDb: PerformanceDb;

  beforeEach(() => {
    tmpDir = makeTempDir();
    perfDb = new PerformanceDb(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns undefined when getRouterOpts returns null", () => {
    const hook = createBeforeAgentHook(() => null);
    const result = hook({ prompt: "write some code" }, {});
    expect(result).toBeUndefined();
  });

  it("returns undefined when candidates array is empty", () => {
    const hook = createBeforeAgentHook(() => ({
      candidates: [],
      perfDb,
    }));
    const result = hook({ prompt: "write some code" }, {});
    expect(result).toBeUndefined();
  });

  it("returns prependContext with routing info when candidates are available", () => {
    const opts: RouterOptions = {
      candidates: testCandidates,
      perfDb,
    };
    const hook = createBeforeAgentHook(() => opts);
    const result = hook({ prompt: "write a function to sort an array in typescript" }, {});

    expect(result).toBeDefined();
    expect(result).toHaveProperty("prependContext");
    const context = (result as { prependContext: string }).prependContext;
    expect(context).toContain("[Meta-Engine Routing]");
  });

  it("prependContext contains task type and recommended model", () => {
    const opts: RouterOptions = {
      candidates: testCandidates,
      perfDb,
    };
    const hook = createBeforeAgentHook(() => opts);
    const result = hook(
      { prompt: "implement a binary search algorithm in python" },
      { agentId: "test-agent", sessionKey: "sess-1" },
    );

    expect(result).toBeDefined();
    const context = (result as { prependContext: string }).prependContext;
    expect(context).toContain("[Meta-Engine Routing]");
    expect(context).toContain("Task type:");
    expect(context).toContain("Recommended local model:");
    expect(context).toContain("Reason:");
  });

  it("passes context through for a chat prompt", () => {
    const opts: RouterOptions = {
      candidates: testCandidates,
      perfDb,
    };
    const hook = createBeforeAgentHook(() => opts);
    const result = hook({ prompt: "hello, how are you today?" }, {});

    expect(result).toBeDefined();
    const context = (result as { prependContext: string }).prependContext;
    expect(context).toContain("[Meta-Engine Routing]");
  });
});

describe("createAgentEndHook", () => {
  let tmpDir: string;
  let perfDb: PerformanceDb;

  beforeEach(() => {
    tmpDir = makeTempDir();
    perfDb = new PerformanceDb(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("records performance data when event has user messages", () => {
    const hook = createAgentEndHook(perfDb);
    hook(
      {
        messages: [
          { role: "user", content: "write a function to sort an array" },
          { role: "assistant", content: "Here is the function..." },
        ],
        success: true,
        durationMs: 5000,
      },
      { sessionKey: "sess-1" },
    );

    expect(perfDb.totalRecords).toBe(1);
    const records = perfDb.getRecords("unknown");
    expect(records).toHaveLength(1);
    expect(records[0].success).toBe(true);
    expect(records[0].durationMs).toBe(5000);
    expect(records[0].sessionKey).toBe("sess-1");
    expect(records[0].taskType).toBe("coding");
  });

  it("skips recording when no user message found", () => {
    const hook = createAgentEndHook(perfDb);
    hook(
      {
        messages: [
          { role: "system", content: "You are a helpful assistant." },
          { role: "assistant", content: "Hello!" },
        ],
        success: true,
        durationMs: 1000,
      },
      {},
    );

    expect(perfDb.totalRecords).toBe(0);
  });

  it("skips recording when prompt text is empty", () => {
    const hook = createAgentEndHook(perfDb);
    hook(
      {
        messages: [{ role: "user", content: "" }],
        success: true,
        durationMs: 1000,
      },
      {},
    );

    expect(perfDb.totalRecords).toBe(0);
  });

  it("skips recording when prompt text is whitespace only", () => {
    const hook = createAgentEndHook(perfDb);
    hook(
      {
        messages: [{ role: "user", content: "   \n\t  " }],
        success: true,
        durationMs: 1000,
      },
      {},
    );

    expect(perfDb.totalRecords).toBe(0);
  });

  it("handles array content in messages (multimodal)", () => {
    const hook = createAgentEndHook(perfDb);
    hook(
      {
        messages: [
          {
            role: "user",
            content: [{ text: "describe this" }, { text: "image please" }],
          },
        ],
        success: true,
        durationMs: 3000,
      },
      { sessionKey: "sess-2" },
    );

    expect(perfDb.totalRecords).toBe(1);
    const records = perfDb.getRecords("unknown");
    expect(records).toHaveLength(1);
    expect(records[0].success).toBe(true);
    expect(records[0].durationMs).toBe(3000);
  });

  it("records with 'unknown' modelId as designed", () => {
    const hook = createAgentEndHook(perfDb);
    hook(
      {
        messages: [{ role: "user", content: "hello there" }],
        success: true,
        durationMs: 500,
      },
      {},
    );

    expect(perfDb.totalRecords).toBe(1);
    const records = perfDb.getRecords("unknown");
    expect(records).toHaveLength(1);
    expect(records[0].modelId).toBe("unknown");
  });

  it("records failure events", () => {
    const hook = createAgentEndHook(perfDb);
    hook(
      {
        messages: [{ role: "user", content: "calculate the integral of x^2" }],
        success: false,
        error: "Model timeout",
        durationMs: 30000,
      },
      { sessionKey: "sess-3" },
    );

    expect(perfDb.totalRecords).toBe(1);
    const records = perfDb.getRecords("unknown");
    expect(records[0].success).toBe(false);
    expect(records[0].durationMs).toBe(30000);
    expect(records[0].taskType).toBe("math");
  });

  it("defaults durationMs to 0 when not provided", () => {
    const hook = createAgentEndHook(perfDb);
    hook(
      {
        messages: [{ role: "user", content: "hello" }],
        success: true,
      },
      {},
    );

    const records = perfDb.getRecords("unknown");
    expect(records[0].durationMs).toBe(0);
  });

  it("silently ignores perfDb write failures", () => {
    // Create a perfDb that writes to a read-only location to force failure
    const readonlyDir = path.join(tmpDir, "readonly");
    fs.mkdirSync(readonlyDir, { recursive: true });
    const readonlyPerfDb = new PerformanceDb(readonlyDir);

    // Now make the directory read-only to cause write failure
    const perfDir = path.join(readonlyDir, "meta-engine");
    if (fs.existsSync(perfDir)) {
      fs.chmodSync(path.join(perfDir, "performance.json"), 0o444);
      fs.chmodSync(perfDir, 0o444);
    }

    const hook = createAgentEndHook(readonlyPerfDb);

    // Should not throw
    expect(() => {
      hook(
        {
          messages: [{ role: "user", content: "hello" }],
          success: true,
          durationMs: 100,
        },
        {},
      );
    }).not.toThrow();

    // Restore permissions for cleanup
    if (fs.existsSync(perfDir)) {
      fs.chmodSync(perfDir, 0o755);
      const perfFile = path.join(perfDir, "performance.json");
      if (fs.existsSync(perfFile)) {
        fs.chmodSync(perfFile, 0o644);
      }
    }
  });

  it("handles empty messages array", () => {
    const hook = createAgentEndHook(perfDb);
    hook(
      {
        messages: [],
        success: true,
        durationMs: 100,
      },
      {},
    );

    expect(perfDb.totalRecords).toBe(0);
  });

  it("records correct task classification from prompt", () => {
    const hook = createAgentEndHook(perfDb);

    // Coding task
    hook(
      {
        messages: [{ role: "user", content: "implement a binary search function in typescript" }],
        success: true,
        durationMs: 2000,
      },
      {},
    );

    // Summarization task
    hook(
      {
        messages: [{ role: "user", content: "summarize the key points of this document" }],
        success: true,
        durationMs: 1000,
      },
      {},
    );

    expect(perfDb.totalRecords).toBe(2);
    const allRecords = perfDb.getRecords("unknown");
    const taskTypes = allRecords.map((r) => r.taskType);
    expect(taskTypes).toContain("coding");
    expect(taskTypes).toContain("summarization");
  });
});
