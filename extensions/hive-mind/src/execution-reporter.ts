import type { ExecutionLog } from "./execution-log.js";
import type { JulieClient } from "./julie-client.js";
import type { ExecutionRecord, ExecutionLogEntry } from "./types.js";
import { STATION_ID } from "./types.js";

type AgentEndEvent = {
  success?: boolean;
  durationMs?: number;
  messages?: Array<{ role: string; content: string | unknown }>;
};

type TaskClassifier = (prompt: string) => { primary: string };

async function loadClassifier(): Promise<TaskClassifier> {
  const mod = await import("../../meta-engine/src/task-classifier.js");
  return mod.classifyTask;
}

async function loadPerformanceDb() {
  const mod = await import("../../meta-engine/src/performance-db.js");
  return new mod.PerformanceDb();
}

function extractUserMessage(
  messages: Array<{ role: string; content: string | unknown }>,
): string | undefined {
  for (const msg of messages) {
    if (msg.role === "user" && typeof msg.content === "string") {
      return msg.content;
    }
  }
  return undefined;
}

export type ExecutionReporterOptions = {
  classifyTask?: TaskClassifier;
};

export function createExecutionReporter(
  julieClient: JulieClient,
  executionLog: ExecutionLog,
  opts?: ExecutionReporterOptions,
) {
  let classifyTaskFn: TaskClassifier | undefined = opts?.classifyTask;

  return async (event: AgentEndEvent): Promise<void> => {
    const userMessage = extractUserMessage(event.messages ?? []);
    if (!userMessage) {
      return;
    }

    if (!classifyTaskFn) {
      classifyTaskFn = await loadClassifier();
    }
    const classification = classifyTaskFn(userMessage);

    const record: ExecutionRecord = {
      station_id: STATION_ID,
      task_type: classification.primary,
      success: event.success ?? false,
      latency_ms: event.durationMs ?? 0,
      capabilities_used: ["task_classification", "model_scoring"],
      timestamp: new Date().toISOString(),
    };

    // Feed performance DB for the learning loop (UC-4)
    try {
      const perfDb = await loadPerformanceDb();
      perfDb.record({
        modelId: "unknown",
        taskType: classification.primary as import("../../meta-engine/src/types.js").TaskType,
        success: record.success,
        durationMs: record.latency_ms,
        timestamp: record.timestamp,
      });
    } catch {
      // Best-effort: performance DB write failure is non-fatal
    }

    let reportedToJulie = false;
    try {
      await julieClient.reportExecution(record);
      reportedToJulie = true;
    } catch {
      // Best-effort: Julie might be unreachable
    }

    const logEntry: ExecutionLogEntry = {
      id: `exec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: record.timestamp,
      task_type: classification.primary,
      success: record.success,
      latency_ms: record.latency_ms,
      reported_to_julie: reportedToJulie,
    };

    executionLog.record(logEntry);
  };
}

/**
 * Record a command execution in the performance DB and execution log.
 * Called from dispatchCommand() to feed the learning loop (UC-4).
 */
export async function recordCommandExecution(opts: {
  command: string;
  success: boolean;
  latencyMs: number;
  executionLog: ExecutionLog;
  julieClient: JulieClient;
}): Promise<void> {
  const timestamp = new Date().toISOString();

  // Classify command into task type
  const taskType = inferTaskTypeFromCommand(opts.command);

  // Record to performance DB
  try {
    const perfDb = await loadPerformanceDb();
    perfDb.record({
      modelId: "iot-hub",
      taskType,
      success: opts.success,
      durationMs: opts.latencyMs,
      timestamp,
    });
  } catch {
    // Best-effort
  }

  // Record to local execution log
  const logEntry: ExecutionLogEntry = {
    id: `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp,
    command: opts.command,
    task_type: taskType,
    success: opts.success,
    latency_ms: opts.latencyMs,
    reported_to_julie: false,
  };

  // Best-effort Julie report
  try {
    await opts.julieClient.reportExecution({
      station_id: STATION_ID,
      task_type: taskType,
      success: opts.success,
      latency_ms: opts.latencyMs,
      capabilities_used: inferCapabilitiesUsed(opts.command),
      timestamp,
    });
    logEntry.reported_to_julie = true;
  } catch {
    // Julie unreachable
  }

  opts.executionLog.record(logEntry);

  // Feed neural graph execution records (best-effort)
  try {
    const { getConvexClient } = await loadNeuralConvex();
    const client = getConvexClient();
    // Use string function reference directly to avoid importing the Convex
    // _generated/api.js (which only exists after `npx convex dev`).
    await client.mutation("execution_records:record" as never, {
      threadId: `cmd-${logEntry.id}`,
      taskType: taskType,
      taskDescription: opts.command,
      nodesVisited: inferNodesVisited(opts.command),
      edgesTraversed: [],
      success: opts.success,
      totalLatencyMs: opts.latencyMs,
      nodeLatencies: {},
      stationId: STATION_ID,
      createdAt: timestamp,
    });
  } catch {
    // Non-critical — neural graph recording is best-effort
  }
}

async function loadNeuralConvex() {
  return import("../../neural-graph/src/persistence/convex-client.js");
}

/** Map command prefixes to neural graph node IDs for nodesVisited. */
function inferNodesVisited(command: string): string[] {
  if (command.startsWith("meta:")) return ["meta-engine"];
  if (command.startsWith("network:") || command.startsWith("unifi:")) return ["iot-hub"];
  if (command.startsWith("neural:")) return ["meta-engine"];
  if (command.startsWith("scraper:")) return ["scraper_intel"];
  if (command.startsWith("hf:")) return ["clerk_learning"];
  return ["iot-hub"];
}

/** Map command prefixes to meta-engine task types. */
function inferTaskTypeFromCommand(
  command: string,
): import("../../meta-engine/src/types.js").TaskType {
  if (command.startsWith("meta:classify") || command.startsWith("meta:recommend")) {
    return "analysis";
  }
  if (command.startsWith("meta:score")) {
    return "reasoning";
  }
  if (command.startsWith("meta:train") || command.startsWith("meta:evaluate")) {
    return "coding";
  }
  if (command.startsWith("meta:search")) {
    return "analysis";
  }
  if (command.startsWith("network:") || command.startsWith("unifi:")) {
    return "tool-use";
  }
  return "chat";
}

/** Derive actual capabilities used from command prefix for Julie reporting. */
export function inferCapabilitiesUsed(command: string): string[] {
  const caps: string[] = [];
  if (command.startsWith("meta:classify") || command.startsWith("meta:recommend")) {
    caps.push("task_classification");
  }
  if (command.startsWith("meta:model") || command.startsWith("meta:hardware")) {
    caps.push("model_management", "hardware_detection");
  }
  if (command.startsWith("meta:train")) caps.push("model_training");
  if (command.startsWith("meta:search")) caps.push("huggingface_search");
  if (command.startsWith("meta:score")) caps.push("model_scoring");
  if (command.startsWith("meta:dashboard") || command.startsWith("meta:status")) {
    caps.push("model_management", "task_classification");
  }
  if (command.startsWith("network:scan") || command.startsWith("network:station")) {
    caps.push("network_monitoring");
  }
  if (command.startsWith("network:switch") || command.startsWith("network:5g")) {
    caps.push("network_control", "dual_wan");
  }
  if (command.startsWith("network:path") || command.startsWith("network:failover")) {
    caps.push("network_control", "dual_wan");
  }
  if (command.startsWith("network:alert")) caps.push("alert_management");
  if (command.startsWith("unifi:")) caps.push("network_monitoring");
  if (command.startsWith("neural:")) caps.push("neural_graph");
  if (command.startsWith("hf:")) caps.push("huggingface_management");
  if (caps.length === 0) caps.push(command);
  return caps;
}
