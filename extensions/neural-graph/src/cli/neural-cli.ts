import {
  handleNeuralStatus,
  handleNeuralTopology,
  handleNeuralEvolve,
  handleNeuralPending,
} from "../api-handlers.js";

// ---------------------------------------------------------------------------
// CLI commands for neural-graph
// Usage: openclaw neural-graph <subcommand>
// ---------------------------------------------------------------------------

export async function runNeuralCli(args: string[]): Promise<string> {
  const subcommand = args[0] ?? "status";
  const stationId = "iot-hub";

  switch (subcommand) {
    case "status": {
      const status = await handleNeuralStatus(stationId);
      return formatStatus(status);
    }

    case "topology": {
      const topology = await handleNeuralTopology(stationId);
      return formatTopology(topology);
    }

    case "evolve": {
      const result = await handleNeuralEvolve(stationId);
      return formatEvolution(result);
    }

    case "pending": {
      const pending = await handleNeuralPending();
      return formatPending(pending);
    }

    case "help":
    default:
      return [
        "Neural Graph CLI",
        "",
        "Commands:",
        "  status     Show neural graph status and maturation phase",
        "  topology   Display graph nodes and edges",
        "  evolve     Trigger an evolution cycle",
        "  pending    List pending approval requests",
        "  help       Show this help message",
      ].join("\n");
  }
}

function formatStatus(status: Record<string, unknown>): string {
  return [
    "Neural Graph Status",
    "═".repeat(40),
    `Phase:            ${status.phase}`,
    `Convex:           ${status.convexConnected ? "connected" : "disconnected"}`,
    `Nodes:            ${status.totalNodes}`,
    `Edges:            ${status.totalEdges}`,
    `Myelinated:       ${status.myelinatedEdges}`,
    `Executions:       ${status.totalExecutions}`,
    `Avg Fitness:      ${status.avgFitness}`,
    `Station:          ${status.stationId}`,
  ].join("\n");
}

function formatTopology(topology: Record<string, unknown>): string {
  const nodes = topology.nodes as Array<Record<string, unknown>>;
  const edges = topology.edges as Array<Record<string, unknown>>;

  const lines = [
    "Neural Graph Topology",
    "═".repeat(50),
    "",
    `Phase: ${topology.phase}  |  Executions: ${topology.totalExecutions}`,
    "",
    "Nodes:",
    "─".repeat(50),
  ];

  for (const n of nodes) {
    const status = n.status === "active" ? "●" : n.status === "degraded" ? "◐" : "○";
    lines.push(
      `  ${status} ${n.nodeId} [${n.nodeType}]  fitness=${n.fitnessScore}  activations=${n.activationCount}`,
    );
  }

  lines.push("", "Edges:", "─".repeat(50));

  for (const e of edges) {
    const myelin = e.myelinated ? " ⚡" : "";
    lines.push(
      `  ${e.sourceNodeId} → ${e.targetNodeId}  [${e.edgeType}]  w=${(e.weight as number).toFixed(2)}${myelin}`,
    );
  }

  return lines.join("\n");
}

function formatEvolution(result: Record<string, unknown>): string {
  return [
    "Evolution Cycle Complete",
    "═".repeat(40),
    `Phase:            ${result.phase}`,
    `Executions:       ${result.totalExecutions}`,
    `Nodes Updated:    ${result.nodesUpdated}`,
    `Edges Updated:    ${result.edgesUpdated}`,
    `Phase Transition: ${result.phaseTransition ? "YES" : "no"}`,
  ].join("\n");
}

function formatPending(pending: Array<Record<string, unknown>>): string {
  if (pending.length === 0) {
    return "No pending approval requests.";
  }

  const lines = ["Pending Approvals", "═".repeat(50)];

  for (const p of pending) {
    lines.push(
      `  [${p._id}] ${p.eventType}: ${p.targetId}`,
      `    Reason: ${p.reason}`,
      `    Triggered by: ${p.triggeredBy}`,
      "",
    );
  }

  return lines.join("\n");
}
