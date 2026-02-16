import { StateGraph, END, START } from "@langchain/langgraph";
import { api } from "../../convex/_generated/api.js";
import { ConvexCheckpointer } from "../persistence/convex-checkpointer.js";
import { getConvexClient } from "../persistence/convex-client.js";
import {
  capabilityMetaEngine,
  capabilityModelManager,
  capabilityModelTrainer,
  capabilityMemory,
  capabilityScraperIntel,
  capabilityClerkLearning,
  capabilitySocialIntel,
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
//   START → meta_orchestrator → [conditional: 8 capability/network/peer nodes]
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
    .addNode("scraper_intel", capabilityScraperIntel)
    .addNode("clerk_learning", capabilityClerkLearning)
    .addNode("social_intel", capabilitySocialIntel)
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
    .addEdge("scraper_intel", "evaluation")
    .addEdge("clerk_learning", "evaluation")
    .addEdge("social_intel", "evaluation")

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

  // Record execution metrics (best-effort — failures must not break the query)
  try {
    await recordExecutionMetrics({
      threadId,
      task: opts.task,
      taskType: result.taskType ?? opts.taskType ?? "unknown",
      nodesVisited: result.nodesVisited ?? [],
      nodeLatencies: result.nodeLatencies ?? {},
      success: result.success ?? false,
      stationId: opts.stationId ?? "iot-hub",
    });
  } catch {
    // Non-critical — query result is already available
  }

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

// ---------------------------------------------------------------------------
// Record execution metrics to Convex after a graph query completes.
// Updates execution_records, node activation counts, and edge activation counts.
// ---------------------------------------------------------------------------

async function recordExecutionMetrics(opts: {
  threadId: string;
  task: string;
  taskType: string;
  nodesVisited: string[];
  nodeLatencies: Record<string, number>;
  success: boolean;
  stationId: string;
}) {
  const client = getConvexClient();
  const totalLatencyMs = Object.values(opts.nodeLatencies).reduce((sum, ms) => sum + ms, 0);

  // 1. Record the execution
  await client.mutation(api.execution_records.record, {
    threadId: opts.threadId,
    taskType: opts.taskType,
    taskDescription: opts.task,
    nodesVisited: opts.nodesVisited,
    edgesTraversed: computeEdgesTraversed(opts.nodesVisited),
    success: opts.success,
    totalLatencyMs,
    nodeLatencies: opts.nodeLatencies,
    stationId: opts.stationId,
    createdAt: new Date().toISOString(),
  });

  // 2. Record activation for each visited node
  for (const nodeId of opts.nodesVisited) {
    const latencyMs = opts.nodeLatencies[nodeId] ?? 0;
    await client.mutation(api.graph_nodes.recordActivation, {
      nodeId,
      latencyMs,
      success: opts.success,
    });
  }

  // 3. Record activation for traversed edges
  const edgeIds = computeEdgesTraversed(opts.nodesVisited);
  for (const edgeId of edgeIds) {
    const [source] = edgeId.split("->");
    const latencyMs = opts.nodeLatencies[source] ?? 0;
    await client.mutation(api.graph_edges.recordActivation, {
      edgeId,
      latencyMs,
    });
  }
}

/** Compute edge IDs from consecutive nodes in the visit order. */
function computeEdgesTraversed(nodesVisited: string[]): string[] {
  const edges: string[] = [];
  for (let i = 0; i < nodesVisited.length - 1; i++) {
    edges.push(`${nodesVisited[i]}->${nodesVisited[i + 1]}`);
  }
  return edges;
}
