// ---------------------------------------------------------------------------
// Graph Analytics Engine — Centrality, community detection, path analysis,
// graph metrics using graphology
// ---------------------------------------------------------------------------

import Graph from "graphology";
import louvain from "graphology-communities-louvain";
import { centrality, graph as graphMetricsFns } from "graphology-metrics";
import { unweighted } from "graphology-shortest-path";
import type {
  GraphNode,
  GraphEdge,
  CentralityResult,
  CommunityResult,
  GraphMetrics,
} from "../types.js";

/**
 * Build a graphology graph from node and edge definitions.
 */
export function buildGraph(nodes: GraphNode[], edges: GraphEdge[]): Graph {
  const g = new Graph({ type: "undirected", multi: false });

  for (const node of nodes) {
    if (!g.hasNode(node.id)) {
      g.addNode(node.id, {
        label: node.label ?? node.id,
        weight: node.weight ?? 1,
        ...node.metadata,
      });
    }
  }

  for (const edge of edges) {
    if (g.hasNode(edge.source) && g.hasNode(edge.target)) {
      try {
        g.addEdge(edge.source, edge.target, {
          weight: edge.weight ?? 1,
          ...edge.metadata,
        });
      } catch {
        // Edge may already exist in undirected graph
      }
    }
  }

  return g;
}

/**
 * Compute centrality metrics for all nodes.
 */
export function centralityAnalysis(graph: Graph): CentralityResult[] {
  if (graph.order === 0) return [];

  // Degree centrality
  const degreeCentrality = centrality.degree(graph);

  // Betweenness centrality
  const betweennessCentrality = centrality.betweenness(graph);

  // Closeness centrality
  let closenessCentrality: Record<string, number> = {};
  try {
    closenessCentrality = centrality.closeness(graph);
  } catch {
    // May fail on disconnected graphs
    graph.forEachNode((node) => {
      closenessCentrality[node] = 0;
    });
  }

  // PageRank
  const pageRankCentrality = centrality.pagerank(graph);

  const results: CentralityResult[] = [];
  graph.forEachNode((node) => {
    results.push({
      nodeId: node,
      degree: degreeCentrality[node] ?? 0,
      betweenness: betweennessCentrality[node] ?? 0,
      closeness: closenessCentrality[node] ?? 0,
      pageRank: pageRankCentrality[node] ?? 0,
    });
  });

  return results;
}

/**
 * Detect communities using Louvain algorithm.
 */
export function communityDetection(graph: Graph): CommunityResult {
  if (graph.order === 0) {
    return { communities: [], modularity: 0, algorithm: "louvain" };
  }

  // Louvain assigns community labels to nodes
  const communityMap = louvain(graph);

  // Group nodes by community
  const groups = new Map<number, string[]>();
  for (const [node, community] of Object.entries(communityMap)) {
    const cId = community as number;
    if (!groups.has(cId)) groups.set(cId, []);
    groups.get(cId)!.push(node);
  }

  // Assign community labels as node attributes for modularity computation
  graph.forEachNode((node) => {
    graph.setNodeAttribute(node, "community", communityMap[node]);
  });

  let modularity = 0;
  try {
    modularity = graphMetricsFns.modularity(graph, {
      getNodeCommunity: (_, attr) => attr.community,
    });
  } catch {
    // Modularity computation may fail on some graph structures
  }

  const communities = [...groups.entries()].map(([id, nodes]) => ({
    id,
    nodes,
    size: nodes.length,
  }));

  return { communities, modularity, algorithm: "louvain" };
}

/**
 * Find shortest path between two nodes.
 */
export function pathAnalysis(
  graph: Graph,
  source: string,
  target: string,
): {
  shortestPath: string[];
  distance: number;
  allPaths?: string[][];
} {
  if (!graph.hasNode(source) || !graph.hasNode(target)) {
    return { shortestPath: [], distance: Infinity };
  }

  if (source === target) {
    return { shortestPath: [source], distance: 0 };
  }

  // Shortest path using BFS (unweighted)
  const path = unweighted.bidirectional(graph, source, target);
  if (!path) {
    return { shortestPath: [], distance: Infinity };
  }

  const result: {
    shortestPath: string[];
    distance: number;
    allPaths?: string[][];
  } = {
    shortestPath: path,
    distance: path.length - 1,
  };

  // For small graphs, find all simple paths (BFS with max depth)
  if (graph.order < 50) {
    const allPaths = findAllSimplePaths(graph, source, target, 10);
    result.allPaths = allPaths;
  }

  return result;
}

function findAllSimplePaths(
  graph: Graph,
  source: string,
  target: string,
  maxDepth: number,
): string[][] {
  const paths: string[][] = [];
  const stack: Array<{ node: string; path: string[] }> = [{ node: source, path: [source] }];

  while (stack.length > 0 && paths.length < 100) {
    const { node, path } = stack.pop()!;

    if (node === target && path.length > 1) {
      paths.push([...path]);
      continue;
    }

    if (path.length > maxDepth) continue;

    graph.forEachNeighbor(node, (neighbor) => {
      if (!path.includes(neighbor)) {
        stack.push({ node: neighbor, path: [...path, neighbor] });
      }
    });
  }

  return paths.sort((a, b) => a.length - b.length);
}

/**
 * Compute overall graph metrics.
 */
export function graphMetrics(graph: Graph): GraphMetrics {
  const nodeCount = graph.order;
  const edgeCount = graph.size;

  if (nodeCount === 0) {
    return {
      nodeCount: 0,
      edgeCount: 0,
      density: 0,
      diameter: 0,
      avgPathLength: 0,
      clusteringCoefficient: 0,
      connectedComponents: 0,
      isConnected: true,
    };
  }

  // Density
  const density = nodeCount <= 1 ? 0 : (2 * edgeCount) / (nodeCount * (nodeCount - 1));

  // Connected components (BFS)
  const visited = new Set<string>();
  let components = 0;

  graph.forEachNode((node) => {
    if (!visited.has(node)) {
      components++;
      const queue = [node];
      while (queue.length > 0) {
        const current = queue.shift()!;
        if (visited.has(current)) continue;
        visited.add(current);
        graph.forEachNeighbor(current, (neighbor) => {
          if (!visited.has(neighbor)) queue.push(neighbor);
        });
      }
    }
  });

  // Diameter and average path length (only for connected graphs < 200 nodes)
  let diameter = 0;
  let avgPathLength = 0;

  if (nodeCount < 200 && components === 1) {
    let totalDist = 0;
    let pathCount = 0;
    const nodes = graph.nodes();

    for (const src of nodes) {
      const distances = unweighted.singleSourceLength(graph, src);
      for (const tgt of nodes) {
        if (src !== tgt && distances[tgt] !== undefined) {
          totalDist += distances[tgt];
          pathCount++;
          if (distances[tgt] > diameter) diameter = distances[tgt];
        }
      }
    }

    avgPathLength = pathCount > 0 ? totalDist / pathCount : 0;
  }

  // Clustering coefficient (local average)
  let ccSum = 0;
  let ccCount = 0;
  graph.forEachNode((node) => {
    const neighbors = graph.neighbors(node);
    const k = neighbors.length;
    if (k < 2) return;

    let triangles = 0;
    for (let i = 0; i < k; i++) {
      for (let j = i + 1; j < k; j++) {
        if (graph.hasEdge(neighbors[i], neighbors[j])) triangles++;
      }
    }

    ccSum += (2 * triangles) / (k * (k - 1));
    ccCount++;
  });

  const clusteringCoefficient = ccCount > 0 ? ccSum / ccCount : 0;

  return {
    nodeCount,
    edgeCount,
    density,
    diameter,
    avgPathLength,
    clusteringCoefficient,
    connectedComponents: components,
    isConnected: components === 1,
  };
}

/**
 * Specialized analysis of neural-graph topology.
 * Lazy imports neural-graph data and runs full analysis suite.
 */
export async function neuralGraphAnalysis(): Promise<{
  centrality: CentralityResult[];
  communities: CommunityResult;
  metrics: GraphMetrics;
  insights: string[];
}> {
  try {
    const mod = await import("../../../neural-graph/src/types.js");
    // Attempt to read graph topology from neural-graph
    // In production this would read from Convex or shared state
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];

    const graph = buildGraph(nodes, edges);
    const cent = centralityAnalysis(graph);
    const comm = communityDetection(graph);
    const metrics = graphMetrics(graph);
    const insights = generateInsights(cent, comm, metrics);

    return { centrality: cent, communities: comm, metrics, insights };
  } catch {
    return {
      centrality: [],
      communities: { communities: [], modularity: 0, algorithm: "louvain" },
      metrics: {
        nodeCount: 0,
        edgeCount: 0,
        density: 0,
        diameter: 0,
        avgPathLength: 0,
        clusteringCoefficient: 0,
        connectedComponents: 0,
        isConnected: true,
      },
      insights: ["Neural graph data not available"],
    };
  }
}

function generateInsights(
  cent: CentralityResult[],
  comm: CommunityResult,
  metrics: GraphMetrics,
): string[] {
  const insights: string[] = [];

  if (cent.length > 0) {
    const topBetweenness = [...cent].sort((a, b) => b.betweenness - a.betweenness);
    if (topBetweenness[0].betweenness > 0.5) {
      insights.push(
        `Node "${topBetweenness[0].nodeId}" is a bottleneck with betweenness ${topBetweenness[0].betweenness.toFixed(2)}`,
      );
    }

    const topPageRank = [...cent].sort((a, b) => b.pageRank - a.pageRank);
    insights.push(
      `Most important node by PageRank: "${topPageRank[0].nodeId}" (${topPageRank[0].pageRank.toFixed(3)})`,
    );
  }

  if (comm.communities.length > 1) {
    insights.push(
      `${comm.communities.length} communities detected (modularity: ${comm.modularity.toFixed(3)})`,
    );
  }

  if (metrics.density > 0) {
    const densityLabel =
      metrics.density > 0.7 ? "dense" : metrics.density > 0.3 ? "moderate" : "sparse";
    insights.push(
      `Graph density ${metrics.density.toFixed(3)} suggests ${densityLabel} connectivity`,
    );
  }

  if (!metrics.isConnected) {
    insights.push(`Graph has ${metrics.connectedComponents} disconnected components`);
  }

  return insights;
}
