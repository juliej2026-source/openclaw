import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// Validate the Convex schema file structure
// ---------------------------------------------------------------------------

const CONVEX_DIR = path.resolve(import.meta.dirname, "../../convex");

function readConvexFile(name: string): string {
  return fs.readFileSync(path.join(CONVEX_DIR, name), "utf-8");
}

describe("Neural Graph — Convex schema", () => {
  it("schema.ts exists", () => {
    expect(fs.existsSync(path.join(CONVEX_DIR, "schema.ts"))).toBe(true);
  });

  const schema = readConvexFile("schema.ts");

  it("defines graph_nodes table", () => {
    expect(schema).toContain("graph_nodes");
    expect(schema).toContain("nodeId");
    expect(schema).toContain("fitnessScore");
    expect(schema).toContain("maturationPhase");
  });

  it("defines graph_edges table", () => {
    expect(schema).toContain("graph_edges");
    expect(schema).toContain("sourceNodeId");
    expect(schema).toContain("targetNodeId");
    expect(schema).toContain("myelinated");
  });

  it("defines checkpoints table", () => {
    expect(schema).toContain("checkpoints");
    expect(schema).toContain("threadId");
    expect(schema).toContain("channelValues");
  });

  it("defines evolution_events table", () => {
    expect(schema).toContain("evolution_events");
    expect(schema).toContain("eventType");
    expect(schema).toContain("approvalStatus");
  });

  it("defines execution_records table", () => {
    expect(schema).toContain("execution_records");
    expect(schema).toContain("nodesVisited");
    expect(schema).toContain("totalLatencyMs");
  });

  it("defines graph_embeddings table with vector index", () => {
    expect(schema).toContain("graph_embeddings");
    expect(schema).toContain("embedding");
    expect(schema).toContain("vectorIndex");
    expect(schema).toContain("1536"); // dimension
  });

  it("has stationId index on main tables", () => {
    expect(schema).toContain("by_stationId");
  });
});

describe("Neural Graph — Convex CRUD files", () => {
  const expectedFiles = [
    "graph_nodes.ts",
    "graph_edges.ts",
    "checkpoints.ts",
    "evolution.ts",
    "execution_records.ts",
    "embeddings.ts",
    "crons.ts",
  ];

  for (const file of expectedFiles) {
    it(`${file} exists`, () => {
      expect(fs.existsSync(path.join(CONVEX_DIR, file))).toBe(true);
    });
  }
});

describe("Neural Graph — extension structure", () => {
  const EXT_ROOT = path.resolve(import.meta.dirname, "../..");

  it("has package.json", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(EXT_ROOT, "package.json"), "utf-8"));
    expect(pkg.name).toBe("@openclaw/neural-graph");
    expect(pkg.dependencies).toHaveProperty("@langchain/langgraph");
    expect(pkg.dependencies).toHaveProperty("convex");
  });

  it("has index.ts entry point", () => {
    expect(fs.existsSync(path.join(EXT_ROOT, "index.ts"))).toBe(true);
  });

  const requiredDirs = [
    "src/graph",
    "src/persistence",
    "src/maturation",
    "src/network",
    "src/metrics",
    "src/cli",
  ];

  for (const dir of requiredDirs) {
    it(`has ${dir}/ directory`, () => {
      expect(fs.existsSync(path.join(EXT_ROOT, dir))).toBe(true);
    });
  }
});
