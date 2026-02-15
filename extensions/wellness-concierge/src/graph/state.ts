import { Annotation } from "@langchain/langgraph";
import type { InterAgentMessage } from "../types.js";

// ---------------------------------------------------------------------------
// Wellness Graph State — typed channels for the LangGraph StateGraph
// ---------------------------------------------------------------------------

export const WellnessGraphState = Annotation.Root({
  // Session context
  sessionId: Annotation<string>({
    reducer: (_, next) => next,
    default: () => "",
  }),
  userId: Annotation<string>({
    reducer: (_, next) => next,
    default: () => "",
  }),
  userMessage: Annotation<string>({
    reducer: (_, next) => next,
    default: () => "",
  }),

  // Routing
  selectedAgent: Annotation<string>({
    reducer: (_, next) => next,
    default: () => "",
  }),
  routingConfidence: Annotation<number>({
    reducer: (_, next) => next,
    default: () => 0,
  }),
  intent: Annotation<string>({
    reducer: (_, next) => next,
    default: () => "",
  }),

  // Consent state
  consentGrants: Annotation<string[]>({
    reducer: (prev, next) => [...new Set([...prev, ...next])],
    default: () => [],
  }),
  consentRequired: Annotation<string[]>({
    reducer: (_, next) => next,
    default: () => [],
  }),

  // Inter-agent messages (append-only channel)
  messages: Annotation<InterAgentMessage[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),

  // Agent execution tracking
  agentsVisited: Annotation<string[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
  agentLatencies: Annotation<Record<string, number>>({
    reducer: (prev, next) => ({ ...prev, ...next }),
    default: () => ({}),
  }),

  // Clinical safety
  escalationLevel: Annotation<number>({
    reducer: (_, next) => next,
    default: () => 0,
  }),
  safetyFlags: Annotation<string[]>({
    reducer: (prev, next) => [...new Set([...prev, ...next])],
    default: () => [],
  }),

  // Result
  response: Annotation<string>({
    reducer: (_, next) => next,
    default: () => "",
  }),
  success: Annotation<boolean>({
    reducer: (_, next) => next,
    default: () => false,
  }),
  error: Annotation<string>({
    reducer: (_, next) => next,
    default: () => "",
  }),

  // CAPA evaluation
  capaFindings: Annotation<Record<string, unknown>[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),

  // Safety gate
  pendingEscalation: Annotation<boolean>({
    reducer: (_, next) => next,
    default: () => false,
  }),
});

export type WellnessGraphStateType = typeof WellnessGraphState.State;
