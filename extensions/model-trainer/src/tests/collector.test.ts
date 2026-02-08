import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { collectTrainingData } from "../dataset/collector.js";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "trainer-collector-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function createSessionFile(agentId: string, sessionId: string, messages: unknown[]): void {
  const agentDir = path.join(tmpDir, agentId, "sessions");
  fs.mkdirSync(agentDir, { recursive: true });
  const filePath = path.join(agentDir, `${sessionId}.jsonl`);
  const lines = messages.map((m) => JSON.stringify(m)).join("\n");
  fs.writeFileSync(filePath, lines + "\n");
}

describe("collectTrainingData", () => {
  it("extracts conversation pairs from session files", async () => {
    createSessionFile("agent-1", "session-1", [
      { role: "user", content: "How do I sort an array?", timestamp: "2026-01-01T00:00:00Z" },
      {
        role: "assistant",
        content: "You can use Array.sort() in JavaScript to sort arrays.",
        timestamp: "2026-01-01T00:00:01Z",
      },
    ]);

    const pairs = await collectTrainingData({ agentsDir: tmpDir });
    expect(pairs.length).toBe(1);
    expect(pairs[0]?.conversations.length).toBe(2);
    expect(pairs[0]?.conversations[0]?.role).toBe("user");
    expect(pairs[0]?.conversations[1]?.role).toBe("assistant");
  });

  it("handles multiple conversation pairs in one session", async () => {
    createSessionFile("agent-1", "session-1", [
      { role: "user", content: "First question here?" },
      { role: "assistant", content: "First answer here." },
      { role: "user", content: "Second question here?" },
      { role: "assistant", content: "Second answer here." },
    ]);

    const pairs = await collectTrainingData({ agentsDir: tmpDir });
    expect(pairs.length).toBe(2);
  });

  it("collects from multiple agents", async () => {
    createSessionFile("agent-1", "session-1", [
      { role: "user", content: "Question from agent 1?" },
      { role: "assistant", content: "Answer from agent 1." },
    ]);
    createSessionFile("agent-2", "session-1", [
      { role: "user", content: "Question from agent 2?" },
      { role: "assistant", content: "Answer from agent 2." },
    ]);

    const pairs = await collectTrainingData({ agentsDir: tmpDir });
    expect(pairs.length).toBe(2);
  });

  it("filters by agentId", async () => {
    createSessionFile("agent-1", "session-1", [
      { role: "user", content: "Question from agent 1?" },
      { role: "assistant", content: "Answer from agent 1." },
    ]);
    createSessionFile("agent-2", "session-1", [
      { role: "user", content: "Question from agent 2?" },
      { role: "assistant", content: "Answer from agent 2." },
    ]);

    const pairs = await collectTrainingData({ agentsDir: tmpDir, agentId: "agent-1" });
    expect(pairs.length).toBe(1);
    expect(pairs[0]?.source.agentId).toBe("agent-1");
  });

  it("respects maxPairs limit", async () => {
    const messages = [];
    for (let i = 0; i < 20; i++) {
      messages.push({ role: "user", content: `Question number ${i}?` });
      messages.push({ role: "assistant", content: `Answer number ${i}.` });
    }
    createSessionFile("agent-1", "session-1", messages);

    const pairs = await collectTrainingData({ agentsDir: tmpDir, maxPairs: 5 });
    expect(pairs.length).toBe(5);
  });

  it("skips lines without user or assistant role", async () => {
    createSessionFile("agent-1", "session-1", [
      { role: "system", content: "You are a helpful assistant." },
      { role: "user", content: "Hello, help me please?" },
      { role: "tool", content: "Tool result..." },
      { role: "assistant", content: "Sure, I can help with that." },
    ]);

    const pairs = await collectTrainingData({ agentsDir: tmpDir });
    expect(pairs.length).toBe(1);
    expect(pairs[0]?.conversations[0]?.content).toBe("Hello, help me please?");
  });

  it("handles array content (multimodal messages)", async () => {
    createSessionFile("agent-1", "session-1", [
      {
        role: "user",
        content: [
          { type: "text", text: "What is in this image?" },
          { type: "image", url: "data:image/png;base64,..." },
        ],
      },
      { role: "assistant", content: "I see a cat in the image." },
    ]);

    const pairs = await collectTrainingData({ agentsDir: tmpDir });
    expect(pairs.length).toBe(1);
    expect(pairs[0]?.conversations[0]?.content).toBe("What is in this image?");
  });

  it("returns empty array for nonexistent agents directory", async () => {
    const pairs = await collectTrainingData({ agentsDir: "/tmp/nonexistent-dir-xyz" });
    expect(pairs).toEqual([]);
  });

  it("returns empty array for nonexistent agent ID", async () => {
    const pairs = await collectTrainingData({ agentsDir: tmpDir, agentId: "nonexistent" });
    expect(pairs).toEqual([]);
  });

  it("skips malformed JSONL lines", async () => {
    const agentDir = path.join(tmpDir, "agent-1", "sessions");
    fs.mkdirSync(agentDir, { recursive: true });
    fs.writeFileSync(
      path.join(agentDir, "session-1.jsonl"),
      `{"role":"user","content":"Valid question here?"}\nnot-json\n{"role":"assistant","content":"Valid answer here."}\n`,
    );

    const pairs = await collectTrainingData({ agentsDir: tmpDir });
    expect(pairs.length).toBe(1);
  });

  it("populates source metadata correctly", async () => {
    createSessionFile("my-agent", "my-session", [
      { role: "user", content: "A question?" },
      { role: "assistant", content: "An answer." },
    ]);

    const pairs = await collectTrainingData({ agentsDir: tmpDir });
    expect(pairs[0]?.source.agentId).toBe("my-agent");
    expect(pairs[0]?.source.sessionId).toBe("my-session");
  });
});
