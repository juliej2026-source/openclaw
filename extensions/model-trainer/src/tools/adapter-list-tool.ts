import { Type } from "@sinclair/typebox";
import type { AnyAgentTool } from "../../../../src/agents/tools/common.js";
import { isAdapterOnDisk } from "../adapters/adapter-merge.js";
import { listAdapters } from "../adapters/adapter-store.js";

export function createAdapterListTool(): AnyAgentTool {
  return {
    name: "adapter_list",
    label: "LoRA Adapters",
    description:
      "List all LoRA adapters produced by fine-tuning jobs. " +
      "Shows adapter metadata, base model, size, and evaluation scores.",
    parameters: Type.Object({
      baseModel: Type.Optional(Type.String({ description: "Filter adapters by base model" })),
    }),
    async execute(_toolCallId, args) {
      const params = (args ?? {}) as Record<string, unknown>;
      let adapters = listAdapters();

      if (typeof params.baseModel === "string" && params.baseModel) {
        adapters = adapters.filter((a) => a.baseModel === params.baseModel);
      }

      const summary = adapters.map((a) => ({
        id: a.id,
        name: a.name,
        baseModel: a.baseModel,
        datasetId: a.datasetId,
        trainingJobId: a.trainingJobId,
        sizeBytes: a.sizeBytes,
        evalScore: a.evalScore ?? "not evaluated",
        createdAt: a.createdAt,
        onDisk: isAdapterOnDisk(a),
      }));

      const payload = { totalAdapters: summary.length, adapters: summary };

      return {
        content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
        details: payload,
      };
    },
  };
}
