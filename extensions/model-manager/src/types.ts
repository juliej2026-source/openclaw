/** Capability categories a local model can serve. */
export type ModelCapability =
  | "code"
  | "reasoning"
  | "vision"
  | "chat"
  | "creative"
  | "embedding"
  | "tool-use";

/** Runtime backend used to serve the model. */
export type ModelRuntime = "ollama" | "llamacpp";

/** A locally installed model with enriched metadata. */
export type LocalModel = {
  /** Unique model identifier (e.g. "qwen3:14b" or "hf:TheBloke/CodeLlama-13B-GGUF:Q4_K_M"). */
  id: string;
  /** Human-readable display name. */
  name: string;
  /** Which runtime manages this model. */
  runtime: ModelRuntime;
  /** Absolute path to the GGUF file (llama.cpp models). */
  filePath?: string;
  /** Ollama tag (e.g. "qwen3:14b"). */
  ollamaTag?: string;
  /** Model size on disk in bytes. */
  sizeBytes: number;
  /** Quantization level (e.g. "Q4_K_M", "Q8_0", "F16"). */
  quantization?: string;
  /** Approximate parameter count (e.g. "7B", "14B", "70B"). */
  parameterCount?: string;
  /** Model family (e.g. "llama", "qwen", "mistral", "gemma", "phi"). */
  family?: string;
  /** Inferred capabilities. */
  capabilities: ModelCapability[];
  /** Context window size in tokens. */
  contextWindow: number;
  /** Maximum output tokens. */
  maxTokens: number;
  /** Estimated VRAM required in bytes. */
  vramRequired?: number;
  /** ISO timestamp of installation. */
  installedAt: string;
  /** ISO timestamp of last use. */
  lastUsed?: string;
  /** Number of times this model has been used. */
  usageCount: number;
  /** Extra provider metadata (Ollama show output, GGUF headers, etc.). */
  metadata?: Record<string, unknown>;
};

/** GPU descriptor. */
export type GpuInfo = {
  name: string;
  vramBytes: number;
  driver?: string;
  cudaVersion?: string;
  utilizationPercent?: number;
};

/** Hardware profile of the host machine. */
export type HardwareInfo = {
  gpus: GpuInfo[];
  totalRamBytes: number;
  availableRamBytes: number;
  cpuCores: number;
  platform: string;
  arch: string;
  ollamaAvailable: boolean;
  ollamaVersion?: string;
};

/** Result from searching a model registry (Ollama library or HuggingFace). */
export type ModelSearchResult = {
  id: string;
  source: "ollama" | "huggingface";
  name: string;
  description?: string;
  sizeBytes?: number;
  quantizations?: string[];
  downloads?: number;
  capabilities: ModelCapability[];
};

/** Ollama model tag as returned by GET /api/tags. */
export type OllamaModelTag = {
  name: string;
  model: string;
  modified_at: string;
  size: number;
  digest: string;
  details: {
    parent_model?: string;
    format: string;
    family: string;
    families?: string[];
    parameter_size: string;
    quantization_level: string;
  };
};

/** Pull progress event streamed from POST /api/pull. */
export type OllamaPullProgress = {
  status: string;
  digest?: string;
  total?: number;
  completed?: number;
};

/** Ollama model show info from POST /api/show. */
export type OllamaModelInfo = {
  modelfile: string;
  parameters: string;
  template: string;
  details: {
    parent_model?: string;
    format: string;
    family: string;
    families?: string[];
    parameter_size: string;
    quantization_level: string;
  };
  model_info?: Record<string, unknown>;
};

/** Running model from GET /api/ps. */
export type OllamaRunningModel = {
  name: string;
  model: string;
  size: number;
  digest: string;
  expires_at: string;
  size_vram: number;
};
