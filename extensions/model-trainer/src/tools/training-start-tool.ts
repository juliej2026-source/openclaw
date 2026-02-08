import { Type } from "@sinclair/typebox";
import type { AnyAgentTool } from "../../../../src/agents/tools/common.js";
import type { TrainingJobConfig, TrainingMethod } from "../types.js";
import * as jobManager from "../training/job-manager.js";
import { trainWithOllamaModelfile } from "../training/ollama-trainer.js";
import { trainWithUnsloth } from "../training/unsloth-runner.js";

export function createTrainingStartTool(): AnyAgentTool {
  return {
    name: "training_start",
    label: "Start Training",
    description:
      "Start a model fine-tuning job. Supports two methods: " +
      '"ollama-modelfile" (behavioral customization, no GPU needed) and ' +
      '"unsloth-qlora" (real LoRA fine-tuning, requires CUDA GPU with 8GB+ VRAM). ' +
      "Requires a dataset created by training_data_collect.",
    parameters: Type.Object({
      baseModel: Type.String({
        description: "Base model to fine-tune (e.g. 'qwen3:14b', 'llama3.3:7b')",
      }),
      datasetId: Type.String({
        description: "Dataset ID from training_data_collect",
      }),
      outputName: Type.String({
        description: "Name for the output model/adapter",
      }),
      method: Type.Optional(
        Type.String({
          description:
            'Training method: "ollama-modelfile" (default, no GPU) or "unsloth-qlora" (GPU required)',
        }),
      ),
      epochs: Type.Optional(Type.Number({ description: "Number of training epochs (default: 3)" })),
      batchSize: Type.Optional(Type.Number({ description: "Batch size (default: 2)" })),
      learningRate: Type.Optional(Type.Number({ description: "Learning rate (default: 0.0002)" })),
      loraRank: Type.Optional(Type.Number({ description: "LoRA rank (default: 16)" })),
      loraAlpha: Type.Optional(Type.Number({ description: "LoRA alpha (default: 32)" })),
      maxSeqLength: Type.Optional(
        Type.Number({ description: "Max sequence length (default: 4096)" }),
      ),
    }),
    async execute(_toolCallId, args) {
      const params = (args ?? {}) as Record<string, unknown>;

      const rawMethod = (params.method as string) ?? "ollama-modelfile";
      if (rawMethod !== "ollama-modelfile" && rawMethod !== "unsloth-qlora") {
        return {
          content: [
            {
              type: "text",
              text: `Error: unsupported method "${rawMethod}". Use "ollama-modelfile" or "unsloth-qlora".`,
            },
          ],
          isError: true,
        };
      }
      const method: TrainingMethod = rawMethod;

      const config: TrainingJobConfig = {
        baseModel: params.baseModel as string,
        datasetId: params.datasetId as string,
        method,
        outputName: params.outputName as string,
        hyperparams: {
          epochs: params.epochs as number | undefined,
          batchSize: params.batchSize as number | undefined,
          learningRate: params.learningRate as number | undefined,
          loraRank: params.loraRank as number | undefined,
          loraAlpha: params.loraAlpha as number | undefined,
          maxSeqLength: params.maxSeqLength as number | undefined,
        },
      };

      // Create job
      const job = jobManager.createJob(config);

      // Start training asynchronously (don't await — it runs in background)
      if (method === "ollama-modelfile") {
        void trainWithOllamaModelfile(job.id, config);
      } else {
        void trainWithUnsloth(job.id, config);
      }

      const payload = {
        jobId: job.id,
        status: "queued",
        method,
        baseModel: config.baseModel,
        datasetId: config.datasetId,
        outputName: config.outputName,
        message: `Training job ${job.id} started. Use training_status to monitor progress.`,
      };

      return {
        content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
        details: payload,
      };
    },
  };
}
