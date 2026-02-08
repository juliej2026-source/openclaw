import { describe, it, expect } from "vitest";
import type { GraphNode, GraphEdge } from "../types.js";
import { extractSubgraph, mergeSubgraphs } from "../network/subgraph.js";

function makeNode(nodeId: string, stationId: string): GraphNode {
  return {
    nodeId,
    nodeType: "capability",
    name: nodeId,
    description: "",
    stationId,
    status: "active",
    fitnessScore: 50,
    maturationPhase: "genesis",
    capabilities: [],
    activationCount: 10,
    totalLatencyMs: 500,
    successCount: 8,
    failureCount: 2,
    createdAt: new Date().toISOString(),
    metadata: {},
  };
}

function makeEdge(src: string, tgt: string, stationId = "iot-hub"): GraphEdge {
  return {
    edgeId: `${src}->${tgt}`,
    sourceNodeId: src,
    targetNodeId: tgt,
    edgeType: "data_flow",
    weight: 0.5,
    myelinated: false,
    activationCount: 10,
    coActivationCount: 5,
    avgLatencyMs: 50,
    stationId,
    createdAt: new Date().toISOString(),
    metadata: {},
  };
}

describe("Neural Graph — subgraph extraction", () => {
  it("extracts nodes belonging to a station", () => {
    const allNodes = [makeNode("a", "iot-hub"), makeNode("b", "iot-hub"), makeNode("c", "julia")];
    const allEdges = [makeEdge("a", "b", "iot-hub"), makeEdge("b", "c", "iot-hub")];

    const sub = extractSubgraph(allNodes, allEdges, "iot-hub");

    // Should include a, b (station nodes) and c (connected via edge)
    expect(sub.nodes).toHaveLength(3);
    expect(sub.edges).toHaveLength(2);
    expect(sub.stationId).toBe("iot-hub");
  });

  it("includes connected nodes from other stations", () => {
    const allNodes = [makeNode("local", "iot-hub"), makeNode("remote", "julia")];
    const allEdges = [makeEdge("local", "remote")];

    const sub = extractSubgraph(allNodes, allEdges, "iot-hub");
    expect(sub.nodes.map((n) => n.nodeId)).toContain("remote");
  });

  it("excludes unrelated nodes and edges", () => {
    const allNodes = [makeNode("a", "iot-hub"), makeNode("x", "julia"), makeNode("y", "julia")];
    const allEdges = [
      makeEdge("x", "y", "julia"), // No connection to iot-hub
    ];

    const sub = extractSubgraph(allNodes, allEdges, "iot-hub");
    expect(sub.nodes).toHaveLength(1); // Only "a"
    expect(sub.edges).toHaveLength(0);
  });
});

describe("Neural Graph — subgraph merge", () => {
  it("merges local and remote subgraphs", () => {
    const local = {
      nodes: [makeNode("a", "iot-hub")],
      edges: [makeEdge("a", "b")],
      stationId: "iot-hub",
      extractedAt: new Date().toISOString(),
    };

    const remote = {
      nodes: [makeNode("b", "julia")],
      edges: [makeEdge("a", "b")],
      stationId: "julia",
      extractedAt: new Date().toISOString(),
    };

    const merged = mergeSubgraphs(local, remote);
    expect(merged.nodes).toHaveLength(2);
    expect(merged.stationId).toBe("iot-hub");
  });

  it("local station nodes take precedence", () => {
    const local = {
      nodes: [makeNode("a", "iot-hub")],
      edges: [],
      stationId: "iot-hub",
      extractedAt: new Date().toISOString(),
    };
    local.nodes[0].fitnessScore = 80;

    const remote = {
      nodes: [{ ...makeNode("a", "iot-hub"), fitnessScore: 30 }],
      edges: [],
      stationId: "julia",
      extractedAt: new Date().toISOString(),
    };

    const merged = mergeSubgraphs(local, remote);
    const nodeA = merged.nodes.find((n) => n.nodeId === "a");
    expect(nodeA?.fitnessScore).toBe(80); // Local wins for own station
  });
});
