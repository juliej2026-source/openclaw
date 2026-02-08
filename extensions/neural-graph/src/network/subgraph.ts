import type { GraphNode, GraphEdge } from "../types.js";

// ---------------------------------------------------------------------------
// Local subgraph extraction — for offline/partitioned operation
// Extracts the portion of the graph relevant to a specific station.
// ---------------------------------------------------------------------------

export type Subgraph = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  stationId: string;
  extractedAt: string;
};

export function extractSubgraph(
  allNodes: GraphNode[],
  allEdges: GraphEdge[],
  stationId: string,
): Subgraph {
  // Include nodes belonging to this station
  const stationNodes = allNodes.filter((n) => n.stationId === stationId);
  const stationNodeIds = new Set(stationNodes.map((n) => n.nodeId));

  // Also include nodes that are directly connected to station nodes
  const connectedEdges = allEdges.filter(
    (e) => stationNodeIds.has(e.sourceNodeId) || stationNodeIds.has(e.targetNodeId),
  );

  const connectedNodeIds = new Set<string>();
  for (const edge of connectedEdges) {
    connectedNodeIds.add(edge.sourceNodeId);
    connectedNodeIds.add(edge.targetNodeId);
  }

  // Include all connected nodes (even from other stations) for context
  const subgraphNodes = allNodes.filter(
    (n) => stationNodeIds.has(n.nodeId) || connectedNodeIds.has(n.nodeId),
  );

  // Include edges where both endpoints are in the subgraph
  const subgraphNodeIds = new Set(subgraphNodes.map((n) => n.nodeId));
  const subgraphEdges = allEdges.filter(
    (e) => subgraphNodeIds.has(e.sourceNodeId) && subgraphNodeIds.has(e.targetNodeId),
  );

  return {
    nodes: subgraphNodes,
    edges: subgraphEdges,
    stationId,
    extractedAt: new Date().toISOString(),
  };
}

export function mergeSubgraphs(local: Subgraph, remote: Subgraph): Subgraph {
  const nodeMap = new Map<string, GraphNode>();
  const edgeMap = new Map<string, GraphEdge>();

  // Local nodes take precedence for owned station, remote for theirs
  for (const node of remote.nodes) {
    nodeMap.set(node.nodeId, node);
  }
  for (const node of local.nodes) {
    const existing = nodeMap.get(node.nodeId);
    if (!existing || node.stationId === local.stationId) {
      nodeMap.set(node.nodeId, node);
    }
  }

  // Merge edges: keep the one with more activations
  for (const edge of remote.edges) {
    edgeMap.set(edge.edgeId, edge);
  }
  for (const edge of local.edges) {
    const existing = edgeMap.get(edge.edgeId);
    if (!existing || edge.activationCount >= existing.activationCount) {
      edgeMap.set(edge.edgeId, edge);
    }
  }

  return {
    nodes: [...nodeMap.values()],
    edges: [...edgeMap.values()],
    stationId: local.stationId,
    extractedAt: new Date().toISOString(),
  };
}
