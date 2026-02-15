import { describe, it, expect } from "vitest";
import type { GraphNode, GraphEdge } from "../types.js";
import {
  buildGraph,
  centralityAnalysis,
  communityDetection,
  pathAnalysis,
  graphMetrics,
} from "../engines/graph-analytics.js";

function makeTriangle(): { nodes: GraphNode[]; edges: GraphEdge[] } {
  return {
    nodes: [{ id: "A" }, { id: "B" }, { id: "C" }],
    edges: [
      { source: "A", target: "B" },
      { source: "B", target: "C" },
      { source: "A", target: "C" },
    ],
  };
}

function makeStar(): { nodes: GraphNode[]; edges: GraphEdge[] } {
  return {
    nodes: [{ id: "center" }, { id: "leaf1" }, { id: "leaf2" }, { id: "leaf3" }, { id: "leaf4" }],
    edges: [
      { source: "center", target: "leaf1" },
      { source: "center", target: "leaf2" },
      { source: "center", target: "leaf3" },
      { source: "center", target: "leaf4" },
    ],
  };
}

function makePath(): { nodes: GraphNode[]; edges: GraphEdge[] } {
  return {
    nodes: [{ id: "A" }, { id: "B" }, { id: "C" }, { id: "D" }],
    edges: [
      { source: "A", target: "B" },
      { source: "B", target: "C" },
      { source: "C", target: "D" },
    ],
  };
}

function makeDisconnected(): { nodes: GraphNode[]; edges: GraphEdge[] } {
  return {
    nodes: [{ id: "A" }, { id: "B" }, { id: "C" }, { id: "D" }],
    edges: [
      { source: "A", target: "B" },
      { source: "C", target: "D" },
    ],
  };
}

describe("Graph Analytics Engine", () => {
  describe("buildGraph", () => {
    it("builds graph from nodes and edges", () => {
      const { nodes, edges } = makeTriangle();
      const g = buildGraph(nodes, edges);
      expect(g.order).toBe(3);
      expect(g.size).toBe(3);
    });

    it("ignores edges with missing nodes", () => {
      const g = buildGraph([{ id: "A" }], [{ source: "A", target: "missing" }]);
      expect(g.order).toBe(1);
      expect(g.size).toBe(0);
    });

    it("handles empty input", () => {
      const g = buildGraph([], []);
      expect(g.order).toBe(0);
      expect(g.size).toBe(0);
    });
  });

  describe("centralityAnalysis", () => {
    it("computes centrality for star graph", () => {
      const { nodes, edges } = makeStar();
      const g = buildGraph(nodes, edges);
      const results = centralityAnalysis(g);

      expect(results).toHaveLength(5);

      const center = results.find((r) => r.nodeId === "center")!;
      const leaf = results.find((r) => r.nodeId === "leaf1")!;

      // Center should have highest degree
      expect(center.degree).toBeGreaterThan(leaf.degree);
      // Center should have highest betweenness
      expect(center.betweenness).toBeGreaterThan(leaf.betweenness);
    });

    it("computes PageRank", () => {
      const { nodes, edges } = makeStar();
      const g = buildGraph(nodes, edges);
      const results = centralityAnalysis(g);
      const center = results.find((r) => r.nodeId === "center")!;
      expect(center.pageRank).toBeGreaterThan(0);
    });

    it("handles empty graph", () => {
      const g = buildGraph([], []);
      const results = centralityAnalysis(g);
      expect(results).toHaveLength(0);
    });
  });

  describe("communityDetection", () => {
    it("detects communities in graph with two groups", () => {
      // Two dense groups with sparse cross-edge
      const nodes: GraphNode[] = [
        { id: "a1" },
        { id: "a2" },
        { id: "a3" },
        { id: "b1" },
        { id: "b2" },
        { id: "b3" },
      ];
      const edges: GraphEdge[] = [
        // Group A: fully connected
        { source: "a1", target: "a2" },
        { source: "a2", target: "a3" },
        { source: "a1", target: "a3" },
        // Group B: fully connected
        { source: "b1", target: "b2" },
        { source: "b2", target: "b3" },
        { source: "b1", target: "b3" },
        // One cross-edge
        { source: "a1", target: "b1" },
      ];
      const g = buildGraph(nodes, edges);
      const result = communityDetection(g);

      expect(result.communities.length).toBeGreaterThanOrEqual(2);
      expect(result.algorithm).toBe("louvain");
    });

    it("handles empty graph", () => {
      const g = buildGraph([], []);
      const result = communityDetection(g);
      expect(result.communities).toHaveLength(0);
    });
  });

  describe("pathAnalysis", () => {
    it("finds shortest path in path graph", () => {
      const { nodes, edges } = makePath();
      const g = buildGraph(nodes, edges);
      const result = pathAnalysis(g, "A", "D");

      expect(result.shortestPath).toEqual(["A", "B", "C", "D"]);
      expect(result.distance).toBe(3);
    });

    it("finds all simple paths for small graph", () => {
      const { nodes, edges } = makeTriangle();
      const g = buildGraph(nodes, edges);
      const result = pathAnalysis(g, "A", "C");

      expect(result.shortestPath).toHaveLength(2); // [A, C]
      expect(result.distance).toBe(1);
      expect(result.allPaths).toBeDefined();
      // Should find both A->C direct and A->B->C
      expect(result.allPaths!.length).toBeGreaterThanOrEqual(2);
    });

    it("returns empty path for disconnected nodes", () => {
      const { nodes, edges } = makeDisconnected();
      const g = buildGraph(nodes, edges);
      const result = pathAnalysis(g, "A", "C");

      expect(result.shortestPath).toHaveLength(0);
      expect(result.distance).toBe(Infinity);
    });

    it("handles missing nodes", () => {
      const g = buildGraph([{ id: "A" }], []);
      const result = pathAnalysis(g, "A", "Z");
      expect(result.shortestPath).toHaveLength(0);
    });

    it("handles same source and target", () => {
      const g = buildGraph([{ id: "A" }], []);
      const result = pathAnalysis(g, "A", "A");
      expect(result.shortestPath).toEqual(["A"]);
      expect(result.distance).toBe(0);
    });
  });

  describe("graphMetrics", () => {
    it("triangle: density=1, clustering=1, diameter=1", () => {
      const { nodes, edges } = makeTriangle();
      const g = buildGraph(nodes, edges);
      const m = graphMetrics(g);

      expect(m.nodeCount).toBe(3);
      expect(m.edgeCount).toBe(3);
      expect(m.density).toBeCloseTo(1.0, 3);
      expect(m.clusteringCoefficient).toBeCloseTo(1.0, 3);
      expect(m.diameter).toBe(1);
      expect(m.connectedComponents).toBe(1);
      expect(m.isConnected).toBe(true);
    });

    it("path graph: low density, no triangles", () => {
      const { nodes, edges } = makePath();
      const g = buildGraph(nodes, edges);
      const m = graphMetrics(g);

      expect(m.nodeCount).toBe(4);
      expect(m.edgeCount).toBe(3);
      expect(m.density).toBeCloseTo(0.5, 3);
      expect(m.diameter).toBe(3);
      expect(m.clusteringCoefficient).toBe(0);
      expect(m.isConnected).toBe(true);
    });

    it("disconnected graph", () => {
      const { nodes, edges } = makeDisconnected();
      const g = buildGraph(nodes, edges);
      const m = graphMetrics(g);

      expect(m.connectedComponents).toBe(2);
      expect(m.isConnected).toBe(false);
    });

    it("empty graph", () => {
      const g = buildGraph([], []);
      const m = graphMetrics(g);
      expect(m.nodeCount).toBe(0);
      expect(m.edgeCount).toBe(0);
    });
  });
});
