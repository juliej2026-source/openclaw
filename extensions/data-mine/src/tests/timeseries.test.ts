import { describe, it, expect } from "vitest";
import type { DataPoint } from "../types.js";
import {
  movingAverage,
  trendDetection,
  seasonalityDecomposition,
  changePointDetection,
  forecast,
  rollingStats,
} from "../engines/timeseries.js";

function makePoints(values: number[]): DataPoint[] {
  return values.map((v, i) => ({ timestamp: i, value: v }));
}

describe("Time-Series Engine", () => {
  describe("movingAverage", () => {
    it("computes SMA correctly", () => {
      const result = movingAverage([1, 2, 3, 4, 5], 3, "sma");
      expect(result).toHaveLength(5);
      expect(result[0]).toBeNaN();
      expect(result[1]).toBeNaN();
      expect(result[2]).toBeCloseTo(2, 5);
      expect(result[3]).toBeCloseTo(3, 5);
      expect(result[4]).toBeCloseTo(4, 5);
    });

    it("computes EMA correctly", () => {
      const result = movingAverage([10, 10, 10, 10, 10], 3, "ema");
      // Constant series -> EMA should converge to same value
      for (const v of result) {
        expect(v).toBeCloseTo(10, 5);
      }
    });

    it("computes WMA correctly", () => {
      const result = movingAverage([1, 2, 3, 4, 5], 3, "wma");
      expect(result[0]).toBeNaN();
      expect(result[1]).toBeNaN();
      // WMA(3) at index 2: (1*1 + 2*2 + 3*3) / (1+2+3) = 14/6 = 2.333
      expect(result[2]).toBeCloseTo(14 / 6, 3);
    });

    it("handles window=1", () => {
      const data = [5, 10, 15];
      const result = movingAverage(data, 1, "sma");
      expect(result).toEqual(data);
    });

    it("handles empty array", () => {
      expect(movingAverage([], 3, "sma")).toEqual([]);
    });
  });

  describe("trendDetection", () => {
    it("detects upward trend", () => {
      const series = makePoints([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      const result = trendDetection(series);
      expect(result.direction).toBe("up");
      expect(result.slope).toBeGreaterThan(0);
      expect(result.rSquared).toBeCloseTo(1.0, 3);
      expect(result.significance).toBe(true);
    });

    it("detects downward trend", () => {
      const series = makePoints([10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
      const result = trendDetection(series);
      expect(result.direction).toBe("down");
      expect(result.slope).toBeLessThan(0);
      expect(result.significance).toBe(true);
    });

    it("detects flat trend for constant series", () => {
      const series = makePoints([5, 5, 5, 5, 5]);
      const result = trendDetection(series);
      expect(result.direction).toBe("flat");
      expect(result.slope).toBe(0);
    });

    it("handles single point", () => {
      const result = trendDetection(makePoints([42]));
      expect(result.direction).toBe("flat");
      expect(result.significance).toBe(false);
    });
  });

  describe("seasonalityDecomposition", () => {
    it("decomposes series with known seasonality", () => {
      // Create a series: trend + seasonal
      const period = 12;
      const n = 48; // 4 full periods
      const values: number[] = [];
      for (let i = 0; i < n; i++) {
        const trend = i * 0.5;
        const seasonal = 5 * Math.sin((2 * Math.PI * i) / period);
        values.push(trend + seasonal);
      }

      const result = seasonalityDecomposition(values, period);
      expect(result.trend).toHaveLength(n);
      expect(result.seasonal).toHaveLength(n);
      expect(result.residual).toHaveLength(n);

      // Seasonal should be periodic with period 12
      for (let i = period; i < n - period; i++) {
        expect(result.seasonal[i]).toBeCloseTo(result.seasonal[i - period], 0);
      }
    });

    it("handles short series gracefully", () => {
      const result = seasonalityDecomposition([1, 2, 3], 12);
      expect(result.trend).toHaveLength(3);
      expect(result.seasonal).toHaveLength(3);
    });
  });

  describe("changePointDetection", () => {
    it("detects mean shift", () => {
      // Series with mean shift at midpoint
      const values = [
        ...new Array(50).fill(0).map(() => 10 + Math.sin(Math.random())),
        ...new Array(50).fill(0).map(() => 50 + Math.sin(Math.random())),
      ];
      const points = changePointDetection(values);
      expect(points.length).toBeGreaterThan(0);
      // At least one change point should be near index 50
      const nearMidpoint = points.some((p) => Math.abs(p - 50) < 15);
      expect(nearMidpoint).toBe(true);
    });

    it("detects no change points in stable series", () => {
      const values = new Array(100).fill(5);
      const points = changePointDetection(values);
      expect(points).toHaveLength(0);
    });

    it("handles small array", () => {
      expect(changePointDetection([1, 2])).toEqual([]);
    });
  });

  describe("forecast", () => {
    it("SES forecasts constant for constant series", () => {
      const values = [10, 10, 10, 10, 10];
      const result = forecast(values, 3, "ses");
      expect(result).toHaveLength(3);
      for (const v of result) {
        expect(v).toBeCloseTo(10, 1);
      }
    });

    it("Holt forecasts increasing values for upward trend", () => {
      const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const result = forecast(values, 3, "holt");
      expect(result).toHaveLength(3);
      // Should predict values > 10
      expect(result[0]).toBeGreaterThan(10);
      expect(result[1]).toBeGreaterThan(result[0]);
    });

    it("handles empty array", () => {
      expect(forecast([], 5, "ses")).toEqual([]);
    });

    it("handles zero horizon", () => {
      expect(forecast([1, 2, 3], 0)).toEqual([]);
    });
  });

  describe("rollingStats", () => {
    it("computes rolling statistics correctly", () => {
      const values = [1, 2, 3, 4, 5];
      const result = rollingStats(values, 3);
      expect(result).toHaveLength(5);
      expect(result[0].mean).toBeNaN();
      expect(result[1].mean).toBeNaN();
      expect(result[2].mean).toBeCloseTo(2, 5); // (1+2+3)/3
      expect(result[2].min).toBe(1);
      expect(result[2].max).toBe(3);
      expect(result[3].mean).toBeCloseTo(3, 5); // (2+3+4)/3
      expect(result[4].mean).toBeCloseTo(4, 5); // (3+4+5)/3
    });

    it("computes standard deviation", () => {
      const values = [10, 10, 10, 10]; // constant
      const result = rollingStats(values, 3);
      expect(result[2].stdDev).toBeCloseTo(0, 5);
    });

    it("handles empty array", () => {
      expect(rollingStats([], 3)).toEqual([]);
    });
  });
});
