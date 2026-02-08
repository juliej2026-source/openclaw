/**
 * Simple text similarity and quality metrics for model evaluation.
 */

/** Compute word-level Jaccard similarity between two texts. */
export function jaccardSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\s+/).filter(Boolean));
  const wordsB = new Set(b.toLowerCase().split(/\s+/).filter(Boolean));
  if (wordsA.size === 0 && wordsB.size === 0) {
    return 1;
  }
  if (wordsA.size === 0 || wordsB.size === 0) {
    return 0;
  }

  let intersection = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) {
      intersection++;
    }
  }

  const union = wordsA.size + wordsB.size - intersection;
  return union > 0 ? intersection / union : 0;
}

/** Compute a basic fluency score based on sentence structure heuristics. */
export function fluencyScore(text: string): number {
  if (!text.trim()) {
    return 0;
  }

  let score = 0.5; // Baseline

  // Has proper sentence endings
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  if (sentences.length > 0) {
    score += 0.1;
  }

  // Reasonable average sentence length (10-30 words)
  const avgWords = text.split(/\s+/).length / Math.max(sentences.length, 1);
  if (avgWords >= 10 && avgWords <= 30) {
    score += 0.15;
  } else if (avgWords >= 5 && avgWords <= 50) {
    score += 0.05;
  }

  // Not too repetitive (unique word ratio)
  const words = text.toLowerCase().split(/\s+/).filter(Boolean);
  const uniqueRatio = words.length > 0 ? new Set(words).size / words.length : 0;
  if (uniqueRatio > 0.4) {
    score += 0.15;
  }

  // Has paragraph structure for longer text
  if (text.length > 200 && text.includes("\n")) {
    score += 0.1;
  }

  return Math.min(score, 1);
}

/** Score response accuracy by comparing to a reference (expected) response. */
export function accuracyScore(response: string, reference: string): number {
  // Combine similarity with length-appropriateness
  const similarity = jaccardSimilarity(response, reference);

  // Penalize if response is much shorter or longer than reference
  const lenRatio = response.length / Math.max(reference.length, 1);
  let lengthPenalty = 1;
  if (lenRatio < 0.3 || lenRatio > 3) {
    lengthPenalty = 0.5;
  } else if (lenRatio < 0.5 || lenRatio > 2) {
    lengthPenalty = 0.75;
  }

  return similarity * lengthPenalty;
}

/** Compute an overall quality score from individual metrics. */
export function overallScore(opts: {
  accuracy: number;
  fluency: number;
  taskScores?: Record<string, number>;
}): number {
  const taskAvg =
    opts.taskScores && Object.keys(opts.taskScores).length > 0
      ? Object.values(opts.taskScores).reduce((a, b) => a + b, 0) /
        Object.keys(opts.taskScores).length
      : null;

  if (taskAvg !== null) {
    // Weighted: accuracy 40%, fluency 20%, task-specific 40%
    return opts.accuracy * 0.4 + opts.fluency * 0.2 + taskAvg * 0.4;
  }

  // Without task scores: accuracy 60%, fluency 40%
  return opts.accuracy * 0.6 + opts.fluency * 0.4;
}
