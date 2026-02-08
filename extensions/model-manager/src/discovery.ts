import type { LocalModel, ModelCapability, OllamaModelTag } from "./types.js";
import { OllamaClient } from "./ollama-client.js";

/**
 * Infer model capabilities from name and family heuristics.
 *
 * This is a best-effort mapping: model names follow loose conventions,
 * so we match common patterns. Falls back to ["chat"] for unknown models.
 */
export function inferCapabilities(name: string, family?: string): ModelCapability[] {
  const lower = name.toLowerCase();
  const fam = (family ?? "").toLowerCase();
  const caps = new Set<ModelCapability>();

  // Code-focused models
  if (
    lower.includes("code") ||
    lower.includes("coder") ||
    lower.includes("codex") ||
    lower.includes("starcoder") ||
    lower.includes("deepseek-coder") ||
    lower.includes("codestral") ||
    fam === "codellama" ||
    fam === "starcoder" ||
    fam === "codegemma"
  ) {
    caps.add("code");
    caps.add("tool-use");
  }

  // Vision / multimodal models
  if (
    lower.includes("vision") ||
    lower.includes("-vl") ||
    lower.includes("vl:") ||
    lower.includes("llava") ||
    lower.includes("bakllava") ||
    lower.includes("moondream") ||
    lower.includes("minicpm-v")
  ) {
    caps.add("vision");
  }

  // Reasoning models
  if (
    lower.includes("r1") ||
    lower.includes("reasoning") ||
    lower.includes("think") ||
    lower.includes("qwq") ||
    lower.includes("deepseek-r1")
  ) {
    caps.add("reasoning");
  }

  // Embedding models
  if (
    lower.includes("embed") ||
    lower.includes("bge-") ||
    lower.includes("nomic-embed") ||
    lower.includes("mxbai-embed") ||
    lower.includes("all-minilm")
  ) {
    caps.add("embedding");
  }

  // Creative / instruct / chat (broad fallback)
  if (caps.size === 0) {
    caps.add("chat");
  } else {
    // Most non-embedding models also do chat
    if (!caps.has("embedding")) {
      caps.add("chat");
    }
  }

  return [...caps];
}

/** Parse parameter count string (e.g. "7.6B" -> "7.6B") or extract from name. */
function extractParamCount(details: OllamaModelTag["details"], name: string): string | undefined {
  if (details.parameter_size) {
    return details.parameter_size;
  }
  // Try to extract from model name: "llama3:8b", "qwen3:14b"
  const match = name.match(/(\d+(?:\.\d+)?)[bB]/);
  return match ? `${match[1]}B` : undefined;
}

/** Estimate default context window. Most modern models support 128K. */
function estimateContextWindow(family: string, _paramCount?: string): number {
  const fam = family.toLowerCase();
  // Smaller/older models tend to have smaller context
  if (fam === "phi" || fam === "gemma") {
    return 8192;
  }
  if (fam === "llama" || fam === "codellama") {
    return 131_072;
  }
  // Default for modern models
  return 131_072;
}

/** Convert an Ollama tag to our LocalModel format. */
export function ollamaTagToLocalModel(tag: OllamaModelTag): LocalModel {
  const family = tag.details.family;
  const paramCount = extractParamCount(tag.details, tag.name);
  const capabilities = inferCapabilities(tag.name, family);

  return {
    id: tag.name,
    name: tag.name,
    runtime: "ollama",
    ollamaTag: tag.name,
    sizeBytes: tag.size,
    quantization: tag.details.quantization_level || undefined,
    parameterCount: paramCount,
    family: family || undefined,
    capabilities,
    contextWindow: estimateContextWindow(family, paramCount),
    maxTokens: 8192,
    installedAt: tag.modified_at,
    usageCount: 0,
  };
}

/**
 * Discover all local models from Ollama and convert to LocalModel entries.
 * Preserves usage stats from existing inventory entries.
 */
export async function discoverLocalModels(
  existingModels?: LocalModel[],
  ollamaOpts?: { baseUrl?: string },
): Promise<LocalModel[]> {
  const client = new OllamaClient(ollamaOpts);
  const available = await client.isAvailable();
  if (!available) {
    return [];
  }

  const tags = await client.listModels();
  const existingMap = new Map((existingModels ?? []).map((m) => [m.id, m]));

  return tags.map((tag) => {
    const model = ollamaTagToLocalModel(tag);
    // Preserve usage stats from existing inventory
    const existing = existingMap.get(model.id);
    if (existing) {
      model.usageCount = existing.usageCount;
      model.lastUsed = existing.lastUsed;
    }
    return model;
  });
}
