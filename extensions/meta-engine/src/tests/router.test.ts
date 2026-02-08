import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, beforeEach } from "vitest";
import type { ScoringCandidate } from "../model-scorer.js";
import { PerformanceDb } from "../performance-db.js";
import { routePrompt } from "../router.js";

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "meta-router-test-"));
}

const candidates: ScoringCandidate[] = [
  {
    id: "codellama:13b",
    family: "codellama",
    parameterCount: "13B",
    contextWindow: 131072,
    capabilities: ["code", "chat"],
  },
  {
    id: "qwen3:14b",
    family: "qwen2",
    parameterCount: "14B",
    contextWindow: 131072,
    capabilities: ["chat", "code", "reasoning"],
  },
  {
    id: "llama3.3:8b",
    family: "llama",
    parameterCount: "8B",
    contextWindow: 131072,
    capabilities: ["chat"],
  },
];

describe("routePrompt", () => {
  let tmpDir: string;
  let perfDb: PerformanceDb;

  beforeEach(() => {
    tmpDir = makeTempDir();
    perfDb = new PerformanceDb(tmpDir);
  });

  it("returns null when no candidates", () => {
    const result = routePrompt("Hello", { candidates: [], perfDb });
    expect(result).toBeNull();
  });

  it("returns a routing decision for coding prompts", () => {
    const result = routePrompt("Write a Python quicksort function", {
      candidates,
      perfDb,
    });
    expect(result).not.toBeNull();
    expect(result!.taskClassification.primary).toBe("coding");
    expect(result!.selectedModel.model).toBeDefined();
    expect(result!.reason).toBeTruthy();
  });

  it("includes fallback chain", () => {
    const result = routePrompt("Implement a REST API in Go", {
      candidates,
      perfDb,
    });
    expect(result!.fallbackChain.length).toBeGreaterThan(0);
  });

  it("includes top candidates in the result", () => {
    const result = routePrompt("Hello, how are you?", {
      candidates,
      perfDb,
    });
    expect(result!.topCandidates.length).toBeGreaterThan(0);
    expect(result?.topCandidates[0]?.score).toBeGreaterThan(0);
  });

  it("uses custom provider name", () => {
    const result = routePrompt("Hi", {
      candidates,
      perfDb,
      provider: "my-ollama",
    });
    expect(result!.selectedModel.provider).toBe("my-ollama");
  });
});
