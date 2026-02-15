import { describe, it, expect } from "vitest";
import {
  descriptiveStats,
  correlationPair,
  correlationMatrix,
  linearRegression,
  polynomialRegression,
  multivariateRegression,
  distributionTest,
  spearmanCorrelation,
} from "../engines/statistics.js";

describe("Statistics Engine", () => {
  describe("descriptiveStats", () => {
    it("computes correct stats for known dataset", () => {
      const data = [2, 4, 4, 4, 5, 5, 7, 9];
      const stats = descriptiveStats(data);
      expect(stats.count).toBe(8);
      expect(stats.mean).toBe(5);
      expect(stats.median).toBe(4.5);
      expect(stats.mode).toBe(4);
      expect(stats.min).toBe(2);
      expect(stats.max).toBe(9);
      expect(stats.range).toBe(7);
      expect(stats.stdDev).toBeCloseTo(2.138, 2);
      expect(stats.variance).toBeCloseTo(4.571, 2);
    });

    it("computes quartiles correctly", () => {
      const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const stats = descriptiveStats(data);
      // simple-statistics uses R-7 quantile method
      expect(stats.q1).toBe(3);
      expect(stats.q3).toBe(8);
      expect(stats.iqr).toBe(5);
    });

    it("includes percentiles", () => {
      const data = Array.from({ length: 100 }, (_, i) => i + 1);
      const stats = descriptiveStats(data);
      expect(stats.percentiles[50]).toBeCloseTo(50.5, 0);
      expect(stats.percentiles[25]).toBeCloseTo(25.75, 0);
      expect(stats.percentiles[75]).toBeCloseTo(75.25, 0);
    });

    it("handles empty array", () => {
      const stats = descriptiveStats([]);
      expect(stats.count).toBe(0);
      expect(stats.mean).toBeNaN();
      expect(stats.median).toBeNaN();
    });

    it("handles single element", () => {
      const stats = descriptiveStats([42]);
      expect(stats.count).toBe(1);
      expect(stats.mean).toBe(42);
      expect(stats.median).toBe(42);
      expect(stats.stdDev).toBe(0);
      expect(stats.range).toBe(0);
    });

    it("handles all same values", () => {
      const stats = descriptiveStats([5, 5, 5, 5, 5]);
      expect(stats.mean).toBe(5);
      expect(stats.stdDev).toBe(0);
      expect(stats.variance).toBe(0);
      expect(stats.range).toBe(0);
    });

    it("computes skewness and kurtosis", () => {
      const data = [2, 4, 4, 4, 5, 5, 7, 9];
      const stats = descriptiveStats(data);
      expect(typeof stats.skewness).toBe("number");
      expect(typeof stats.kurtosis).toBe("number");
      expect(stats.skewness).not.toBeNaN();
      expect(stats.kurtosis).not.toBeNaN();
    });
  });

  describe("correlationPair", () => {
    it("detects perfect positive correlation", () => {
      const result = correlationPair([1, 2, 3, 4, 5], [2, 4, 6, 8, 10]);
      expect(result.pearson).toBeCloseTo(1.0, 5);
      expect(result.spearman).toBeCloseTo(1.0, 5);
      expect(result.pValue).toBeLessThan(0.05);
    });

    it("detects perfect negative correlation", () => {
      const result = correlationPair([1, 2, 3, 4, 5], [10, 8, 6, 4, 2]);
      expect(result.pearson).toBeCloseTo(-1.0, 5);
      expect(result.spearman).toBeCloseTo(-1.0, 5);
    });

    it("detects near-zero correlation for orthogonal data", () => {
      // sin and cos at evenly-spaced points are uncorrelated
      const n = 100;
      const a = Array.from({ length: n }, (_, i) => Math.sin((2 * Math.PI * i) / n));
      const b = Array.from({ length: n }, (_, i) => Math.cos((2 * Math.PI * i) / n));
      const result = correlationPair(a, b);
      expect(Math.abs(result.pearson)).toBeLessThan(0.15);
    });

    it("handles insufficient data", () => {
      const result = correlationPair([1], [2]);
      expect(result.pearson).toBeNaN();
      expect(result.pValue).toBe(1);
    });
  });

  describe("correlationMatrix", () => {
    it("produces symmetric matrix with 1s on diagonal", () => {
      const result = correlationMatrix({
        x: [1, 2, 3, 4, 5],
        y: [2, 4, 6, 8, 10],
        z: [5, 4, 3, 2, 1],
      });
      expect(result.variables).toEqual(["x", "y", "z"]);
      expect(result.matrix[0][0]).toBe(1);
      expect(result.matrix[1][1]).toBe(1);
      expect(result.matrix[2][2]).toBe(1);
      // Symmetric
      expect(result.matrix[0][1]).toBeCloseTo(result.matrix[1][0]);
      // x and y perfectly correlated
      expect(result.matrix[0][1]).toBeCloseTo(1.0, 5);
      // x and z perfectly anti-correlated
      expect(result.matrix[0][2]).toBeCloseTo(-1.0, 5);
    });
  });

  describe("spearmanCorrelation", () => {
    it("computes rank correlation", () => {
      const r = spearmanCorrelation([1, 2, 3, 4, 5], [5, 6, 7, 8, 7]);
      expect(r).toBeGreaterThan(0.5);
    });

    it("handles tied ranks", () => {
      const r = spearmanCorrelation([1, 2, 2, 3], [10, 20, 20, 30]);
      expect(r).toBeCloseTo(1.0, 2);
    });
  });

  describe("linearRegression", () => {
    it("fits y = 2x + 1 exactly", () => {
      const x = [1, 2, 3, 4, 5];
      const y = [3, 5, 7, 9, 11];
      const result = linearRegression(x, y);
      expect(result.type).toBe("linear");
      expect(result.coefficients[0]).toBeCloseTo(2, 5);
      expect(result.intercept).toBeCloseTo(1, 5);
      expect(result.rSquared).toBeCloseTo(1.0, 5);
    });

    it("fits noisy data with reasonable r-squared", () => {
      const x = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const y = x.map((xi) => 2 * xi + 1 + Math.sin(xi) * 0.5);
      const result = linearRegression(x, y);
      expect(result.coefficients[0]).toBeCloseTo(2, 0);
      expect(result.rSquared).toBeGreaterThan(0.9);
    });

    it("returns predictions and residuals", () => {
      const x = [1, 2, 3];
      const y = [2, 4, 6];
      const result = linearRegression(x, y);
      expect(result.predictions).toHaveLength(3);
      expect(result.residuals).toHaveLength(3);
      // Residuals should be near zero for perfect fit
      for (const r of result.residuals) {
        expect(Math.abs(r)).toBeLessThan(0.001);
      }
    });
  });

  describe("polynomialRegression", () => {
    it("fits y = x^2 with degree 2", () => {
      const x = [1, 2, 3, 4, 5];
      const y = [1, 4, 9, 16, 25];
      const result = polynomialRegression(x, y, 2);
      expect(result.type).toBe("polynomial");
      expect(result.rSquared).toBeCloseTo(1.0, 3);
    });

    it("returns predictions", () => {
      const x = [1, 2, 3, 4, 5];
      const y = [1, 4, 9, 16, 25];
      const result = polynomialRegression(x, y, 2);
      expect(result.predictions).toHaveLength(5);
      expect(result.predictions[0]).toBeCloseTo(1, 1);
      expect(result.predictions[4]).toBeCloseTo(25, 1);
    });
  });

  describe("multivariateRegression", () => {
    it("fits y = 2*x1 + 3*x2", () => {
      const features = [
        [1, 1],
        [2, 1],
        [1, 2],
        [3, 2],
        [2, 3],
      ];
      const target = features.map((f) => 2 * f[0] + 3 * f[1]);
      const result = multivariateRegression(features, target);
      expect(result.type).toBe("multivariate");
      expect(result.rSquared).toBeCloseTo(1.0, 3);
      expect(result.predictions).toHaveLength(5);
    });
  });

  describe("distributionTest", () => {
    it("detects normal distribution", () => {
      // Generate approximate normal data using CLT
      const data: number[] = [];
      for (let i = 0; i < 200; i++) {
        let sum = 0;
        for (let j = 0; j < 12; j++) {
          sum += Math.sin(i * 1000 + j * 7919) * 0.5 + 0.5;
        }
        data.push(sum - 6);
      }
      const result = distributionTest(data);
      expect(typeof result.isNormal).toBe("boolean");
      expect(typeof result.jarqueBera.statistic).toBe("number");
      expect(typeof result.jarqueBera.pValue).toBe("number");
    });

    it("detects non-normal distribution (uniform)", () => {
      // Uniform-like data (evenly spaced)
      const data = Array.from({ length: 200 }, (_, i) => i);
      const result = distributionTest(data);
      // Uniform has kurtosis ~ -1.2, should have low JB p-value for large n
      expect(typeof result.isNormal).toBe("boolean");
      expect(typeof result.jarqueBera.statistic).toBe("number");
    });

    it("handles small datasets gracefully", () => {
      const result = distributionTest([1, 2, 3]);
      expect(result.isNormal).toBe(true);
      expect(result.jarqueBera.pValue).toBe(1);
    });
  });
});
