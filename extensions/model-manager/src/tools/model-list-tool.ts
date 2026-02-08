import { Type } from "@sinclair/typebox";
import type { AnyAgentTool } from "../../../../src/agents/tools/common.js";
import type { ModelInventory } from "../inventory.js";
import { formatBytes } from "../hardware.js";

export function createModelListTool(inventory: ModelInventory): AnyAgentTool {
  return {
    name: "local_model_list",
    label: "Local Models",
    description:
      "List all locally installed AI models (Ollama and llama.cpp). " +
      "Returns model IDs, sizes, capabilities, and usage statistics. " +
      "Use this to see what models are available for local inference.",
    parameters: Type.Object({
      capability: Type.Optional(
        Type.String({
          description:
            'Filter by capability: "code", "reasoning", "vision", "chat", "creative", "embedding", "tool-use"',
        }),
      ),
      runtime: Type.Optional(
        Type.String({
          description: 'Filter by runtime: "ollama" or "llamacpp"',
        }),
      ),
    }),
    async execute(_toolCallId, args) {
      const params = (args ?? {}) as Record<string, unknown>;
      inventory.reload();

      let models = inventory.listAll();

      if (typeof params.capability === "string" && params.capability) {
        const cap = params.capability as import("../types.js").ModelCapability;
        models = models.filter((m) => m.capabilities.includes(cap));
      }
      if (typeof params.runtime === "string" && params.runtime) {
        models = models.filter((m) => m.runtime === params.runtime);
      }

      const summary = models.map((m) => ({
        id: m.id,
        name: m.name,
        runtime: m.runtime,
        size: formatBytes(m.sizeBytes),
        parameters: m.parameterCount ?? "unknown",
        capabilities: m.capabilities,
        quantization: m.quantization ?? "unknown",
        contextWindow: m.contextWindow,
        usageCount: m.usageCount,
        lastUsed: m.lastUsed ?? "never",
      }));

      const payload = {
        totalModels: summary.length,
        totalSize: formatBytes(inventory.totalSizeBytes()),
        models: summary,
      };

      return {
        content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
        details: payload,
      };
    },
  };
}
