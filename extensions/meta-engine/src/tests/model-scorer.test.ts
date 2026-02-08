import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, beforeEach } from "vitest";
import type { TaskClassification } from "../types.js";
import { scoreModels, type ScoringCandidate } from "../model-scorer.js";
import { PerformanceDb } from "../performance-db.js";

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "meta-engine-test-"));
}

const codingTask: TaskClassification = {
  primary: "coding",
  secondary: [],
  confidence: 0.9,
  contextLengthEstimate: 200,
  requiresVision: false,
  requiresToolUse: false,
  complexity: "moderate",
};

const simpleChat: TaskClassification = {
  primary: "chat",
  secondary: [],
  confidence: 0.3,
  contextLengthEstimate: 10,
  requiresVision: false,
  requiresToolUse: false,
  complexity: "simple",
};

const visionTask: TaskClassification = {
  primary: "vision",
  secondary: [],
  confidence: 0.8,
  contextLengthEstimate: 50,
  requiresVision: true,
  requiresToolUse: false,
  complexity: "moderate",
};

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
  {
    id: "phi3:3b",
    family: "phi",
    parameterCount: "3B",
    contextWindow: 8192,
    capabilities: ["chat", "code"],
  },
  {
    id: "llava:13b",
    family: "llava",
    parameterCount: "13B",
    contextWindow: 4096,
    capabilities: ["vision", "chat"],
  },
];

describe("scoreModels", () => {
  let tmpDir: string;
  let perfDb: PerformanceDb;

  beforeEach(() => {
    tmpDir = makeTempDir();
    perfDb = new PerformanceDb(tmpDir);
  });

  it("ranks code models higher for coding tasks", () => {
    const scores = scoreModels(candidates, codingTask, perfDb);
    // codellama and qwen should be near the top for coding
    const topTwo = scores.slice(0, 2).map((s) => s.modelId);
    expect(topTwo).toContain("codellama:13b");
  });

  it("ranks smaller models higher for simple chat", () => {
    const scores = scoreModels(candidates, simpleChat, perfDb);
    // phi3:3b should score well for simple tasks (size efficiency)
    const phi = scores.find((s) => s.modelId === "phi3:3b");
    expect(phi).toBeDefined();
    expect(phi!.breakdown.sizeEfficiency).toBeGreaterThan(80);
  });

  it("gives zero capability score to non-vision models for vision tasks", () => {
    const scores = scoreModels(candidates, visionTask, perfDb);
    // llava should be the only viable vision model
    const llava = scores.find((s) => s.modelId === "llava:13b");
    const codellama = scores.find((s) => s.modelId === "codellama:13b");
    expect(llava!.breakdown.capabilityMatch).toBeGreaterThan(0);
    expect(codellama!.breakdown.capabilityMatch).toBe(0);
  });

  it("incorporates performance history", () => {
    // Record some performance data
    perfDb.record({
      modelId: "llama3.3:8b",
      taskType: "coding",
      success: true,
      durationMs: 3000,
      timestamp: new Date().toISOString(),
    });
    perfDb.record({
      modelId: "llama3.3:8b",
      taskType: "coding",
      success: true,
      durationMs: 2500,
      timestamp: new Date().toISOString(),
    });

    const scores = scoreModels(candidates, codingTask, perfDb);
    const llama = scores.find((s) => s.modelId === "llama3.3:8b");
    expect(llama?.breakdown.performanceHistory).toBe(100); // 100% success
  });

  it("filters by hardware constraints", () => {
    const constrainedCandidates: ScoringCandidate[] = [
      { ...candidates[0], vramRequired: 10 * 1024 * 1024 * 1024 }, // 10GB
      { ...candidates[3], vramRequired: 2 * 1024 * 1024 * 1024 }, // 2GB
    ];

    const scores = scoreModels(constrainedCandidates, codingTask, perfDb, {
      availableVramBytes: 6 * 1024 * 1024 * 1024, // 6GB available
    });

    const big = scores.find((s) => s.modelId === "codellama:13b");
    const small = scores.find((s) => s.modelId === "phi3:3b");
    expect(big?.fitsHardware).toBe(false);
    expect(small?.fitsHardware).toBe(true);
    // Hardware-fitting models should be ranked first
    expect(scores[0]?.fitsHardware).toBe(true);
  });

  it("returns scores sorted by score descending", () => {
    const scores = scoreModels(candidates, codingTask, perfDb);
    for (let i = 1; i < scores.length; i++) {
      if (scores[i]?.fitsHardware === scores[i - 1]?.fitsHardware) {
        expect(scores[i]?.score).toBeLessThanOrEqual(scores[i - 1]?.score ?? 0);
      }
    }
  });
});
