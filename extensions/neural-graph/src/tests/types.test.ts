import { describe, it, expect } from "vitest";
import {
  CORE_NODE_IDS,
  FITNESS_WEIGHTS,
  PHASE_THRESHOLDS,
  MYELINATION_THRESHOLD,
  PRUNING_THRESHOLD,
  EVOLUTION_INTERVAL_MS,
  CONVEX_URL,
} from "../types.js";

describe("Neural Graph — types & constants", () => {
  it("defines 6 core node IDs", () => {
    expect(CORE_NODE_IDS).toHaveLength(6);
    expect(CORE_NODE_IDS).toContain("meta-engine");
    expect(CORE_NODE_IDS).toContain("model-manager");
    expect(CORE_NODE_IDS).toContain("model-trainer");
    expect(CORE_NODE_IDS).toContain("memory-lancedb");
    expect(CORE_NODE_IDS).toContain("iot-hub");
    expect(CORE_NODE_IDS).toContain("julie");
  });

  it("fitness weights sum to 100", () => {
    const total =
      FITNESS_WEIGHTS.successRate +
      FITNESS_WEIGHTS.latency +
      FITNESS_WEIGHTS.utilization +
      FITNESS_WEIGHTS.connectivity;
    expect(total).toBe(100);
  });

  it("phase thresholds are ordered", () => {
    expect(PHASE_THRESHOLDS.differentiation).toBeLessThan(PHASE_THRESHOLDS.synaptogenesis);
    expect(PHASE_THRESHOLDS.synaptogenesis).toBeLessThan(PHASE_THRESHOLDS.pruning);
  });

  it("myelination requires 100+ activations and weight >= 0.7", () => {
    expect(MYELINATION_THRESHOLD.activationCount).toBe(100);
    expect(MYELINATION_THRESHOLD.minWeight).toBe(0.7);
  });

  it("pruning requires fitness < 30 and 7d inactivity", () => {
    expect(PRUNING_THRESHOLD.minFitness).toBe(30);
    expect(PRUNING_THRESHOLD.inactivityDays).toBe(7);
  });

  it("evolution interval is 15 minutes", () => {
    expect(EVOLUTION_INTERVAL_MS).toBe(15 * 60 * 1000);
  });

  it("default Convex URL is localhost:3210", () => {
    // env var may override, but default is localhost
    expect(CONVEX_URL).toMatch(/127\.0\.0\.1:3210|localhost/);
  });
});
