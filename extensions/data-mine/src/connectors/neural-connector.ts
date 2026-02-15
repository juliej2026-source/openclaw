// ---------------------------------------------------------------------------
// Neural Graph Connector — Read execution data from neural-graph extension
// ---------------------------------------------------------------------------

import type { DataSeries, GraphNode, GraphEdge } from "../types.js";

/**
 * Get neural-graph execution data as DataSeries.
 * Falls back to mock data if import fails.
 */
export async function getNeuralExecutions(): Promise<DataSeries[]> {
  try {
    const mod = await import("../../../neural-graph/src/types.js");
    // In production, read from Convex or shared execution log
    return getMockNeuralExecutions();
  } catch {
    return getMockNeuralExecutions();
  }
}

/**
 * Get neural-graph topology as generic GraphNode/GraphEdge arrays.
 */
export async function getNeuralTopology(): Promise<{
  nodes: GraphNode[];
  edges: GraphEdge[];
}> {
  try {
    const mod = await import("../../../neural-graph/src/types.js");
    return getMockNeuralTopology();
  } catch {
    return getMockNeuralTopology();
  }
}

function getMockNeuralExecutions(): DataSeries[] {
  const now = Date.now();
  const hour = 3_600_000;

  return [
    {
      id: "neural-latency",
      name: "Neural Graph Avg Latency (ms)",
      source: "neural_graph",
      points: Array.from({ length: 24 }, (_, i) => ({
        timestamp: now - (23 - i) * hour,
        value: 200 + Math.sin(i) * 50 + Math.random() * 20,
      })),
      unit: "ms",
    },
    {
      id: "neural-success-rate",
      name: "Neural Graph Success Rate",
      source: "neural_graph",
      points: Array.from({ length: 24 }, (_, i) => ({
        timestamp: now - (23 - i) * hour,
        value: 0.92 + Math.random() * 0.08,
      })),
      unit: "ratio",
    },
    {
      id: "neural-executions",
      name: "Neural Graph Executions/Hour",
      source: "neural_graph",
      points: Array.from({ length: 24 }, (_, i) => ({
        timestamp: now - (23 - i) * hour,
        value: Math.floor(10 + Math.random() * 20),
      })),
      unit: "count",
    },
  ];
}

function getMockNeuralTopology(): { nodes: GraphNode[]; edges: GraphEdge[] } {
  return {
    nodes: [
      { id: "meta_orchestrator", label: "Meta Orchestrator", weight: 1 },
      { id: "capability_meta_engine", label: "Meta Engine", weight: 0.85 },
      { id: "capability_model_manager", label: "Model Manager", weight: 0.7 },
      { id: "capability_memory", label: "Memory", weight: 0.6 },
      { id: "network_ops", label: "Network Ops", weight: 0.5 },
      { id: "scraper_intel", label: "Scraper Intel", weight: 0.4 },
      { id: "evaluation", label: "Evaluation", weight: 0.9 },
    ],
    edges: [
      { source: "meta_orchestrator", target: "capability_meta_engine", weight: 0.9 },
      { source: "meta_orchestrator", target: "capability_model_manager", weight: 0.7 },
      { source: "meta_orchestrator", target: "capability_memory", weight: 0.5 },
      { source: "meta_orchestrator", target: "network_ops", weight: 0.4 },
      { source: "meta_orchestrator", target: "scraper_intel", weight: 0.3 },
      { source: "capability_meta_engine", target: "evaluation", weight: 0.8 },
      { source: "capability_model_manager", target: "evaluation", weight: 0.6 },
      { source: "network_ops", target: "evaluation", weight: 0.4 },
    ],
  };
}
