import { describe, it, expect, vi, beforeEach } from "vitest";

const mockMutation = vi.fn().mockResolvedValue("ok");
const mockQuery = vi.fn();

// Mock Convex modules before importing lifecycle
vi.mock("../persistence/convex-client.js", () => ({
  getConvexClient: () => ({
    query: (...args: unknown[]) => mockQuery(...args),
    mutation: (...args: unknown[]) => mockMutation(...args),
  }),
}));

vi.mock("../../convex/_generated/api.js", () => ({
  api: {
    graph_nodes: {
      list: "graph_nodes:list",
      create: "graph_nodes:create",
      updateFitness: "graph_nodes:updateFitness",
    },
    graph_edges: {
      list: "graph_edges:list",
      create: "graph_edges:create",
      myelinate: "graph_edges:myelinate",
    },
    execution_records: { count: "execution_records:count" },
    evolution: { record: "evolution:record" },
  },
}));

const { determinePhase, runEvolutionCycle } = await import("../maturation/lifecycle.js");

describe("Neural Graph — maturation lifecycle", () => {
  it("returns genesis for < 100 executions", () => {
    expect(determinePhase(0)).toBe("genesis");
    expect(determinePhase(50)).toBe("genesis");
    expect(determinePhase(99)).toBe("genesis");
  });

  it("returns differentiation for 100-499 executions", () => {
    expect(determinePhase(100)).toBe("differentiation");
    expect(determinePhase(250)).toBe("differentiation");
    expect(determinePhase(499)).toBe("differentiation");
  });

  it("returns synaptogenesis for 500-999 executions", () => {
    expect(determinePhase(500)).toBe("synaptogenesis");
    expect(determinePhase(750)).toBe("synaptogenesis");
    expect(determinePhase(999)).toBe("synaptogenesis");
  });

  it("returns pruning for 1000+ executions", () => {
    expect(determinePhase(1000)).toBe("pruning");
    expect(determinePhase(5000)).toBe("pruning");
    expect(determinePhase(100000)).toBe("pruning");
  });
});

describe("runEvolutionCycle — edge myelination", () => {
  beforeEach(() => {
    mockMutation.mockClear();
    mockQuery.mockClear();
  });

  it("myelinates edges meeting activation and weight thresholds", async () => {
    mockQuery
      // nodes
      .mockResolvedValueOnce([
        {
          nodeId: "meta-engine",
          nodeType: "capability",
          fitnessScore: 50,
          maturationPhase: "genesis",
          activationCount: 200,
          successCount: 180,
          failureCount: 20,
          totalLatencyMs: 5000,
          status: "active",
        },
      ])
      // edges
      .mockResolvedValueOnce([
        {
          edgeId: "meta-engine->model-manager",
          sourceNodeId: "meta-engine",
          targetNodeId: "model-manager",
          weight: 0.8,
          myelinated: false,
          activationCount: 150, // > 100 threshold
          coActivationCount: 50,
          avgLatencyMs: 10,
        },
        {
          edgeId: "iot-hub->meta-engine",
          sourceNodeId: "iot-hub",
          targetNodeId: "meta-engine",
          weight: 0.5, // Below 0.7 threshold
          myelinated: false,
          activationCount: 200,
          coActivationCount: 100,
          avgLatencyMs: 5,
        },
      ])
      // execution count
      .mockResolvedValueOnce(50);

    const result = await runEvolutionCycle("iot-hub");

    expect(result.edgesUpdated).toBe(1); // Only first edge qualifies

    const myelinateCalls = mockMutation.mock.calls.filter(
      (call) => call[0] === "graph_edges:myelinate",
    );
    expect(myelinateCalls.length).toBe(1);
    expect(myelinateCalls[0]![1]).toEqual({ edgeId: "meta-engine->model-manager" });
  });

  it("skips already myelinated edges", async () => {
    mockQuery
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          edgeId: "a->b",
          weight: 0.9,
          myelinated: true, // Already myelinated
          activationCount: 200,
          coActivationCount: 50,
          avgLatencyMs: 10,
        },
      ])
      .mockResolvedValueOnce(50);

    const result = await runEvolutionCycle("iot-hub");
    expect(result.edgesUpdated).toBe(0);
  });

  it("returns correct edgesUpdated count", async () => {
    mockQuery
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          edgeId: "a->b",
          weight: 0.8,
          myelinated: false,
          activationCount: 150,
          coActivationCount: 0,
          avgLatencyMs: 0,
        },
        {
          edgeId: "c->d",
          weight: 0.9,
          myelinated: false,
          activationCount: 200,
          coActivationCount: 0,
          avgLatencyMs: 0,
        },
        {
          edgeId: "e->f",
          weight: 0.3,
          myelinated: false,
          activationCount: 50,
          coActivationCount: 0,
          avgLatencyMs: 0,
        },
      ])
      .mockResolvedValueOnce(0);

    const result = await runEvolutionCycle("iot-hub");
    expect(result.edgesUpdated).toBe(2); // a->b and c->d qualify
  });
});
