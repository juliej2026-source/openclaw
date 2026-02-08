import type { RoutingDecision } from "./types.js";
import { scoreModels, type HardwareConstraints, type ScoringCandidate } from "./model-scorer.js";
import { PerformanceDb } from "./performance-db.js";
import { classifyTask } from "./task-classifier.js";

export type RouterOptions = {
  /** Available local models with metadata. */
  candidates: ScoringCandidate[];
  /** Hardware constraints (VRAM, RAM). */
  constraints?: HardwareConstraints;
  /** Performance database instance. */
  perfDb: PerformanceDb;
  /** Provider name for local models (default: "local-models"). */
  provider?: string;
};

/**
 * Route a user prompt to the best available local model.
 *
 * 1. Classify the prompt into task type(s).
 * 2. Score all candidate models.
 * 3. Select the top-scoring model that fits hardware constraints.
 * 4. Build a fallback chain from remaining candidates.
 */
export function routePrompt(prompt: string, opts: RouterOptions): RoutingDecision | null {
  const { candidates, constraints, perfDb } = opts;
  const provider = opts.provider ?? "local-models";

  if (candidates.length === 0) {
    return null;
  }

  // Step 1: Classify the task
  const classification = classifyTask(prompt);

  // Step 2: Score candidates
  const scored = scoreModels(candidates, classification, perfDb, constraints);

  // Step 3: Select the top candidate that fits hardware
  const viable = scored.filter((s) => s.fitsHardware);
  if (viable.length === 0) {
    // No model fits hardware — fall back to smallest model
    const smallest = scored[scored.length - 1];
    if (!smallest) {
      return null;
    }
    return {
      selectedModel: { provider, model: smallest.modelId },
      taskClassification: classification,
      topCandidates: scored.slice(0, 5),
      reason: `No model fits hardware constraints. Using smallest available: ${smallest.modelId} (score: ${smallest.score})`,
      fallbackChain: [],
    };
  }

  const selected = viable[0];

  // Step 4: Build fallback chain from remaining viable candidates
  const fallbackChain = viable.slice(1, 4).map((s) => ({ provider, model: s.modelId }));

  const reason = buildReason(selected, classification);

  return {
    selectedModel: { provider, model: selected.modelId },
    taskClassification: classification,
    topCandidates: scored.slice(0, 5),
    reason,
    fallbackChain,
  };
}

function buildReason(
  selected: ReturnType<typeof scoreModels>[0],
  classification: ReturnType<typeof classifyTask>,
): string {
  const parts: string[] = [];
  parts.push(
    `Task: ${classification.primary} (${classification.complexity}, confidence: ${classification.confidence.toFixed(2)})`,
  );
  parts.push(`Model: ${selected.modelId} (score: ${selected.score})`);

  const bd = selected.breakdown;
  const topFactor =
    bd.capabilityMatch >= bd.performanceHistory ? "capability match" : "performance history";
  parts.push(`Top factor: ${topFactor}`);

  return parts.join(". ");
}
