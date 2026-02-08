import fs from "node:fs";
import path from "node:path";
import type { TrainingPair, TrainingDataset } from "../types.js";

function datasetsDir(): string {
  return path.join(process.env.HOME ?? "~", ".openclaw", "model-trainer", "datasets");
}

type ShareGptEntry = {
  conversations: Array<{ from: "human" | "gpt" | "system"; value: string }>;
};

/** Convert training pairs to ShareGPT format (most widely supported). */
function toShareGpt(pairs: TrainingPair[]): ShareGptEntry[] {
  return pairs.map((pair) => ({
    conversations: [
      ...(pair.system ? [{ from: "system" as const, value: pair.system }] : []),
      ...pair.conversations.map((c) => ({
        from: c.role === "user" ? ("human" as const) : ("gpt" as const),
        value: c.content,
      })),
    ],
  }));
}

type AlpacaEntry = {
  instruction: string;
  input: string;
  output: string;
};

/** Convert training pairs to Alpaca format. */
function toAlpaca(pairs: TrainingPair[]): AlpacaEntry[] {
  return pairs
    .filter((p) => p.conversations.length >= 2)
    .map((pair) => ({
      instruction: pair.system ?? "",
      input: pair.conversations.find((c) => c.role === "user")?.content ?? "",
      output: pair.conversations.find((c) => c.role === "assistant")?.content ?? "",
    }));
}

/**
 * Export training pairs to a JSONL file in the specified format.
 * Returns a TrainingDataset descriptor.
 */
export function exportDataset(opts: {
  pairs: TrainingPair[];
  name: string;
  format?: "sharegpt" | "alpaca" | "chatml";
  baseModel?: string;
}): TrainingDataset {
  const format = opts.format ?? "sharegpt";
  const id = `${opts.name}-${Date.now()}`;
  const filePath = path.join(datasetsDir(), `${id}.jsonl`);

  fs.mkdirSync(datasetsDir(), { recursive: true });

  let entries: unknown[];
  if (format === "sharegpt" || format === "chatml") {
    entries = toShareGpt(opts.pairs);
  } else {
    entries = toAlpaca(opts.pairs);
  }

  const lines = entries.map((e) => JSON.stringify(e)).join("\n");
  fs.writeFileSync(filePath, lines + "\n");

  return {
    id,
    name: opts.name,
    pairCount: opts.pairs.length,
    format,
    createdAt: new Date().toISOString(),
    baseModel: opts.baseModel,
    filePath,
  };
}

/** List all exported datasets. */
export function listDatasets(): TrainingDataset[] {
  if (!fs.existsSync(datasetsDir())) {
    return [];
  }

  return fs
    .readdirSync(datasetsDir())
    .filter((f) => f.endsWith(".jsonl"))
    .map((f) => {
      const filePath = path.join(datasetsDir(), f);
      const stat = fs.statSync(filePath);
      const content = fs.readFileSync(filePath, "utf-8");
      const lineCount = content.trim().split("\n").length;

      return {
        id: path.basename(f, ".jsonl"),
        name: path.basename(f, ".jsonl").replace(/-\d+$/, ""),
        pairCount: lineCount,
        format: "sharegpt" as const,
        createdAt: stat.birthtime.toISOString(),
        filePath,
      };
    });
}
