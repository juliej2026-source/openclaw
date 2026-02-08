import { EventEmitter } from "node:events";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Default success spawn factory — re-applied every beforeEach
function createSuccessProc(): EventEmitter & {
  stdout: EventEmitter;
  stderr: EventEmitter;
} {
  const proc = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter;
    stderr: EventEmitter;
  };
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  setTimeout(() => {
    proc.stdout.emit("data", Buffer.from("TRAINING_START\n"));
    proc.stdout.emit("data", Buffer.from("TRAINING_COMPLETE loss=0.1234\n"));
    proc.stdout.emit("data", Buffer.from("ADAPTER_SAVED path=/tmp/adapters/test\n"));
    proc.emit("close", 0);
  }, 10);
  return proc;
}

vi.mock("node:child_process", () => ({
  spawn: vi.fn(() => createSuccessProc()),
}));

import { spawn } from "node:child_process";
import type { TrainingJobConfig } from "../types.js";
import * as jobManager from "../training/job-manager.js";
import { trainWithUnsloth } from "../training/unsloth-runner.js";

let tmpDir: string;
const originalHome = process.env.HOME;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "unsloth-runner-test-"));
  process.env.HOME = tmpDir;
  // Reset spawn to default success behavior (tests may override via mockImplementation)
  vi.mocked(spawn).mockImplementation((() => createSuccessProc()) as unknown as typeof spawn);
});

afterEach(() => {
  process.env.HOME = originalHome;
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

const baseConfig: TrainingJobConfig = {
  baseModel: "llama3:8b",
  datasetId: "test-ds",
  method: "unsloth-qlora",
  outputName: "my-qlora-model",
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

describe("trainWithUnsloth", () => {
  it("sets job to failed when dataset not found", async () => {
    const job = jobManager.createJob(baseConfig);

    await trainWithUnsloth(job.id, baseConfig);

    const updated = jobManager.getJob(job.id);
    expect(updated).toBeDefined();
    expect(updated!.status).toBe("failed");
    expect(updated!.error).toContain("not found");
    expect(updated!.completedAt).toBeDefined();
  });

  it("generates a Python training script and writes it to disk", async () => {
    createDatasetFile("test-ds", sampleDatasetLines);
    const job = jobManager.createJob(baseConfig);

    await trainWithUnsloth(job.id, baseConfig);

    const scriptPath = path.join(trainerDir(), "scripts", `${job.id}.py`);
    expect(fs.existsSync(scriptPath)).toBe(true);

    const content = fs.readFileSync(scriptPath, "utf-8");
    expect(content).toContain("from unsloth import FastLanguageModel");
    expect(content).toContain(`MODEL_NAME = "${baseConfig.baseModel}"`);
    expect(content).toContain("TRAINING_START");
    expect(content).toContain("TRAINING_COMPLETE");
    expect(content).toContain("ADAPTER_SAVED");
  });

  it("updates job through status flow: preparing -> training -> completed on exit 0", async () => {
    createDatasetFile("test-ds", sampleDatasetLines);
    const job = jobManager.createJob(baseConfig);

    const updateSpy = vi.spyOn(jobManager, "updateJob");

    await trainWithUnsloth(job.id, baseConfig);

    const statusCalls = updateSpy.mock.calls.filter((call) => call[1] && "status" in call[1]);
    const statuses = statusCalls.map((call) => (call[1] as { status: string }).status);

    expect(statuses).toContain("preparing");
    expect(statuses).toContain("training");
    expect(statuses).toContain("completed");

    expect(statuses.indexOf("preparing")).toBeLessThan(statuses.indexOf("training"));
    expect(statuses.indexOf("training")).toBeLessThan(statuses.indexOf("completed"));

    const final = jobManager.getJob(job.id);
    expect(final!.status).toBe("completed");
    expect(final!.completedAt).toBeDefined();

    updateSpy.mockRestore();
  });

  it("sets failed on non-zero exit code", async () => {
    createDatasetFile("test-ds", sampleDatasetLines);

    vi.mocked(spawn).mockImplementation((() => {
      const proc = new EventEmitter() as EventEmitter & {
        stdout: EventEmitter;
        stderr: EventEmitter;
      };
      proc.stdout = new EventEmitter();
      proc.stderr = new EventEmitter();
      setTimeout(() => {
        proc.stderr.emit("data", Buffer.from("RuntimeError: CUDA out of memory\n"));
        proc.emit("close", 1);
      }, 10);
      return proc;
    }) as unknown as typeof spawn);

    const job = jobManager.createJob(baseConfig);

    await trainWithUnsloth(job.id, baseConfig);

    const updated = jobManager.getJob(job.id);
    expect(updated).toBeDefined();
    expect(updated!.status).toBe("failed");
    expect(updated!.error).toContain("exited with code 1");
    expect(updated!.completedAt).toBeDefined();
  });

  it("sets failed on spawn error", async () => {
    createDatasetFile("test-ds", sampleDatasetLines);

    vi.mocked(spawn).mockImplementation((() => {
      const proc = new EventEmitter() as EventEmitter & {
        stdout: EventEmitter;
        stderr: EventEmitter;
      };
      proc.stdout = new EventEmitter();
      proc.stderr = new EventEmitter();
      setTimeout(() => {
        proc.emit("error", new Error("spawn python3 ENOENT"));
      }, 10);
      return proc;
    }) as unknown as typeof spawn);

    const job = jobManager.createJob(baseConfig);

    await trainWithUnsloth(job.id, baseConfig);

    const updated = jobManager.getJob(job.id);
    expect(updated).toBeDefined();
    expect(updated!.status).toBe("failed");
    expect(updated!.error).toContain("python3 ENOENT");
    expect(updated!.completedAt).toBeDefined();
  });

  it("parses TRAINING_COMPLETE and ADAPTER_SAVED signals from stdout", async () => {
    createDatasetFile("test-ds", sampleDatasetLines);

    const updateSpy = vi.spyOn(jobManager, "updateJob");

    const job = jobManager.createJob(baseConfig);
    await trainWithUnsloth(job.id, baseConfig);

    // After TRAINING_COMPLETE, the status should transition to "merging"
    const mergingCalls = updateSpy.mock.calls.filter(
      (call) => call[1] && (call[1] as { status?: string }).status === "merging",
    );
    expect(mergingCalls.length).toBeGreaterThanOrEqual(1);

    // After ADAPTER_SAVED, outputPath should be set
    const outputPathCalls = updateSpy.mock.calls.filter(
      (call) => call[1] && "outputPath" in call[1],
    );
    expect(outputPathCalls.length).toBeGreaterThanOrEqual(1);
    expect((outputPathCalls[0][1] as { outputPath: string }).outputPath).toBe("/tmp/adapters/test");

    updateSpy.mockRestore();
  });

  it("creates a log file with stdout and stderr output", async () => {
    createDatasetFile("test-ds", sampleDatasetLines);
    const job = jobManager.createJob(baseConfig);

    await trainWithUnsloth(job.id, baseConfig);

    const updated = jobManager.getJob(job.id);
    expect(updated!.logPath).toBeDefined();
    expect(fs.existsSync(updated!.logPath!)).toBe(true);

    // Allow the writeStream to flush
    await new Promise((r) => setTimeout(r, 50));

    const logContent = fs.readFileSync(updated!.logPath!, "utf-8");
    expect(logContent).toContain("TRAINING_START");
    expect(logContent).toContain("TRAINING_COMPLETE");
  });

  it("spawns python3 with the correct script path", async () => {
    createDatasetFile("test-ds", sampleDatasetLines);
    const job = jobManager.createJob(baseConfig);

    await trainWithUnsloth(job.id, baseConfig);

    expect(spawn).toHaveBeenCalledWith(
      "python3",
      [path.join(trainerDir(), "scripts", `${job.id}.py`)],
      expect.objectContaining({
        stdio: ["ignore", "pipe", "pipe"],
      }),
    );
  });

  it("uses custom hyperparameters in generated script", async () => {
    createDatasetFile("test-ds", sampleDatasetLines);
    const config: TrainingJobConfig = {
      ...baseConfig,
      hyperparams: {
        epochs: 5,
        batchSize: 4,
        learningRate: 1e-4,
        loraRank: 32,
        loraAlpha: 64,
        maxSeqLength: 8192,
        warmupSteps: 20,
        gradientAccumulationSteps: 8,
      },
    };
    const job = jobManager.createJob(config);

    await trainWithUnsloth(job.id, config);

    const scriptPath = path.join(trainerDir(), "scripts", `${job.id}.py`);
    const content = fs.readFileSync(scriptPath, "utf-8");

    expect(content).toContain("EPOCHS = 5");
    expect(content).toContain("BATCH_SIZE = 4");
    expect(content).toContain("LEARNING_RATE = 0.0001");
    expect(content).toContain("LORA_RANK = 32");
    expect(content).toContain("LORA_ALPHA = 64");
    expect(content).toContain("MAX_SEQ_LENGTH = 8192");
    expect(content).toContain("WARMUP_STEPS = 20");
    expect(content).toContain("GRAD_ACCUM = 8");
  });
});
