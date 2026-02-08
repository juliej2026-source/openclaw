import type { TrainingHyperparams } from "../types.js";

/**
 * Pre-built QLoRA hyperparameter configs for common model families and VRAM tiers.
 *
 * Tuned for consumer GPUs:
 * - 8GB VRAM  (RTX 3060/4060, etc.) → batch 2, smaller ranks
 * - 16GB VRAM (RTX 3080/4080, etc.) → batch 4, standard ranks
 * - 24GB+ VRAM (RTX 3090/4090, A5000, etc.) → batch 8, higher ranks
 */

export type VramTier = "8gb" | "16gb" | "24gb";

export type ConfigTemplate = {
  name: string;
  description: string;
  family: string;
  vramTier: VramTier;
  hyperparams: Required<TrainingHyperparams>;
};

const BASE_8GB: Required<TrainingHyperparams> = {
  epochs: 3,
  batchSize: 2,
  learningRate: 2e-4,
  loraRank: 16,
  loraAlpha: 32,
  maxSeqLength: 2048,
  warmupSteps: 10,
  gradientAccumulationSteps: 4,
};

const BASE_16GB: Required<TrainingHyperparams> = {
  epochs: 3,
  batchSize: 4,
  learningRate: 2e-4,
  loraRank: 32,
  loraAlpha: 64,
  maxSeqLength: 4096,
  warmupSteps: 10,
  gradientAccumulationSteps: 4,
};

const BASE_24GB: Required<TrainingHyperparams> = {
  epochs: 3,
  batchSize: 8,
  learningRate: 1e-4,
  loraRank: 64,
  loraAlpha: 128,
  maxSeqLength: 8192,
  warmupSteps: 20,
  gradientAccumulationSteps: 2,
};

/** All available config templates. */
export const CONFIG_TEMPLATES: ConfigTemplate[] = [
  // ── Llama family ────────────────────────────────────────────────────
  {
    name: "llama-7b-8gb",
    description: "Llama 3/3.1/3.3 7B on 8GB VRAM",
    family: "llama",
    vramTier: "8gb",
    hyperparams: { ...BASE_8GB },
  },
  {
    name: "llama-7b-16gb",
    description: "Llama 3/3.1/3.3 7B on 16GB VRAM",
    family: "llama",
    vramTier: "16gb",
    hyperparams: { ...BASE_16GB },
  },
  {
    name: "llama-13b-24gb",
    description: "Llama 13B+ on 24GB+ VRAM",
    family: "llama",
    vramTier: "24gb",
    hyperparams: { ...BASE_24GB },
  },

  // ── Qwen family ────────────────────────────────────────────────────
  {
    name: "qwen-7b-8gb",
    description: "Qwen 2.5/3 7B on 8GB VRAM",
    family: "qwen",
    vramTier: "8gb",
    hyperparams: { ...BASE_8GB, maxSeqLength: 4096 },
  },
  {
    name: "qwen-7b-16gb",
    description: "Qwen 2.5/3 7B on 16GB VRAM",
    family: "qwen",
    vramTier: "16gb",
    hyperparams: { ...BASE_16GB },
  },
  {
    name: "qwen-14b-24gb",
    description: "Qwen 14B+ on 24GB+ VRAM",
    family: "qwen",
    vramTier: "24gb",
    hyperparams: { ...BASE_24GB },
  },

  // ── Mistral family ─────────────────────────────────────────────────
  {
    name: "mistral-7b-8gb",
    description: "Mistral/Mixtral 7B on 8GB VRAM",
    family: "mistral",
    vramTier: "8gb",
    hyperparams: { ...BASE_8GB },
  },
  {
    name: "mistral-7b-16gb",
    description: "Mistral/Mixtral 7B on 16GB VRAM",
    family: "mistral",
    vramTier: "16gb",
    hyperparams: { ...BASE_16GB },
  },

  // ── Gemma family ───────────────────────────────────────────────────
  {
    name: "gemma-7b-8gb",
    description: "Gemma 2/3 7B on 8GB VRAM",
    family: "gemma",
    vramTier: "8gb",
    hyperparams: { ...BASE_8GB, maxSeqLength: 2048 },
  },
  {
    name: "gemma-7b-16gb",
    description: "Gemma 2/3 7B on 16GB VRAM",
    family: "gemma",
    vramTier: "16gb",
    hyperparams: { ...BASE_16GB, maxSeqLength: 4096 },
  },

  // ── Phi family ─────────────────────────────────────────────────────
  {
    name: "phi-3b-8gb",
    description: "Phi 3/4 3B on 8GB VRAM (fast training)",
    family: "phi",
    vramTier: "8gb",
    hyperparams: { ...BASE_8GB, batchSize: 4, maxSeqLength: 4096 },
  },

  // ── DeepSeek family ────────────────────────────────────────────────
  {
    name: "deepseek-7b-16gb",
    description: "DeepSeek Coder 7B on 16GB VRAM",
    family: "deepseek",
    vramTier: "16gb",
    hyperparams: { ...BASE_16GB, learningRate: 1e-4 },
  },
  {
    name: "deepseek-7b-24gb",
    description: "DeepSeek Coder 7B on 24GB+ VRAM",
    family: "deepseek",
    vramTier: "24gb",
    hyperparams: { ...BASE_24GB },
  },

  // ── CodeLlama family ───────────────────────────────────────────────
  {
    name: "codellama-7b-8gb",
    description: "CodeLlama 7B on 8GB VRAM",
    family: "codellama",
    vramTier: "8gb",
    hyperparams: { ...BASE_8GB, maxSeqLength: 4096 },
  },
  {
    name: "codellama-13b-24gb",
    description: "CodeLlama 13B on 24GB+ VRAM",
    family: "codellama",
    vramTier: "24gb",
    hyperparams: { ...BASE_24GB },
  },
];

/**
 * Find the best matching config template for a model and available VRAM.
 *
 * Matches by model family (extracted from model name) and VRAM tier.
 * Falls back to the generic 8GB config if no match is found.
 */
export function findTemplate(modelName: string, availableVramGb?: number): ConfigTemplate {
  const lowerName = modelName.toLowerCase();

  // Determine family from model name
  const families = ["codellama", "deepseek", "llama", "qwen", "mistral", "gemma", "phi"];
  const family = families.find((f) => lowerName.includes(f)) ?? "llama";

  // Determine VRAM tier
  let tier: VramTier = "8gb";
  if (availableVramGb !== undefined) {
    if (availableVramGb >= 24) {
      tier = "24gb";
    } else if (availableVramGb >= 16) {
      tier = "16gb";
    }
  }

  // Find exact match
  const exact = CONFIG_TEMPLATES.find((t) => t.family === family && t.vramTier === tier);
  if (exact) {
    return exact;
  }

  // Fall back to same family, closest lower tier
  const sameFamilyLower = CONFIG_TEMPLATES.filter(
    (t) => t.family === family && tierToGb(t.vramTier) <= tierToGb(tier),
  ).toSorted((a, b) => tierToGb(b.vramTier) - tierToGb(a.vramTier));

  if (sameFamilyLower.length > 0) {
    return sameFamilyLower[0] as ConfigTemplate;
  }

  // Absolute fallback: generic Llama 8GB config
  return CONFIG_TEMPLATES[0];
}

function tierToGb(tier: VramTier): number {
  const map: Record<VramTier, number> = { "8gb": 8, "16gb": 16, "24gb": 24 };
  return map[tier];
}

/** List all available template names. */
export function listTemplateNames(): string[] {
  return CONFIG_TEMPLATES.map((t) => t.name);
}
