import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// ---------------------------------------------------------------------------
// Model inventory reader — same pattern as hive-mind/command-dispatch.ts
// ---------------------------------------------------------------------------

export function readInventoryCandidates(): Array<{
  id: string;
  family?: string;
  parameterCount?: string;
  contextWindow: number;
  capabilities: string[];
  vramRequired?: number;
}> {
  try {
    const inventoryPath = path.join(
      process.env.HOME ?? os.homedir(),
      ".openclaw",
      "model-manager",
      "inventory.json",
    );
    const raw = fs.readFileSync(inventoryPath, "utf-8");
    const data = JSON.parse(raw) as { models?: Array<Record<string, unknown>> };
    return (data.models ?? []).map((m) => ({
      id: String(m.id ?? ""),
      family: m.family ? String(m.family) : undefined,
      parameterCount: m.parameterCount ? String(m.parameterCount) : undefined,
      contextWindow: (m.contextWindow as number) ?? 131_072,
      capabilities: Array.isArray(m.capabilities) ? (m.capabilities as string[]) : [],
      vramRequired: m.vramRequired as number | undefined,
    }));
  } catch {
    return [];
  }
}
