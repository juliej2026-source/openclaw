import type { RoutingDecision } from "../types.js";
import { routePrompt, type RouterOptions } from "../router.js";

/**
 * Build the prependContext string from a routing decision.
 *
 * This context is injected into the agent's conversation before processing,
 * providing the agent with information about which local model is recommended
 * for the current task (useful when spawning subagents).
 */
export function buildRoutingContext(decision: RoutingDecision): string {
  const lines: string[] = [];
  lines.push("[Meta-Engine Routing]");
  lines.push(
    `Task type: ${decision.taskClassification.primary} (${decision.taskClassification.complexity})`,
  );
  lines.push(
    `Recommended local model: ${decision.selectedModel.provider}/${decision.selectedModel.model}`,
  );
  lines.push(`Reason: ${decision.reason}`);

  if (decision.fallbackChain.length > 0) {
    const fallbacks = decision.fallbackChain.map((f) => `${f.provider}/${f.model}`).join(", ");
    lines.push(`Fallback models: ${fallbacks}`);
  }

  return lines.join("\n");
}

/**
 * Create the before_agent_start hook handler.
 *
 * Classifies the incoming prompt, scores available models, and prepends
 * routing context to the conversation.
 */
export function createBeforeAgentHook(
  getRouterOpts: () => RouterOptions | null,
): (
  event: { prompt: string },
  context: { agentId?: string; sessionKey?: string },
) => { prependContext?: string } | void {
  return (event, _context) => {
    const opts = getRouterOpts();
    if (!opts || opts.candidates.length === 0) {
      return; // No local models available, skip routing
    }

    const decision = routePrompt(event.prompt, opts);
    if (!decision) {
      return;
    }

    return {
      prependContext: buildRoutingContext(decision),
    };
  };
}
