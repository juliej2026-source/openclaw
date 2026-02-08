import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { TrainingPair } from "../types.js";
import { exportDataset, listDatasets } from "../dataset/formatter.js";

// Use a temporary directory to avoid polluting real data
let tmpDir: string;
const originalHome = process.env.HOME;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "trainer-fmt-"));
  process.env.HOME = tmpDir;
});

afterEach(() => {
  process.env.HOME = originalHome;
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function makePair(user: string, assistant: string, system?: string): TrainingPair {
  return {
    system,
    conversations: [
      { role: "user", content: user },
      { role: "assistant", content: assistant },
    ],
    source: { sessionId: "test", timestamp: new Date().toISOString() },
  };
}

describe("exportDataset", () => {
  it("exports to ShareGPT format", () => {
    const pairs = [
      makePair("Hello", "Hi there! How can I help?"),
      makePair("What is TypeScript?", "TypeScript is a typed superset of JavaScript."),
    ];

    const dataset = exportDataset({ pairs, name: "test-ds" });

    expect(dataset.name).toBe("test-ds");
    expect(dataset.pairCount).toBe(2);
    expect(dataset.format).toBe("sharegpt");
    expect(fs.existsSync(dataset.filePath)).toBe(true);

    // Verify JSONL content
    const content = fs.readFileSync(dataset.filePath, "utf-8");
    const lines = content.trim().split("\n");
    expect(lines.length).toBe(2);

    const entry = JSON.parse(lines[0] ?? "{}") as {
      conversations: Array<{ from: string; value: string }>;
    };
    expect(entry.conversations[0]?.from).toBe("human");
    expect(entry.conversations[1]?.from).toBe("gpt");
  });

  it("exports to Alpaca format", () => {
    const pairs = [makePair("Explain arrays", "Arrays are ordered collections of elements.")];

    const dataset = exportDataset({ pairs, name: "alpaca-test", format: "alpaca" });

    const content = fs.readFileSync(dataset.filePath, "utf-8");
    const entry = JSON.parse(content.trim()) as {
      instruction: string;
      input: string;
      output: string;
    };
    expect(entry.input).toBe("Explain arrays");
    expect(entry.output).toBe("Arrays are ordered collections of elements.");
  });

  it("includes system messages in ShareGPT", () => {
    const pairs = [makePair("Hello", "Hi!", "You are a helpful assistant.")];

    const dataset = exportDataset({ pairs, name: "system-test" });
    const content = fs.readFileSync(dataset.filePath, "utf-8");
    const entry = JSON.parse(content.trim()) as {
      conversations: Array<{ from: string; value: string }>;
    };

    expect(entry.conversations[0]?.from).toBe("system");
    expect(entry.conversations[0]?.value).toBe("You are a helpful assistant.");
  });
});

describe("listDatasets", () => {
  it("returns empty array when no datasets exist", () => {
    const datasets = listDatasets();
    expect(datasets).toEqual([]);
  });

  it("lists exported datasets", () => {
    const pairs = [makePair("Question", "Answer that is long enough to pass.")];
    exportDataset({ pairs, name: "list-test" });

    const datasets = listDatasets();
    expect(datasets.length).toBe(1);
    expect(datasets[0]?.name).toBe("list-test");
  });
});
