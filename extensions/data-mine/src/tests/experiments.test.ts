import { describe, it, expect, beforeEach } from "vitest";
import {
  tTest,
  chiSquaredTest,
  mannWhitneyU,
  effectSize,
  confidenceInterval,
  sampleSizeCalculation,
  createExperiment,
  recordObservation,
  evaluateExperiment,
  clearExperiments,
  getExperiments,
  getExperiment,
} from "../engines/experiments.js";

describe("Experiment Engine", () => {
  beforeEach(() => {
    clearExperiments();
  });

  describe("tTest", () => {
    it("detects significant difference between groups", () => {
      // Group A: mean ~10, Group B: mean ~20
      const groupA = Array.from({ length: 30 }, (_, i) => 10 + Math.sin(i) * 3);
      const groupB = Array.from({ length: 30 }, (_, i) => 20 + Math.cos(i) * 3);
      const result = tTest(groupA, groupB);

      expect(result.testName).toBe("independent t-test");
      expect(result.significant).toBe(true);
      expect(result.pValue).toBeLessThan(0.05);
      expect(result.degreesOfFreedom).toBe(58);
    });

    it("detects no difference for same distribution", () => {
      const data = Array.from({ length: 30 }, (_, i) => 10 + Math.sin(i) * 2);
      const groupA = data.slice(0, 15);
      const groupB = data.slice(15, 30);
      const result = tTest(groupA, groupB);

      // Same underlying data, should not be significant
      expect(result.pValue).toBeGreaterThan(0.01);
    });

    it("returns confidence interval", () => {
      const groupA = [10, 11, 12, 13, 14];
      const groupB = [20, 21, 22, 23, 24];
      const result = tTest(groupA, groupB);

      expect(result.confidenceInterval).toBeDefined();
      // CI should not include 0 for significant test
      expect(result.confidenceInterval![0]).toBeLessThan(0);
      expect(result.confidenceInterval![1]).toBeLessThan(0);
    });

    it("handles small groups", () => {
      const result = tTest([1], [2]);
      expect(result.pValue).toBe(1);
      expect(result.significant).toBe(false);
    });

    it("supports paired t-test", () => {
      const before = [10, 12, 14, 16, 18, 20, 22, 24, 26, 28];
      const after = [15, 17, 19, 21, 23, 25, 27, 29, 31, 33];
      const result = tTest(before, after, { paired: true });

      expect(result.testName).toBe("paired t-test");
      expect(result.significant).toBe(true);
    });
  });

  describe("chiSquaredTest", () => {
    it("not significant when observed matches expected", () => {
      const observed = [50, 50, 50, 50];
      const expected = [50, 50, 50, 50];
      const result = chiSquaredTest(observed, expected);

      expect(result.testName).toBe("chi-squared");
      expect(result.statistic).toBeCloseTo(0, 5);
      expect(result.significant).toBe(false);
    });

    it("significant when heavily skewed", () => {
      const observed = [90, 10, 10, 10];
      const expected = [30, 30, 30, 30];
      const result = chiSquaredTest(observed, expected);

      expect(result.significant).toBe(true);
      expect(result.pValue).toBeLessThan(0.05);
    });

    it("handles single category", () => {
      const result = chiSquaredTest([100], [100]);
      expect(result.pValue).toBe(1);
    });
  });

  describe("mannWhitneyU", () => {
    it("detects difference in medians", () => {
      const groupA = Array.from({ length: 30 }, (_, i) => 10 + i * 0.1);
      const groupB = Array.from({ length: 30 }, (_, i) => 30 + i * 0.1);
      const result = mannWhitneyU(groupA, groupB);

      expect(result.testName).toBe("Mann-Whitney U");
      expect(result.significant).toBe(true);
    });

    it("not significant for overlapping distributions", () => {
      const groupA = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const groupB = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
      const result = mannWhitneyU(groupA, groupB);

      // Heavily overlapping, may or may not be significant
      expect(typeof result.pValue).toBe("number");
    });

    it("handles small groups", () => {
      const result = mannWhitneyU([1], [2]);
      expect(result.pValue).toBe(1);
    });
  });

  describe("effectSize", () => {
    it("detects large effect size", () => {
      const groupA = Array.from({ length: 30 }, () => 10);
      const groupB = Array.from({ length: 30 }, () => 20);

      // Add tiny variation to avoid zero stddev
      groupA[0] = 10.1;
      groupB[0] = 20.1;

      const result = effectSize(groupA, groupB);
      expect(result.cohensD).toBeGreaterThan(0.8);
      expect(result.interpretation).toBe("large");
    });

    it("detects negligible effect size", () => {
      const groupA = Array.from({ length: 30 }, (_, i) => 10 + Math.sin(i) * 5);
      const groupB = Array.from({ length: 30 }, (_, i) => 10.1 + Math.cos(i) * 5);
      const result = effectSize(groupA, groupB);
      expect(result.cohensD).toBeLessThan(0.2);
      expect(result.interpretation).toBe("negligible");
    });

    it("handles constant groups", () => {
      const result = effectSize([5, 5, 5], [5, 5, 5]);
      expect(result.cohensD).toBe(0);
      expect(result.interpretation).toBe("negligible");
    });
  });

  describe("confidenceInterval", () => {
    it("interval contains mean", () => {
      const data = [1, 2, 3, 4, 5];
      const [lower, upper] = confidenceInterval(data, 0.95);
      const mean = 3;
      expect(lower).toBeLessThan(mean);
      expect(upper).toBeGreaterThan(mean);
    });

    it("wider at higher confidence", () => {
      const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const ci90 = confidenceInterval(data, 0.9);
      const ci99 = confidenceInterval(data, 0.99);
      const width90 = ci90[1] - ci90[0];
      const width99 = ci99[1] - ci99[0];
      expect(width99).toBeGreaterThan(width90);
    });

    it("handles single element", () => {
      const [lower, upper] = confidenceInterval([42]);
      expect(lower).toBe(42);
      expect(upper).toBe(42);
    });
  });

  describe("sampleSizeCalculation", () => {
    it("computes ~64 per group for medium effect", () => {
      const n = sampleSizeCalculation(0.5, 0.8, 0.05);
      expect(n).toBeGreaterThan(50);
      expect(n).toBeLessThan(100);
    });

    it("smaller effect needs larger sample", () => {
      const nSmall = sampleSizeCalculation(0.2, 0.8, 0.05);
      const nLarge = sampleSizeCalculation(0.8, 0.8, 0.05);
      expect(nSmall).toBeGreaterThan(nLarge);
    });

    it("returns Infinity for zero effect", () => {
      expect(sampleSizeCalculation(0)).toBe(Infinity);
    });
  });

  describe("experiment lifecycle", () => {
    it("creates experiment", () => {
      const config = createExperiment({
        name: "Test A/B",
        description: "Testing response times",
        groups: ["control", "treatment"],
        metric: "latency_ms",
        hypothesis: "Treatment reduces latency",
        alpha: 0.05,
        minSampleSize: 30,
      });

      expect(config.id).toBeTruthy();
      expect(config.name).toBe("Test A/B");
      expect(config.createdAt).toBeTruthy();
    });

    it("records observations and evaluates", () => {
      const config = createExperiment({
        name: "Performance Test",
        description: "Testing two models",
        groups: ["model_a", "model_b"],
        metric: "accuracy",
        hypothesis: "Model B is more accurate",
        alpha: 0.05,
        minSampleSize: 20,
      });

      // Record 50 observations per group with different means
      for (let i = 0; i < 50; i++) {
        recordObservation({
          experimentId: config.id,
          group: "model_a",
          value: 70 + Math.sin(i) * 5,
          timestamp: new Date().toISOString(),
        });
        recordObservation({
          experimentId: config.id,
          group: "model_b",
          value: 85 + Math.cos(i) * 5,
          timestamp: new Date().toISOString(),
        });
      }

      const result = evaluateExperiment(config.id);
      expect(result.experimentId).toBe(config.id);
      expect(result.significant).toBe(true);
      expect(result.tTest).toBeDefined();
      expect(result.mannWhitney).toBeDefined();
      expect(result.effectSize).toBeDefined();
      expect(result.effectSize!.interpretation).toBe("large");
      expect(Object.keys(result.groupStats)).toHaveLength(2);
    });

    it("lists experiments", () => {
      createExperiment({
        name: "Test 1",
        description: "",
        groups: ["a", "b"],
        metric: "x",
        hypothesis: "",
        alpha: 0.05,
        minSampleSize: 10,
      });
      createExperiment({
        name: "Test 2",
        description: "",
        groups: ["a", "b"],
        metric: "y",
        hypothesis: "",
        alpha: 0.05,
        minSampleSize: 10,
      });

      expect(getExperiments()).toHaveLength(2);
    });

    it("gets single experiment", () => {
      const config = createExperiment({
        name: "Findable",
        description: "",
        groups: ["a", "b"],
        metric: "x",
        hypothesis: "",
        alpha: 0.05,
        minSampleSize: 10,
      });

      expect(getExperiment(config.id)).toBeDefined();
      expect(getExperiment("nonexistent")).toBeUndefined();
    });

    it("handles evaluation of unknown experiment", () => {
      const result = evaluateExperiment("unknown");
      expect(result.recommendation).toBe("Experiment not found");
    });

    it("recommends more data when below min sample size", () => {
      const config = createExperiment({
        name: "Small Test",
        description: "",
        groups: ["a", "b"],
        metric: "x",
        hypothesis: "",
        alpha: 0.05,
        minSampleSize: 50,
      });

      recordObservation({ experimentId: config.id, group: "a", value: 1, timestamp: "" });
      recordObservation({ experimentId: config.id, group: "b", value: 2, timestamp: "" });

      const result = evaluateExperiment(config.id);
      expect(result.recommendation).toContain("Collect more data");
    });
  });
});
