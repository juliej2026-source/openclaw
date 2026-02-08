import type { ModelScore, TaskClassification } from "./types.js";
import { getStrengthForTask } from "./capability-map.js";
import { PerformanceDb } from "./performance-db.js";

/** Minimal model info needed for scoring (from model-manager inventory). */
export type ScoringCandidate = {
  id: string;
  family?: string;
  parameterCount?: string;
  contextWindow: number;
  capabilities: string[];
  vramRequired?: number;
};

/** Hardware constraints for filtering. */
export type HardwareConstraints = {
  availableVramBytes?: number;
  availableRamBytes?: number;
};

// ── Scoring weights ──────────────────────────────────────────────────────

const WEIGHTS = {
  capabilityMatch: 0.35,
  performanceHistory: 0.3,
  sizeEfficiency: 0.15,
  contextFit: 0.1,
  latencyScore: 0.1,
};

// ── Helper functions ─────────────────────────────────────────────────────

/** Parse parameter count string (e.g. "14.8B") to a number. */
function parseParamBillions(paramCount?: string): number {
  if (!paramCount) {
    return 7; // Default guess
  }
  const match = paramCount.match(/([\d.]+)/);
  return match ? Number(match[1]) : 7;
}

/** Score how well model capabilities match the task (0-100). */
function scoreCapabilityMatch(candidate: ScoringCandidate, task: TaskClassification): number {
  const family = candidate.family ?? "";

  // Primary task strength
  const primaryStrength = getStrengthForTask(family, task.primary);

  // Check if model has required capabilities
  if (task.requiresVision && !candidate.capabilities.includes("vision")) {
    return 0; // Hard fail: can't do vision
  }

  // Bonus for secondary task type coverage
  let secondaryBonus = 0;
  if (task.secondary.length > 0) {
    const secondaryScores = task.secondary.map((t) => getStrengthForTask(family, t));
    secondaryBonus = (secondaryScores.reduce((s, v) => s + v, 0) / secondaryScores.length) * 20;
  }

  return Math.min(100, primaryStrength * 80 + secondaryBonus);
}

/** Score based on performance history (0-100). Default 50 if no data. */
function scorePerformanceHistory(
  candidate: ScoringCandidate,
  task: TaskClassification,
  perfDb: PerformanceDb,
): number {
  const successRate = perfDb.getSuccessRate(candidate.id, task.primary);
  if (successRate == null) {
    return 50; // No data, neutral score
  }
  return successRate * 100;
}

/** Score size efficiency (0-100). Smaller models get higher scores for simple tasks. */
function scoreSizeEfficiency(candidate: ScoringCandidate, task: TaskClassification): number {
  const params = parseParamBillions(candidate.parameterCount);

  // For simple tasks, prefer smaller models (faster, less resources)
  if (task.complexity === "simple") {
    if (params <= 3) {
      return 100;
    }
    if (params <= 7) {
      return 85;
    }
    if (params <= 14) {
      return 60;
    }
    return 40;
  }

  // For moderate tasks, mid-range models are ideal
  if (task.complexity === "moderate") {
    if (params <= 3) {
      return 50;
    }
    if (params <= 14) {
      return 90;
    }
    if (params <= 34) {
      return 80;
    }
    return 70;
  }

  // For complex tasks, bigger is generally better
  if (params <= 7) {
    return 40;
  }
  if (params <= 14) {
    return 65;
  }
  if (params <= 34) {
    return 85;
  }
  return 100;
}

/** Score context window fit (0-100). */
function scoreContextFit(candidate: ScoringCandidate, task: TaskClassification): number {
  const needed = task.contextLengthEstimate * 2; // 2x for safety margin
  if (candidate.contextWindow >= needed) {
    return 100;
  }
  if (candidate.contextWindow >= needed * 0.5) {
    return 60;
  }
  return 20;
}

/** Score latency (0-100). Based on historical data or estimated from size. */
function scoreLatency(
  candidate: ScoringCandidate,
  task: TaskClassification,
  perfDb: PerformanceDb,
): number {
  const avgLatency = perfDb.getAverageLatency(candidate.id, task.primary);
  if (avgLatency != null) {
    // Good: <5s, OK: <15s, Slow: <30s, Bad: >30s
    if (avgLatency < 5000) {
      return 100;
    }
    if (avgLatency < 15000) {
      return 75;
    }
    if (avgLatency < 30000) {
      return 50;
    }
    return 25;
  }

  // Estimate from model size
  const params = parseParamBillions(candidate.parameterCount);
  if (params <= 3) {
    return 90;
  }
  if (params <= 7) {
    return 75;
  }
  if (params <= 14) {
    return 60;
  }
  return 40;
}

// ── Main scoring function ────────────────────────────────────────────────

/**
 * Score a list of candidate models against a task classification.
 * Returns models sorted by score (highest first).
 */
export function scoreModels(
  candidates: ScoringCandidate[],
  task: TaskClassification,
  perfDb: PerformanceDb,
  constraints?: HardwareConstraints,
): ModelScore[] {
  const scored: ModelScore[] = candidates.map((candidate) => {
    const capabilityMatch = scoreCapabilityMatch(candidate, task);
    const performanceHistory = scorePerformanceHistory(candidate, task, perfDb);
    const sizeEfficiency = scoreSizeEfficiency(candidate, task);
    const contextFit = scoreContextFit(candidate, task);
    const latencyScore = scoreLatency(candidate, task, perfDb);

    const score =
      capabilityMatch * WEIGHTS.capabilityMatch +
      performanceHistory * WEIGHTS.performanceHistory +
      sizeEfficiency * WEIGHTS.sizeEfficiency +
      contextFit * WEIGHTS.contextFit +
      latencyScore * WEIGHTS.latencyScore;

    // Check hardware constraints
    let fitsHardware = true;
    if (constraints?.availableVramBytes && candidate.vramRequired) {
      fitsHardware = candidate.vramRequired <= constraints.availableVramBytes;
    }

    return {
      modelId: candidate.id,
      score: Math.round(score * 10) / 10,
      breakdown: {
        capabilityMatch: Math.round(capabilityMatch),
        performanceHistory: Math.round(performanceHistory),
        latencyScore: Math.round(latencyScore),
        sizeEfficiency: Math.round(sizeEfficiency),
        contextFit: Math.round(contextFit),
      },
      fitsHardware,
      estimatedLatencyMs: perfDb.getAverageLatency(candidate.id, task.primary),
    };
  });

  // Sort by: hardware fit first, then score
  scored.sort((a, b) => {
    if (a.fitsHardware !== b.fitsHardware) {
      return a.fitsHardware ? -1 : 1;
    }
    return b.score - a.score;
  });

  return scored;
}
