/** High-level task categories for routing. */
export type TaskType =
  | "coding"
  | "reasoning"
  | "creative"
  | "vision"
  | "chat"
  | "analysis"
  | "tool-use"
  | "math"
  | "summarization";

/** Result of classifying an incoming user prompt. */
export type TaskClassification = {
  /** Primary task type. */
  primary: TaskType;
  /** Optional secondary task types. */
  secondary: TaskType[];
  /** Classification confidence (0-1). */
  confidence: number;
  /** Estimated context tokens needed. */
  contextLengthEstimate: number;
  /** Whether the task requires image understanding. */
  requiresVision: boolean;
  /** Whether the task needs tool/function calling. */
  requiresToolUse: boolean;
  /** Estimated complexity. */
  complexity: "simple" | "moderate" | "complex";
};

/** Scored candidate model for a task. */
export type ModelScore = {
  modelId: string;
  score: number; // 0-100 composite
  breakdown: {
    capabilityMatch: number;
    performanceHistory: number;
    latencyScore: number;
    sizeEfficiency: number;
    contextFit: number;
  };
  fitsHardware: boolean;
  estimatedLatencyMs?: number;
};

/** Record of model performance on a specific task type. */
export type PerformanceRecord = {
  modelId: string;
  taskType: TaskType;
  success: boolean;
  durationMs: number;
  tokenInput?: number;
  tokenOutput?: number;
  timestamp: string;
  sessionKey?: string;
};

/** Final routing decision. */
export type RoutingDecision = {
  selectedModel: { provider: string; model: string };
  taskClassification: TaskClassification;
  topCandidates: ModelScore[];
  reason: string;
  fallbackChain: Array<{ provider: string; model: string }>;
};

/** Capability strength map for a model family. Values are 0-1. */
export type CapabilityStrengths = Partial<Record<TaskType, number>>;
