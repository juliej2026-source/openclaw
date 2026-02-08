import { Type } from "@sinclair/typebox";
import type { AnyAgentTool } from "../../../../src/agents/tools/common.js";
import { getAdapter, updateAdapterEvalScore } from "../adapters/adapter-store.js";
import { listDatasets } from "../dataset/formatter.js";
import { evaluateModel } from "../eval/evaluator.js";

export function createEvalTool(): AnyAgentTool {
  return {
    name: "model_eval",
    label: "Model Eval",
    description:
      "Evaluate a model's quality by running test prompts from a dataset and scoring " +
      "responses. Optionally compares a fine-tuned model against its base model to " +
      "measure improvement. Requires Ollama running with the model loaded.",
    parameters: Type.Object({
      modelId: Type.String({
        description: "Ollama model to evaluate (e.g. 'my-custom-model')",
      }),
      datasetId: Type.Optional(
        Type.String({ description: "Dataset ID for test cases. Uses most recent if omitted." }),
      ),
      adapterId: Type.Optional(
        Type.String({ description: "Adapter ID to tag this evaluation against" }),
      ),
      baseModelId: Type.Optional(
        Type.String({ description: "Base model to compare against (measures improvement)" }),
      ),
      maxCases: Type.Optional(
        Type.Number({ description: "Maximum number of test cases (default: 20)" }),
      ),
    }),
    async execute(_toolCallId, args) {
      const params = (args ?? {}) as Record<string, unknown>;
      const modelId = params.modelId as string;
      if (!modelId) {
        return {
          content: [{ type: "text", text: "Error: modelId is required" }],
          isError: true,
        };
      }

      // Find dataset file path
      let datasetPath: string | undefined;
      const datasets = listDatasets();

      if (typeof params.datasetId === "string") {
        const ds = datasets.find((d) => d.id === params.datasetId);
        if (!ds) {
          return {
            content: [{ type: "text", text: `Dataset "${params.datasetId}" not found.` }],
            isError: true,
          };
        }
        datasetPath = ds.filePath;
      } else if (datasets.length > 0) {
        // Use most recent dataset
        datasetPath = datasets[datasets.length - 1]?.filePath;
      }

      if (!datasetPath) {
        return {
          content: [
            {
              type: "text",
              text: "No datasets found. Collect training data first with training_data_collect.",
            },
          ],
          isError: true,
        };
      }

      try {
        const result = await evaluateModel({
          modelId,
          adapterId: params.adapterId as string | undefined,
          datasetPath,
          baseModelId: params.baseModelId as string | undefined,
          maxCases: (params.maxCases as number) ?? 20,
        });

        // Update adapter eval score if specified
        if (params.adapterId && typeof params.adapterId === "string") {
          const adapter = getAdapter(params.adapterId);
          if (adapter) {
            updateAdapterEvalScore(params.adapterId, result.scores.overall);
          }
        }

        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          details: result,
        };
      } catch (err) {
        return {
          content: [
            {
              type: "text",
              text: `Evaluation failed: ${err instanceof Error ? err.message : String(err)}. Is Ollama running with model "${modelId}" available?`,
            },
          ],
          isError: true,
        };
      }
    },
  };
}
