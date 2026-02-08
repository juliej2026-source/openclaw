import type { PerformanceRecord } from "../types.js";
import { PerformanceDb } from "../performance-db.js";
import { classifyTask } from "../task-classifier.js";

/**
 * Create the agent_end hook handler.
 *
 * Records performance data (success/failure, duration) for the model
 * that was used. This data feeds back into the model scorer for future routing.
 */
export function createAgentEndHook(
  perfDb: PerformanceDb,
): (
  event: { messages: unknown[]; success: boolean; error?: string; durationMs?: number },
  context: { agentId?: string; sessionKey?: string },
) => void {
  return (event, context) => {
    // Extract the original user prompt from messages
    const messages = event.messages as Array<{
      role?: string;
      content?: string | Array<{ text?: string }>;
    }>;

    const userMsg = messages.find((m) => m.role === "user");
    if (!userMsg) {
      return;
    }

    const promptText =
      typeof userMsg.content === "string"
        ? userMsg.content
        : Array.isArray(userMsg.content)
          ? userMsg.content.map((c) => c.text ?? "").join(" ")
          : "";

    if (!promptText.trim()) {
      return;
    }

    // Classify what kind of task it was
    const classification = classifyTask(promptText);

    // We don't know exactly which model was used from the hook context,
    // but we can record against the session key for later correlation.
    // The model ID will need to be resolved from the session metadata.
    const record: PerformanceRecord = {
      modelId: "unknown", // Will be enriched when model info is available
      taskType: classification.primary,
      success: event.success,
      durationMs: event.durationMs ?? 0,
      timestamp: new Date().toISOString(),
      sessionKey: context.sessionKey,
    };

    try {
      perfDb.record(record);
    } catch {
      // Silently ignore write failures — performance tracking is best-effort
    }
  };
}
