import { StateGraph, END, START } from "@langchain/langgraph";
import { ConvexCheckpointer } from "../persistence/convex-checkpointer.js";
import {
  capabilityMetaEngine,
  capabilityModelManager,
  capabilityModelTrainer,
  capabilityMemory,
} from "./capability-nodes.js";
import { evaluation, shouldEvolve, mutation, needsApproval } from "./evolution-nodes.js";
import { humanGate } from "./human-gate.js";
import { networkOps } from "./network-nodes.js";
import { metaOrchestrator } from "./orchestrator.js";
import { NeuralGraphState } from "./state.js";

// ---------------------------------------------------------------------------
// Compile the Neural Graph StateGraph
//
// Topology:
//   START → meta_orchestrator → [conditional: 5 capability/network nodes]
//                                   ↓ (all feed into)
//                              evaluation → [conditional: shouldEvolve?]
//                                   ↓ yes          ↓ no
//                              mutation → [conditional: needsApproval?]
//                                   ↓ yes          ↓ no
//                              human_gate → END     END
// ---------------------------------------------------------------------------

export function compileNeuralGraph() {
  const graph = new StateGraph(NeuralGraphState)
    // Nodes
    .addNode("meta_orchestrator", metaOrchestrator)
    .addNode("capability_meta_engine", capabilityMetaEngine)
    .addNode("capability_model_manager", capabilityModelManager)
    .addNode("capability_model_trainer", capabilityModelTrainer)
    .addNode("capability_memory", capabilityMemory)
    .addNode("network_ops", networkOps)
    .addNode("evaluation", evaluation)
    .addNode("mutation", mutation)
    .addNode("human_gate", humanGate)

    // Entry
    .addEdge(START, "meta_orchestrator")

    // Orchestrator routes to capability nodes (the Command already uses goto)
    // But we also need explicit edges for the graph structure
    .addEdge("meta_orchestrator", "capability_meta_engine")

    // All capability nodes feed into evaluation
    .addEdge("capability_meta_engine", "evaluation")
    .addEdge("capability_model_manager", "evaluation")
    .addEdge("capability_model_trainer", "evaluation")
    .addEdge("capability_memory", "evaluation")
    .addEdge("network_ops", "evaluation")

    // Evaluation conditionally routes to mutation or END
    .addConditionalEdges("evaluation", shouldEvolve, {
      mutation: "mutation",
      __end__: END,
    })

    // Mutation conditionally routes to human_gate or END
    .addConditionalEdges("mutation", needsApproval, {
      human_gate: "human_gate",
      __end__: END,
    })

    // Human gate always ends
    .addEdge("human_gate", END);

  return graph;
}

// Compiled graph with Convex checkpoint persistence
let compiledGraph: ReturnType<ReturnType<typeof compileNeuralGraph>["compile"]> | null = null;

export function getNeuralGraph() {
  if (!compiledGraph) {
    const graph = compileNeuralGraph();
    const checkpointer = new ConvexCheckpointer();
    compiledGraph = graph.compile({ checkpointer });
  }
  return compiledGraph;
}

// Execute a query through the neural graph
export async function executeNeuralQuery(opts: {
  task: string;
  taskType?: string;
  complexity?: string;
  stationId?: string;
  threadId?: string;
}) {
  const graph = getNeuralGraph();
  const threadId =
    opts.threadId ?? `thread-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const result = await graph.invoke(
    {
      taskDescription: opts.task,
      taskType: opts.taskType ?? "unknown",
      complexity: opts.complexity ?? "medium",
      sourceStationId: opts.stationId ?? "iot-hub",
    },
    {
      configurable: { thread_id: threadId },
    },
  );

  return {
    threadId,
    result: result.result,
    success: result.success,
    nodesVisited: result.nodesVisited,
    nodeLatencies: result.nodeLatencies,
    evolutionProposals: result.evolutionProposals,
    pendingApproval: result.pendingApproval,
  };
}
