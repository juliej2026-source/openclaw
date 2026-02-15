// ---------------------------------------------------------------------------
// Time-Series Engine — Moving averages, trend detection, seasonality,
// change-point detection, forecasting, rolling stats
// ---------------------------------------------------------------------------

import type { DataPoint, MovingAverageType } from "../types.js";

/**
 * Compute moving average (SMA, EMA, or WMA).
 * Returns array same length as input, with NaN for insufficient initial data.
 */
export function movingAverage(
  values: number[],
  window: number,
  type: MovingAverageType = "sma",
): number[] {
  if (values.length === 0 || window <= 0) return [];
  if (window === 1) return [...values];

  const result = new Array<number>(values.length);

  switch (type) {
    case "sma": {
      for (let i = 0; i < values.length; i++) {
        if (i < window - 1) {
          result[i] = NaN;
        } else {
          let sum = 0;
          for (let j = i - window + 1; j <= i; j++) {
            sum += values[j];
          }
          result[i] = sum / window;
        }
      }
      break;
    }
    case "ema": {
      const alpha = 2 / (window + 1);
      result[0] = values[0];
      for (let i = 1; i < values.length; i++) {
        result[i] = alpha * values[i] + (1 - alpha) * result[i - 1];
      }
      break;
    }
    case "wma": {
      const weightSum = (window * (window + 1)) / 2;
      for (let i = 0; i < values.length; i++) {
        if (i < window - 1) {
          result[i] = NaN;
        } else {
          let sum = 0;
          for (let j = 0; j < window; j++) {
            sum += values[i - window + 1 + j] * (j + 1);
          }
          result[i] = sum / weightSum;
        }
      }
      break;
    }
  }

  return result;
}

/**
 * Detect trend in a time-series using linear regression.
 */
export function trendDetection(series: DataPoint[]): {
  direction: "up" | "down" | "flat";
  slope: number;
  rSquared: number;
  significance: boolean;
} {
  if (series.length < 2) {
    return { direction: "flat", slope: 0, rSquared: 0, significance: false };
  }

  const n = series.length;
  const x = series.map((_, i) => i);
  const y = series.map((p) => p.value);

  const meanX = x.reduce((s, v) => s + v, 0) / n;
  const meanY = y.reduce((s, v) => s + v, 0) / n;

  let ssXY = 0;
  let ssXX = 0;
  let ssYY = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    ssXY += dx * dy;
    ssXX += dx * dx;
    ssYY += dy * dy;
  }

  const slope = ssXX === 0 ? 0 : ssXY / ssXX;
  const rSquared = ssXX === 0 || ssYY === 0 ? 0 : (ssXY * ssXY) / (ssXX * ssYY);

  let direction: "up" | "down" | "flat" = "flat";
  if (Math.abs(slope) > 1e-10) {
    direction = slope > 0 ? "up" : "down";
  }

  return {
    direction,
    slope,
    rSquared,
    significance: rSquared > 0.5,
  };
}

/**
 * Classical additive seasonal decomposition.
 * Returns trend, seasonal, and residual components.
 */
export function seasonalityDecomposition(
  values: number[],
  period: number,
): {
  trend: number[];
  seasonal: number[];
  residual: number[];
} {
  const n = values.length;
  if (n < period * 2) {
    return { trend: [...values], seasonal: new Array(n).fill(0), residual: new Array(n).fill(0) };
  }

  // Step 1: Centered moving average for trend
  const trend = new Array<number>(n).fill(NaN);
  const half = Math.floor(period / 2);
  for (let i = half; i < n - half; i++) {
    let sum = 0;
    let count = 0;
    for (let j = i - half; j <= i + half; j++) {
      if (j >= 0 && j < n) {
        sum += values[j];
        count++;
      }
    }
    trend[i] = sum / count;
  }

  // Fill edges with nearest valid trend
  for (let i = 0; i < half; i++) {
    trend[i] = trend[half];
  }
  for (let i = n - half; i < n; i++) {
    trend[i] = trend[n - half - 1];
  }

  // Step 2: Detrended values
  const detrended = values.map((v, i) => v - trend[i]);

  // Step 3: Average seasonal component by phase
  const seasonalAvg = new Array<number>(period).fill(0);
  const seasonalCount = new Array<number>(period).fill(0);
  for (let i = 0; i < n; i++) {
    const phase = i % period;
    seasonalAvg[phase] += detrended[i];
    seasonalCount[phase]++;
  }
  for (let p = 0; p < period; p++) {
    seasonalAvg[p] /= seasonalCount[p] || 1;
  }

  // Center seasonal (subtract mean so seasonal sums to ~0)
  const seasonalMean = seasonalAvg.reduce((s, v) => s + v, 0) / period;
  for (let p = 0; p < period; p++) {
    seasonalAvg[p] -= seasonalMean;
  }

  // Step 4: Build seasonal and residual arrays
  const seasonal = values.map((_, i) => seasonalAvg[i % period]);
  const residual = values.map((v, i) => v - trend[i] - seasonal[i]);

  return { trend, seasonal, residual };
}

/**
 * CUSUM-based change-point detection.
 * Returns indices where cumulative sum exceeds threshold.
 */
export function changePointDetection(values: number[], threshold?: number): number[] {
  if (values.length < 4) return [];

  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const stdDev = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / (values.length - 1));

  const thresh = threshold ?? 2 * stdDev;
  if (thresh === 0) return [];

  const changePoints: number[] = [];
  let cusumPos = 0;
  let cusumNeg = 0;

  for (let i = 0; i < values.length; i++) {
    const deviation = values[i] - mean;
    cusumPos = Math.max(0, cusumPos + deviation);
    cusumNeg = Math.min(0, cusumNeg + deviation);

    if (cusumPos > thresh || cusumNeg < -thresh) {
      changePoints.push(i);
      cusumPos = 0;
      cusumNeg = 0;
    }
  }

  return changePoints;
}

/**
 * Forecast future values using Simple Exponential Smoothing (SES)
 * or Holt's linear trend method.
 */
export function forecast(
  values: number[],
  horizon: number,
  method: "ses" | "holt" = "ses",
): number[] {
  if (values.length === 0 || horizon <= 0) return [];

  if (method === "ses") {
    return sesForecast(values, horizon);
  } else {
    return holtForecast(values, horizon);
  }
}

function sesForecast(values: number[], horizon: number): number[] {
  // Find optimal alpha via grid search minimizing MSE
  let bestAlpha = 0.5;
  let bestMSE = Infinity;

  for (let alpha = 0.1; alpha <= 0.9; alpha += 0.1) {
    let smoothed = values[0];
    let mse = 0;
    for (let i = 1; i < values.length; i++) {
      smoothed = alpha * values[i] + (1 - alpha) * smoothed;
      mse += (values[i] - smoothed) ** 2;
    }
    mse /= values.length - 1;
    if (mse < bestMSE) {
      bestMSE = mse;
      bestAlpha = alpha;
    }
  }

  // Apply SES with best alpha
  let smoothed = values[0];
  for (let i = 1; i < values.length; i++) {
    smoothed = bestAlpha * values[i] + (1 - bestAlpha) * smoothed;
  }

  // Forecast is flat at last smoothed value
  return new Array(horizon).fill(smoothed);
}

function holtForecast(values: number[], horizon: number): number[] {
  if (values.length < 2) {
    return new Array(horizon).fill(values[0] ?? 0);
  }

  // Initialize
  let level = values[0];
  let trend = values[1] - values[0];
  const alpha = 0.3;
  const beta = 0.1;

  for (let i = 1; i < values.length; i++) {
    const prevLevel = level;
    level = alpha * values[i] + (1 - alpha) * (prevLevel + trend);
    trend = beta * (level - prevLevel) + (1 - beta) * trend;
  }

  // Forecast
  const result: number[] = [];
  for (let h = 1; h <= horizon; h++) {
    result.push(level + h * trend);
  }
  return result;
}

/**
 * Rolling window statistics.
 */
export function rollingStats(
  values: number[],
  window: number,
): Array<{
  mean: number;
  stdDev: number;
  min: number;
  max: number;
}> {
  if (values.length === 0 || window <= 0) return [];

  const result: Array<{ mean: number; stdDev: number; min: number; max: number }> = [];

  for (let i = 0; i < values.length; i++) {
    if (i < window - 1) {
      result.push({ mean: NaN, stdDev: NaN, min: NaN, max: NaN });
      continue;
    }
    const slice = values.slice(i - window + 1, i + 1);
    const mean = slice.reduce((s, v) => s + v, 0) / slice.length;
    const variance = slice.reduce((s, v) => s + (v - mean) ** 2, 0) / (slice.length - 1);
    result.push({
      mean,
      stdDev: Math.sqrt(variance),
      min: Math.min(...slice),
      max: Math.max(...slice),
    });
  }

  return result;
}
