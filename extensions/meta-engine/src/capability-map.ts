import type { CapabilityStrengths } from "./types.js";

/**
 * Static mapping of model families to capability strength scores (0-1).
 *
 * These are heuristic ratings based on known model family specializations.
 * Values represent relative strength compared to a general-purpose model.
 * Missing entries default to 0.5 (average).
 */
export const FAMILY_CAPABILITIES: Record<string, CapabilityStrengths> = {
  // ── Code-focused families ───────────────────────────────────────────
  codellama: {
    coding: 0.9,
    reasoning: 0.5,
    chat: 0.4,
    creative: 0.3,
    math: 0.5,
    analysis: 0.6,
    "tool-use": 0.7,
    summarization: 0.4,
  },
  codegemma: {
    coding: 0.85,
    reasoning: 0.5,
    chat: 0.4,
    creative: 0.3,
    math: 0.5,
    analysis: 0.6,
    "tool-use": 0.7,
    summarization: 0.4,
  },
  starcoder: {
    coding: 0.85,
    reasoning: 0.4,
    chat: 0.3,
    creative: 0.2,
    math: 0.4,
    analysis: 0.5,
    "tool-use": 0.6,
    summarization: 0.3,
  },
  deepseek: {
    coding: 0.85,
    reasoning: 0.8,
    chat: 0.7,
    creative: 0.5,
    math: 0.8,
    analysis: 0.8,
    "tool-use": 0.7,
    summarization: 0.6,
  },

  // ── General-purpose families ────────────────────────────────────────
  llama: {
    coding: 0.7,
    reasoning: 0.75,
    chat: 0.85,
    creative: 0.7,
    math: 0.6,
    analysis: 0.7,
    "tool-use": 0.65,
    summarization: 0.75,
  },
  qwen: {
    coding: 0.8,
    reasoning: 0.8,
    chat: 0.85,
    creative: 0.7,
    math: 0.75,
    analysis: 0.8,
    "tool-use": 0.75,
    summarization: 0.75,
  },
  qwen2: {
    coding: 0.8,
    reasoning: 0.8,
    chat: 0.85,
    creative: 0.7,
    math: 0.75,
    analysis: 0.8,
    "tool-use": 0.75,
    summarization: 0.75,
  },
  mistral: {
    coding: 0.7,
    reasoning: 0.75,
    chat: 0.8,
    creative: 0.7,
    math: 0.65,
    analysis: 0.7,
    "tool-use": 0.7,
    summarization: 0.75,
  },
  gemma: {
    coding: 0.65,
    reasoning: 0.65,
    chat: 0.75,
    creative: 0.65,
    math: 0.6,
    analysis: 0.65,
    "tool-use": 0.55,
    summarization: 0.7,
  },
  phi: {
    coding: 0.7,
    reasoning: 0.7,
    chat: 0.7,
    creative: 0.55,
    math: 0.7,
    analysis: 0.65,
    "tool-use": 0.6,
    summarization: 0.65,
  },
  command: {
    // Cohere Command
    coding: 0.5,
    reasoning: 0.7,
    chat: 0.8,
    creative: 0.7,
    math: 0.5,
    analysis: 0.7,
    "tool-use": 0.6,
    summarization: 0.8,
  },

  // ── Reasoning specialists ───────────────────────────────────────────
  qwq: {
    coding: 0.75,
    reasoning: 0.95,
    chat: 0.6,
    creative: 0.5,
    math: 0.9,
    analysis: 0.9,
    "tool-use": 0.6,
    summarization: 0.6,
  },

  // ── Vision families ─────────────────────────────────────────────────
  llava: {
    coding: 0.3,
    reasoning: 0.5,
    chat: 0.65,
    creative: 0.5,
    vision: 0.9,
    analysis: 0.6,
    summarization: 0.5,
  },
};

/** Default capability strengths for unknown model families. */
const DEFAULT_STRENGTHS: CapabilityStrengths = {
  coding: 0.5,
  reasoning: 0.5,
  chat: 0.6,
  creative: 0.5,
  math: 0.4,
  analysis: 0.5,
  "tool-use": 0.5,
  summarization: 0.5,
};

/**
 * Look up the capability strengths for a model family.
 * Falls back to DEFAULT_STRENGTHS for unknown families.
 */
export function getCapabilityStrengths(family: string): CapabilityStrengths {
  const lower = family.toLowerCase();
  return FAMILY_CAPABILITIES[lower] ?? DEFAULT_STRENGTHS;
}

/**
 * Get the strength score for a specific task type from a model family.
 * Returns 0.5 (average) if not specified.
 */
export function getStrengthForTask(family: string, taskType: string): number {
  const strengths = getCapabilityStrengths(family);
  return strengths[taskType as keyof CapabilityStrengths] ?? 0.5;
}
