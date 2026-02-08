import { Type } from "@sinclair/typebox";
import type { AnyAgentTool } from "../../../../src/agents/tools/common.js";
import type { ModelInventory } from "../inventory.js";
import { OllamaClient } from "../ollama-client.js";

export function createModelRemoveTool(inventory: ModelInventory): AnyAgentTool {
  return {
    name: "local_model_remove",
    label: "Remove Model",
    description:
      "Remove a locally installed model. Deletes it from Ollama and the inventory. " +
      "This frees up disk space. Use local_model_list first to see available models.",
    parameters: Type.Object({
      model: Type.String({
        description: 'Model ID to remove (e.g. "qwen3:14b")',
      }),
    }),
    async execute(_toolCallId, args) {
      const params = (args ?? {}) as Record<string, unknown>;
      const modelId = typeof params.model === "string" ? params.model.trim() : "";
      if (!modelId) {
        throw new Error("model ID is required");
      }

      const existing = inventory.get(modelId);
      if (!existing) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: false,
                error: `Model "${modelId}" not found in inventory`,
              }),
            },
          ],
        };
      }

      // Delete from Ollama if it's an Ollama model
      if (existing.runtime === "ollama") {
        const client = new OllamaClient();
        const available = await client.isAvailable();
        if (available) {
          try {
            await client.deleteModel(existing.ollamaTag ?? modelId);
          } catch (err) {
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({
                    success: false,
                    error: `Failed to delete from Ollama: ${err instanceof Error ? err.message : String(err)}`,
                  }),
                },
              ],
            };
          }
        }
      }

      // Remove from inventory
      inventory.remove(modelId);

      const payload = {
        success: true,
        model: modelId,
        message: `Removed ${modelId}`,
      };

      return {
        content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
        details: payload,
      };
    },
  };
}
