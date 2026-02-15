// ---------------------------------------------------------------------------
// Statistics Engine — Descriptive stats, correlation, regression, distribution tests
// ---------------------------------------------------------------------------

import MultivariateLinearRegression from "ml-regression-multivariate-linear";
import { PolynomialRegression } from "ml-regression-polynomial";
import { SimpleLinearRegression } from "ml-regression-simple-linear";
import * as ss from "simple-statistics";
import type {
  DescriptiveStats,
  CorrelationResult,
  CorrelationMatrix,
  RegressionResult,
} from "../types.js";

/**
 * Compute descriptive statistics for a numeric array.
 */
export function descriptiveStats(data: number[]): DescriptiveStats {
  if (data.length === 0) {
    return {
      count: 0,
      mean: NaN,
      median: NaN,
      mode: NaN,
      min: NaN,
      max: NaN,
      range: NaN,
      stdDev: NaN,
      variance: NaN,
      skewness: NaN,
      kurtosis: NaN,
      q1: NaN,
      q3: NaN,
      iqr: NaN,
      percentiles: {},
    };
  }

  if (data.length === 1) {
    const v = data[0];
    return {
      count: 1,
      mean: v,
      median: v,
      mode: v,
      min: v,
      max: v,
      range: 0,
      stdDev: 0,
      variance: 0,
      skewness: NaN,
      kurtosis: NaN,
      q1: v,
      q3: v,
      iqr: 0,
      percentiles: { 5: v, 10: v, 25: v, 50: v, 75: v, 90: v, 95: v },
    };
  }

  const sorted = [...data].sort((a, b) => a - b);
  const mean = ss.mean(data);
  const median = ss.median(sorted);
  const mode = ss.mode(sorted);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const stdDev = ss.sampleStandardDeviation(data);
  const variance = ss.sampleVariance(data);
  const skewness = data.length >= 3 ? ss.sampleSkewness(data) : NaN;
  const kurtosis = data.length >= 4 ? ss.sampleKurtosis(data) : NaN;
  const q1 = ss.quantile(sorted, 0.25);
  const q3 = ss.quantile(sorted, 0.75);

  const percentiles: Record<number, number> = {};
  for (const p of [5, 10, 25, 50, 75, 90, 95]) {
    percentiles[p] = ss.quantile(sorted, p / 100);
  }

  return {
    count: data.length,
    mean,
    median,
    mode,
    min,
    max,
    range: max - min,
    stdDev,
    variance,
    skewness,
    kurtosis,
    q1,
    q3,
    iqr: q3 - q1,
    percentiles,
  };
}

/**
 * Compute Spearman rank correlation between two arrays.
 */
export function spearmanCorrelation(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length < 2) return NaN;

  function rankArray(arr: number[]): number[] {
    const indexed = arr.map((v, i) => ({ v, i }));
    indexed.sort((x, y) => x.v - y.v);
    const ranks = new Array(arr.length);
    let i = 0;
    while (i < indexed.length) {
      let j = i;
      while (j < indexed.length && indexed[j].v === indexed[i].v) j++;
      const avgRank = (i + j - 1) / 2 + 1;
      for (let k = i; k < j; k++) {
        ranks[indexed[k].i] = avgRank;
      }
      i = j;
    }
    return ranks;
  }

  const ranksA = rankArray(a);
  const ranksB = rankArray(b);
  return ss.sampleCorrelation(ranksA, ranksB);
}

/**
 * Approximate p-value for a correlation coefficient using t-distribution.
 */
function correlationPValue(r: number, n: number): number {
  if (n <= 2) return 1;
  if (Math.abs(r) >= 1) return 0;
  const t = r * Math.sqrt((n - 2) / (1 - r * r));
  const df = n - 2;
  return tDistributionPValue(Math.abs(t), df) * 2; // two-tailed
}

/**
 * Approximate one-tailed p-value for t-distribution using regularized incomplete beta.
 */
function tDistributionPValue(t: number, df: number): number {
  const x = df / (df + t * t);
  return 0.5 * regularizedIncompleteBeta(x, df / 2, 0.5);
}

/**
 * Regularized incomplete beta function using continued fraction (Lentz's algorithm).
 */
export function regularizedIncompleteBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;

  // Use symmetry relation when x > (a+1)/(a+b+2)
  if (x > (a + 1) / (a + b + 2)) {
    return 1 - regularizedIncompleteBeta(1 - x, b, a);
  }

  const lnBeta = lnGamma(a) + lnGamma(b) - lnGamma(a + b);
  const front = Math.exp(Math.log(x) * a + Math.log(1 - x) * b - lnBeta) / a;

  // Lentz's continued fraction
  const maxIter = 200;
  const eps = 1e-14;
  let f = 1;
  let c = 1;
  let d = 1 - ((a + b) * x) / (a + 1);
  if (Math.abs(d) < eps) d = eps;
  d = 1 / d;
  f = d;

  for (let m = 1; m <= maxIter; m++) {
    // Even step
    let numerator = (m * (b - m) * x) / ((a + 2 * m - 1) * (a + 2 * m));
    d = 1 + numerator * d;
    if (Math.abs(d) < eps) d = eps;
    c = 1 + numerator / c;
    if (Math.abs(c) < eps) c = eps;
    d = 1 / d;
    f *= c * d;

    // Odd step
    numerator = -((a + m) * (a + b + m) * x) / ((a + 2 * m) * (a + 2 * m + 1));
    d = 1 + numerator * d;
    if (Math.abs(d) < eps) d = eps;
    c = 1 + numerator / c;
    if (Math.abs(c) < eps) c = eps;
    d = 1 / d;
    const delta = c * d;
    f *= delta;

    if (Math.abs(delta - 1) < eps) break;
  }

  return front * f;
}

/**
 * Log-gamma function using Lanczos approximation.
 */
export function lnGamma(z: number): number {
  if (z <= 0) return Infinity;
  const g = 7;
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6,
    1.5056327351493116e-7,
  ];
  let x = c[0];
  for (let i = 1; i < g + 2; i++) {
    x += c[i] / (z + i - 1);
  }
  const t = z + g - 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z - 0.5) * Math.log(t) - t + Math.log(x);
}

/**
 * Compute correlation pair (Pearson + Spearman + p-value).
 */
export function correlationPair(a: number[], b: number[]): CorrelationResult {
  if (a.length !== b.length || a.length < 2) {
    return {
      variableA: "a",
      variableB: "b",
      pearson: NaN,
      spearman: NaN,
      pValue: 1,
    };
  }

  const pearson = ss.sampleCorrelation(a, b);
  const spearman = spearmanCorrelation(a, b);
  const pValue = correlationPValue(pearson, a.length);

  return {
    variableA: "a",
    variableB: "b",
    pearson,
    spearman,
    pValue,
  };
}

/**
 * Compute correlation matrix for named variables.
 */
export function correlationMatrix(variables: Record<string, number[]>): CorrelationMatrix {
  const names = Object.keys(variables);
  const n = names.length;
  const matrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    matrix[i][i] = 1;
    for (let j = i + 1; j < n; j++) {
      const r = ss.sampleCorrelation(variables[names[i]], variables[names[j]]);
      matrix[i][j] = r;
      matrix[j][i] = r;
    }
  }

  return { variables: names, matrix, method: "pearson" };
}

/**
 * Linear regression: y = slope * x + intercept.
 */
export function linearRegression(x: number[], y: number[]): RegressionResult {
  const reg = new SimpleLinearRegression(x, y);
  const predictions = x.map((xi) => reg.predict(xi));
  const residuals = y.map((yi, i) => yi - predictions[i]);
  const ssTot = ss.sumSimple(y.map((yi) => (yi - ss.mean(y)) ** 2));
  const ssRes = ss.sumSimple(residuals.map((r) => r * r));
  const rSquared = ssTot === 0 ? 1 : 1 - ssRes / ssTot;

  return {
    type: "linear",
    coefficients: [reg.slope],
    intercept: reg.intercept,
    rSquared,
    residuals,
    predictions,
  };
}

/**
 * Polynomial regression: y = c0 + c1*x + c2*x^2 + ... + cn*x^n.
 */
export function polynomialRegression(x: number[], y: number[], degree: number): RegressionResult {
  const reg = new PolynomialRegression(x, y, degree);
  const predictions = x.map((xi) => reg.predict(xi));
  const residuals = y.map((yi, i) => yi - predictions[i]);
  const ssTot = ss.sumSimple(y.map((yi) => (yi - ss.mean(y)) ** 2));
  const ssRes = ss.sumSimple(residuals.map((r) => r * r));
  const rSquared = ssTot === 0 ? 1 : 1 - ssRes / ssTot;

  return {
    type: "polynomial",
    coefficients: reg.coefficients,
    intercept: reg.coefficients[0] ?? 0,
    rSquared,
    residuals,
    predictions,
  };
}

/**
 * Multivariate linear regression.
 */
export function multivariateRegression(features: number[][], target: number[]): RegressionResult {
  const reg = new MultivariateLinearRegression(
    features,
    target.map((t) => [t]),
  );
  const predictions = features.map((f) => reg.predict([f])[0]);
  const residuals = target.map((t, i) => t - predictions[i]);
  const mean = ss.mean(target);
  const ssTot = ss.sumSimple(target.map((t) => (t - mean) ** 2));
  const ssRes = ss.sumSimple(residuals.map((r) => r * r));
  const rSquared = ssTot === 0 ? 1 : 1 - ssRes / ssTot;

  return {
    type: "multivariate",
    coefficients: reg.weights.map((w: number[]) => w[0]),
    intercept: 0,
    rSquared,
    residuals,
    predictions,
  };
}

/**
 * Jarque-Bera test for normality.
 */
export function distributionTest(data: number[]): {
  isNormal: boolean;
  skewnessZ: number;
  kurtosisZ: number;
  jarqueBera: { statistic: number; pValue: number };
} {
  if (data.length < 8) {
    return {
      isNormal: true,
      skewnessZ: 0,
      kurtosisZ: 0,
      jarqueBera: { statistic: 0, pValue: 1 },
    };
  }

  const n = data.length;
  const skew = ss.sampleSkewness(data);
  const kurt = ss.sampleKurtosis(data);

  // Jarque-Bera statistic: JB = (n/6) * (S^2 + (1/4)(K-3)^2)
  // Note: sampleKurtosis from simple-statistics is excess kurtosis (K-3)
  const jb = (n / 6) * (skew * skew + (kurt * kurt) / 4);

  // p-value: JB ~ chi-squared(2)
  const pValue = 1 - chiSquaredCDF(jb, 2);

  return {
    isNormal: pValue > 0.05,
    skewnessZ: skew / Math.sqrt(6 / n),
    kurtosisZ: kurt / Math.sqrt(24 / n),
    jarqueBera: { statistic: jb, pValue },
  };
}

/**
 * Chi-squared CDF approximation using regularized incomplete gamma.
 */
function chiSquaredCDF(x: number, k: number): number {
  if (x <= 0) return 0;
  return regularizedIncompleteGamma(k / 2, x / 2);
}

/**
 * Regularized lower incomplete gamma function P(a, x).
 * Uses series expansion for small x, continued fraction for large x.
 */
function regularizedIncompleteGamma(a: number, x: number): number {
  if (x <= 0) return 0;
  if (x < a + 1) {
    // Series expansion
    let sum = 1 / a;
    let term = 1 / a;
    for (let n = 1; n < 200; n++) {
      term *= x / (a + n);
      sum += term;
      if (Math.abs(term) < 1e-14 * Math.abs(sum)) break;
    }
    return sum * Math.exp(-x + a * Math.log(x) - lnGamma(a));
  } else {
    // Continued fraction (Legendre)
    return 1 - regularizedUpperIncompleteGamma(a, x);
  }
}

function regularizedUpperIncompleteGamma(a: number, x: number): number {
  const eps = 1e-14;
  let f = x + 1 - a;
  if (Math.abs(f) < eps) f = eps;
  let c = 1 / eps;
  let d = 1 / f;
  let h = d;

  for (let i = 1; i < 200; i++) {
    const an = -i * (i - a);
    const bn = x + 2 * i + 1 - a;
    d = bn + an * d;
    if (Math.abs(d) < eps) d = eps;
    c = bn + an / c;
    if (Math.abs(c) < eps) c = eps;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < eps) break;
  }

  return Math.exp(-x + a * Math.log(x) - lnGamma(a)) * h;
}
