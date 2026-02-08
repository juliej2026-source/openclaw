import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { evaluateModel } from "../eval/evaluator.js";

let tmpDir: string;
const originalHome = process.env.HOME;
const originalFetch = globalThis.fetch;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "evaluator-test-"));
  process.env.HOME = tmpDir;

  // Mock global fetch for Ollama generate API
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ response: "Mocked response text from the model." }),
  });
});

afterEach(() => {
  process.env.HOME = originalHome;
  globalThis.fetch = originalFetch;
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function trainerDir(): string {
  return path.join(tmpDir, ".openclaw", "model-trainer");
}

function createDatasetFile(filePath: string, lines: string[]): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, lines.join("\n") + "\n");
}

const sampleDatasetLines = [
  JSON.stringify({
    conversations: [
      { from: "human", value: "Hello?" },
      { from: "gpt", value: "Hi there! How can I help you today?" },
    ],
  }),
  JSON.stringify({
    conversations: [
      { from: "human", value: "What is the capital of France?" },
      { from: "gpt", value: "The capital of France is Paris." },
    ],
  }),
  JSON.stringify({
    conversations: [
      { from: "human", value: "Explain recursion." },
      {
        from: "gpt",
        value:
          "Recursion is a programming technique where a function calls itself to solve a problem.",
      },
    ],
  }),
];

describe("evaluateModel", () => {
  it("returns zero scores when dataset file not found", async () => {
    const result = await evaluateModel({
      modelId: "test-model",
      datasetPath: "/nonexistent/path/dataset.jsonl",
    });

    expect(result.testCases).toBe(0);
    expect(result.scores.overall).toBe(0);
    expect(result.modelId).toBe("test-model");
    expect(result.timestamp).toBeDefined();
  });

  it("returns zero scores when dataset is empty", async () => {
    const dsPath = path.join(tmpDir, "empty-dataset.jsonl");
    fs.writeFileSync(dsPath, "");

    const result = await evaluateModel({
      modelId: "test-model",
      datasetPath: dsPath,
    });

    expect(result.testCases).toBe(0);
    expect(result.scores.overall).toBe(0);
  });

  it("returns zero scores when dataset has only malformed lines", async () => {
    const dsPath = path.join(tmpDir, "bad-dataset.jsonl");
    fs.writeFileSync(dsPath, "not valid json\nalso not json\n");

    const result = await evaluateModel({
      modelId: "test-model",
      datasetPath: dsPath,
    });

    expect(result.testCases).toBe(0);
    expect(result.scores.overall).toBe(0);
  });

  it("returns scores when model generates responses", async () => {
    const dsPath = path.join(tmpDir, "eval-dataset.jsonl");
    createDatasetFile(dsPath, sampleDatasetLines);

    const result = await evaluateModel({
      modelId: "my-fine-tuned:latest",
      datasetPath: dsPath,
    });

    expect(result.testCases).toBeGreaterThan(0);
    expect(result.scores.overall).toBeGreaterThan(0);
    expect(result.scores.accuracy).toBeDefined();
    expect(result.scores.fluency).toBeDefined();
    expect(result.modelId).toBe("my-fine-tuned:latest");
    expect(result.timestamp).toBeDefined();
  });

  it("calls Ollama generate API with correct parameters", async () => {
    const dsPath = path.join(tmpDir, "api-dataset.jsonl");
    createDatasetFile(dsPath, sampleDatasetLines);

    await evaluateModel({
      modelId: "test-model",
      datasetPath: dsPath,
      baseUrl: "http://localhost:11434",
    });

    const fetchMock = vi.mocked(globalThis.fetch);
    expect(fetchMock).toHaveBeenCalled();

    // Check the first call's arguments
    const firstCall = fetchMock.mock.calls[0];
    expect(firstCall[0]).toBe("http://localhost:11434/api/generate");

    const reqInit = firstCall[1] as RequestInit;
    expect(reqInit.method).toBe("POST");
    expect(reqInit.headers).toEqual({ "Content-Type": "application/json" });

    const body = JSON.parse(reqInit.body as string) as {
      model: string;
      stream: boolean;
      options: { temperature: number };
    };
    expect(body.model).toBe("test-model");
    expect(body.stream).toBe(false);
    expect(body.options.temperature).toBe(0.1);
  });

  it("saves eval result JSON file to disk", async () => {
    const dsPath = path.join(tmpDir, "save-dataset.jsonl");
    createDatasetFile(dsPath, sampleDatasetLines);

    const result = await evaluateModel({
      modelId: "save-test-model",
      datasetPath: dsPath,
    });

    // Eval result should be saved to evals dir
    const evalDir = path.join(trainerDir(), "evals");
    expect(fs.existsSync(evalDir)).toBe(true);

    const evalFiles = fs.readdirSync(evalDir);
    expect(evalFiles.length).toBeGreaterThanOrEqual(1);

    // Find the matching eval file
    const matchingFile = evalFiles.find((f) => f.startsWith("save-test-model"));
    expect(matchingFile).toBeDefined();

    const savedData = JSON.parse(fs.readFileSync(path.join(evalDir, matchingFile!), "utf-8")) as {
      modelId: string;
      testCases: number;
      scores: { overall: number };
    };

    expect(savedData.modelId).toBe("save-test-model");
    expect(savedData.testCases).toBe(result.testCases);
    expect(savedData.scores.overall).toBe(result.scores.overall);
  });

  it("compares with base model when baseModelId provided", async () => {
    const dsPath = path.join(tmpDir, "compare-dataset.jsonl");
    createDatasetFile(dsPath, sampleDatasetLines);

    // Different responses for the fine-tuned vs base model
    let callIndex = 0;
    vi.mocked(globalThis.fetch).mockImplementation(async (input) => {
      const url = typeof input === "string" ? input : (input as Request).url;
      if (url.includes("/api/generate")) {
        callIndex++;
        return {
          ok: true,
          json: async () => ({
            response:
              callIndex % 2 === 1
                ? "Fine-tuned response with more relevant content."
                : "Base model generic response.",
          }),
        } as Response;
      }
      return { ok: false, json: async () => ({}) } as Response;
    });

    const result = await evaluateModel({
      modelId: "fine-tuned-model",
      baseModelId: "base-model",
      datasetPath: dsPath,
    });

    expect(result.testCases).toBeGreaterThan(0);
    expect(result.comparisonToBase).toBeDefined();
    expect(result.comparisonToBase!.baseScore).toBeDefined();
    expect(typeof result.comparisonToBase!.improvement).toBe("number");
  });

  it("does not include comparisonToBase when baseModelId not provided", async () => {
    const dsPath = path.join(tmpDir, "no-compare-dataset.jsonl");
    createDatasetFile(dsPath, sampleDatasetLines);

    const result = await evaluateModel({
      modelId: "single-model",
      datasetPath: dsPath,
    });

    expect(result.comparisonToBase).toBeUndefined();
  });

  it("includes adapterId in result when provided", async () => {
    const dsPath = path.join(tmpDir, "adapter-dataset.jsonl");
    createDatasetFile(dsPath, sampleDatasetLines);

    const result = await evaluateModel({
      modelId: "adapter-model",
      adapterId: "adapter-123",
      datasetPath: dsPath,
    });

    expect(result.adapterId).toBe("adapter-123");
  });

  it("handles fetch failures gracefully and returns zero for failed cases", async () => {
    const dsPath = path.join(tmpDir, "fail-dataset.jsonl");
    createDatasetFile(dsPath, sampleDatasetLines);

    // Make all fetch calls throw
    vi.mocked(globalThis.fetch).mockRejectedValue(new Error("Connection refused"));

    const result = await evaluateModel({
      modelId: "unreachable-model",
      datasetPath: dsPath,
    });

    // All evaluations fail, so testCases should be 0 and overall score 0
    expect(result.testCases).toBe(0);
    expect(result.scores.overall).toBe(0);
  });

  it("respects maxCases parameter to limit evaluation size", async () => {
    // Create a dataset with many entries
    const manyLines = Array.from({ length: 50 }, (_, i) =>
      JSON.stringify({
        conversations: [
          { from: "human", value: `Question ${i}` },
          { from: "gpt", value: `Answer ${i}` },
        ],
      }),
    );
    const dsPath = path.join(tmpDir, "many-dataset.jsonl");
    createDatasetFile(dsPath, manyLines);

    const result = await evaluateModel({
      modelId: "test-model",
      datasetPath: dsPath,
      maxCases: 5,
    });

    // Should evaluate at most 5 cases
    expect(result.testCases).toBeLessThanOrEqual(5);
    expect(result.testCases).toBeGreaterThan(0);
  });

  it("uses default Ollama base URL when none provided", async () => {
    const dsPath = path.join(tmpDir, "default-url-dataset.jsonl");
    createDatasetFile(dsPath, sampleDatasetLines);

    await evaluateModel({
      modelId: "test-model",
      datasetPath: dsPath,
    });

    const fetchMock = vi.mocked(globalThis.fetch);
    const firstCall = fetchMock.mock.calls[0];
    expect(firstCall[0]).toBe("http://127.0.0.1:11434/api/generate");
  });

  it("scores are rounded to 3 decimal places", async () => {
    const dsPath = path.join(tmpDir, "rounding-dataset.jsonl");
    createDatasetFile(dsPath, sampleDatasetLines);

    const result = await evaluateModel({
      modelId: "round-model",
      datasetPath: dsPath,
    });

    if (result.scores.accuracy !== undefined) {
      const decimalPlaces = result.scores.accuracy.toString().split(".")[1]?.length ?? 0;
      expect(decimalPlaces).toBeLessThanOrEqual(3);
    }
    if (result.scores.fluency !== undefined) {
      const decimalPlaces = result.scores.fluency.toString().split(".")[1]?.length ?? 0;
      expect(decimalPlaces).toBeLessThanOrEqual(3);
    }
    const overallDecimals = result.scores.overall.toString().split(".")[1]?.length ?? 0;
    expect(overallDecimals).toBeLessThanOrEqual(3);
  });
});
