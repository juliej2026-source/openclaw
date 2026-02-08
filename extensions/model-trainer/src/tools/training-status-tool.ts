import { Type } from "@sinclair/typebox";
import type { AnyAgentTool } from "../../../../src/agents/tools/common.js";
import * as jobManager from "../training/job-manager.js";

export function createTrainingStatusTool(): AnyAgentTool {
  return {
    name: "training_status",
    label: "Training Status",
    description:
      "Check the status of training jobs. With no arguments, lists all jobs. " +
      "With a job ID, returns detailed status including progress and logs.",
    parameters: Type.Object({
      jobId: Type.Optional(
        Type.String({ description: "Specific job ID to check. Omit to list all jobs." }),
      ),
      status: Type.Optional(
        Type.String({
          description:
            'Filter by status: "queued", "preparing", "training", "completed", "failed", "cancelled"',
        }),
      ),
      cancel: Type.Optional(
        Type.Boolean({ description: "Set to true to cancel a queued or running job" }),
      ),
    }),
    async execute(_toolCallId, args) {
      const params = (args ?? {}) as Record<string, unknown>;

      // Cancel a job
      if (params.cancel && typeof params.jobId === "string") {
        const cancelled = jobManager.cancelJob(params.jobId);
        return {
          content: [
            {
              type: "text",
              text: cancelled
                ? `Job ${params.jobId} cancelled.`
                : `Could not cancel job ${params.jobId} (not found or already finished).`,
            },
          ],
        };
      }

      // Get specific job
      if (typeof params.jobId === "string") {
        const job = jobManager.getJob(params.jobId);
        if (!job) {
          return {
            content: [{ type: "text", text: `Job ${params.jobId} not found.` }],
            isError: true,
          };
        }

        return {
          content: [{ type: "text", text: JSON.stringify(job, null, 2) }],
          details: job,
        };
      }

      // List all jobs
      const statusFilter = params.status as import("../types.js").TrainingJobStatus | undefined;
      const jobs = jobManager.listJobs(statusFilter);

      const summary = jobs.map((j) => ({
        id: j.id,
        status: j.status,
        method: j.config.method,
        baseModel: j.config.baseModel,
        outputName: j.config.outputName,
        startedAt: j.startedAt,
        completedAt: j.completedAt,
        error: j.error,
      }));

      const payload = { totalJobs: summary.length, jobs: summary };

      return {
        content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
        details: payload,
      };
    },
  };
}
