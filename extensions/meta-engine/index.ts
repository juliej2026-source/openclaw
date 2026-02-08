import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import fs from "node:fs";
import path from "node:path";
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk";
import type { ScoringCandidate } from "./src/model-scorer.js";
import type { RouterOptions } from "./src/router.js";
import { registerMetaCli } from "./src/cli/meta-cli.js";
import { createAgentEndHook } from "./src/hooks/after-agent-hook.js";
import { createBeforeAgentHook } from "./src/hooks/before-agent-hook.js";
import { PerformanceDb } from "./src/performance-db.js";
import { createMetaOverrideTool } from "./src/tools/meta-override-tool.js";
import { createMetaSelectTool } from "./src/tools/meta-select-tool.js";
import { createMetaStatusTool } from "./src/tools/meta-status-tool.js";

const TOOL_NAMES = ["meta_model_select", "meta_model_status", "meta_model_override"] as const;

/**
 * Reads the model-manager inventory to build scoring candidates.
 *
 * The model-manager stores its inventory at ~/.openclaw/model-manager/inventory.json.
 * We read it directly (cross-plugin communication via shared filesystem).
 */
function loadCandidatesFromInventory(): ScoringCandidate[] {
  try {
    const inventoryPath = path.join(
      process.env.HOME ?? "~",
      ".openclaw",
      "model-manager",
      "inventory.json",
    );
    const raw = fs.readFileSync(inventoryPath, "utf-8");
    const data = JSON.parse(raw) as {
      models?: Array<{
        id: string;
        family?: string;
        parameterCount?: string;
        contextWindow: number;
        capabilities: string[];
        vramRequired?: number;
      }>;
    };
    return (data.models ?? []).map((m) => ({
      id: m.id,
      family: m.family,
      parameterCount: m.parameterCount,
      contextWindow: m.contextWindow,
      capabilities: m.capabilities,
      vramRequired: m.vramRequired,
    }));
  } catch {
    return [];
  }
}

const metaEnginePlugin = {
  id: "meta-engine",
  name: "Meta-Engine",
  description:
    "Autonomous model selection: classifies tasks and routes to optimal " +
    "local models based on capabilities and performance history.",
  configSchema: emptyPluginConfigSchema(),

  register(api: OpenClawPluginApi) {
    const perfDb = new PerformanceDb();

    // Factory that builds router options from current state
    function getRouterOpts(): RouterOptions | null {
      const candidates = loadCandidatesFromInventory();
      if (candidates.length === 0) {
        return null;
      }
      return { candidates, perfDb, provider: "local-models" };
    }

    // ── Hooks ────────────────────────────────────────────────────────
    api.on("before_agent_start", createBeforeAgentHook(getRouterOpts), { priority: 100 });

    api.on("agent_end", createAgentEndHook(perfDb));

    // ── Tools ────────────────────────────────────────────────────────
    api.registerTool(
      () => [
        createMetaSelectTool(getRouterOpts),
        createMetaStatusTool(perfDb, () => loadCandidatesFromInventory().length),
        createMetaOverrideTool(),
      ],
      { names: [...TOOL_NAMES] },
    );

    // ── CLI ──────────────────────────────────────────────────────────
    api.registerCli(
      ({ program }) => {
        registerMetaCli(program);
      },
      { commands: ["meta"] },
    );

    api.logger.info("Meta-Engine: registered task classification and model routing");
  },
};

export default metaEnginePlugin;
