import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { NeuralGraphStateType } from "../graph/state.js";

// Instead of mocking the PeerClient module (which involves tricky transitive
// dynamic import mocking), we test the peer capability nodes by mocking fetch
// at the global level — the same pattern used in hive-mind/tests/peer-client.test.ts.

const { capabilityScraperIntel, capabilityClerkLearning, capabilitySocialIntel } =
  await import("../graph/capability-nodes.js");

function makeState(taskDescription: string): NeuralGraphStateType {
  return {
    taskDescription,
    taskType: "unknown",
    complexity: "medium",
    sourceStationId: "iot-hub",
    selectedRoute: "",
    routingConfidence: 0,
    nodesVisited: [],
    nodeLatencies: {},
    result: null,
    success: false,
    error: "",
    shouldEvolve: false,
    evolutionProposals: [],
    pendingApproval: false,
  };
}

function mockFetchSuccess(data: Record<string, unknown>) {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

function mockFetchFailure(error: string) {
  vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error(error));
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// After the network topology migration (10.1.7.0/24 → 10.1.8.0/24), the
// scraper, clerk, and social-intel peer stations were removed from
// PEER_STATIONS. Only Julie (10.1.8.143) and Caesar (10.1.8.82) remain.
//
// The capability nodes now gracefully return success=false with
// "not configured" when getPeer() returns null for these old stations.
// ---------------------------------------------------------------------------

describe("capabilityScraperIntel", () => {
  it("returns not configured since scraper station was removed", async () => {
    const result = await capabilityScraperIntel(makeState("Check hotel prices for booking"));
    expect(result.nodesVisited).toContain("scraper_intel");
    expect(result.success).toBe(false);
    expect((result.result as Record<string, unknown>).available).toBe(false);
    expect((result.result as Record<string, unknown>).reason).toContain("not configured");
  });

  it("records latency in nodeLatencies", async () => {
    const result = await capabilityScraperIntel(makeState("Get hotel prices"));
    expect(result.nodeLatencies).toHaveProperty("scraper_intel");
    expect(typeof result.nodeLatencies!.scraper_intel).toBe("number");
  });

  it("handles network errors gracefully", async () => {
    mockFetchFailure("ECONNREFUSED");

    const result = await capabilityScraperIntel(makeState("Get hotel prices"));
    expect(result.nodesVisited).toContain("scraper_intel");
    expect(result.success).toBe(false);
  });
});

describe("capabilityClerkLearning", () => {
  it("returns not configured since clerk station was removed", async () => {
    const result = await capabilityClerkLearning(makeState("Check HF model status"));
    expect(result.nodesVisited).toContain("clerk_learning");
    expect(result.success).toBe(false);
    expect((result.result as Record<string, unknown>).available).toBe(false);
    expect((result.result as Record<string, unknown>).reason).toContain("not configured");
  });

  it("records latency in nodeLatencies", async () => {
    const result = await capabilityClerkLearning(makeState("Run inference"));
    expect(result.nodeLatencies).toHaveProperty("clerk_learning");
    expect(typeof result.nodeLatencies!.clerk_learning).toBe("number");
  });

  it("handles network errors gracefully", async () => {
    mockFetchFailure("ECONNREFUSED");

    const result = await capabilityClerkLearning(makeState("Run inference"));
    expect(result.nodesVisited).toContain("clerk_learning");
    expect(result.success).toBe(false);
  });
});

describe("capabilitySocialIntel", () => {
  it("returns not configured since social-intel station was removed", async () => {
    const result = await capabilitySocialIntel(makeState("Check social intel status"));
    expect(result.nodesVisited).toContain("social_intel");
    expect(result.success).toBe(false);
    expect((result.result as Record<string, unknown>).available).toBe(false);
    expect((result.result as Record<string, unknown>).reason).toContain("not configured");
  });

  it("records latency in nodeLatencies", async () => {
    const result = await capabilitySocialIntel(makeState("Check social feed"));
    expect(result.nodeLatencies).toHaveProperty("social_intel");
    expect(typeof result.nodeLatencies!.social_intel).toBe("number");
  });

  it("handles network errors gracefully", async () => {
    mockFetchFailure("Connection refused");

    const result = await capabilitySocialIntel(makeState("Check social feed"));
    expect(result.nodesVisited).toContain("social_intel");
    expect(result.success).toBe(false);
  });
});
