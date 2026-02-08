import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { TrainingJobConfig } from "../types.js";
import * as jobManager from "../training/job-manager.js";

let tmpDir: string;
const originalHome = process.env.HOME;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "trainer-jobs-"));
  process.env.HOME = tmpDir;
});

afterEach(() => {
  process.env.HOME = originalHome;
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

const sampleConfig: TrainingJobConfig = {
  baseModel: "qwen3:7b",
  datasetId: "test-dataset-123",
  method: "ollama-modelfile",
  outputName: "my-custom-model",
};

describe("job-manager", () => {
  it("creates a job with queued status", () => {
    const job = jobManager.createJob(sampleConfig);
    expect(job.id).toMatch(/^job-/);
    expect(job.status).toBe("queued");
    expect(job.config).toEqual(sampleConfig);
  });

  it("retrieves a job by ID", () => {
    const created = jobManager.createJob(sampleConfig);
    const fetched = jobManager.getJob(created.id);
    expect(fetched).toBeDefined();
    expect(fetched!.id).toBe(created.id);
  });

  it("returns undefined for unknown job ID", () => {
    expect(jobManager.getJob("nonexistent")).toBeUndefined();
  });

  it("lists all jobs", () => {
    jobManager.createJob(sampleConfig);
    jobManager.createJob({ ...sampleConfig, outputName: "another-model" });

    const all = jobManager.listJobs();
    expect(all.length).toBe(2);
  });

  it("lists jobs filtered by status", () => {
    const job = jobManager.createJob(sampleConfig);
    jobManager.updateJob(job.id, { status: "training" });
    jobManager.createJob({ ...sampleConfig, outputName: "queued-model" });

    const training = jobManager.listJobs("training");
    expect(training.length).toBe(1);
    expect(training[0]?.status).toBe("training");

    const queued = jobManager.listJobs("queued");
    expect(queued.length).toBe(1);
  });

  it("updates job fields", () => {
    const job = jobManager.createJob(sampleConfig);

    const updated = jobManager.updateJob(job.id, {
      status: "training",
      startedAt: "2026-01-01T00:00:00Z",
    });

    expect(updated).toBeDefined();
    expect(updated!.status).toBe("training");
    expect(updated!.startedAt).toBe("2026-01-01T00:00:00Z");
  });

  it("returns undefined when updating nonexistent job", () => {
    const result = jobManager.updateJob("nonexistent", { status: "failed" });
    expect(result).toBeUndefined();
  });

  it("cancels a queued job", () => {
    const job = jobManager.createJob(sampleConfig);
    const cancelled = jobManager.cancelJob(job.id);
    expect(cancelled).toBe(true);

    const fetched = jobManager.getJob(job.id);
    expect(fetched!.status).toBe("cancelled");
    expect(fetched!.completedAt).toBeDefined();
  });

  it("cancels a training job", () => {
    const job = jobManager.createJob(sampleConfig);
    jobManager.updateJob(job.id, { status: "training" });

    const cancelled = jobManager.cancelJob(job.id);
    expect(cancelled).toBe(true);
  });

  it("cannot cancel a completed job", () => {
    const job = jobManager.createJob(sampleConfig);
    jobManager.updateJob(job.id, { status: "completed" });

    const cancelled = jobManager.cancelJob(job.id);
    expect(cancelled).toBe(false);
  });

  it("cannot cancel a nonexistent job", () => {
    expect(jobManager.cancelJob("nonexistent")).toBe(false);
  });

  it("persists jobs to disk", () => {
    const _job = jobManager.createJob(sampleConfig);

    // Verify file exists
    const jobsFile = path.join(tmpDir, ".openclaw", "model-trainer", "jobs.json");
    expect(fs.existsSync(jobsFile)).toBe(true);

    const data = JSON.parse(fs.readFileSync(jobsFile, "utf-8")) as { jobs: unknown[] };
    expect(data.jobs.length).toBe(1);
  });
});
