import { StateGraph, END, START } from "@langchain/langgraph";
import {
  clinicalSafetyEscalation,
  dataStewardPdpa,
  dailyCoach,
  conciergeOperator,
  ragKnowledge,
  deviceIntegration,
  evaluationCapa,
  needsEscalation,
} from "./agent-nodes.js";
import { orchestratorRouter } from "./orchestrator-router.js";
import { safetyGate } from "./safety-gate.js";
import { WellnessGraphState } from "./state.js";

// ---------------------------------------------------------------------------
// Compile the Wellness Concierge StateGraph
//
// Topology:
//   START → orchestrator_router → [Command goto: one of 6 agent nodes]
//                                    ↓ (all feed into)
//                               evaluation_capa → [conditional: needsEscalation?]
//                                    ↓ yes                ↓ no
//                         clinical_safety_escalation       END
//                                    ↓
//                              [conditional: pendingEscalation?]
//                                    ↓ yes        ↓ no
//                              safety_gate        END
//                                    ↓
//                                   END
// ---------------------------------------------------------------------------

export function compileWellnessGraph() {
  const graph = new StateGraph(WellnessGraphState)
    // Nodes
    .addNode("orchestrator_router", orchestratorRouter, {
      ends: [
        "clinical_safety_escalation",
        "data_steward_pdpa",
        "daily_coach",
        "concierge_operator",
        "rag_knowledge",
        "device_integration_optional",
      ],
    })
    .addNode("clinical_safety_escalation", clinicalSafetyEscalation)
    .addNode("data_steward_pdpa", dataStewardPdpa)
    .addNode("daily_coach", dailyCoach)
    .addNode("concierge_operator", conciergeOperator)
    .addNode("rag_knowledge", ragKnowledge)
    .addNode("device_integration_optional", deviceIntegration)
    .addNode("evaluation_capa", evaluationCapa)
    .addNode("safety_gate", safetyGate)

    // Entry
    .addEdge(START, "orchestrator_router")

    // Orchestrator uses Command(goto) for dynamic routing.
    // Destinations declared via `ends` in addNode above.

    // All agent nodes feed into evaluation_capa
    .addEdge("clinical_safety_escalation", "evaluation_capa")
    .addEdge("data_steward_pdpa", "evaluation_capa")
    .addEdge("daily_coach", "evaluation_capa")
    .addEdge("concierge_operator", "evaluation_capa")
    .addEdge("rag_knowledge", "evaluation_capa")
    .addEdge("device_integration_optional", "evaluation_capa")

    // Evaluation conditionally routes to safety gate or END
    .addConditionalEdges("evaluation_capa", needsEscalation, {
      safety_gate: "safety_gate",
      __end__: END,
    })

    // Safety gate always ends
    .addEdge("safety_gate", END);

  return graph;
}

/**
 * Compile and execute a wellness query through the graph.
 */
export async function executeWellnessQuery(message: string, userId?: string, sessionId?: string) {
  const graph = compileWellnessGraph();
  const app = graph.compile();

  const result = await app.invoke({
    userMessage: message,
    userId: userId ?? "anonymous",
    sessionId: sessionId ?? `session-${Date.now()}`,
  });

  return result;
}
