import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Convex modules
const mockMutation = vi.fn().mockResolvedValue("mock-id");
const mockQuery = vi.fn().mockResolvedValue([]);

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
      recordActivation: "graph_nodes:recordActivation",
    },
    graph_edges: {
      list: "graph_edges:list",
      create: "graph_edges:create",
      recordActivation: "graph_edges:recordActivation",
      myelinate: "graph_edges:myelinate",
    },
    execution_records: {
      record: "execution_records:record",
      count: "execution_records:count",
    },
    evolution: { record: "evolution:record" },
  },
}));

// Mock LangGraph to avoid full compilation
vi.mock("@langchain/langgraph", () => {
  const mockGraph = {
    invoke: vi.fn().mockResolvedValue({
      taskType: "chat",
      result: { text: "ok" },
      success: true,
      nodesVisited: ["meta_orchestrator", "capability_meta_engine", "evaluation"],
      nodeLatencies: { meta_orchestrator: 10, capability_meta_engine: 50, evaluation: 5 },
      evolutionProposals: [],
      pendingApproval: false,
      shouldEvolve: false,
    }),
  };
  // Annotation is used as both Annotation.Root({}) and Annotation<T>({reducer, default})
  function Annotation() {
    return {};
  }
  Annotation.Root = () => ({ State: {} });
  class MockStateGraph {
    addNode() {
      return this;
    }
    addEdge() {
      return this;
    }
    addConditionalEdges() {
      return this;
    }
    compile() {
      return mockGraph;
    }
  }
  return {
    StateGraph: MockStateGraph,
    END: "__end__",
    START: "__start__",
    Annotation,
    Command: class {},
  };
});

vi.mock("../persistence/convex-checkpointer.js", () => ({
  ConvexCheckpointer: vi.fn(),
}));

// Mock capability/orchestrator/evolution modules to avoid deep import chains
vi.mock("../graph/capability-nodes.js", () => ({
  capabilityMetaEngine: vi.fn(),
  capabilityModelManager: vi.fn(),
  capabilityModelTrainer: vi.fn(),
  capabilityMemory: vi.fn(),
  capabilityScraperIntel: vi.fn(),
  capabilityClerkLearning: vi.fn(),
  capabilitySocialIntel: vi.fn(),
}));
vi.mock("../graph/orchestrator.js", () => ({ metaOrchestrator: vi.fn() }));
vi.mock("../graph/evolution-nodes.js", () => ({
  evaluation: vi.fn(),
  shouldEvolve: vi.fn(),
  mutation: vi.fn(),
  needsApproval: vi.fn(),
}));
vi.mock("../graph/human-gate.js", () => ({ humanGate: vi.fn() }));
vi.mock("../graph/network-nodes.js", () => ({ networkOps: vi.fn() }));

const { executeNeuralQuery } = await import("../graph/compiler.js");

describe("Neural Graph — execution recording", () => {
  beforeEach(() => {
    mockMutation.mockClear();
    mockQuery.mockClear();
  });

  it("records execution to execution_records after query", async () => {
    const result = await executeNeuralQuery({
      task: "test task",
      taskType: "chat",
      stationId: "iot-hub",
    });

    expect(result.success).toBe(true);

    // Find the execution_records.record call
    const recordCall = mockMutation.mock.calls.find(
      (call) => call[0] === "execution_records:record",
    );
    expect(recordCall).toBeDefined();
    expect(recordCall![1]).toMatchObject({
      taskType: "chat",
      taskDescription: "test task",
      success: true,
      stationId: "iot-hub",
      nodesVisited: ["meta_orchestrator", "capability_meta_engine", "evaluation"],
    });
  });

  it("records node activations for each visited node", async () => {
    await executeNeuralQuery({ task: "test", stationId: "iot-hub" });

    const nodeActivations = mockMutation.mock.calls.filter(
      (call) => call[0] === "graph_nodes:recordActivation",
    );

    expect(nodeActivations.length).toBe(3); // meta_orchestrator, capability_meta_engine, evaluation
    expect(nodeActivations[0]![1]).toMatchObject({
      nodeId: "meta_orchestrator",
      latencyMs: 10,
      success: true,
    });
    expect(nodeActivations[1]![1]).toMatchObject({
      nodeId: "capability_meta_engine",
      latencyMs: 50,
      success: true,
    });
    expect(nodeActivations[2]![1]).toMatchObject({
      nodeId: "evaluation",
      latencyMs: 5,
      success: true,
    });
  });

  it("records edge activations for traversed edges", async () => {
    await executeNeuralQuery({ task: "test", stationId: "iot-hub" });

    const edgeActivations = mockMutation.mock.calls.filter(
      (call) => call[0] === "graph_edges:recordActivation",
    );

    expect(edgeActivations.length).toBe(2); // orchestrator->meta_engine, meta_engine->evaluation
    expect(edgeActivations[0]![1]).toMatchObject({
      edgeId: "meta_orchestrator->capability_meta_engine",
    });
    expect(edgeActivations[1]![1]).toMatchObject({
      edgeId: "capability_meta_engine->evaluation",
    });
  });

  it("returns query result even when recording fails", async () => {
    mockMutation.mockRejectedValueOnce(new Error("Convex down"));

    const result = await executeNeuralQuery({
      task: "test despite failure",
      stationId: "iot-hub",
    });

    // Query result should still be returned
    expect(result.success).toBe(true);
    expect(result.result).toEqual({ text: "ok" });
  });

  it("computes totalLatencyMs from node latencies", async () => {
    await executeNeuralQuery({ task: "test", stationId: "iot-hub" });

    const recordCall = mockMutation.mock.calls.find(
      (call) => call[0] === "execution_records:record",
    );
    expect(recordCall![1].totalLatencyMs).toBe(65); // 10 + 50 + 5
  });
});
