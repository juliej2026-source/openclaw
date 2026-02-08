import { describe, it, expect } from "vitest";
import type { GraphNode, GraphEdge } from "../types.js";
import {
  calculateNodeFitness,
  calculateGlobalStats,
  calculateEdgeFitness,
} from "../maturation/fitness.js";

function makeNode(overrides: Partial<GraphNode> = {}): GraphNode {
  return {
    nodeId: "test-node",
    nodeType: "capability",
    name: "Test Node",
    description: "test",
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

describe("Neural Graph — fitness scoring", () => {
  it("calculates fitness for a healthy node", () => {
    const node = makeNode({
      successCount: 90,
      failureCount: 10,
      activationCount: 100,
      totalLatencyMs: 5000,
    });
    const edges = [makeEdge({ sourceNodeId: "test-node", weight: 0.8 })];
    const globalStats = { avgLatencyMs: 50, maxActivations: 100 };

    const fitness = calculateNodeFitness(node, edges, globalStats);
    expect(fitness).toBeGreaterThan(50);
    expect(fitness).toBeLessThanOrEqual(100);
  });

  it("penalizes low success rate", () => {
    const healthy = makeNode({ successCount: 90, failureCount: 10 });
    const unhealthy = makeNode({ successCount: 10, failureCount: 90 });
    const edges: GraphEdge[] = [];
    const globalStats = { avgLatencyMs: 50, maxActivations: 100 };

    const healthyFitness = calculateNodeFitness(healthy, edges, globalStats);
    const unhealthyFitness = calculateNodeFitness(unhealthy, edges, globalStats);

    expect(healthyFitness).toBeGreaterThan(unhealthyFitness);
  });

  it("returns neutral fitness for new nodes", () => {
    const newNode = makeNode({
      successCount: 0,
      failureCount: 0,
      activationCount: 0,
      totalLatencyMs: 0,
    });
    const globalStats = { avgLatencyMs: 0, maxActivations: 0 };

    const fitness = calculateNodeFitness(newNode, [], globalStats);
    expect(fitness).toBeGreaterThan(0);
    expect(fitness).toBeLessThan(100);
  });

  it("calculates global stats correctly", () => {
    const nodes = [
      makeNode({ totalLatencyMs: 1000, successCount: 5, failureCount: 5, activationCount: 20 }),
      makeNode({
        nodeId: "n2",
        totalLatencyMs: 2000,
        successCount: 8,
        failureCount: 2,
        activationCount: 50,
      }),
    ];

    const stats = calculateGlobalStats(nodes);
    expect(stats.avgLatencyMs).toBeGreaterThan(0);
    expect(stats.maxActivations).toBe(50);
  });

  it("calculates edge fitness", () => {
    const normalEdge = makeEdge({ weight: 0.5, activationCount: 10, myelinated: false });
    const strongEdge = makeEdge({ weight: 0.9, activationCount: 100, myelinated: true });

    const normalFitness = calculateEdgeFitness(normalEdge);
    const strongFitness = calculateEdgeFitness(strongEdge);

    expect(strongFitness).toBeGreaterThan(normalFitness);
  });
});
