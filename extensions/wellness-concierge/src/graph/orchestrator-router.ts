import { Command } from "@langchain/langgraph";
import type { WellnessGraphStateType } from "./state.js";

// ---------------------------------------------------------------------------
// Orchestrator Router — intent classification + dynamic routing
// Priority: Safety > Privacy > Correctness > User value
// ---------------------------------------------------------------------------

// Crisis keywords (highest priority — route to clinical safety immediately)
const CRISIS_PATTERNS =
  /\b(sui?cid\w*|self[- ]?harm\w*|hurt\s+(my|him|her)self|kill\s+(my|him|her)self|end(ing)?\s+(my|their)\s+life|want\s+to\s+die|imminent\s+danger|emergency|overdose\w*|cutting|hanging)\b/i;

// Scheduling / booking intent
const SCHEDULING_PATTERNS =
  /\b(schedul|book|appointment|calendar|check[- ]?in|availab|reschedul|cancel\s+session|next\s+session|provider|therapist|counselor)\b/i;

// Device / wearable intent
const DEVICE_PATTERNS =
  /\b(wearabl|heart\s+rate|hrv|sleep\s+track|biometric|fitbit|apple\s+watch|garmin|oura|cgm|glucose|device|sensor)\b/i;

// Privacy / consent intent
const PRIVACY_PATTERNS =
  /\b(privac|consent|data\s+(access|delet|export|request)|delet\w*\s+(my\s+)?data|pdpa|gdpr|opt[- ]?out|withdraw|personal\s+data|forget\s+me)\b/i;

// Knowledge / SOP intent
const KNOWLEDGE_PATTERNS =
  /\b(protocol|sop|guide|document|polic|manual|procedure|template|program\s+doc|how\s+does\s+(the|this)\s+program)\b/i;

// Intent → agent route mapping
const INTENT_ROUTES: Record<string, string> = {
  crisis: "clinical_safety_escalation",
  scheduling: "concierge_operator",
  device: "device_integration_optional",
  privacy: "data_steward_pdpa",
  knowledge: "rag_knowledge",
  coaching: "daily_coach",
};

const DEFAULT_ROUTE = "daily_coach";

/**
 * Classify user message into a wellness intent.
 * Returns intent string and confidence score.
 */
export function classifyWellnessIntent(message: string): {
  intent: string;
  confidence: number;
} {
  if (!message || message.trim().length === 0) {
    return { intent: "coaching", confidence: 0.3 };
  }

  // Priority 1: Crisis (always check first)
  if (CRISIS_PATTERNS.test(message)) {
    return { intent: "crisis", confidence: 0.95 };
  }

  // Priority 2: Privacy / consent
  if (PRIVACY_PATTERNS.test(message)) {
    return { intent: "privacy", confidence: 0.85 };
  }

  // Priority 3: Scheduling
  if (SCHEDULING_PATTERNS.test(message)) {
    return { intent: "scheduling", confidence: 0.8 };
  }

  // Priority 4: Device / wearable
  if (DEVICE_PATTERNS.test(message)) {
    return { intent: "device", confidence: 0.8 };
  }

  // Priority 5: Knowledge / SOP
  if (KNOWLEDGE_PATTERNS.test(message)) {
    return { intent: "knowledge", confidence: 0.75 };
  }

  // Default: coaching
  return { intent: "coaching", confidence: 0.6 };
}

/**
 * Orchestrator Router node — classifies intent and routes via Command(goto).
 */
export async function orchestratorRouter(state: WellnessGraphStateType): Promise<Command> {
  const start = Date.now();

  const { intent, confidence } = classifyWellnessIntent(state.userMessage);
  const route = INTENT_ROUTES[intent] ?? DEFAULT_ROUTE;
  const latency = Date.now() - start;

  return new Command({
    update: {
      intent,
      selectedAgent: route,
      routingConfidence: confidence,
      agentsVisited: ["orchestrator_router"],
      agentLatencies: { orchestrator_router: latency },
    },
    goto: route,
  });
}
