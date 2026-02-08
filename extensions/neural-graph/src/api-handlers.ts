import type { NeuralQueryRequest, NeuralStatusResponse, NeuralTopologyResponse } from "./types.js";
import { api } from "../convex/_generated/api.js";
import { executeNeuralQuery } from "./graph/compiler.js";
import { seedGenesis, runEvolutionCycle, determinePhase } from "./maturation/lifecycle.js";
import { getConvexClient, isConvexHealthy } from "./persistence/convex-client.js";

// ---------------------------------------------------------------------------
// HTTP API handlers for /api/neural/*
// ---------------------------------------------------------------------------

export async function handleNeuralStatus(stationId: string): Promise<NeuralStatusResponse> {
  const client = getConvexClient();
  const connected = await isConvexHealthy();

  if (!connected) {
    return {
      phase: "genesis",
      totalNodes: 0,
      totalEdges: 0,
      totalExecutions: 0,
      myelinatedEdges: 0,
      avgFitness: 0,
      stationId,
      convexConnected: false,
    };
  }

  const [nodes, edges, executions, myelinated] = await Promise.all([
    client.query(api.graph_nodes.list, { stationId }),
    client.query(api.graph_edges.list, { stationId }),
    client.query(api.execution_records.count, { stationId }),
    client.query(api.graph_edges.listMyelinated, {}),
  ]);

  const avgFitness =
    nodes.length > 0 ? nodes.reduce((sum, n) => sum + n.fitnessScore, 0) / nodes.length : 0;

  const phase = determinePhase(executions);

  return {
    phase,
    totalNodes: nodes.length,
    totalEdges: edges.length,
    totalExecutions: executions,
    myelinatedEdges: myelinated.length,
    avgFitness: Math.round(avgFitness * 10) / 10,
    stationId,
    convexConnected: true,
  };
}

export async function handleNeuralTopology(stationId: string): Promise<NeuralTopologyResponse> {
  const client = getConvexClient();

  const [nodes, edges, executions] = await Promise.all([
    client.query(api.graph_nodes.list, { stationId }),
    client.query(api.graph_edges.list, { stationId }),
    client.query(api.execution_records.count, { stationId }),
  ]);

  return {
    nodes: nodes as NeuralTopologyResponse["nodes"],
    edges: edges as NeuralTopologyResponse["edges"],
    phase: determinePhase(executions),
    totalExecutions: executions,
    stationId,
  };
}

export async function handleNeuralQuery(req: NeuralQueryRequest) {
  const result = await executeNeuralQuery({
    task: req.task,
    taskType: req.taskType,
    complexity: req.complexity,
    stationId: req.stationId ?? "iot-hub",
  });
  return result;
}

export async function handleNeuralGenesis(stationId: string) {
  return seedGenesis(stationId);
}

export async function handleNeuralEvolve(stationId: string) {
  return runEvolutionCycle(stationId);
}

export async function handleNeuralApprove(eventId: string) {
  const client = getConvexClient();
  // eventId needs to be a Convex document ID
  await client.mutation(api.evolution.approve, { eventId: eventId as any });
  return { approved: true, eventId };
}

export async function handleNeuralReject(eventId: string) {
  const client = getConvexClient();
  await client.mutation(api.evolution.reject, { eventId: eventId as any });
  return { rejected: true, eventId };
}

export async function handleNeuralPending() {
  const client = getConvexClient();
  return client.query(api.evolution.listPending, {});
}

export async function handleNeuralEvents(stationId: string, limit = 50) {
  const client = getConvexClient();
  return client.query(api.evolution.list, { stationId, limit });
}

export async function handleNeuralExecutions(stationId: string, limit = 100) {
  const client = getConvexClient();
  return client.query(api.execution_records.list, { stationId, limit });
}
