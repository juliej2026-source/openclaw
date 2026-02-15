import { Command } from "@langchain/langgraph";
import type { NeuralGraphStateType } from "./state.js";

// ---------------------------------------------------------------------------
// Meta-Orchestrator — the supervisor node
// Classifies tasks and routes to the appropriate capability node.
// Uses the same lazy-import pattern as hive-mind/command-dispatch.ts
// ---------------------------------------------------------------------------

async function getClassifyTask() {
  const mod = await import("../../../meta-engine/src/task-classifier.js");
  return mod.classifyTask;
}

// Route mapping: task type → graph node name
const TASK_ROUTES: Record<string, string> = {
  chat: "capability_meta_engine",
  code: "capability_meta_engine",
  coding: "capability_meta_engine",
  reasoning: "capability_meta_engine",
  analysis: "capability_meta_engine",
  creative: "capability_meta_engine",
  math: "capability_meta_engine",
  vision: "capability_meta_engine",
  summarization: "capability_meta_engine",
  "tool-use": "capability_meta_engine",
  model_management: "capability_model_manager",
  model_pull: "capability_model_manager",
  model_info: "capability_model_manager",
  training: "capability_model_trainer",
  fine_tune: "capability_model_trainer",
  evaluation: "capability_model_trainer",
  memory_search: "capability_memory",
  knowledge_retrieval: "capability_memory",
  network_scan: "network_ops",
  station_health: "network_ops",
  device_info: "network_ops",

  // Peer station routes — hotel/price intelligence → SCRAPER
  hotel_intel: "scraper_intel",
  hotel_scraping: "scraper_intel",
  price_monitoring: "scraper_intel",
  anomaly_detection: "scraper_intel",
  family_report: "scraper_intel",

  // Peer station routes — HuggingFace inference → CLERK
  peer_inference: "clerk_learning",
  hf_inference: "clerk_learning",
  hf_embed: "clerk_learning",

  // Peer station routes — social monitoring → SOCIAL-INTEL
  social_intel: "social_intel",
  social_monitoring: "social_intel",
  telegram: "social_intel",
  sentiment_analysis: "social_intel",
};

const DEFAULT_ROUTE = "capability_meta_engine";

export async function metaOrchestrator(state: NeuralGraphStateType): Promise<Command> {
  const start = Date.now();

  let taskType = state.taskType;
  let confidence = 0.5;

  // If taskType is unknown, try to classify via meta-engine
  if (taskType === "unknown" && state.taskDescription) {
    try {
      const classifyTask = await getClassifyTask();
      const classification = classifyTask(state.taskDescription);
      taskType = classification.taskType ?? "chat";
      confidence = classification.confidence ?? 0.7;
    } catch {
      taskType = "chat";
      confidence = 0.3;
    }
  } else {
    confidence = 0.9;
  }

  const route = TASK_ROUTES[taskType] ?? DEFAULT_ROUTE;
  const latency = Date.now() - start;

  return new Command({
    update: {
      taskType,
      selectedRoute: route,
      routingConfidence: confidence,
      nodesVisited: ["meta_orchestrator"],
      nodeLatencies: { meta_orchestrator: latency },
    },
    goto: route,
  });
}

// Conditional routing function for the StateGraph
export function routeFromOrchestrator(state: NeuralGraphStateType): string {
  return state.selectedRoute || DEFAULT_ROUTE;
}
