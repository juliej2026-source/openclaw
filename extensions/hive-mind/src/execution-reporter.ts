import type { ExecutionLog } from "./execution-log.js";
import type { JuliaClient } from "./julia-client.js";
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
  juliaClient: JuliaClient,
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
      capabilities_used: ["task_classification"],
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

    let reportedToJulia = false;
    try {
      await juliaClient.reportExecution(record);
      reportedToJulia = true;
    } catch {
      // Best-effort: JULIA might be unreachable
    }

    const logEntry: ExecutionLogEntry = {
      id: `exec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: record.timestamp,
      task_type: classification.primary,
      success: record.success,
      latency_ms: record.latency_ms,
      reported_to_julia: reportedToJulia,
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
  juliaClient: JuliaClient;
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
    reported_to_julia: false,
  };

  // Best-effort JULIA report
  try {
    await opts.juliaClient.reportExecution({
      station_id: STATION_ID,
      task_type: taskType,
      success: opts.success,
      latency_ms: opts.latencyMs,
      capabilities_used: [opts.command],
      timestamp,
    });
    logEntry.reported_to_julia = true;
  } catch {
    // JULIA unreachable
  }

  opts.executionLog.record(logEntry);
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
