import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk";
import { registerModelManagerCli } from "./src/cli/models-cli.js";
import { discoverLocalModels } from "./src/discovery.js";
import { ModelInventory } from "./src/inventory.js";
import { createHardwareInfoTool } from "./src/tools/hardware-info-tool.js";
import { createModelInfoTool } from "./src/tools/model-info-tool.js";
import { createModelListTool } from "./src/tools/model-list-tool.js";
import { createModelPullTool } from "./src/tools/model-pull-tool.js";
import { createModelRemoveTool } from "./src/tools/model-remove-tool.js";

const TOOL_NAMES = [
  "local_model_list",
  "local_model_pull",
  "local_model_remove",
  "local_model_info",
  "local_hardware_info",
] as const;

// Shared inventory instance (lazily created per gateway lifecycle)
let sharedInventory: ModelInventory | undefined;

function getInventory(): ModelInventory {
  if (!sharedInventory) {
    sharedInventory = new ModelInventory();
  }
  return sharedInventory;
}

const modelManagerPlugin = {
  id: "model-manager",
  name: "Model Manager",
  description:
    "Local model management for Ollama and llama.cpp: download, inventory, " +
    "hardware detection, and capability tracking.",
  configSchema: emptyPluginConfigSchema(),

  register(api: OpenClawPluginApi) {
    // ── Tools ──────────────────────────────────────────────────────────
    api.registerTool(
      () => {
        const inv = getInventory();
        return [
          createModelListTool(inv),
          createModelPullTool(inv),
          createModelRemoveTool(inv),
          createModelInfoTool(inv),
          createHardwareInfoTool(),
        ];
      },
      { names: [...TOOL_NAMES] },
    );

    // ── CLI ────────────────────────────────────────────────────────────
    api.registerCli(
      ({ program }) => {
        registerModelManagerCli(program);
      },
      { commands: ["local-models"] },
    );

    // ── Provider registration ──────────────────────────────────────────
    // Register local models as a provider so they appear in `openclaw models list`
    // and are usable through the standard model selection system.
    api.registerProvider({
      id: "local-models",
      label: "Local Models (Ollama/llama.cpp)",
      docsPath: "/providers/local-models",
      aliases: ["local", "ollama-managed"],
      envVars: ["OLLAMA_API_KEY"],
      auth: [
        {
          id: "ollama",
          label: "Ollama (local)",
          hint: "Auto-detect locally installed Ollama models",
          kind: "custom",
          run: async (_ctx) => {
            const inv = getInventory();
            const models = await discoverLocalModels(inv.listAll());
            inv.replaceAll(models);

            const modelDefs = models
              .filter((m) => !m.capabilities.includes("embedding"))
              .map((m) => ({
                id: m.id,
                name: m.name,
                api: "openai-completions" as const,
                reasoning: m.capabilities.includes("reasoning"),
                input: m.capabilities.includes("vision")
                  ? (["text", "image"] as const)
                  : (["text"] as const),
                cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
                contextWindow: m.contextWindow,
                maxTokens: m.maxTokens,
              }));

            const defaultModel = modelDefs[0]?.id;

            return {
              profiles: [
                {
                  profileId: "local-models:ollama",
                  credential: {
                    type: "token" as const,
                    provider: "local-models",
                    token: "ollama",
                  },
                },
              ],
              configPatch: {
                models: {
                  providers: {
                    "local-models": {
                      baseUrl: "http://127.0.0.1:11434/v1",
                      apiKey: "ollama",
                      api: "openai-completions",
                      models: modelDefs,
                    },
                  },
                },
              },
              defaultModel: defaultModel ? `local-models/${defaultModel}` : undefined,
              notes: [
                `Found ${models.length} local models via Ollama.`,
                "Models are served at http://127.0.0.1:11434 (OpenAI-compatible API).",
                "Use `openclaw local-models list` to see all models and their capabilities.",
                "Use `openclaw local-models pull <model>` to download new models.",
              ],
            };
          },
        },
      ],
    });

    // ── Gateway hooks ──────────────────────────────────────────────────
    // Auto-discover models when the gateway starts
    api.on("gateway_start", async () => {
      try {
        const inv = getInventory();
        const models = await discoverLocalModels(inv.listAll());
        inv.replaceAll(models);
        if (models.length > 0) {
          api.logger.info(`Model Manager: discovered ${models.length} local models`);
        }
      } catch (err) {
        api.logger.warn?.(
          `Model Manager: discovery failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    });
  },
};

export default modelManagerPlugin;
