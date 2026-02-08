import { describe, it, expect, vi } from "vitest";

// Mock Convex modules before importing lifecycle
vi.mock("convex/browser", () => ({
  ConvexHttpClient: vi.fn().mockImplementation(() => ({
    query: vi.fn(),
    mutation: vi.fn(),
  })),
}));

vi.mock("../../convex/_generated/api.js", () => ({
  api: {
    graph_nodes: {
      list: "graph_nodes:list",
      create: "graph_nodes:create",
      updateFitness: "graph_nodes:updateFitness",
    },
    graph_edges: { list: "graph_edges:list", create: "graph_edges:create" },
    execution_records: { count: "execution_records:count" },
    evolution: { record: "evolution:record" },
  },
}));

const { determinePhase } = await import("../maturation/lifecycle.js");

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
