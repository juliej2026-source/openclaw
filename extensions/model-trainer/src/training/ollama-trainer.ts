import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import type { TrainingJobConfig } from "../types.js";
import * as jobManager from "./job-manager.js";

const execFileAsync = promisify(execFile);
function trainerDir(): string {
  return path.join(process.env.HOME ?? "~", ".openclaw", "model-trainer");
}

/**
 * Train via Ollama Modelfile.
 *
 * This is not true fine-tuning — it creates a new Ollama model from an
 * existing base with a custom system prompt and parameter overrides.
 * Useful for behavioral customization without GPU training.
 *
 * The system prompt is derived from the training dataset's conversation patterns.
 */
export async function trainWithOllamaModelfile(
  jobId: string,
  config: TrainingJobConfig,
): Promise<void> {
  jobManager.updateJob(jobId, {
    status: "preparing",
    startedAt: new Date().toISOString(),
  });

  try {
    // Read the dataset to extract a system prompt
    const datasetPath = findDatasetPath(config.datasetId);
    if (!datasetPath) {
      throw new Error(`Dataset ${config.datasetId} not found`);
    }

    const systemPrompt = await buildSystemPromptFromDataset(datasetPath);

    // Create a Modelfile
    const modelfileDir = path.join(trainerDir(), "modelfiles");
    fs.mkdirSync(modelfileDir, { recursive: true });
    const modelfilePath = path.join(modelfileDir, `${config.outputName}.Modelfile`);

    const modelfileContent = [
      `FROM ${config.baseModel}`,
      `SYSTEM """${systemPrompt}"""`,
      "PARAMETER temperature 0.7",
      "PARAMETER top_p 0.9",
      `PARAMETER num_ctx ${config.hyperparams?.maxSeqLength ?? 4096}`,
    ].join("\n");

    fs.writeFileSync(modelfilePath, modelfileContent);

    // Update job status
    jobManager.updateJob(jobId, { status: "training" });

    // Run ollama create
    const { stdout, stderr } = await execFileAsync(
      "ollama",
      ["create", config.outputName, "-f", modelfilePath],
      { timeout: 5 * 60 * 1000 }, // 5 minutes should be enough for Modelfile creation
    );

    const logPath = path.join(trainerDir(), "logs", `${jobId}.log`);
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    fs.writeFileSync(logPath, `stdout:\n${stdout}\nstderr:\n${stderr}\n`);

    jobManager.updateJob(jobId, {
      status: "completed",
      completedAt: new Date().toISOString(),
      outputPath: modelfilePath,
      logPath,
    });
  } catch (err) {
    jobManager.updateJob(jobId, {
      status: "failed",
      completedAt: new Date().toISOString(),
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

function findDatasetPath(datasetId: string): string | undefined {
  const datasetsDir = path.join(trainerDir(), "datasets");
  if (!fs.existsSync(datasetsDir)) {
    return undefined;
  }

  // Try exact match first
  const exact = path.join(datasetsDir, `${datasetId}.jsonl`);
  if (fs.existsSync(exact)) {
    return exact;
  }

  // Try pattern match
  const files = fs.readdirSync(datasetsDir);
  const match = files.find((f) => f.startsWith(datasetId) && f.endsWith(".jsonl"));
  return match ? path.join(datasetsDir, match) : undefined;
}

/**
 * Build a system prompt from the training data patterns.
 * Extracts common themes and response styles from the dataset.
 */
async function buildSystemPromptFromDataset(datasetPath: string): Promise<string> {
  const content = fs.readFileSync(datasetPath, "utf-8");
  const lines = content.trim().split("\n").slice(0, 50); // Sample first 50 entries

  // Extract assistant responses to analyze patterns
  const responses: string[] = [];
  for (const line of lines) {
    try {
      const entry = JSON.parse(line) as {
        conversations?: Array<{ from?: string; value?: string }>;
      };
      const assistantMsgs = (entry.conversations ?? [])
        .filter((c) => c.from === "gpt" || c.from === "assistant")
        .map((c) => c.value ?? "");
      responses.push(...assistantMsgs);
    } catch {
      // Skip malformed
    }
  }

  if (responses.length === 0) {
    return "You are a helpful assistant.";
  }

  // Calculate average response length to set tone expectations
  const avgLength = responses.reduce((s, r) => s + r.length, 0) / responses.length;
  const style = avgLength > 500 ? "detailed and thorough" : "concise and direct";

  return (
    `You are a helpful assistant. Respond in a ${style} style. ` +
    `Base your responses on the patterns and knowledge from your training data.`
  );
}
