import { Type } from "@sinclair/typebox";
import type { AnyAgentTool } from "../../../../src/agents/tools/common.js";
import type { ModelInventory } from "../inventory.js";
import { ollamaTagToLocalModel } from "../discovery.js";
import { formatBytes } from "../hardware.js";
import { OllamaClient } from "../ollama-client.js";

export function createModelPullTool(inventory: ModelInventory): AnyAgentTool {
  return {
    name: "local_model_pull",
    label: "Pull Model",
    description:
      "Download and install a model locally via Ollama. " +
      'Provide a model name like "qwen3:14b", "llama3.3:70b", "codellama:13b". ' +
      "The model will be pulled from the Ollama registry and added to the local inventory. " +
      "This may take a while for large models.",
    parameters: Type.Object({
      model: Type.String({
        description: 'Model to pull, e.g. "qwen3:14b", "llama3.3:latest", "codellama:7b"',
      }),
    }),
    async execute(_toolCallId, args) {
      const params = (args ?? {}) as Record<string, unknown>;
      const modelName = typeof params.model === "string" ? params.model.trim() : "";
      if (!modelName) {
        throw new Error("model name is required");
      }

      const client = new OllamaClient();
      const available = await client.isAvailable();
      if (!available) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: false,
                error: "Ollama is not running. Start Ollama first: https://ollama.com",
              }),
            },
          ],
        };
      }

      // Track progress for the response
      let lastProgress = "";
      const result = await client.pullAndWait(modelName, (event) => {
        if (event.total && event.completed) {
          const pct = Math.round((event.completed / event.total) * 100);
          lastProgress = `${event.status}: ${pct}% (${formatBytes(event.completed)}/${formatBytes(event.total)})`;
        } else {
          lastProgress = event.status;
        }
      });

      if (!result.success) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: false,
                error: `Pull failed with status: ${result.finalStatus}`,
                lastProgress,
              }),
            },
          ],
        };
      }

      // Refresh inventory: get the new model's tag info
      const tags = await client.listModels();
      const newTag = tags.find((t) => t.name === modelName || t.name === `${modelName}:latest`);

      if (newTag) {
        const model = ollamaTagToLocalModel(newTag);
        inventory.upsert(model);
      }

      const payload = {
        success: true,
        model: modelName,
        message: `Successfully pulled ${modelName}`,
        size: newTag ? formatBytes(newTag.size) : "unknown",
      };

      return {
        content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
        details: payload,
      };
    },
  };
}
