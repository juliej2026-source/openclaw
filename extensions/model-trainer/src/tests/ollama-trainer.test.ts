import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("node:child_process", () => ({
  execFile: vi.fn(
    (
      _cmd: string,
      _args: string[],
      _opts: unknown,
      callback: (err: Error | null, stdout: string, stderr: string) => void,
    ) => {
      callback(null, "success\n", "");
    },
  ),
}));

import { execFile } from "node:child_process";
import type { TrainingJobConfig } from "../types.js";
import * as jobManager from "../training/job-manager.js";
import { trainWithOllamaModelfile } from "../training/ollama-trainer.js";

let tmpDir: string;
const originalHome = process.env.HOME;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ollama-trainer-test-"));
  process.env.HOME = tmpDir;
  vi.clearAllMocks();
});

afterEach(() => {
  process.env.HOME = originalHome;
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

const baseConfig: TrainingJobConfig = {
  baseModel: "llama3:8b",
  datasetId: "test-ds",
  method: "ollama-modelfile",
  outputName: "my-test-model",
};

function trainerDir(): string {
  return path.join(tmpDir, ".openclaw", "model-trainer");
}

function createDatasetFile(datasetId: string, lines: string[]): void {
  const datasetsDir = path.join(trainerDir(), "datasets");
  fs.mkdirSync(datasetsDir, { recursive: true });
  const filePath = path.join(datasetsDir, `${datasetId}.jsonl`);
  fs.writeFileSync(filePath, lines.join("\n") + "\n");
}

const sampleDatasetLines = [
  JSON.stringify({
    conversations: [
      { from: "human", value: "Hello" },
      { from: "gpt", value: "Hi there!" },
    ],
  }),
  JSON.stringify({
    conversations: [
      { from: "human", value: "What is 2+2?" },
      { from: "gpt", value: "4" },
    ],
  }),
];

describe("trainWithOllamaModelfile", () => {
  it("sets job to failed when dataset not found", async () => {
    const job = jobManager.createJob(baseConfig);

    await trainWithOllamaModelfile(job.id, baseConfig);

    const updated = jobManager.getJob(job.id);
    expect(updated).toBeDefined();
    expect(updated!.status).toBe("failed");
    expect(updated!.error).toContain("not found");
    expect(updated!.completedAt).toBeDefined();
  });

  it("creates a Modelfile with correct FROM and SYSTEM directives when dataset exists", async () => {
    createDatasetFile("test-ds", sampleDatasetLines);
    const job = jobManager.createJob(baseConfig);

    await trainWithOllamaModelfile(job.id, baseConfig);

    // Verify Modelfile was written
    const modelfilePath = path.join(
      trainerDir(),
      "modelfiles",
      `${baseConfig.outputName}.Modelfile`,
    );
    expect(fs.existsSync(modelfilePath)).toBe(true);

    const content = fs.readFileSync(modelfilePath, "utf-8");
    expect(content).toContain(`FROM ${baseConfig.baseModel}`);
    expect(content).toContain("SYSTEM");
    expect(content).toContain("PARAMETER temperature 0.7");
    expect(content).toContain("PARAMETER top_p 0.9");
    expect(content).toContain("PARAMETER num_ctx 4096");
  });

  it("updates job to preparing then training during execution", async () => {
    createDatasetFile("test-ds", sampleDatasetLines);
    const job = jobManager.createJob(baseConfig);

    // Track status updates via spy
    const updateSpy = vi.spyOn(jobManager, "updateJob");

    await trainWithOllamaModelfile(job.id, baseConfig);

    // Verify the sequence of status updates
    const statusCalls = updateSpy.mock.calls.filter((call) => call[1] && "status" in call[1]);
    const statuses = statusCalls.map((call) => (call[1] as { status: string }).status);

    expect(statuses).toContain("preparing");
    expect(statuses).toContain("training");
    expect(statuses).toContain("completed");

    // preparing should come before training
    expect(statuses.indexOf("preparing")).toBeLessThan(statuses.indexOf("training"));
    // training should come before completed
    expect(statuses.indexOf("training")).toBeLessThan(statuses.indexOf("completed"));

    updateSpy.mockRestore();
  });

  it("completes successfully and writes a log file", async () => {
    createDatasetFile("test-ds", sampleDatasetLines);
    const job = jobManager.createJob(baseConfig);

    await trainWithOllamaModelfile(job.id, baseConfig);

    const updated = jobManager.getJob(job.id);
    expect(updated).toBeDefined();
    expect(updated!.status).toBe("completed");
    expect(updated!.completedAt).toBeDefined();
    expect(updated!.outputPath).toBeDefined();
    expect(updated!.logPath).toBeDefined();

    // Log file should exist and contain stdout/stderr sections
    expect(fs.existsSync(updated!.logPath!)).toBe(true);
    const logContent = fs.readFileSync(updated!.logPath!, "utf-8");
    expect(logContent).toContain("stdout:");
    expect(logContent).toContain("stderr:");
  });

  it("calls ollama create with correct arguments", async () => {
    createDatasetFile("test-ds", sampleDatasetLines);
    const job = jobManager.createJob(baseConfig);

    await trainWithOllamaModelfile(job.id, baseConfig);

    expect(execFile).toHaveBeenCalledWith(
      "ollama",
      ["create", baseConfig.outputName, "-f", expect.stringContaining(".Modelfile")],
      expect.objectContaining({ timeout: 5 * 60 * 1000 }),
      expect.any(Function),
    );
  });

  it("handles ollama create failure gracefully and sets status to failed", async () => {
    createDatasetFile("test-ds", sampleDatasetLines);
    const job = jobManager.createJob(baseConfig);

    // Make execFile return an error
    vi.mocked(execFile).mockImplementation(((
      _cmd: unknown,
      _args: unknown,
      _opts: unknown,
      callback: unknown,
    ) => {
      (callback as (err: Error | null, stdout: string, stderr: string) => void)(
        new Error("ollama create failed: model not found"),
        "",
        "",
      );
    }) as typeof execFile);

    await trainWithOllamaModelfile(job.id, baseConfig);

    const updated = jobManager.getJob(job.id);
    expect(updated).toBeDefined();
    expect(updated!.status).toBe("failed");
    expect(updated!.error).toContain("ollama create failed");
    expect(updated!.completedAt).toBeDefined();
  });

  it("uses custom maxSeqLength from hyperparams", async () => {
    createDatasetFile("test-ds", sampleDatasetLines);
    const config: TrainingJobConfig = {
      ...baseConfig,
      hyperparams: { maxSeqLength: 8192 },
    };
    const job = jobManager.createJob(config);

    await trainWithOllamaModelfile(job.id, config);

    const modelfilePath = path.join(trainerDir(), "modelfiles", `${config.outputName}.Modelfile`);
    const content = fs.readFileSync(modelfilePath, "utf-8");
    expect(content).toContain("PARAMETER num_ctx 8192");
  });

  it("builds concise system prompt for short dataset responses", async () => {
    // Short responses -> "concise and direct" style
    const shortLines = [
      JSON.stringify({
        conversations: [
          { from: "human", value: "Hello" },
          { from: "gpt", value: "Hi!" },
        ],
      }),
      JSON.stringify({
        conversations: [
          { from: "human", value: "How are you?" },
          { from: "gpt", value: "Good." },
        ],
      }),
    ];
    createDatasetFile("test-ds", shortLines);
    const job = jobManager.createJob(baseConfig);

    await trainWithOllamaModelfile(job.id, baseConfig);

    const modelfilePath = path.join(
      trainerDir(),
      "modelfiles",
      `${baseConfig.outputName}.Modelfile`,
    );
    const content = fs.readFileSync(modelfilePath, "utf-8");
    expect(content).toContain("concise and direct");
  });

  it("builds detailed system prompt for long dataset responses", async () => {
    // Long responses (>500 chars) -> "detailed and thorough" style
    const longResponse = "A ".repeat(300); // 600 chars
    const longLines = [
      JSON.stringify({
        conversations: [
          { from: "human", value: "Explain something" },
          { from: "gpt", value: longResponse },
        ],
      }),
    ];
    createDatasetFile("test-ds", longLines);
    const job = jobManager.createJob(baseConfig);

    await trainWithOllamaModelfile(job.id, baseConfig);

    const modelfilePath = path.join(
      trainerDir(),
      "modelfiles",
      `${baseConfig.outputName}.Modelfile`,
    );
    const content = fs.readFileSync(modelfilePath, "utf-8");
    expect(content).toContain("detailed and thorough");
  });
});
