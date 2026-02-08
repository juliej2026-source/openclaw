import { Annotation } from "@langchain/langgraph";
import type { EvolutionProposal } from "../types.js";

// ---------------------------------------------------------------------------
// Neural Graph State — typed channels for the LangGraph StateGraph
// ---------------------------------------------------------------------------

export const NeuralGraphState = Annotation.Root({
  // Input
  taskDescription: Annotation<string>({
    reducer: (_, next) => next,
    default: () => "",
  }),
  taskType: Annotation<string>({
    reducer: (_, next) => next,
    default: () => "unknown",
  }),
  complexity: Annotation<string>({
    reducer: (_, next) => next,
    default: () => "medium",
  }),
  sourceStationId: Annotation<string>({
    reducer: (_, next) => next,
    default: () => "iot-hub",
  }),

  // Routing
  selectedRoute: Annotation<string>({
    reducer: (_, next) => next,
    default: () => "",
  }),
  routingConfidence: Annotation<number>({
    reducer: (_, next) => next,
    default: () => 0,
  }),

  // Execution tracking
  nodesVisited: Annotation<string[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
  nodeLatencies: Annotation<Record<string, number>>({
    reducer: (prev, next) => ({ ...prev, ...next }),
    default: () => ({}),
  }),

  // Result
  result: Annotation<unknown>({
    reducer: (_, next) => next,
    default: () => null,
  }),
  success: Annotation<boolean>({
    reducer: (_, next) => next,
    default: () => false,
  }),
  error: Annotation<string>({
    reducer: (_, next) => next,
    default: () => "",
  }),

  // Evolution
  shouldEvolve: Annotation<boolean>({
    reducer: (_, next) => next,
    default: () => false,
  }),
  evolutionProposals: Annotation<EvolutionProposal[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),

  // Human gate
  pendingApproval: Annotation<boolean>({
    reducer: (_, next) => next,
    default: () => false,
  }),
});

export type NeuralGraphStateType = typeof NeuralGraphState.State;
