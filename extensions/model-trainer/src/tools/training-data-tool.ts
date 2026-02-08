import { Type } from "@sinclair/typebox";
import type { AnyAgentTool } from "../../../../src/agents/tools/common.js";
import { collectTrainingData } from "../dataset/collector.js";
import { exportDataset } from "../dataset/formatter.js";
import { validateDataset } from "../dataset/validator.js";

export function createTrainingDataTool(): AnyAgentTool {
  return {
    name: "training_data_collect",
    label: "Training Data",
    description:
      "Collect and export training data from conversation session transcripts. " +
      "Reads session JSONL files, extracts user/assistant pairs, validates quality, " +
      "and exports to a training dataset file. Use this before starting fine-tuning.",
    parameters: Type.Object({
      name: Type.String({
        description: "Name for the exported dataset (e.g. 'coding-pairs', 'support-chats')",
      }),
      agentId: Type.Optional(
        Type.String({
          description: "Filter to a specific agent ID. Omit to collect from all agents.",
        }),
      ),
      format: Type.Optional(
        Type.String({ description: 'Output format: "sharegpt" (default), "alpaca", or "chatml"' }),
      ),
      maxPairs: Type.Optional(
        Type.Number({
          description: "Maximum number of training pairs to collect (default: 10000)",
        }),
      ),
      baseModel: Type.Optional(
        Type.String({ description: "Tag the dataset with a target base model" }),
      ),
    }),
    async execute(_toolCallId, args) {
      const params = (args ?? {}) as Record<string, unknown>;
      const name = params.name as string;
      if (!name) {
        return {
          content: [{ type: "text", text: "Error: dataset name is required" }],
          isError: true,
        };
      }

      // Collect pairs from session transcripts
      const rawPairs = await collectTrainingData({
        agentId: params.agentId as string | undefined,
        maxPairs: (params.maxPairs as number) ?? 10_000,
      });

      if (rawPairs.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "No training data found. Make sure there are session transcripts in ~/.openclaw/agents/*/sessions/.",
            },
          ],
        };
      }

      // Validate and filter
      const validation = validateDataset(rawPairs);

      // Export to file
      const dataset = exportDataset({
        pairs: validation.valid,
        name,
        format: (params.format as "sharegpt" | "alpaca" | "chatml") ?? "sharegpt",
        baseModel: params.baseModel as string | undefined,
      });

      const payload = {
        dataset: {
          id: dataset.id,
          name: dataset.name,
          pairCount: dataset.pairCount,
          format: dataset.format,
          filePath: dataset.filePath,
        },
        collection: {
          rawPairs: rawPairs.length,
          validPairs: validation.valid.length,
          removed: validation.removed,
          removalReasons: validation.reasons,
        },
      };

      return {
        content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
        details: payload,
      };
    },
  };
}
