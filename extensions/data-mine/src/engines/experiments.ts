// ---------------------------------------------------------------------------
// Experiment Engine — A/B testing, hypothesis tests, confidence intervals,
// effect size, power analysis
// ---------------------------------------------------------------------------

import * as ss from "simple-statistics";
import type {
  ExperimentConfig,
  ExperimentObservation,
  ExperimentResult,
  HypothesisTest,
  DescriptiveStats,
} from "../types.js";
import { descriptiveStats } from "./statistics.js";
import { lnGamma, regularizedIncompleteBeta } from "./statistics.js";

// ---- In-memory stores ----

const experiments = new Map<string, ExperimentConfig>();
const observations = new Map<string, ExperimentObservation[]>();

/**
 * Independent two-sample or paired t-test.
 */
export function tTest(
  groupA: number[],
  groupB: number[],
  options?: { paired?: boolean; alpha?: number },
): HypothesisTest {
  const alpha = options?.alpha ?? 0.05;

  if (options?.paired) {
    return pairedTTest(groupA, groupB, alpha);
  }

  const nA = groupA.length;
  const nB = groupB.length;

  if (nA < 2 || nB < 2) {
    return {
      testName: "independent t-test",
      statistic: 0,
      pValue: 1,
      degreesOfFreedom: 0,
      significant: false,
      confidenceLevel: 1 - alpha,
    };
  }

  const meanA = ss.mean(groupA);
  const meanB = ss.mean(groupB);
  const varA = ss.sampleVariance(groupA);
  const varB = ss.sampleVariance(groupB);

  // Pooled variance
  const sp2 = ((nA - 1) * varA + (nB - 1) * varB) / (nA + nB - 2);
  const se = Math.sqrt(sp2 * (1 / nA + 1 / nB));

  if (se === 0) {
    return {
      testName: "independent t-test",
      statistic: 0,
      pValue: meanA === meanB ? 1 : 0,
      degreesOfFreedom: nA + nB - 2,
      significant: meanA !== meanB,
      confidenceLevel: 1 - alpha,
    };
  }

  const t = (meanA - meanB) / se;
  const df = nA + nB - 2;
  const pValue = tDistPValue2Tailed(Math.abs(t), df);

  // Confidence interval for mean difference
  const tCritical = tDistQuantile(1 - alpha / 2, df);
  const ci: [number, number] = [meanA - meanB - tCritical * se, meanA - meanB + tCritical * se];

  return {
    testName: "independent t-test",
    statistic: t,
    pValue,
    degreesOfFreedom: df,
    significant: pValue < alpha,
    confidenceInterval: ci,
    confidenceLevel: 1 - alpha,
  };
}

function pairedTTest(groupA: number[], groupB: number[], alpha: number): HypothesisTest {
  const n = Math.min(groupA.length, groupB.length);
  if (n < 2) {
    return {
      testName: "paired t-test",
      statistic: 0,
      pValue: 1,
      degreesOfFreedom: 0,
      significant: false,
      confidenceLevel: 1 - alpha,
    };
  }

  const diffs = groupA.slice(0, n).map((a, i) => a - groupB[i]);
  const meanDiff = ss.mean(diffs);
  const sdDiff = ss.sampleStandardDeviation(diffs);
  const se = sdDiff / Math.sqrt(n);

  if (se === 0) {
    return {
      testName: "paired t-test",
      statistic: 0,
      pValue: meanDiff === 0 ? 1 : 0,
      degreesOfFreedom: n - 1,
      significant: meanDiff !== 0,
      confidenceLevel: 1 - alpha,
    };
  }

  const t = meanDiff / se;
  const df = n - 1;
  const pValue = tDistPValue2Tailed(Math.abs(t), df);

  return {
    testName: "paired t-test",
    statistic: t,
    pValue,
    degreesOfFreedom: df,
    significant: pValue < alpha,
    confidenceLevel: 1 - alpha,
  };
}

/**
 * Chi-squared goodness-of-fit test.
 */
export function chiSquaredTest(observed: number[], expected: number[]): HypothesisTest {
  if (observed.length !== expected.length || observed.length < 2) {
    return {
      testName: "chi-squared",
      statistic: 0,
      pValue: 1,
      degreesOfFreedom: 0,
      significant: false,
      confidenceLevel: 0.95,
    };
  }

  let chiSq = 0;
  for (let i = 0; i < observed.length; i++) {
    if (expected[i] === 0) continue;
    chiSq += (observed[i] - expected[i]) ** 2 / expected[i];
  }

  const df = observed.length - 1;
  const pValue = 1 - chiSquaredCDF(chiSq, df);

  return {
    testName: "chi-squared",
    statistic: chiSq,
    pValue,
    degreesOfFreedom: df,
    significant: pValue < 0.05,
    confidenceLevel: 0.95,
  };
}

/**
 * Mann-Whitney U test (non-parametric).
 */
export function mannWhitneyU(groupA: number[], groupB: number[]): HypothesisTest {
  const nA = groupA.length;
  const nB = groupB.length;

  if (nA < 2 || nB < 2) {
    return {
      testName: "Mann-Whitney U",
      statistic: 0,
      pValue: 1,
      significant: false,
      confidenceLevel: 0.95,
    };
  }

  // Rank all values
  const combined = [
    ...groupA.map((v) => ({ v, group: "A" })),
    ...groupB.map((v) => ({ v, group: "B" })),
  ];
  combined.sort((a, b) => a.v - b.v);

  // Assign ranks (handle ties)
  const ranks = new Array(combined.length);
  let i = 0;
  while (i < combined.length) {
    let j = i;
    while (j < combined.length && combined[j].v === combined[i].v) j++;
    const avgRank = (i + j + 1) / 2; // 1-indexed average rank
    for (let k = i; k < j; k++) ranks[k] = avgRank;
    i = j;
  }

  // Sum ranks for group A
  let rankSumA = 0;
  for (let idx = 0; idx < combined.length; idx++) {
    if (combined[idx].group === "A") rankSumA += ranks[idx];
  }

  const uA = rankSumA - (nA * (nA + 1)) / 2;
  const uB = nA * nB - uA;
  const u = Math.min(uA, uB);

  // Normal approximation for large samples
  const meanU = (nA * nB) / 2;
  const stdU = Math.sqrt((nA * nB * (nA + nB + 1)) / 12);

  if (stdU === 0) {
    return {
      testName: "Mann-Whitney U",
      statistic: u,
      pValue: 1,
      significant: false,
      confidenceLevel: 0.95,
    };
  }

  const z = (u - meanU) / stdU;
  // Two-tailed p-value from normal approximation
  const pValue = 2 * normalCDF(-Math.abs(z));

  return {
    testName: "Mann-Whitney U",
    statistic: u,
    pValue,
    significant: pValue < 0.05,
    confidenceLevel: 0.95,
  };
}

/**
 * Cohen's d effect size.
 */
export function effectSize(
  groupA: number[],
  groupB: number[],
): {
  cohensD: number;
  interpretation: "negligible" | "small" | "medium" | "large";
} {
  if (groupA.length < 2 || groupB.length < 2) {
    return { cohensD: 0, interpretation: "negligible" };
  }

  const meanA = ss.mean(groupA);
  const meanB = ss.mean(groupB);
  const varA = ss.sampleVariance(groupA);
  const varB = ss.sampleVariance(groupB);

  // Pooled standard deviation
  const pooledSD = Math.sqrt(
    ((groupA.length - 1) * varA + (groupB.length - 1) * varB) / (groupA.length + groupB.length - 2),
  );

  if (pooledSD === 0) {
    return { cohensD: 0, interpretation: "negligible" };
  }

  const d = Math.abs(meanA - meanB) / pooledSD;
  let interpretation: "negligible" | "small" | "medium" | "large";

  if (d < 0.2) interpretation = "negligible";
  else if (d < 0.5) interpretation = "small";
  else if (d < 0.8) interpretation = "medium";
  else interpretation = "large";

  return { cohensD: d, interpretation };
}

/**
 * Confidence interval for the mean.
 */
export function confidenceInterval(data: number[], level: number = 0.95): [number, number] {
  if (data.length < 2) {
    const v = data[0] ?? 0;
    return [v, v];
  }

  const mean = ss.mean(data);
  const se = ss.sampleStandardDeviation(data) / Math.sqrt(data.length);
  const df = data.length - 1;
  const tCritical = tDistQuantile(1 - (1 - level) / 2, df);

  return [mean - tCritical * se, mean + tCritical * se];
}

/**
 * Required sample size per group for desired power.
 */
export function sampleSizeCalculation(
  es: number,
  power: number = 0.8,
  alpha: number = 0.05,
): number {
  if (es <= 0) return Infinity;

  const zAlpha = normalQuantile(1 - alpha / 2);
  const zPower = normalQuantile(power);

  const n = Math.ceil(((zAlpha + zPower) ** 2 * 2) / (es * es));
  return n;
}

// ---- Experiment Lifecycle ----

/**
 * Create a new experiment.
 */
export function createExperiment(
  config: Omit<ExperimentConfig, "id" | "createdAt">,
): ExperimentConfig {
  const id = `exp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const experiment: ExperimentConfig = {
    ...config,
    id,
    createdAt: new Date().toISOString(),
  };
  experiments.set(id, experiment);
  observations.set(id, []);
  return experiment;
}

/**
 * Record an observation for an experiment.
 */
export function recordObservation(observation: ExperimentObservation): void {
  const obs = observations.get(observation.experimentId);
  if (!obs) {
    observations.set(observation.experimentId, [observation]);
  } else {
    obs.push(observation);
  }
}

/**
 * Evaluate an experiment by running statistical tests.
 */
export function evaluateExperiment(experimentId: string): ExperimentResult {
  const config = experiments.get(experimentId);
  if (!config) {
    return {
      experimentId,
      config: {
        id: experimentId,
        name: "Unknown",
        description: "",
        groups: [],
        metric: "",
        hypothesis: "",
        alpha: 0.05,
        minSampleSize: 30,
        createdAt: "",
      },
      groupStats: {},
      significant: false,
      recommendation: "Experiment not found",
    };
  }

  const obs = observations.get(experimentId) ?? [];

  // Group observations by group name
  const groupData: Record<string, number[]> = {};
  for (const o of obs) {
    if (!groupData[o.group]) groupData[o.group] = [];
    groupData[o.group].push(o.value);
  }

  // Compute group stats
  const groupStats: Record<string, DescriptiveStats> = {};
  for (const [group, values] of Object.entries(groupData)) {
    groupStats[group] = descriptiveStats(values);
  }

  // Run tests if we have exactly 2 groups
  const groups = Object.keys(groupData);
  let tTestResult: HypothesisTest | undefined;
  let mannWhitneyResult: HypothesisTest | undefined;
  let effectSizeResult: { cohensD: number; interpretation: string } | undefined;

  if (groups.length === 2) {
    const a = groupData[groups[0]];
    const b = groupData[groups[1]];

    tTestResult = tTest(a, b, { alpha: config.alpha });
    mannWhitneyResult = mannWhitneyU(a, b);
    effectSizeResult = effectSize(a, b);
  }

  const significant = tTestResult?.significant ?? false;

  // Generate recommendation
  let recommendation: string;
  const totalObs = obs.length;
  const perGroup = groups.map((g) => groupData[g]?.length ?? 0);
  const minPerGroup = Math.min(...perGroup, Infinity);

  if (groups.length < 2) {
    recommendation = "Need at least 2 groups to evaluate";
  } else if (minPerGroup < config.minSampleSize) {
    recommendation = `Collect more data. Minimum ${config.minSampleSize} per group required, have ${minPerGroup}`;
  } else if (significant) {
    recommendation = `Significant difference detected (p=${tTestResult!.pValue.toFixed(4)}). Effect size: ${effectSizeResult?.interpretation ?? "unknown"}`;
  } else {
    recommendation = `No significant difference detected (p=${tTestResult!.pValue.toFixed(4)}). Consider increasing sample size or adjusting hypothesis`;
  }

  return {
    experimentId,
    config,
    groupStats,
    tTest: tTestResult,
    mannWhitney: mannWhitneyResult,
    effectSize: effectSizeResult,
    significant,
    recommendation,
  };
}

/**
 * List all experiments.
 */
export function getExperiments(): ExperimentConfig[] {
  return [...experiments.values()];
}

/**
 * Get single experiment.
 */
export function getExperiment(experimentId: string): ExperimentConfig | undefined {
  return experiments.get(experimentId);
}

/**
 * Clear all experiments (for testing).
 */
export function clearExperiments(): void {
  experiments.clear();
  observations.clear();
}

// ---- Statistical Distribution Helpers ----

/**
 * Two-tailed p-value for t-distribution.
 */
function tDistPValue2Tailed(t: number, df: number): number {
  if (df <= 0) return 1;
  const x = df / (df + t * t);
  return regularizedIncompleteBeta(x, df / 2, 0.5);
}

/**
 * Approximate t-distribution quantile using normal approximation for large df.
 */
function tDistQuantile(p: number, df: number): number {
  // For df > 30, use normal approximation
  if (df > 30) return normalQuantile(p);

  // For smaller df, use approximation from Abramowitz & Stegun
  const z = normalQuantile(p);
  const g1 = (z * z * z + z) / 4;
  const g2 = (5 * z ** 5 + 16 * z ** 3 + 3 * z) / 96;
  const g3 = (3 * z ** 7 + 19 * z ** 5 + 17 * z ** 3 - 15 * z) / 384;

  return z + g1 / df + g2 / (df * df) + g3 / (df * df * df);
}

/**
 * Standard normal CDF approximation (Abramowitz & Stegun).
 */
function normalCDF(z: number): number {
  if (z < -8) return 0;
  if (z > 8) return 1;

  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.sqrt(2);
  const t = 1 / (1 + p * x);
  const y = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return 0.5 * (1 + sign * y);
}

/**
 * Standard normal quantile (inverse CDF) using rational approximation.
 */
function normalQuantile(p: number): number {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  if (p === 0.5) return 0;

  // Rational approximation (Peter Acklam's algorithm)
  const a = [
    -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2,
    -3.066479806614716e1, 2.506628277459239,
  ];
  const b = [
    -5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1,
    -1.328068155288572e1,
  ];
  const c = [
    -7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734,
    4.374664141464968, 2.938163982698783,
  ];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];

  const pLow = 0.02425;
  const pHigh = 1 - pLow;

  let q: number;
  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    );
  } else if (p <= pHigh) {
    q = p - 0.5;
    const r = q * q;
    return (
      ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
    );
  } else {
    q = Math.sqrt(-2 * Math.log(1 - p));
    return -(
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    );
  }
}

/**
 * Chi-squared CDF using regularized incomplete gamma.
 */
function chiSquaredCDF(x: number, k: number): number {
  if (x <= 0) return 0;
  return regularizedIncompleteGamma(k / 2, x / 2);
}

function regularizedIncompleteGamma(a: number, x: number): number {
  if (x <= 0) return 0;
  if (x < a + 1) {
    let sum = 1 / a;
    let term = 1 / a;
    for (let n = 1; n < 200; n++) {
      term *= x / (a + n);
      sum += term;
      if (Math.abs(term) < 1e-14 * Math.abs(sum)) break;
    }
    return sum * Math.exp(-x + a * Math.log(x) - lnGamma(a));
  } else {
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
