import { Type } from "@sinclair/typebox";
import type { AnyAgentTool } from "../../../../src/agents/tools/common.js";
import type { PerformanceDb } from "../performance-db.js";

export function createMetaStatusTool(
  perfDb: PerformanceDb,
  getCandidateCount: () => number,
): AnyAgentTool {
  return {
    name: "meta_model_status",
    label: "Meta Status",
    description:
      "Show the current state of the meta-engine: available models, " +
      "performance statistics, and routing table.",
    parameters: Type.Object({}),
    async execute() {
      const summary = perfDb.getSummary();

      const payload = {
        availableModels: getCandidateCount(),
        totalPerformanceRecords: perfDb.totalRecords,
        modelPerformance: summary
          .toSorted((a, b) => b.successRate - a.successRate)
          .slice(0, 20)
          .map((s) => ({
            model: s.modelId,
            taskType: s.taskType,
            runs: s.totalRuns,
            successRate: `${(s.successRate * 100).toFixed(1)}%`,
            avgLatency: `${Math.round(s.avgLatencyMs)}ms`,
          })),
      };

      return {
        content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
        details: payload,
      };
    },
  };
}
