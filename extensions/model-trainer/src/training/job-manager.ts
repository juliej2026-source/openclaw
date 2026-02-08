import fs from "node:fs";
import path from "node:path";
import type { TrainingJob, TrainingJobConfig, TrainingJobStatus } from "../types.js";

function trainerDir(): string {
  return path.join(process.env.HOME ?? "~", ".openclaw", "model-trainer");
}

function jobsFile(): string {
  return path.join(trainerDir(), "jobs.json");
}

type JobsData = {
  version: 1;
  jobs: TrainingJob[];
};

function loadJobs(): JobsData {
  try {
    const raw = fs.readFileSync(jobsFile(), "utf-8");
    return JSON.parse(raw) as JobsData;
  } catch {
    return { version: 1, jobs: [] };
  }
}

function saveJobs(data: JobsData): void {
  fs.mkdirSync(trainerDir(), { recursive: true });
  fs.writeFileSync(jobsFile(), JSON.stringify(data, null, 2) + "\n");
}

function generateJobId(): string {
  return `job-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Create a new training job (queued). */
export function createJob(config: TrainingJobConfig): TrainingJob {
  const job: TrainingJob = {
    id: generateJobId(),
    config,
    status: "queued",
  };

  const data = loadJobs();
  data.jobs.push(job);
  saveJobs(data);
  return job;
}

/** Get a job by ID. */
export function getJob(jobId: string): TrainingJob | undefined {
  return loadJobs().jobs.find((j) => j.id === jobId);
}

/** List all jobs, optionally filtered by status. */
export function listJobs(status?: TrainingJobStatus): TrainingJob[] {
  const jobs = loadJobs().jobs;
  if (status) {
    return jobs.filter((j) => j.status === status);
  }
  return jobs;
}

/** Update a job's status and optional fields. */
export function updateJob(
  jobId: string,
  updates: Partial<
    Pick<
      TrainingJob,
      "status" | "progress" | "startedAt" | "completedAt" | "error" | "outputPath" | "logPath"
    >
  >,
): TrainingJob | undefined {
  const data = loadJobs();
  const job = data.jobs.find((j) => j.id === jobId);
  if (!job) {
    return undefined;
  }

  Object.assign(job, updates);
  saveJobs(data);
  return job;
}

/** Cancel a queued or running job. */
export function cancelJob(jobId: string): boolean {
  const data = loadJobs();
  const job = data.jobs.find((j) => j.id === jobId);
  if (!job || job.status === "completed" || job.status === "failed" || job.status === "cancelled") {
    return false;
  }
  job.status = "cancelled";
  job.completedAt = new Date().toISOString();
  saveJobs(data);
  return true;
}
