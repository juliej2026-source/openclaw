import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import type { TrainingPair } from "../types.js";

function defaultAgentsDir(): string {
  return path.join(process.env.HOME ?? "~", ".openclaw", "agents");
}

type SessionMessage = {
  role?: string;
  content?: string | Array<{ text?: string; type?: string }>;
  timestamp?: string;
};

/** Extract text content from a message's content field. */
function extractText(content: SessionMessage["content"]): string {
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .filter((c) => c.type === "text" || !c.type)
      .map((c) => c.text ?? "")
      .join("\n");
  }
  return "";
}

/**
 * Read a session JSONL file and extract conversation pairs.
 *
 * Each pair is a user message followed by an assistant response.
 * We skip tool calls, system messages, and error responses.
 */
async function extractPairsFromSessionFile(
  filePath: string,
  sessionId: string,
  agentId?: string,
): Promise<TrainingPair[]> {
  const pairs: TrainingPair[] = [];

  const stream = fs.createReadStream(filePath, { encoding: "utf-8" });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  const conversations: Array<{ role: "user" | "assistant"; content: string }> = [];

  for await (const line of rl) {
    if (!line.trim()) {
      continue;
    }
    try {
      const msg = JSON.parse(line) as SessionMessage;
      const text = extractText(msg.content);
      if (!text.trim()) {
        continue;
      }

      if (msg.role === "user") {
        // If we have a pending conversation, save it before starting new one
        if (conversations.length >= 2) {
          pairs.push({
            conversations: [...conversations],
            source: {
              sessionId,
              agentId,
              timestamp: msg.timestamp ?? new Date().toISOString(),
            },
          });
        }
        conversations.length = 0;
        conversations.push({ role: "user", content: text });
      } else if (msg.role === "assistant" && conversations.length > 0) {
        conversations.push({ role: "assistant", content: text });
      }
    } catch {
      // Skip malformed lines
    }
  }

  // Save last conversation if it's complete
  if (conversations.length >= 2) {
    pairs.push({
      conversations: [...conversations],
      source: {
        sessionId,
        agentId,
        timestamp: new Date().toISOString(),
      },
    });
  }

  return pairs;
}

/**
 * Collect training pairs from all session files for a given agent.
 *
 * Reads JSONL session transcripts from ~/.openclaw/agents/<agentId>/sessions/.
 */
export async function collectTrainingData(opts: {
  agentId?: string;
  agentsDir?: string;
  maxPairs?: number;
}): Promise<TrainingPair[]> {
  const agentsDir = opts.agentsDir ?? defaultAgentsDir();
  const maxPairs = opts.maxPairs ?? 10_000;
  const allPairs: TrainingPair[] = [];

  // Find agent directories
  let agentDirs: string[];
  if (opts.agentId) {
    const dir = path.join(agentsDir, opts.agentId);
    agentDirs = fs.existsSync(dir) ? [dir] : [];
  } else {
    try {
      agentDirs = fs
        .readdirSync(agentsDir)
        .map((d) => path.join(agentsDir, d))
        .filter((d) => fs.statSync(d).isDirectory());
    } catch {
      return [];
    }
  }

  for (const agentDir of agentDirs) {
    const sessionsDir = path.join(agentDir, "sessions");
    if (!fs.existsSync(sessionsDir)) {
      continue;
    }

    const agentId = path.basename(agentDir);
    const sessionFiles = fs
      .readdirSync(sessionsDir)
      .filter((f) => f.endsWith(".jsonl"))
      .map((f) => path.join(sessionsDir, f));

    for (const file of sessionFiles) {
      if (allPairs.length >= maxPairs) {
        break;
      }
      const sessionId = path.basename(file, ".jsonl");
      const pairs = await extractPairsFromSessionFile(file, sessionId, agentId);
      allPairs.push(...pairs);
    }
  }

  return allPairs.slice(0, maxPairs);
}
