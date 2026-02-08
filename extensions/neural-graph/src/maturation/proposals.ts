import type { GraphNode, GraphEdge, EvolutionProposal } from "../types.js";
import { MYELINATION_THRESHOLD, PRUNING_THRESHOLD, CORE_NODE_IDS } from "../types.js";

// ---------------------------------------------------------------------------
// Mutation proposal generation — used by the evolution cycle
// Generates proposals based on current graph state without applying them.
// ---------------------------------------------------------------------------

export function generateMyelinationProposals(edges: GraphEdge[]): EvolutionProposal[] {
  const proposals: EvolutionProposal[] = [];

  for (const edge of edges) {
    if (
      !edge.myelinated &&
      edge.activationCount >= MYELINATION_THRESHOLD.activationCount &&
      edge.weight >= MYELINATION_THRESHOLD.minWeight
    ) {
      proposals.push({
        type: "edge_myelinated",
        targetId: edge.edgeId,
        reason: `High-traffic: ${edge.activationCount} activations, weight ${edge.weight.toFixed(2)}`,
        requiresApproval: false,
        proposedChanges: { myelinated: true },
      });
    }
  }

  return proposals;
}

export function generatePruningProposals(
  nodes: GraphNode[],
  edges: GraphEdge[],
): EvolutionProposal[] {
  const proposals: EvolutionProposal[] = [];

  // Node pruning (synthetic only, never core)
  for (const node of nodes) {
    if (node.nodeType !== "synthetic") continue;
    if (CORE_NODE_IDS.includes(node.nodeId as (typeof CORE_NODE_IDS)[number])) continue;
    if (node.status === "pruned") continue;

    const daysSinceActive = node.lastActivated
      ? (Date.now() - new Date(node.lastActivated).getTime()) / 86_400_000
      : Infinity;

    if (
      node.fitnessScore < PRUNING_THRESHOLD.minFitness &&
      daysSinceActive > PRUNING_THRESHOLD.inactivityDays
    ) {
      proposals.push({
        type: "node_pruned",
        targetId: node.nodeId,
        reason: `Fitness ${node.fitnessScore.toFixed(1)}, inactive ${daysSinceActive.toFixed(0)}d`,
        requiresApproval: true,
        proposedChanges: { status: "pruned" },
      });
    }
  }

  // Edge pruning
  for (const edge of edges) {
    if (
      edge.weight < PRUNING_THRESHOLD.minEdgeWeight &&
      edge.activationCount < PRUNING_THRESHOLD.minEdgeActivations
    ) {
      proposals.push({
        type: "edge_pruned",
        targetId: edge.edgeId,
        reason: `Weight ${edge.weight.toFixed(2)}, ${edge.activationCount} activations`,
        requiresApproval: false,
        proposedChanges: {},
      });
    }
  }

  return proposals;
}

export function generateSynaptogenesisProposals(
  nodes: GraphNode[],
  edges: GraphEdge[],
  coActivationMap: Map<string, number>,
): EvolutionProposal[] {
  const proposals: EvolutionProposal[] = [];
  const existingEdgePairs = new Set(edges.map((e) => `${e.sourceNodeId}->${e.targetNodeId}`));

  // Create edges between frequently co-activated nodes that lack a direct connection
  for (const [pairKey, count] of coActivationMap) {
    if (count < 10) continue; // Minimum co-activation threshold

    const [source, target] = pairKey.split("->");
    if (!source || !target) continue;
    if (existingEdgePairs.has(pairKey)) continue;
    if (existingEdgePairs.has(`${target}->${source}`)) continue;

    // Both nodes must exist and be active
    const sourceNode = nodes.find((n) => n.nodeId === source);
    const targetNode = nodes.find((n) => n.nodeId === target);
    if (!sourceNode || !targetNode) continue;
    if (sourceNode.status === "pruned" || targetNode.status === "pruned") continue;

    proposals.push({
      type: "edge_created",
      targetId: `${source}->${target}`,
      reason: `Co-activated ${count} times without direct edge`,
      requiresApproval: false,
      proposedChanges: {
        sourceNodeId: source,
        targetNodeId: target,
        edgeType: "activation",
        weight: Math.min(0.5, count / 100),
      },
    });
  }

  return proposals;
}
