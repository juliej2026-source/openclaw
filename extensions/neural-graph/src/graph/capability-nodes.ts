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
// Scraper Intelligence capability node — routes to SCRAPER station
// ---------------------------------------------------------------------------

async function getPeerClient() {
  const mod = await import("../../../hive-mind/src/peer-client.js");
  return new mod.PeerClient();
}

export async function capabilityScraperIntel(
  state: NeuralGraphStateType,
): Promise<Partial<NeuralGraphStateType>> {
  const start = Date.now();
  const nodeId = "scraper_intel";

  try {
    const peerClient = await getPeerClient();
    const scraper = peerClient.getPeer("scraper");

    if (!scraper) {
      return {
        nodesVisited: [nodeId],
        nodeLatencies: { [nodeId]: Date.now() - start },
        result: { available: false, reason: "SCRAPER station not configured" },
        success: false,
      };
    }

    // Determine which scraper command to dispatch based on task description
    const desc = state.taskDescription.toLowerCase();
    let command = "intel:status";
    if (/\bprice\b|\brate\b|\bcost\b|\bbooking\b|\bdeal\b/.test(desc)) command = "intel:prices";
    else if (/\bscrape\b|\bcrawl\b|\bfetch\b/.test(desc)) command = "intel:scrape";
    else if (/\bfamily\b|\breport\b/.test(desc)) command = "intel:report";
    else if (/\banomal|\bdetect\b|\balert\b/.test(desc)) command = "intel:anomalies";

    const result = await peerClient.dispatchCommand("scraper", {
      command,
      request_id: `neural-${Date.now()}`,
    });

    return {
      nodesVisited: [nodeId],
      nodeLatencies: { [nodeId]: Date.now() - start },
      result: {
        station: "scraper",
        command,
        response: result,
        reachable: result.success,
      },
      success: result.success,
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
// Clerk Learning capability node — routes to CLERK station
// ---------------------------------------------------------------------------

export async function capabilityClerkLearning(
  state: NeuralGraphStateType,
): Promise<Partial<NeuralGraphStateType>> {
  const start = Date.now();
  const nodeId = "clerk_learning";

  try {
    const peerClient = await getPeerClient();
    const clerk = peerClient.getPeer("clerk");

    if (!clerk) {
      return {
        nodesVisited: [nodeId],
        nodeLatencies: { [nodeId]: Date.now() - start },
        result: { available: false, reason: "CLERK station not configured" },
        success: false,
      };
    }

    // Route to appropriate CLERK capability
    const desc = state.taskDescription.toLowerCase();
    let command = "hf:status";
    if (/embed/.test(desc)) command = "hf:embed";
    else if (/summar/.test(desc)) command = "hf:summarize";
    else if (/infer|generate|complet/.test(desc)) command = "hf:infer";
    else if (/analys|analyz/.test(desc)) command = "hf:analyze";

    const result = await peerClient.dispatchCommand("clerk", {
      command,
      request_id: `neural-${Date.now()}`,
    });

    return {
      nodesVisited: [nodeId],
      nodeLatencies: { [nodeId]: Date.now() - start },
      result: {
        station: "clerk",
        command,
        response: result,
        reachable: result.success,
      },
      success: result.success,
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
// Social Intelligence capability node — routes to SOCIAL-INTEL station
// ---------------------------------------------------------------------------

export async function capabilitySocialIntel(
  state: NeuralGraphStateType,
): Promise<Partial<NeuralGraphStateType>> {
  const start = Date.now();
  const nodeId = "social_intel";

  try {
    const peerClient = await getPeerClient();
    const social = peerClient.getPeer("social-intel");

    if (!social) {
      return {
        nodesVisited: [nodeId],
        nodeLatencies: { [nodeId]: Date.now() - start },
        result: { available: false, reason: "SOCIAL-INTEL station not configured" },
        success: false,
      };
    }

    // Route to appropriate SOCIAL-INTEL capability
    const desc = state.taskDescription.toLowerCase();
    let command = "social:status";
    if (/telegram/.test(desc)) command = "social:telegram";
    else if (/sentiment/.test(desc)) command = "social:sentiment";
    else if (/monitor|feed|track/.test(desc)) command = "social:monitor";
    else if (/trend/.test(desc)) command = "social:trends";

    const result = await peerClient.dispatchCommand("social-intel", {
      command,
      request_id: `neural-${Date.now()}`,
    });

    return {
      nodesVisited: [nodeId],
      nodeLatencies: { [nodeId]: Date.now() - start },
      result: {
        station: "social-intel",
        command,
        response: result,
        reachable: result.success,
      },
      success: result.success,
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
