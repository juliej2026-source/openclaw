import { Type } from "@sinclair/typebox";
import type { AnyAgentTool } from "../../../../src/agents/tools/common.js";
import { routePrompt, type RouterOptions } from "../router.js";

export function createMetaSelectTool(getRouterOpts: () => RouterOptions | null): AnyAgentTool {
  return {
    name: "meta_model_select",
    label: "Model Select",
    description:
      "Ask the meta-engine to recommend the best local model for a specific task. " +
      "Provide a task description and get back a model recommendation with scores. " +
      "Use this when spawning subagents to pick the optimal model for each subtask.",
    parameters: Type.Object({
      task: Type.String({
        description: "Description of the task to find the best model for",
      }),
    }),
    async execute(_toolCallId, args) {
      const params = (args ?? {}) as Record<string, unknown>;
      const task = typeof params.task === "string" ? params.task.trim() : "";
      if (!task) {
        throw new Error("task description is required");
      }

      const opts = getRouterOpts();
      if (!opts || opts.candidates.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                recommendation: null,
                reason: "No local models available. Use local_model_pull to download models first.",
              }),
            },
          ],
        };
      }

      const decision = routePrompt(task, opts);
      if (!decision) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                recommendation: null,
                reason: "Could not determine a model recommendation.",
              }),
            },
          ],
        };
      }

      const payload = {
        recommendation: decision.selectedModel,
        taskType: decision.taskClassification.primary,
        complexity: decision.taskClassification.complexity,
        confidence: decision.taskClassification.confidence,
        score: decision.topCandidates[0]?.score,
        reason: decision.reason,
        fallbacks: decision.fallbackChain,
        topCandidates: decision.topCandidates.slice(0, 3).map((c) => ({
          model: c.modelId,
          score: c.score,
          fitsHardware: c.fitsHardware,
        })),
      };

      return {
        content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
        details: payload,
      };
    },
  };
}
