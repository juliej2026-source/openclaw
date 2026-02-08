import { api } from "../../convex/_generated/api.js";
import { determinePhase } from "../maturation/lifecycle.js";
import { getConvexClient, isConvexHealthy } from "../persistence/convex-client.js";

// ---------------------------------------------------------------------------
// Prometheus metrics in text exposition format
// Scraped by existing Prometheus job alongside hive-mind /metrics
// ---------------------------------------------------------------------------

const PHASE_NUMBER: Record<string, number> = {
  genesis: 0,
  differentiation: 1,
  synaptogenesis: 2,
  pruning: 3,
  myelination: 4,
};

export async function renderNeuralMetrics(stationId: string): Promise<string> {
  const connected = await isConvexHealthy();
  if (!connected) {
    return [
      "# HELP neural_graph_connected Whether Convex backend is reachable",
      "# TYPE neural_graph_connected gauge",
      "neural_graph_connected 0",
    ].join("\n");
  }

  const client = getConvexClient();

  const [nodes, edges, executions, myelinated, evolutionCount] = await Promise.all([
    client.query(api.graph_nodes.list, { stationId }),
    client.query(api.graph_edges.list, { stationId }),
    client.query(api.execution_records.count, { stationId }),
    client.query(api.graph_edges.listMyelinated, {}),
    client.query(api.evolution.count, {}),
  ]);

  const phase = determinePhase(executions);
  const avgFitness =
    nodes.length > 0 ? nodes.reduce((sum, n) => sum + n.fitnessScore, 0) / nodes.length : 0;

  const lines: string[] = [];

  // Connection status
  lines.push("# HELP neural_graph_connected Whether Convex backend is reachable");
  lines.push("# TYPE neural_graph_connected gauge");
  lines.push("neural_graph_connected 1");

  // Node count by type
  lines.push("# HELP neural_graph_node_count Number of nodes in the neural graph");
  lines.push("# TYPE neural_graph_node_count gauge");
  const typeCounts = new Map<string, number>();
  for (const node of nodes) {
    typeCounts.set(node.nodeType, (typeCounts.get(node.nodeType) ?? 0) + 1);
  }
  for (const [nodeType, count] of typeCounts) {
    lines.push(`neural_graph_node_count{type="${nodeType}"} ${count}`);
  }
  lines.push(`neural_graph_node_count{type="total"} ${nodes.length}`);

  // Edge count and weights
  lines.push("# HELP neural_graph_edge_count Number of edges in the neural graph");
  lines.push("# TYPE neural_graph_edge_count gauge");
  lines.push(`neural_graph_edge_count ${edges.length}`);

  lines.push("# HELP neural_graph_edge_weight Edge weight distribution");
  lines.push("# TYPE neural_graph_edge_weight histogram");
  const weightBuckets = [0.1, 0.2, 0.3, 0.5, 0.7, 0.9, 1.0];
  for (const bucket of weightBuckets) {
    const count = edges.filter((e) => e.weight <= bucket).length;
    lines.push(`neural_graph_edge_weight_bucket{le="${bucket}"} ${count}`);
  }
  lines.push(`neural_graph_edge_weight_bucket{le="+Inf"} ${edges.length}`);

  // Node fitness
  lines.push("# HELP neural_graph_node_fitness Node fitness score (0-100)");
  lines.push("# TYPE neural_graph_node_fitness gauge");
  for (const node of nodes) {
    lines.push(
      `neural_graph_node_fitness{node="${node.nodeId}",type="${node.nodeType}"} ${node.fitnessScore}`,
    );
  }
  lines.push(`neural_graph_node_fitness{node="avg",type="all"} ${avgFitness.toFixed(1)}`);

  // Executions
  lines.push("# HELP neural_graph_execution_total Total graph executions");
  lines.push("# TYPE neural_graph_execution_total counter");
  lines.push(`neural_graph_execution_total ${executions}`);

  // Evolution events
  lines.push("# HELP neural_graph_evolution_events_total Total evolution events");
  lines.push("# TYPE neural_graph_evolution_events_total counter");
  lines.push(`neural_graph_evolution_events_total ${evolutionCount}`);

  // Myelinated edges
  lines.push("# HELP neural_graph_myelinated_edges Number of myelinated (optimized) edges");
  lines.push("# TYPE neural_graph_myelinated_edges gauge");
  lines.push(`neural_graph_myelinated_edges ${myelinated.length}`);

  // Maturation phase
  lines.push(
    "# HELP neural_graph_maturation_phase Current maturation phase (0=genesis,1=diff,2=synap,3=prune,4=myelin)",
  );
  lines.push("# TYPE neural_graph_maturation_phase gauge");
  lines.push(`neural_graph_maturation_phase ${PHASE_NUMBER[phase] ?? 0}`);

  return lines.join("\n");
}
