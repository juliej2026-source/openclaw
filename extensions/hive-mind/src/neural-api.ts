import type http from "node:http";

// ---------------------------------------------------------------------------
// Neural Graph API handlers — serves graph data to the portal
// Returns the static genesis graph when Convex is not available,
// delegates to neural-graph extension handlers when it is.
// ---------------------------------------------------------------------------

const GENESIS_NODES = [
  {
    nodeId: "meta-engine",
    nodeType: "capability",
    name: "Meta-Engine",
    status: "active",
    fitnessScore: 50,
    maturationPhase: "genesis",
    capabilities: ["task_classification", "model_scoring", "performance_tracking"],
    activationCount: 0,
  },
  {
    nodeId: "model-manager",
    nodeType: "capability",
    name: "Model Manager",
    status: "active",
    fitnessScore: 50,
    maturationPhase: "genesis",
    capabilities: ["model_management", "hardware_detection", "huggingface_search"],
    activationCount: 0,
  },
  {
    nodeId: "model-trainer",
    nodeType: "capability",
    name: "Model Trainer",
    status: "active",
    fitnessScore: 50,
    maturationPhase: "genesis",
    capabilities: ["model_training", "dataset_curation", "lora_adapters"],
    activationCount: 0,
  },
  {
    nodeId: "memory-lancedb",
    nodeType: "capability",
    name: "Memory (LanceDB)",
    status: "active",
    fitnessScore: 50,
    maturationPhase: "genesis",
    capabilities: ["memory_search", "knowledge_retrieval"],
    activationCount: 0,
  },
  {
    nodeId: "iot-hub",
    nodeType: "station",
    name: "IOT-HUB",
    status: "active",
    fitnessScore: 65,
    maturationPhase: "genesis",
    capabilities: ["iot", "smart_home", "sensors", "network_monitoring", "linux"],
    activationCount: 0,
  },
  {
    nodeId: "julie",
    nodeType: "station",
    name: "Julie",
    status: "active",
    fitnessScore: 55,
    maturationPhase: "genesis",
    capabilities: ["orchestration", "station_management"],
    activationCount: 0,
  },
  {
    nodeId: "scraper",
    nodeType: "station",
    name: "SCRAPER",
    status: "active",
    fitnessScore: 50,
    maturationPhase: "genesis",
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
    activationCount: 0,
  },
  {
    nodeId: "clerk",
    nodeType: "station",
    name: "CLERK",
    status: "active",
    fitnessScore: 50,
    maturationPhase: "genesis",
    capabilities: [
      "hf_inference",
      "embeddings",
      "summarization",
      "analysis",
      "reporting",
      "evolve_and_document",
      "tandem_tasks",
    ],
    activationCount: 0,
  },
  {
    nodeId: "social-intel",
    nodeType: "station",
    name: "SOCIAL-INTEL",
    status: "active",
    fitnessScore: 50,
    maturationPhase: "genesis",
    capabilities: [
      "social_monitoring",
      "telegram_integration",
      "social_analytics",
      "content_analysis",
      "sentiment_analysis",
    ],
    activationCount: 0,
  },
  {
    nodeId: "scraper_intel",
    nodeType: "capability",
    name: "Scraper Intelligence",
    status: "active",
    fitnessScore: 50,
    maturationPhase: "genesis",
    capabilities: ["hotel_scraping", "price_monitoring", "anomaly_detection", "family_report"],
    activationCount: 0,
  },
  {
    nodeId: "clerk_learning",
    nodeType: "capability",
    name: "Clerk Learning",
    status: "active",
    fitnessScore: 50,
    maturationPhase: "genesis",
    capabilities: ["hf_inference", "embeddings", "summarization", "peer_inference"],
    activationCount: 0,
  },
  {
    nodeId: "social_intel",
    nodeType: "capability",
    name: "Social Intelligence",
    status: "active",
    fitnessScore: 50,
    maturationPhase: "genesis",
    capabilities: ["social_monitoring", "telegram_integration", "sentiment_analysis"],
    activationCount: 0,
  },
];

const GENESIS_EDGES = [
  // Local capability data flows
  {
    edgeId: "meta-engine->model-manager",
    sourceNodeId: "meta-engine",
    targetNodeId: "model-manager",
    edgeType: "data_flow",
    weight: 0.5,
    myelinated: false,
    activationCount: 0,
  },
  {
    edgeId: "meta-engine->model-trainer",
    sourceNodeId: "meta-engine",
    targetNodeId: "model-trainer",
    edgeType: "data_flow",
    weight: 0.5,
    myelinated: false,
    activationCount: 0,
  },
  {
    edgeId: "meta-engine->memory-lancedb",
    sourceNodeId: "meta-engine",
    targetNodeId: "memory-lancedb",
    edgeType: "data_flow",
    weight: 0.5,
    myelinated: false,
    activationCount: 0,
  },
  {
    edgeId: "model-manager->model-trainer",
    sourceNodeId: "model-manager",
    targetNodeId: "model-trainer",
    edgeType: "dependency",
    weight: 0.5,
    myelinated: false,
    activationCount: 0,
  },
  // IOT-HUB activates local capabilities
  {
    edgeId: "iot-hub->meta-engine",
    sourceNodeId: "iot-hub",
    targetNodeId: "meta-engine",
    edgeType: "activation",
    weight: 0.5,
    myelinated: false,
    activationCount: 0,
  },
  {
    edgeId: "iot-hub->model-manager",
    sourceNodeId: "iot-hub",
    targetNodeId: "model-manager",
    edgeType: "activation",
    weight: 0.5,
    myelinated: false,
    activationCount: 0,
  },
  {
    edgeId: "iot-hub->model-trainer",
    sourceNodeId: "iot-hub",
    targetNodeId: "model-trainer",
    edgeType: "activation",
    weight: 0.5,
    myelinated: false,
    activationCount: 0,
  },
  {
    edgeId: "iot-hub->memory-lancedb",
    sourceNodeId: "iot-hub",
    targetNodeId: "memory-lancedb",
    edgeType: "activation",
    weight: 0.5,
    myelinated: false,
    activationCount: 0,
  },
  // Julie orchestrates all stations
  {
    edgeId: "julie->iot-hub",
    sourceNodeId: "julie",
    targetNodeId: "iot-hub",
    edgeType: "activation",
    weight: 0.5,
    myelinated: false,
    activationCount: 0,
  },
  {
    edgeId: "julie->meta-engine",
    sourceNodeId: "julie",
    targetNodeId: "meta-engine",
    edgeType: "data_flow",
    weight: 0.5,
    myelinated: false,
    activationCount: 0,
  },
  {
    edgeId: "julie->scraper",
    sourceNodeId: "julie",
    targetNodeId: "scraper",
    edgeType: "activation",
    weight: 0.5,
    myelinated: false,
    activationCount: 0,
  },
  {
    edgeId: "julie->clerk",
    sourceNodeId: "julie",
    targetNodeId: "clerk",
    edgeType: "activation",
    weight: 0.5,
    myelinated: false,
    activationCount: 0,
  },
  {
    edgeId: "julie->social-intel",
    sourceNodeId: "julie",
    targetNodeId: "social-intel",
    edgeType: "activation",
    weight: 0.5,
    myelinated: false,
    activationCount: 0,
  },
  // IOT-HUB tandem connections to peer stations
  {
    edgeId: "iot-hub->scraper",
    sourceNodeId: "iot-hub",
    targetNodeId: "scraper",
    edgeType: "data_flow",
    weight: 0.5,
    myelinated: false,
    activationCount: 0,
  },
  {
    edgeId: "iot-hub->clerk",
    sourceNodeId: "iot-hub",
    targetNodeId: "clerk",
    edgeType: "data_flow",
    weight: 0.5,
    myelinated: false,
    activationCount: 0,
  },
  // Station → capability node activations
  {
    edgeId: "scraper->scraper_intel",
    sourceNodeId: "scraper",
    targetNodeId: "scraper_intel",
    edgeType: "activation",
    weight: 0.5,
    myelinated: false,
    activationCount: 0,
  },
  {
    edgeId: "clerk->clerk_learning",
    sourceNodeId: "clerk",
    targetNodeId: "clerk_learning",
    edgeType: "activation",
    weight: 0.5,
    myelinated: false,
    activationCount: 0,
  },
  {
    edgeId: "social-intel->social_intel",
    sourceNodeId: "social-intel",
    targetNodeId: "social_intel",
    edgeType: "activation",
    weight: 0.5,
    myelinated: false,
    activationCount: 0,
  },
  // Meta-engine routes to peer capability nodes
  {
    edgeId: "meta-engine->scraper_intel",
    sourceNodeId: "meta-engine",
    targetNodeId: "scraper_intel",
    edgeType: "data_flow",
    weight: 0.5,
    myelinated: false,
    activationCount: 0,
  },
  {
    edgeId: "meta-engine->clerk_learning",
    sourceNodeId: "meta-engine",
    targetNodeId: "clerk_learning",
    edgeType: "data_flow",
    weight: 0.5,
    myelinated: false,
    activationCount: 0,
  },
  {
    edgeId: "meta-engine->social_intel",
    sourceNodeId: "meta-engine",
    targetNodeId: "social_intel",
    edgeType: "data_flow",
    weight: 0.5,
    myelinated: false,
    activationCount: 0,
  },
  // Peer tandem data flows (SCRAPER ↔ CLERK)
  {
    edgeId: "scraper->clerk",
    sourceNodeId: "scraper",
    targetNodeId: "clerk",
    edgeType: "data_flow",
    weight: 0.5,
    myelinated: false,
    activationCount: 0,
  },
];

function json(res: http.ServerResponse, data: unknown, status = 200): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

export async function handleNeuralStatus(
  _req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  // Try Convex-backed handler first
  try {
    const mod = await import("../../neural-graph/src/api-handlers.js");
    const data = await mod.handleNeuralStatus("iot-hub");
    json(res, data);
    return;
  } catch {
    // Convex not available — return genesis state
  }

  json(res, {
    phase: "genesis",
    totalNodes: GENESIS_NODES.length,
    totalEdges: GENESIS_EDGES.length,
    totalExecutions: 0,
    myelinatedEdges: 0,
    avgFitness: 50,
    stationId: "iot-hub",
    convexConnected: false,
  });
}

export async function handleNeuralTopology(
  _req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  try {
    const mod = await import("../../neural-graph/src/api-handlers.js");
    const data = await mod.handleNeuralTopology("iot-hub");
    json(res, data);
    return;
  } catch {
    // Convex not available — return genesis topology
  }

  json(res, {
    nodes: GENESIS_NODES,
    edges: GENESIS_EDGES,
    phase: "genesis",
    totalExecutions: 0,
    stationId: "iot-hub",
  });
}

export async function handleNeuralEvents(
  _req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  try {
    const mod = await import("../../neural-graph/src/api-handlers.js");
    const data = await mod.handleNeuralEvents("iot-hub");
    json(res, data);
    return;
  } catch {
    // Convex not available
  }

  json(res, []);
}

export async function handleNeuralPending(
  _req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  try {
    const mod = await import("../../neural-graph/src/api-handlers.js");
    const data = await mod.handleNeuralPending();
    json(res, data);
    return;
  } catch {
    // Convex not available
  }

  json(res, []);
}
