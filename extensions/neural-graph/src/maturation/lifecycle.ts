import type { MaturationPhase, GraphNode, GraphEdge } from "../types.js";
import { api } from "../../convex/_generated/api.js";
import { getConvexClient } from "../persistence/convex-client.js";
import { PHASE_THRESHOLDS, CORE_NODE_IDS, MYELINATION_THRESHOLD } from "../types.js";
import { calculateNodeFitness, calculateGlobalStats } from "./fitness.js";

// ---------------------------------------------------------------------------
// Maturation lifecycle management
// Phase transitions based on total execution count
// ---------------------------------------------------------------------------

export function determinePhase(totalExecutions: number): MaturationPhase {
  if (totalExecutions >= PHASE_THRESHOLDS.pruning) return "pruning";
  if (totalExecutions >= PHASE_THRESHOLDS.synaptogenesis) return "synaptogenesis";
  if (totalExecutions >= PHASE_THRESHOLDS.differentiation) return "differentiation";
  return "genesis";
}

// ---------------------------------------------------------------------------
// Genesis — seed the graph with known nodes and initial edges
// ---------------------------------------------------------------------------

type GenesisNode = {
  nodeId: string;
  nodeType: "capability" | "station";
  name: string;
  description: string;
  capabilities: string[];
};

const GENESIS_NODES: GenesisNode[] = [
  {
    nodeId: "meta-engine",
    nodeType: "capability",
    name: "Meta-Engine",
    description: "Task classification, model scoring, performance tracking, autonomous routing",
    capabilities: ["task_classification", "model_scoring", "performance_tracking"],
  },
  {
    nodeId: "model-manager",
    nodeType: "capability",
    name: "Model Manager",
    description: "Hardware detection, model discovery, lifecycle management, HuggingFace search",
    capabilities: ["model_management", "hardware_detection", "huggingface_search"],
  },
  {
    nodeId: "model-trainer",
    nodeType: "capability",
    name: "Model Trainer",
    description:
      "Dataset collection, training (Ollama Modelfile + QLoRA), adapter management, evaluation",
    capabilities: ["model_training", "dataset_curation", "lora_adapters", "model_evaluation"],
  },
  {
    nodeId: "memory-lancedb",
    nodeType: "capability",
    name: "Memory (LanceDB)",
    description: "Vector-based memory storage and semantic search",
    capabilities: ["memory_search", "knowledge_retrieval"],
  },
  {
    nodeId: "iot-hub",
    nodeType: "station",
    name: "IOT-HUB Station",
    description: "Primary compute station — runs gateway, AI extensions, monitoring",
    capabilities: ["iot", "smart_home", "sensors", "network_monitoring", "linux"],
  },
  {
    nodeId: "julie",
    nodeType: "station",
    name: "Julie Orchestrator",
    description: "Central hive mind orchestrator — coordinates station network",
    capabilities: ["orchestration", "station_management"],
  },
  {
    nodeId: "scraper",
    nodeType: "station",
    name: "SCRAPER Station",
    description:
      "Intelligence node — hotel price scraping, anomaly detection, family reports, local LLM (qwen2.5:7b)",
    capabilities: [
      "niseko_intel",
      "price_monitoring",
      "hotel_scraping",
      "anomaly_detection",
      "local_llm",
      "family_report",
      "tandem_tasks",
      "web_scraping",
    ],
  },
  {
    nodeId: "clerk",
    nodeType: "station",
    name: "CLERK Station",
    description:
      "Learning node — HuggingFace inference (Mistral-7B), embeddings, summarization, analysis, evolve-and-document",
    capabilities: [
      "hf_inference",
      "embeddings",
      "summarization",
      "analysis",
      "reporting",
      "evolve_and_document",
      "tandem_tasks",
    ],
  },
  {
    nodeId: "social-intel",
    nodeType: "station",
    name: "SOCIAL-INTEL Station",
    description:
      "Social intelligence node — co-hosted on Julie, Telegram integration, sentiment analysis, content monitoring",
    capabilities: [
      "social_monitoring",
      "telegram_integration",
      "social_analytics",
      "content_analysis",
      "sentiment_analysis",
    ],
  },
  // Peer capability nodes — aggregated routing targets
  {
    nodeId: "scraper_intel",
    nodeType: "capability",
    name: "Scraper Intelligence",
    description:
      "Routes hotel pricing, anomaly detection, and family report tasks to SCRAPER station via peer network",
    capabilities: ["hotel_scraping", "price_monitoring", "anomaly_detection", "family_report"],
  },
  {
    nodeId: "clerk_learning",
    nodeType: "capability",
    name: "Clerk Learning",
    description:
      "Routes HuggingFace inference, embeddings, and summarization tasks to CLERK station via peer network",
    capabilities: ["hf_inference", "embeddings", "summarization", "peer_inference"],
  },
  {
    nodeId: "social_intel",
    nodeType: "capability",
    name: "Social Intelligence",
    description:
      "Routes social monitoring, Telegram, and sentiment tasks to SOCIAL-INTEL station via peer network",
    capabilities: ["social_monitoring", "telegram_integration", "sentiment_analysis"],
  },
];

type GenesisEdge = {
  sourceNodeId: string;
  targetNodeId: string;
  edgeType: "data_flow" | "dependency" | "activation";
};

const GENESIS_EDGES: GenesisEdge[] = [
  // Local capability data flows
  { sourceNodeId: "meta-engine", targetNodeId: "model-manager", edgeType: "data_flow" },
  { sourceNodeId: "meta-engine", targetNodeId: "model-trainer", edgeType: "data_flow" },
  { sourceNodeId: "meta-engine", targetNodeId: "memory-lancedb", edgeType: "data_flow" },
  { sourceNodeId: "model-manager", targetNodeId: "model-trainer", edgeType: "dependency" },

  // IOT-HUB activates local capabilities
  { sourceNodeId: "iot-hub", targetNodeId: "meta-engine", edgeType: "activation" },
  { sourceNodeId: "iot-hub", targetNodeId: "model-manager", edgeType: "activation" },
  { sourceNodeId: "iot-hub", targetNodeId: "model-trainer", edgeType: "activation" },
  { sourceNodeId: "iot-hub", targetNodeId: "memory-lancedb", edgeType: "activation" },

  // Julie orchestrates all stations
  { sourceNodeId: "julie", targetNodeId: "iot-hub", edgeType: "activation" },
  { sourceNodeId: "julie", targetNodeId: "meta-engine", edgeType: "data_flow" },
  { sourceNodeId: "julie", targetNodeId: "scraper", edgeType: "activation" },
  { sourceNodeId: "julie", targetNodeId: "clerk", edgeType: "activation" },
  { sourceNodeId: "julie", targetNodeId: "social-intel", edgeType: "activation" },

  // IOT-HUB tandem connections to peer stations
  { sourceNodeId: "iot-hub", targetNodeId: "scraper", edgeType: "data_flow" },
  { sourceNodeId: "iot-hub", targetNodeId: "clerk", edgeType: "data_flow" },

  // Station → capability node activations
  { sourceNodeId: "scraper", targetNodeId: "scraper_intel", edgeType: "activation" },
  { sourceNodeId: "clerk", targetNodeId: "clerk_learning", edgeType: "activation" },
  { sourceNodeId: "social-intel", targetNodeId: "social_intel", edgeType: "activation" },

  // Meta-engine routes to peer capability nodes
  { sourceNodeId: "meta-engine", targetNodeId: "scraper_intel", edgeType: "data_flow" },
  { sourceNodeId: "meta-engine", targetNodeId: "clerk_learning", edgeType: "data_flow" },
  { sourceNodeId: "meta-engine", targetNodeId: "social_intel", edgeType: "data_flow" },

  // Peer tandem data flows (SCRAPER ↔ CLERK)
  { sourceNodeId: "scraper", targetNodeId: "clerk", edgeType: "data_flow" },
];

export async function seedGenesis(stationId: string): Promise<{
  nodesCreated: number;
  edgesCreated: number;
}> {
  const client = getConvexClient();
  const now = new Date().toISOString();
  let nodesCreated = 0;
  let edgesCreated = 0;

  // Seed nodes
  for (const gn of GENESIS_NODES) {
    await client.mutation(api.graph_nodes.create, {
      nodeId: gn.nodeId,
      nodeType: gn.nodeType,
      name: gn.name,
      description: gn.description,
      stationId,
      status: "active",
      fitnessScore: 50, // Neutral starting fitness
      maturationPhase: "genesis",
      capabilities: gn.capabilities,
      activationCount: 0,
      totalLatencyMs: 0,
      successCount: 0,
      failureCount: 0,
      createdAt: now,
      metadata: {},
    });
    nodesCreated++;
  }

  // Seed edges
  for (const ge of GENESIS_EDGES) {
    const edgeId = `${ge.sourceNodeId}->${ge.targetNodeId}`;
    await client.mutation(api.graph_edges.create, {
      edgeId,
      sourceNodeId: ge.sourceNodeId,
      targetNodeId: ge.targetNodeId,
      edgeType: ge.edgeType,
      weight: 0.5, // Neutral starting weight
      myelinated: false,
      activationCount: 0,
      coActivationCount: 0,
      avgLatencyMs: 0,
      stationId,
      createdAt: now,
      metadata: {},
    });
    edgesCreated++;
  }

  return { nodesCreated, edgesCreated };
}

// ---------------------------------------------------------------------------
// Evolution cycle — called periodically (every 15 minutes)
// ---------------------------------------------------------------------------

export async function runEvolutionCycle(stationId: string): Promise<{
  phase: MaturationPhase;
  totalExecutions: number;
  nodesUpdated: number;
  edgesUpdated: number;
  phaseTransition: boolean;
}> {
  const client = getConvexClient();

  // Get current state
  const [nodes, edges, executionCount] = await Promise.all([
    client.query(api.graph_nodes.list, { stationId }),
    client.query(api.graph_edges.list, { stationId }),
    client.query(api.execution_records.count, { stationId }),
  ]);

  // Determine phase
  const newPhase = determinePhase(executionCount);
  const currentPhases = nodes.map((n) => n.maturationPhase);
  const prevPhase = currentPhases[0] ?? "genesis";
  const phaseTransition = prevPhase !== newPhase;

  // Calculate global stats for fitness scoring
  const globalStats = calculateGlobalStats(nodes as GraphNode[]);

  // Update fitness scores for all nodes
  let nodesUpdated = 0;
  for (const node of nodes) {
    const fitness = calculateNodeFitness(node as GraphNode, edges as GraphEdge[], globalStats);
    if (fitness !== node.fitnessScore || node.maturationPhase !== newPhase) {
      await client.mutation(api.graph_nodes.updateFitness, {
        nodeId: node.nodeId,
        fitnessScore: fitness,
        maturationPhase: newPhase,
      });
      nodesUpdated++;
    }
  }

  // Myelinate edges that meet the threshold
  let edgesUpdated = 0;
  for (const edge of edges) {
    if (
      !edge.myelinated &&
      edge.activationCount >= MYELINATION_THRESHOLD.activationCount &&
      edge.weight >= MYELINATION_THRESHOLD.minWeight
    ) {
      await client.mutation(api.graph_edges.myelinate, { edgeId: edge.edgeId });
      edgesUpdated++;
    }
  }

  // Record phase transition event
  if (phaseTransition) {
    await client.mutation(api.evolution.record, {
      eventType: "phase_transition",
      targetId: stationId,
      previousState: { phase: prevPhase },
      newState: { phase: newPhase },
      reason: `${executionCount} total executions reached ${newPhase} threshold`,
      triggeredBy: "evolution_cycle",
      requiresApproval: false,
      approvalStatus: "auto_approved",
      stationId,
      createdAt: new Date().toISOString(),
    });
  }

  return {
    phase: newPhase,
    totalExecutions: executionCount,
    nodesUpdated,
    edgesUpdated,
    phaseTransition,
  };
}
