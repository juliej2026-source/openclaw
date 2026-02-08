import { Type } from "@sinclair/typebox";
import type { AnyAgentTool } from "../../../../src/agents/tools/common.js";

// Session-level model overrides (in-memory, cleared on gateway restart)
const sessionOverrides = new Map<string, string>();

/** Get the current model override for a session, if any. */
export function getSessionOverride(sessionKey: string): string | undefined {
  return sessionOverrides.get(sessionKey);
}

/** Clear all session overrides. */
export function clearAllOverrides(): void {
  sessionOverrides.clear();
}

export function createMetaOverrideTool(): AnyAgentTool {
  return {
    name: "meta_model_override",
    label: "Model Override",
    description:
      "Pin a specific model for the current session, overriding the meta-engine's " +
      "automatic selection. Use 'clear' as the model to remove the override.",
    parameters: Type.Object({
      model: Type.String({
        description: 'Model to pin (e.g. "local-models/qwen3:14b") or "clear" to remove override',
      }),
    }),
    async execute(_toolCallId, args) {
      const params = (args ?? {}) as Record<string, unknown>;
      const model = typeof params.model === "string" ? params.model.trim() : "";
      if (!model) {
        throw new Error("model is required");
      }

      // In practice, the session key would come from the tool context.
      // For now, we use a placeholder since the tool context doesn't expose sessionKey.
      const sessionKey = "current";

      if (model === "clear") {
        sessionOverrides.delete(sessionKey);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                message: "Model override cleared. Meta-engine will resume automatic selection.",
              }),
            },
          ],
        };
      }

      sessionOverrides.set(sessionKey, model);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              message: `Model pinned to ${model} for this session.`,
              model,
            }),
          },
        ],
      };
    },
  };
}
