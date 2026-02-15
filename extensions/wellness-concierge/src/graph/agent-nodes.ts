import type { WellnessGraphStateType } from "./state.js";

// ---------------------------------------------------------------------------
// Agent Nodes — stub implementations for the 7 specialist agents
// Each records timing, produces minimal state update, and returns result.
// ---------------------------------------------------------------------------

function makeStubNode(agentId: string, responseTemplate: string) {
  return async function (state: WellnessGraphStateType) {
    const start = Date.now();

    const response = responseTemplate.replace("{message}", state.userMessage || "your request");
    const latency = Date.now() - start;

    return {
      agentsVisited: [agentId],
      agentLatencies: { [agentId]: latency },
      response,
      success: true,
    };
  };
}

// ---- Clinical Safety & Escalation ----

export async function clinicalSafetyEscalation(state: WellnessGraphStateType) {
  const start = Date.now();
  const latency = Date.now() - start;

  return {
    agentsVisited: ["clinical_safety_escalation"],
    agentLatencies: { clinical_safety_escalation: latency },
    escalationLevel: 3,
    safetyFlags: ["crisis_detected"],
    pendingEscalation: true,
    response:
      "Are you in immediate danger right now? If yes, please call local emergency services now or go to the nearest emergency department. Singapore crisis resources: SOS 1800-221-4444, IMH 6389-2222.",
    success: true,
  };
}

// ---- Data Steward (PDPA) ----

export const dataStewardPdpa = makeStubNode(
  "data_steward_pdpa",
  "Privacy check complete. Your data is handled per PDPA guidelines. Consent status verified for {message}.",
);

// ---- Daily Coach ----

export const dailyCoach = makeStubNode(
  "daily_coach",
  "Based on {message}, here is your plan: Take 5 minutes for a focused breathing exercise right now. Micro-commitment: one 10-minute walk after lunch.",
);

// ---- Concierge Operator ----

export const conciergeOperator = makeStubNode(
  "concierge_operator",
  "I'll help coordinate that. Based on {message}, I can offer appointment options within the next 5 business days. Your next check-in is scheduled for 7 days from now.",
);

// ---- RAG Knowledge ----

export const ragKnowledge = makeStubNode(
  "rag_knowledge",
  "Based on approved program documentation for {message}: Please refer to the Executive Wellbeing Program Guide v1, Section 2.3 for detailed protocols.",
);

// ---- Device Integration ----

export const deviceIntegration = makeStubNode(
  "device_integration_optional",
  "Device data check for {message}: No verified wearable data currently available. Please ensure your device is connected and synced.",
);

// ---- Evaluation & CAPA ----

export async function evaluationCapa(state: WellnessGraphStateType) {
  const start = Date.now();
  const latency = Date.now() - start;

  // Check if we need to escalate based on state
  const needsEscalation =
    state.escalationLevel >= 2 && !state.safetyFlags.includes("crisis_detected");

  return {
    agentsVisited: ["evaluation_capa"],
    agentLatencies: { evaluation_capa: latency },
    pendingEscalation: needsEscalation,
    success: true,
  };
}

// ---- Conditional: should we escalate to clinical safety? ----

export function needsEscalation(state: WellnessGraphStateType): string {
  if (state.pendingEscalation && !state.safetyFlags.includes("crisis_detected")) {
    return "safety_gate";
  }
  return "__end__";
}
