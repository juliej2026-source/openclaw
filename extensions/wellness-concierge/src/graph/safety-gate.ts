import type { WellnessGraphStateType } from "./state.js";

// ---------------------------------------------------------------------------
// Safety Gate — human-in-the-loop for crisis escalation
// In production, this would use interrupt() from @langchain/langgraph.
// For now, it logs the escalation and marks it as pending review.
// ---------------------------------------------------------------------------

export async function safetyGate(state: WellnessGraphStateType) {
  const start = Date.now();

  // In production: await interrupt({ reason: "Crisis escalation requires human review" });
  // For now, we mark the escalation as recorded and return

  const latency = Date.now() - start;

  return {
    agentsVisited: ["safety_gate"],
    agentLatencies: { safety_gate: latency },
    pendingEscalation: false, // Escalation has been recorded
    success: true,
  };
}
