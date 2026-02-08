/** A single training conversation pair. */
export type TrainingPair = {
  system?: string;
  conversations: Array<{ role: "user" | "assistant"; content: string }>;
  source: {
    sessionId: string;
    agentId?: string;
    timestamp: string;
  };
  /** Estimated quality (0-1). */
  quality?: number;
  /** Task type tag (from meta-engine classification). */
  taskType?: string;
};

/** A collected training dataset. */
export type TrainingDataset = {
  id: string;
  name: string;
  pairCount: number;
  format: "sharegpt" | "alpaca" | "chatml";
  createdAt: string;
  baseModel?: string;
  filePath: string;
};

/** Training method. */
export type TrainingMethod = "ollama-modelfile" | "unsloth-qlora";

/** Hyperparameters for fine-tuning. */
export type TrainingHyperparams = {
  epochs?: number;
  batchSize?: number;
  learningRate?: number;
  loraRank?: number;
  loraAlpha?: number;
  maxSeqLength?: number;
  warmupSteps?: number;
  gradientAccumulationSteps?: number;
};

/** Configuration for a training job. */
export type TrainingJobConfig = {
  baseModel: string;
  datasetId: string;
  method: TrainingMethod;
  outputName: string;
  hyperparams?: TrainingHyperparams;
};

/** Training job status. */
export type TrainingJobStatus =
  | "queued"
  | "preparing"
  | "training"
  | "merging"
  | "completed"
  | "failed"
  | "cancelled";

/** Training progress info. */
export type TrainingProgress = {
  currentEpoch: number;
  totalEpochs: number;
  currentStep: number;
  totalSteps: number;
  loss?: number;
  learningRate?: number;
};

/** A training job. */
export type TrainingJob = {
  id: string;
  config: TrainingJobConfig;
  status: TrainingJobStatus;
  progress?: TrainingProgress;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  outputPath?: string;
  logPath?: string;
};

/** A stored LoRA adapter. */
export type LoraAdapter = {
  id: string;
  name: string;
  baseModel: string;
  datasetId: string;
  trainingJobId: string;
  path: string;
  sizeBytes: number;
  createdAt: string;
  evalScore?: number;
  metadata?: Record<string, unknown>;
};

/** Model evaluation result. */
export type EvalResult = {
  modelId: string;
  adapterId?: string;
  testCases: number;
  scores: {
    overall: number;
    accuracy?: number;
    fluency?: number;
    taskSpecific?: Record<string, number>;
  };
  comparisonToBase?: {
    baseScore: number;
    improvement: number;
  };
  timestamp: string;
};
