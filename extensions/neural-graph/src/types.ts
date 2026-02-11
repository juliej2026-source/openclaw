// ---------------------------------------------------------------------------
// Neural Graph — Shared Types
// ---------------------------------------------------------------------------

// Node types in the neural graph
export type NodeType =
  | "capability" // AI extension wrapper (meta-engine, model-manager, etc.)
  | "station" // Physical/logical station (iot-hub, julie, etc.)
  | "model" // Specific AI model instance
  | "synthetic"; // Dynamically created by evolution

export type NodeStatus = "active" | "degraded" | "dormant" | "pruned";

export type MaturationPhase =
  | "genesis" // Initial seeding, <100 executions
  | "differentiation" // Fitness scoring active, 100-499 executions
  | "synaptogenesis" // New edges forming, 500-999 executions
  | "pruning" // Underperformers removed, 1000+ executions
  | "myelination"; // High-traffic paths optimized, ongoing

// Edge types between nodes
export type EdgeType =
  | "data_flow" // Data passes from source to target
  | "dependency" // Target depends on source
  | "activation" // Source activates target
  | "fallback" // Target is fallback for source
  | "inhibition"; // Source inhibits target

// ---------------------------------------------------------------------------
// Graph Node
// ---------------------------------------------------------------------------

export type GraphNode = {
  _id?: string;
  nodeId: string;
  nodeType: NodeType;
  name: string;
  description: string;
  stationId: string;
  status: NodeStatus;
  fitnessScore: number; // 0–100
  maturationPhase: MaturationPhase;
  capabilities: string[];
  activationCount: number;
  totalLatencyMs: number;
  successCount: number;
  failureCount: number;
  lastActivated?: string; // ISO timestamp
  createdAt: string;
  metadata: Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// Graph Edge
// ---------------------------------------------------------------------------

export type GraphEdge = {
  _id?: string;
  edgeId: string;
  sourceNodeId: string;
  targetNodeId: string;
  edgeType: EdgeType;
  weight: number; // 0.0–1.0
  myelinated: boolean; // High-traffic optimized path
  activationCount: number;
  coActivationCount: number; // Times both endpoints activated in same execution
  avgLatencyMs: number;
  stationId: string;
  createdAt: string;
  metadata: Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// Evolution
// ---------------------------------------------------------------------------

export type EvolutionEventType =
  | "node_created"
  | "node_pruned"
  | "node_status_changed"
  | "edge_created"
  | "edge_pruned"
  | "edge_weight_changed"
  | "edge_myelinated"
  | "fitness_recalculated"
  | "phase_transition";

export type ApprovalStatus = "pending" | "approved" | "rejected" | "auto_approved";

export type EvolutionEvent = {
  _id?: string;
  eventType: EvolutionEventType;
  targetId: string;
  previousState: Record<string, unknown>;
  newState: Record<string, unknown>;
  reason: string;
  triggeredBy: string; // "system" | "evolution_cycle" | "human" | stationId
  requiresApproval: boolean;
  approvalStatus: ApprovalStatus;
  stationId: string;
  createdAt: string;
};

// ---------------------------------------------------------------------------
// Execution
// ---------------------------------------------------------------------------

export type ExecutionRecord = {
  _id?: string;
  threadId: string;
  taskType: string;
  taskDescription: string;
  nodesVisited: string[];
  edgesTraversed: string[];
  success: boolean;
  totalLatencyMs: number;
  nodeLatencies: Record<string, number>;
  stationId: string;
  createdAt: string;
};

// ---------------------------------------------------------------------------
// LangGraph State Channel Types
// ---------------------------------------------------------------------------

export type EvolutionProposal = {
  type: EvolutionEventType;
  targetId: string;
  reason: string;
  requiresApproval: boolean;
  proposedChanges: Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// API Types
// ---------------------------------------------------------------------------

export type NeuralQueryRequest = {
  task: string;
  taskType?: string;
  complexity?: string;
  stationId?: string;
};

export type NeuralTopologyResponse = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  phase: MaturationPhase;
  totalExecutions: number;
  stationId: string;
};

export type NeuralStatusResponse = {
  phase: MaturationPhase;
  totalNodes: number;
  totalEdges: number;
  totalExecutions: number;
  myelinatedEdges: number;
  avgFitness: number;
  stationId: string;
  convexConnected: boolean;
  lastEvolutionCycle?: string;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const CONVEX_URL = process.env.CONVEX_URL ?? "http://127.0.0.1:3210";

export const CORE_NODE_IDS = [
  "meta-engine",
  "model-manager",
  "model-trainer",
  "memory-lancedb",
  "iot-hub",
  "julie",
] as const;

export const FITNESS_WEIGHTS = {
  successRate: 40,
  latency: 30,
  utilization: 20,
  connectivity: 10,
} as const;

export const PHASE_THRESHOLDS = {
  differentiation: 100,
  synaptogenesis: 500,
  pruning: 1000,
} as const;

export const MYELINATION_THRESHOLD = {
  activationCount: 100,
  minWeight: 0.7,
} as const;

export const PRUNING_THRESHOLD = {
  minFitness: 30,
  inactivityDays: 7,
  minEdgeWeight: 0.1,
  minEdgeActivations: 5,
} as const;

export const EVOLUTION_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
