import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk";
import { registerTrainerCli } from "./src/cli/trainer-cli.js";
import { collectTrainingData } from "./src/dataset/collector.js";
import { exportDataset } from "./src/dataset/formatter.js";
import { validateDataset } from "./src/dataset/validator.js";
import { createAdapterListTool } from "./src/tools/adapter-list-tool.js";
import { createEvalTool } from "./src/tools/eval-tool.js";
import { createTrainingDataTool } from "./src/tools/training-data-tool.js";
import { createTrainingStartTool } from "./src/tools/training-start-tool.js";
import { createTrainingStatusTool } from "./src/tools/training-status-tool.js";

const TOOL_NAMES = [
  "training_data_collect",
  "training_start",
  "training_status",
  "adapter_list",
  "model_eval",
] as const;

const modelTrainerPlugin = {
  id: "model-trainer",
  name: "Model Trainer",
  description:
    "LoRA/QLoRA fine-tuning for local models: dataset collection from session " +
    "transcripts, training job management, adapter tracking, and model evaluation.",
  configSchema: emptyPluginConfigSchema(),

  register(api: OpenClawPluginApi) {
    // ── Tools ──────────────────────────────────────────────────────────
    api.registerTool(
      () => [
        createTrainingDataTool(),
        createTrainingStartTool(),
        createTrainingStatusTool(),
        createAdapterListTool(),
        createEvalTool(),
      ],
      { names: [...TOOL_NAMES] },
    );

    // ── CLI ────────────────────────────────────────────────────────────
    api.registerCli(
      ({ program }) => {
        registerTrainerCli(program);
      },
      { commands: ["train"] },
    );

    // ── Hooks ──────────────────────────────────────────────────────────
    // Auto-collect successful conversation pairs after each agent run.
    // Data is collected passively; training is never triggered automatically.
    api.on("agent_end", async (event) => {
      try {
        // Only collect from successful agent runs
        if (!event || typeof event !== "object") {
          return;
        }
        const ev = event as { agentId?: string; success?: boolean };
        if (ev.success === false) {
          return;
        }

        const agentId = ev.agentId;
        if (!agentId) {
          return;
        }

        // Collect and store a small batch of new pairs
        const pairs = await collectTrainingData({
          agentId,
          maxPairs: 100,
        });

        if (pairs.length < 5) {
          return;
        } // Not enough data to bother

        const validation = validateDataset(pairs);
        if (validation.valid.length < 3) {
          return;
        }

        // Export to a rolling dataset for this agent
        exportDataset({
          pairs: validation.valid,
          name: `auto-${agentId}`,
          format: "sharegpt",
        });
      } catch {
        // Silent — data collection should never break the main flow
      }
    });
  },
};

export default modelTrainerPlugin;
