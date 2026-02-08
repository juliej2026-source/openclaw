import type { GraphNode, GraphEdge } from "../types.js";
import { FITNESS_WEIGHTS } from "../types.js";

// ---------------------------------------------------------------------------
// Fitness scoring — 0 to 100 scale
// Weighted: success rate (40), latency (30), utilization (20), connectivity (10)
// ---------------------------------------------------------------------------

export function calculateNodeFitness(
  node: GraphNode,
  edges: GraphEdge[],
  globalStats: { avgLatencyMs: number; maxActivations: number },
): number {
  const totalAttempts = node.successCount + node.failureCount;

  // Success rate (0–40 pts)
  const successRate = totalAttempts > 0 ? node.successCount / totalAttempts : 0.5;
  const successScore = successRate * FITNESS_WEIGHTS.successRate;

  // Latency (0–30 pts): lower is better, relative to global average
  let latencyScore = 0;
  if (totalAttempts > 0 && globalStats.avgLatencyMs > 0) {
    const avgNodeLatency = node.totalLatencyMs / totalAttempts;
    const latencyRatio = globalStats.avgLatencyMs / Math.max(avgNodeLatency, 1);
    latencyScore = Math.min(1, latencyRatio) * FITNESS_WEIGHTS.latency;
  } else {
    latencyScore = FITNESS_WEIGHTS.latency * 0.5; // Neutral for new nodes
  }

  // Utilization (0–20 pts): activation count relative to most-active node
  let utilizationScore = 0;
  if (globalStats.maxActivations > 0) {
    const utilizationRatio = node.activationCount / globalStats.maxActivations;
    utilizationScore = Math.min(1, utilizationRatio) * FITNESS_WEIGHTS.utilization;
  } else {
    utilizationScore = FITNESS_WEIGHTS.utilization * 0.5;
  }

  // Connectivity (0–10 pts): number of edges relative to max possible
  const nodeEdges = edges.filter(
    (e) => e.sourceNodeId === node.nodeId || e.targetNodeId === node.nodeId,
  );
  const avgWeight =
    nodeEdges.length > 0 ? nodeEdges.reduce((sum, e) => sum + e.weight, 0) / nodeEdges.length : 0;
  const connectivityScore = avgWeight * FITNESS_WEIGHTS.connectivity;

  return Math.round((successScore + latencyScore + utilizationScore + connectivityScore) * 10) / 10;
}

export function calculateGlobalStats(nodes: GraphNode[]): {
  avgLatencyMs: number;
  maxActivations: number;
} {
  let totalLatency = 0;
  let totalActivations = 0;
  let maxActivations = 0;
  let nodeCount = 0;

  for (const node of nodes) {
    const attempts = node.successCount + node.failureCount;
    if (attempts > 0) {
      totalLatency += node.totalLatencyMs / attempts;
      nodeCount++;
    }
    totalActivations += node.activationCount;
    maxActivations = Math.max(maxActivations, node.activationCount);
  }

  return {
    avgLatencyMs: nodeCount > 0 ? totalLatency / nodeCount : 0,
    maxActivations,
  };
}

export function calculateEdgeFitness(edge: GraphEdge): number {
  // Simple metric: weight * log(activations + 1) * (myelinated ? 1.5 : 1)
  const base = edge.weight * Math.log2(edge.activationCount + 1);
  const bonus = edge.myelinated ? 1.5 : 1.0;
  return Math.min(100, Math.round(base * bonus * 10) / 10);
}
