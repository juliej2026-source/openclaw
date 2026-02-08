import type { ModelSearchResult } from "./types.js";
import { inferCapabilities } from "./discovery.js";

const HF_API_BASE = "https://huggingface.co/api";
const DEFAULT_TIMEOUT_MS = 15_000;

type HfModelResult = {
  _id: string;
  id: string;
  modelId: string;
  author?: string;
  tags?: string[];
  downloads?: number;
  library_name?: string;
  pipeline_tag?: string;
  siblings?: Array<{ rfilename: string; size?: number }>;
};

/**
 * Search HuggingFace Hub for GGUF models.
 *
 * Filters for models that have at least one .gguf file in their repository,
 * since those are the ones usable with llama.cpp / Ollama.
 */
export async function searchHuggingFaceModels(
  query: string,
  opts?: { limit?: number; timeoutMs?: number },
): Promise<ModelSearchResult[]> {
  const limit = opts?.limit ?? 20;
  const timeout = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const params = new URLSearchParams({
    search: query,
    filter: "gguf",
    sort: "downloads",
    direction: "-1",
    limit: String(limit),
  });

  const res = await fetch(`${HF_API_BASE}/models?${params}`, {
    signal: AbortSignal.timeout(timeout),
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    throw new Error(`HuggingFace search failed: ${res.status} ${res.statusText}`);
  }

  const models = (await res.json()) as HfModelResult[];

  return models.map((m) => {
    // Find GGUF files and extract quantization info
    const ggufFiles = (m.siblings ?? []).filter((s) => s.rfilename.endsWith(".gguf"));
    const quantizations = ggufFiles
      .map((f) => {
        const match = f.rfilename.match(/(Q\d[_A-Z0-9]*|F16|F32)/i);
        return match ? match[1].toUpperCase() : null;
      })
      .filter((q): q is string => q !== null);

    const totalSize = ggufFiles.reduce((sum, f) => sum + (f.size ?? 0), 0);

    return {
      id: `hf:${m.id}`,
      source: "huggingface" as const,
      name: m.modelId ?? m.id,
      description: m.pipeline_tag ?? undefined,
      sizeBytes: totalSize || undefined,
      quantizations: [...new Set(quantizations)],
      downloads: m.downloads,
      capabilities: inferCapabilities(m.id),
    };
  });
}

/**
 * Get file listing for a HuggingFace model, filtered to GGUF files.
 * Returns download URLs and metadata.
 */
export async function listHuggingFaceGgufFiles(
  repoId: string,
  opts?: { timeoutMs?: number },
): Promise<Array<{ filename: string; size: number; downloadUrl: string }>> {
  const timeout = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const res = await fetch(`${HF_API_BASE}/models/${repoId}`, {
    signal: AbortSignal.timeout(timeout),
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    throw new Error(`HuggingFace model info failed: ${res.status} ${res.statusText}`);
  }

  const model = (await res.json()) as HfModelResult;
  const ggufFiles = (model.siblings ?? []).filter((s) => s.rfilename.endsWith(".gguf"));

  return ggufFiles.map((f) => ({
    filename: f.rfilename,
    size: f.size ?? 0,
    downloadUrl: `https://huggingface.co/${repoId}/resolve/main/${f.rfilename}`,
  }));
}
