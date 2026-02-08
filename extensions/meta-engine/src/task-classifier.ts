import type { TaskClassification, TaskType } from "./types.js";

// ── Signal patterns for each task type ───────────────────────────────────

const SIGNALS: Record<TaskType, RegExp[]> = {
  coding: [
    /```\w+/,
    /\bfunction\s/,
    /\bclass\s/,
    /\bdef\s/,
    /\bimport\s/,
    /\bconst\s/,
    /\blet\s/,
    /\bvar\s/,
    /fix\s*(the\s+)?bug/i,
    /\bimplement\b/i,
    /\brefactor\b/i,
    /write\s+(a\s+|the\s+|some\s+)?code/i,
    /\bdebug\b/i,
    /\bcompile\b/i,
    /\bsyntax\b/i,
    /\bAPI\b/,
    /\bendpoint\b/i,
    /\bunit\s+test\b/i,
    /\btypescript\b/i,
    /\bpython\b/i,
    /\brust\b/i,
    /\bjavascript\b/i,
    /\bgolang\b/i,
  ],
  reasoning: [
    /explain\s+why/i,
    /\banalyze\b/i,
    /\bcompare\b.*\b(and|vs|versus)\b/i,
    /\bevaluate\b/i,
    /\bprove\b/i,
    /step[\s-]by[\s-]step/i,
    /\breason\b/i,
    /\bwhy\s+(does|do|is|are|did|would|should)\b/i,
    /think\s+through/i,
    /\btrade[\s-]?off/i,
    /pros\s+and\s+cons/i,
  ],
  vision: [
    /\bimage\b/i,
    /\bscreenshot\b/i,
    /\bphoto\b/i,
    /\bpicture\b/i,
    /look\s+at\s+(this|the)/i,
    /what\s+(is|do you see)\s+in\s+(this|the)/i,
    /\bdescribe\s+(this|the)\s+(image|photo|picture)/i,
    /\bocr\b/i,
  ],
  math: [
    /\bcalculate\b/i,
    /\bequation\b/i,
    /\bintegral\b/i,
    /\bderivative\b/i,
    /\bproof\b/i,
    /\btheorem\b/i,
    /\bsolve\b.*\b(for|equation)/i,
    /\bmatrix\b/i,
    /\bprobability\b/i,
    /\bstatistic/i,
  ],
  creative: [
    /\bwrite\s+(a\s+)?(story|poem|song|essay|blog|article)/i,
    /\bcreative\b/i,
    /\bimagine\b/i,
    /\bbrainstorm\b/i,
    /come\s+up\s+with/i,
    /\bgenerate\s+(a\s+)?(name|title|idea|slogan)/i,
  ],
  summarization: [
    /\bsummarize\b/i,
    /\bsummary\b/i,
    /\btl;?dr\b/i,
    /\bkey\s+points\b/i,
    /\bcondense\b/i,
    /\bbriefly\s+describe\b/i,
  ],
  analysis: [
    /\banalyze\b/i,
    /\bbreakdown\b/i,
    /\breview\b.*\b(code|pr|pull request)/i,
    /\baudit\b/i,
    /\binvestigate\b/i,
    /\bdiagnose\b/i,
    /\broot\s+cause\b/i,
  ],
  "tool-use": [
    /\bsearch\s+(the\s+)?(web|internet|google)/i,
    /\bfetch\b.*\burl\b/i,
    /\brun\b.*\bcommand\b/i,
    /\bexecute\b/i,
    /\binstall\b.*\bpackage/i,
    /\bdeploy\b/i,
  ],
  chat: [], // Fallback — always matches if nothing else does
};

// ── Complexity estimation ────────────────────────────────────────────────

function estimateComplexity(text: string): "simple" | "moderate" | "complex" {
  const words = text.split(/\s+/).length;
  const hasMultipleQuestions = (text.match(/\?/g) || []).length > 1;
  const hasCodeBlocks = /```/.test(text);
  const hasLongContext = words > 200;

  if (hasLongContext || (hasMultipleQuestions && hasCodeBlocks)) {
    return "complex";
  }
  if (words > 50 || hasCodeBlocks || hasMultipleQuestions) {
    return "moderate";
  }
  return "simple";
}

function estimateContextLength(text: string): number {
  // Rough token estimate: ~1.3 tokens per word for English text
  const words = text.split(/\s+/).length;
  return Math.ceil(words * 1.3);
}

// ── Main classifier ──────────────────────────────────────────────────────

/**
 * Classify a user prompt into task type(s) using pattern matching heuristics.
 *
 * This is "Tier 1" — fast, synchronous, no LLM needed. Covers ~80% of cases.
 * Returns a TaskClassification with confidence score.
 */
export function classifyTask(prompt: string): TaskClassification {
  const scores: Record<TaskType, number> = {
    coding: 0,
    reasoning: 0,
    creative: 0,
    vision: 0,
    chat: 0,
    analysis: 0,
    "tool-use": 0,
    math: 0,
    summarization: 0,
  };

  // Score each task type by counting pattern matches
  for (const [taskType, patterns] of Object.entries(SIGNALS) as [TaskType, RegExp[]][]) {
    for (const pattern of patterns) {
      if (pattern.test(prompt)) {
        scores[taskType] += 1;
      }
    }
  }

  // Find the top scoring types
  const entries = Object.entries(scores) as [TaskType, number][];
  entries.sort((a, b) => b[1] - a[1]);

  const topScore = entries[0]?.[1] ?? 0;
  const primary: TaskType = topScore > 0 ? entries[0][0] : "chat";

  // Secondary types are those with scores > 0 and within 50% of the top
  const secondary = entries
    .slice(1)
    .filter(([, s]) => s > 0 && s >= topScore * 0.5)
    .map(([t]) => t);

  // Confidence: higher when top score is clearly dominant
  const secondScore = entries[1]?.[1] ?? 0;
  let confidence: number;
  if (topScore === 0) {
    confidence = 0.3; // Default chat — low confidence
  } else if (topScore >= 3 && secondScore <= 1) {
    confidence = 0.95;
  } else if (topScore >= 2) {
    confidence = 0.8;
  } else {
    confidence = 0.6;
  }

  return {
    primary,
    secondary,
    confidence,
    contextLengthEstimate: estimateContextLength(prompt),
    requiresVision: scores.vision > 0,
    requiresToolUse: scores["tool-use"] > 0,
    complexity: estimateComplexity(prompt),
  };
}
