import type { NeuralGraphStateType } from "./state.js";

// ---------------------------------------------------------------------------
// Capability nodes — wrappers around existing OpenClaw extensions
// Each node records its activation for the fitness/evolution system.
// ---------------------------------------------------------------------------

// Lazy imports (same pattern as hive-mind/command-dispatch.ts)
async function getClassifyTask() {
  const mod = await import("../../../meta-engine/src/task-classifier.js");
  return mod.classifyTask;
}

async function getScoreModels() {
  const mod = await import("../../../meta-engine/src/model-scorer.js");
  return mod.scoreModels;
}

async function getRoutePrompt() {
  const mod = await import("../../../meta-engine/src/router.js");
  return mod.routePrompt;
}

async function getOllamaClient() {
  const mod = await import("../../../model-manager/src/ollama-client.js");
  return mod.OllamaClient;
}

async function getDetectHardware() {
  const mod = await import("../../../model-manager/src/hardware.js");
  return mod.detectHardware;
}

async function getCreateJob() {
  const mod = await import("../../../model-trainer/src/training/job-manager.js");
  return mod.createJob;
}

async function getListJobs() {
  const mod = await import("../../../model-trainer/src/training/job-manager.js");
  return mod.listJobs;
}

// ---------------------------------------------------------------------------
// Meta-Engine capability node
// ---------------------------------------------------------------------------

export async function capabilityMetaEngine(
  state: NeuralGraphStateType,
): Promise<Partial<NeuralGraphStateType>> {
  const start = Date.now();
  const nodeId = "capability_meta_engine";

  try {
    const classifyTask = await getClassifyTask();
    const classification = classifyTask(state.taskDescription);

    // Try model recommendation if we have a task
    let recommendation = null;
    try {
      const routePrompt = await getRoutePrompt();
      recommendation = routePrompt(state.taskDescription, {
        candidates: [],
        perfDb: null,
      });
    } catch {
      // Optional — scoring may not be available
    }

    return {
      nodesVisited: [nodeId],
      nodeLatencies: { [nodeId]: Date.now() - start },
      result: { classification, recommendation },
      success: true,
    };
  } catch (err) {
    return {
      nodesVisited: [nodeId],
      nodeLatencies: { [nodeId]: Date.now() - start },
      error: err instanceof Error ? err.message : String(err),
      success: false,
    };
  }
}

// ---------------------------------------------------------------------------
// Model Manager capability node
// ---------------------------------------------------------------------------

export async function capabilityModelManager(
  state: NeuralGraphStateType,
): Promise<Partial<NeuralGraphStateType>> {
  const start = Date.now();
  const nodeId = "capability_model_manager";

  try {
    const OllamaClient = await getOllamaClient();
    const client = new OllamaClient();

    const [installed, running, hardware] = await Promise.all([
      client.listModels().catch(() => []),
      client.listRunning().catch(() => []),
      getDetectHardware()
        .then((fn) => fn())
        .catch(() => null),
    ]);

    return {
      nodesVisited: [nodeId],
      nodeLatencies: { [nodeId]: Date.now() - start },
      result: {
        installed,
        running,
        hardware,
        installed_count: installed.length,
        running_count: running.length,
      },
      success: true,
    };
  } catch (err) {
    return {
      nodesVisited: [nodeId],
      nodeLatencies: { [nodeId]: Date.now() - start },
      error: err instanceof Error ? err.message : String(err),
      success: false,
    };
  }
}

// ---------------------------------------------------------------------------
// Model Trainer capability node
// ---------------------------------------------------------------------------

export async function capabilityModelTrainer(
  state: NeuralGraphStateType,
): Promise<Partial<NeuralGraphStateType>> {
  const start = Date.now();
  const nodeId = "capability_model_trainer";

  try {
    const listJobs = await getListJobs();
    const jobs = listJobs();

    return {
      nodesVisited: [nodeId],
      nodeLatencies: { [nodeId]: Date.now() - start },
      result: { jobs, job_count: jobs.length },
      success: true,
    };
  } catch (err) {
    return {
      nodesVisited: [nodeId],
      nodeLatencies: { [nodeId]: Date.now() - start },
      error: err instanceof Error ? err.message : String(err),
      success: false,
    };
  }
}

// ---------------------------------------------------------------------------
// Memory (LanceDB) capability node
// ---------------------------------------------------------------------------

export async function capabilityMemory(
  state: NeuralGraphStateType,
): Promise<Partial<NeuralGraphStateType>> {
  const start = Date.now();
  const nodeId = "capability_memory";

  try {
    // memory-lancedb may not be available — graceful fallback
    const mod = await import("../../../memory-lancedb/src/search.js").catch(() => null);

    if (!mod) {
      return {
        nodesVisited: [nodeId],
        nodeLatencies: { [nodeId]: Date.now() - start },
        result: { available: false, reason: "memory-lancedb not installed" },
        success: true,
      };
    }

    const results = await mod.search(state.taskDescription, { limit: 5 });

    return {
      nodesVisited: [nodeId],
      nodeLatencies: { [nodeId]: Date.now() - start },
      result: { available: true, results, count: results.length },
      success: true,
    };
  } catch (err) {
    return {
      nodesVisited: [nodeId],
      nodeLatencies: { [nodeId]: Date.now() - start },
      error: err instanceof Error ? err.message : String(err),
      success: false,
    };
  }
}
