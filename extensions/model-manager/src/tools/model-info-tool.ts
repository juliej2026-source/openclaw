import { Type } from "@sinclair/typebox";
import type { AnyAgentTool } from "../../../../src/agents/tools/common.js";
import type { ModelInventory } from "../inventory.js";
import { formatBytes } from "../hardware.js";
import { OllamaClient } from "../ollama-client.js";

export function createModelInfoTool(inventory: ModelInventory): AnyAgentTool {
  return {
    name: "local_model_info",
    label: "Model Info",
    description:
      "Get detailed information about a locally installed model, including " +
      "size, quantization, capabilities, context window, and Ollama metadata.",
    parameters: Type.Object({
      model: Type.String({
        description: 'Model ID to inspect (e.g. "qwen3:14b")',
      }),
    }),
    async execute(_toolCallId, args) {
      const params = (args ?? {}) as Record<string, unknown>;
      const modelId = typeof params.model === "string" ? params.model.trim() : "";
      if (!modelId) {
        throw new Error("model ID is required");
      }

      inventory.reload();
      const model = inventory.get(modelId);
      if (!model) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ error: `Model "${modelId}" not found in inventory` }),
            },
          ],
        };
      }

      // Try to get extra info from Ollama
      let ollamaInfo: Record<string, unknown> | undefined;
      if (model.runtime === "ollama") {
        try {
          const client = new OllamaClient();
          const info = await client.showModel(model.ollamaTag ?? modelId);
          ollamaInfo = {
            template: info.template,
            family: info.details.family,
            families: info.details.families,
            format: info.details.format,
            parameterSize: info.details.parameter_size,
            quantizationLevel: info.details.quantization_level,
          };
        } catch {
          // Ollama not available, skip
        }
      }

      const payload = {
        id: model.id,
        name: model.name,
        runtime: model.runtime,
        size: formatBytes(model.sizeBytes),
        sizeBytes: model.sizeBytes,
        quantization: model.quantization ?? "unknown",
        parameterCount: model.parameterCount ?? "unknown",
        family: model.family ?? "unknown",
        capabilities: model.capabilities,
        contextWindow: model.contextWindow,
        maxTokens: model.maxTokens,
        vramRequired: model.vramRequired ? formatBytes(model.vramRequired) : "unknown",
        installedAt: model.installedAt,
        lastUsed: model.lastUsed ?? "never",
        usageCount: model.usageCount,
        ollamaDetails: ollamaInfo,
      };

      return {
        content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
        details: payload,
      };
    },
  };
}
