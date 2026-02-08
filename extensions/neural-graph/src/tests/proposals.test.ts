import { describe, it, expect } from "vitest";
import type { GraphNode, GraphEdge } from "../types.js";
import {
  generateMyelinationProposals,
  generatePruningProposals,
  generateSynaptogenesisProposals,
} from "../maturation/proposals.js";

function makeNode(overrides: Partial<GraphNode> = {}): GraphNode {
  return {
    nodeId: "test-node",
    nodeType: "capability",
    name: "Test",
    description: "",
    stationId: "iot-hub",
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
    ...overrides,
  };
}

function makeEdge(overrides: Partial<GraphEdge> = {}): GraphEdge {
  return {
    edgeId: "test-edge",
    sourceNodeId: "a",
    targetNodeId: "b",
    edgeType: "data_flow",
    weight: 0.5,
    myelinated: false,
    activationCount: 10,
    coActivationCount: 5,
    avgLatencyMs: 50,
    stationId: "iot-hub",
    createdAt: new Date().toISOString(),
    metadata: {},
    ...overrides,
  };
}

describe("Neural Graph — myelination proposals", () => {
  it("proposes myelination for high-traffic edges", () => {
    const edges = [
      makeEdge({ edgeId: "e1", activationCount: 150, weight: 0.8 }),
      makeEdge({ edgeId: "e2", activationCount: 50, weight: 0.9 }), // not enough activations
      makeEdge({ edgeId: "e3", activationCount: 200, weight: 0.5 }), // not enough weight
    ];

    const proposals = generateMyelinationProposals(edges);
    expect(proposals).toHaveLength(1);
    expect(proposals[0].targetId).toBe("e1");
    expect(proposals[0].type).toBe("edge_myelinated");
  });

  it("skips already myelinated edges", () => {
    const edges = [makeEdge({ edgeId: "e1", activationCount: 150, weight: 0.8, myelinated: true })];

    const proposals = generateMyelinationProposals(edges);
    expect(proposals).toHaveLength(0);
  });
});

describe("Neural Graph — pruning proposals", () => {
  it("proposes pruning for low-fitness synthetic nodes", () => {
    const oldDate = new Date(Date.now() - 10 * 86_400_000).toISOString(); // 10 days ago
    const nodes = [
      makeNode({
        nodeId: "synth-1",
        nodeType: "synthetic",
        fitnessScore: 20,
        lastActivated: oldDate,
      }),
      makeNode({
        nodeId: "meta-engine", // core node — should not be pruned
        nodeType: "capability",
        fitnessScore: 20,
        lastActivated: oldDate,
      }),
    ];

    const proposals = generatePruningProposals(nodes, []);
    expect(proposals.filter((p) => p.type === "node_pruned")).toHaveLength(1);
    expect(proposals[0].targetId).toBe("synth-1");
    expect(proposals[0].requiresApproval).toBe(true);
  });

  it("proposes pruning for low-weight edges", () => {
    const edges = [
      makeEdge({ edgeId: "e1", weight: 0.05, activationCount: 2 }),
      makeEdge({ edgeId: "e2", weight: 0.5, activationCount: 100 }), // healthy
    ];

    const proposals = generatePruningProposals([], edges);
    expect(proposals.filter((p) => p.type === "edge_pruned")).toHaveLength(1);
    expect(proposals[0].targetId).toBe("e1");
  });
});

describe("Neural Graph — synaptogenesis proposals", () => {
  it("proposes new edges between co-activated nodes", () => {
    const nodes = [makeNode({ nodeId: "a" }), makeNode({ nodeId: "b" })];
    const edges: GraphEdge[] = []; // No direct edge
    const coActivations = new Map([["a->b", 15]]);

    const proposals = generateSynaptogenesisProposals(nodes, edges, coActivations);
    expect(proposals).toHaveLength(1);
    expect(proposals[0].type).toBe("edge_created");
    expect(proposals[0].targetId).toBe("a->b");
  });

  it("skips if edge already exists", () => {
    const nodes = [makeNode({ nodeId: "a" }), makeNode({ nodeId: "b" })];
    const edges = [makeEdge({ edgeId: "existing", sourceNodeId: "a", targetNodeId: "b" })];
    const coActivations = new Map([["a->b", 15]]);

    const proposals = generateSynaptogenesisProposals(nodes, edges, coActivations);
    expect(proposals).toHaveLength(0);
  });

  it("skips low co-activation counts", () => {
    const nodes = [makeNode({ nodeId: "a" }), makeNode({ nodeId: "b" })];
    const coActivations = new Map([["a->b", 5]]); // Below threshold

    const proposals = generateSynaptogenesisProposals(nodes, [], coActivations);
    expect(proposals).toHaveLength(0);
  });
});
