import fs from "node:fs";
import path from "node:path";
import type { EvalResult, TrainingPair } from "../types.js";
import { accuracyScore, fluencyScore, overallScore } from "./metrics.js";

function trainerDir(): string {
  return path.join(process.env.HOME ?? "~", ".openclaw", "model-trainer");
}

type OllamaGenerateResponse = {
  response?: string;
  error?: string;
};

/**
 * Generate a response from an Ollama model for a given prompt.
 */
async function generateResponse(
  model: string,
  prompt: string,
  baseUrl = "http://127.0.0.1:11434",
): Promise<string> {
  const resp = await fetch(`${baseUrl}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
      options: { temperature: 0.1 }, // Low temperature for deterministic eval
    }),
  });

  if (!resp.ok) {
    throw new Error(`Ollama generate failed: ${resp.status} ${resp.statusText}`);
  }

  const data = (await resp.json()) as OllamaGenerateResponse;
  if (data.error) {
    throw new Error(data.error);
  }
  return data.response ?? "";
}

/**
 * Load eval test cases from a dataset file.
 * Uses a subset of the training data as eval prompts.
 */
function loadTestCases(datasetPath: string, maxCases = 20): TrainingPair[] {
  if (!fs.existsSync(datasetPath)) {
    return [];
  }

  const content = fs.readFileSync(datasetPath, "utf-8");
  const lines = content.trim().split("\n");

  // Sample evenly from the dataset
  const step = Math.max(1, Math.floor(lines.length / maxCases));
  const pairs: TrainingPair[] = [];

  for (let i = 0; i < lines.length && pairs.length < maxCases; i += step) {
    try {
      const entry = JSON.parse(lines[i]) as {
        conversations?: Array<{ from?: string; value?: string }>;
      };
      const convs = entry.conversations ?? [];
      const userMsg = convs.find((c) => c.from === "human" || c.from === "user");
      const assistantMsg = convs.find((c) => c.from === "gpt" || c.from === "assistant");

      if (userMsg?.value && assistantMsg?.value) {
        pairs.push({
          conversations: [
            { role: "user", content: userMsg.value },
            { role: "assistant", content: assistantMsg.value },
          ],
          source: { sessionId: "eval", timestamp: new Date().toISOString() },
        });
      }
    } catch {
      // Skip malformed
    }
  }

  return pairs;
}

/**
 * Evaluate a model (optionally fine-tuned) against test cases.
 *
 * Runs each test prompt through the model and compares responses to reference.
 * Optionally compares against a base model to measure improvement.
 */
export async function evaluateModel(opts: {
  modelId: string;
  adapterId?: string;
  datasetPath: string;
  baseModelId?: string;
  maxCases?: number;
  baseUrl?: string;
}): Promise<EvalResult> {
  const testCases = loadTestCases(opts.datasetPath, opts.maxCases ?? 20);

  if (testCases.length === 0) {
    return {
      modelId: opts.modelId,
      adapterId: opts.adapterId,
      testCases: 0,
      scores: { overall: 0 },
      timestamp: new Date().toISOString(),
    };
  }

  let totalAccuracy = 0;
  let totalFluency = 0;
  let baseAccuracy = 0;
  let baseFluency = 0;
  let evaluated = 0;

  for (const testCase of testCases) {
    const userMsg = testCase.conversations.find((c) => c.role === "user");
    const refMsg = testCase.conversations.find((c) => c.role === "assistant");
    if (!userMsg || !refMsg) {
      continue;
    }

    try {
      // Evaluate target model
      const response = await generateResponse(opts.modelId, userMsg.content, opts.baseUrl);
      totalAccuracy += accuracyScore(response, refMsg.content);
      totalFluency += fluencyScore(response);

      // Evaluate base model if provided
      if (opts.baseModelId) {
        const baseResponse = await generateResponse(
          opts.baseModelId,
          userMsg.content,
          opts.baseUrl,
        );
        baseAccuracy += accuracyScore(baseResponse, refMsg.content);
        baseFluency += fluencyScore(baseResponse);
      }

      evaluated++;
    } catch {
      // Skip failed evaluations
    }
  }

  if (evaluated === 0) {
    return {
      modelId: opts.modelId,
      adapterId: opts.adapterId,
      testCases: 0,
      scores: { overall: 0 },
      timestamp: new Date().toISOString(),
    };
  }

  const avgAccuracy = totalAccuracy / evaluated;
  const avgFluency = totalFluency / evaluated;
  const overall = overallScore({ accuracy: avgAccuracy, fluency: avgFluency });

  const result: EvalResult = {
    modelId: opts.modelId,
    adapterId: opts.adapterId,
    testCases: evaluated,
    scores: {
      overall: Math.round(overall * 1000) / 1000,
      accuracy: Math.round(avgAccuracy * 1000) / 1000,
      fluency: Math.round(avgFluency * 1000) / 1000,
    },
    timestamp: new Date().toISOString(),
  };

  // Add base model comparison if available
  if (opts.baseModelId && evaluated > 0) {
    const baseAvgAccuracy = baseAccuracy / evaluated;
    const baseAvgFluency = baseFluency / evaluated;
    const baseOverall = overallScore({ accuracy: baseAvgAccuracy, fluency: baseAvgFluency });

    result.comparisonToBase = {
      baseScore: Math.round(baseOverall * 1000) / 1000,
      improvement: Math.round((overall - baseOverall) * 1000) / 1000,
    };
  }

  // Save eval result
  const evalDir = path.join(trainerDir(), "evals");
  fs.mkdirSync(evalDir, { recursive: true });
  const evalPath = path.join(evalDir, `${opts.modelId.replace(/[/:]/g, "-")}-${Date.now()}.json`);
  fs.writeFileSync(evalPath, JSON.stringify(result, null, 2) + "\n");

  return result;
}
