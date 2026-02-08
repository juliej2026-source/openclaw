import type { EvolutionProposal } from "../types.js";
import type { NeuralGraphStateType } from "./state.js";
import { api } from "../../convex/_generated/api.js";
import { getConvexClient } from "../persistence/convex-client.js";
import { MYELINATION_THRESHOLD, PRUNING_THRESHOLD, CORE_NODE_IDS } from "../types.js";

// ---------------------------------------------------------------------------
// Evaluation node — post-execution self-evaluation
// Proposes edge strengthening, myelination, pruning based on execution data
// ---------------------------------------------------------------------------

export async function evaluation(
  state: NeuralGraphStateType,
): Promise<Partial<NeuralGraphStateType>> {
  const start = Date.now();
  const nodeId = "evaluation";
  const proposals: EvolutionProposal[] = [];

  try {
    const client = getConvexClient();

    // Get current graph state
    const [nodes, edges] = await Promise.all([
      client.query(api.graph_nodes.list, {}),
      client.query(api.graph_edges.list, {}),
    ]);

    // 1. Strengthen edges between co-visited nodes
    const visited = state.nodesVisited;
    for (let i = 0; i < visited.length - 1; i++) {
      for (let j = i + 1; j < visited.length; j++) {
        const edge = edges.find(
          (e) =>
            (e.sourceNodeId === visited[i] && e.targetNodeId === visited[j]) ||
            (e.sourceNodeId === visited[j] && e.targetNodeId === visited[i]),
        );
        if (edge && edge.weight < 1.0) {
          const delta = state.success ? 0.02 : -0.01;
          const newWeight = Math.max(0, Math.min(1.0, edge.weight + delta));
          if (newWeight !== edge.weight) {
            proposals.push({
              type: "edge_weight_changed",
              targetId: edge.edgeId,
              reason: `Co-activation in ${state.success ? "successful" : "failed"} execution`,
              requiresApproval: false,
              proposedChanges: { weight: newWeight },
            });
          }
        }
      }
    }

    // 2. Check for myelination candidates
    for (const edge of edges) {
      if (
        !edge.myelinated &&
        edge.activationCount >= MYELINATION_THRESHOLD.activationCount &&
        edge.weight >= MYELINATION_THRESHOLD.minWeight
      ) {
        proposals.push({
          type: "edge_myelinated",
          targetId: edge.edgeId,
          reason: `High-traffic edge: ${edge.activationCount} activations, weight ${edge.weight.toFixed(2)}`,
          requiresApproval: false,
          proposedChanges: { myelinated: true },
        });
      }
    }

    // 3. Check for pruning candidates (only synthetic nodes)
    for (const node of nodes) {
      if (node.nodeType !== "synthetic") continue;
      if (CORE_NODE_IDS.includes(node.nodeId as (typeof CORE_NODE_IDS)[number])) continue;

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
          reason: `Low fitness (${node.fitnessScore.toFixed(1)}) + ${daysSinceActive.toFixed(0)}d inactive`,
          requiresApproval: true, // Pruning requires human approval
          proposedChanges: { status: "pruned" },
        });
      }
    }

    // 4. Check for low-weight edge pruning
    for (const edge of edges) {
      if (
        edge.weight < PRUNING_THRESHOLD.minEdgeWeight &&
        edge.activationCount < PRUNING_THRESHOLD.minEdgeActivations
      ) {
        proposals.push({
          type: "edge_pruned",
          targetId: edge.edgeId,
          reason: `Low weight (${edge.weight.toFixed(2)}) + ${edge.activationCount} activations`,
          requiresApproval: false,
          proposedChanges: {},
        });
      }
    }

    const shouldEvolve = proposals.length > 0;

    return {
      nodesVisited: [nodeId],
      nodeLatencies: { [nodeId]: Date.now() - start },
      shouldEvolve,
      evolutionProposals: proposals,
    };
  } catch (err) {
    return {
      nodesVisited: [nodeId],
      nodeLatencies: { [nodeId]: Date.now() - start },
      shouldEvolve: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// Conditional routing: evolution needed?
export function shouldEvolve(state: NeuralGraphStateType): string {
  return state.shouldEvolve ? "mutation" : "__end__";
}

// ---------------------------------------------------------------------------
// Mutation node — applies auto-approved mutations; routes critical to human gate
// ---------------------------------------------------------------------------

export async function mutation(
  state: NeuralGraphStateType,
): Promise<Partial<NeuralGraphStateType>> {
  const start = Date.now();
  const nodeId = "mutation";
  let hasPendingApproval = false;

  try {
    const client = getConvexClient();

    for (const proposal of state.evolutionProposals) {
      const now = new Date().toISOString();

      if (proposal.requiresApproval) {
        // Record as pending — human_gate will handle
        await client.mutation(api.evolution.record, {
          eventType: proposal.type,
          targetId: proposal.targetId,
          previousState: {},
          newState: proposal.proposedChanges,
          reason: proposal.reason,
          triggeredBy: "evolution_cycle",
          requiresApproval: true,
          approvalStatus: "pending",
          stationId: state.sourceStationId,
          createdAt: now,
        });
        hasPendingApproval = true;
        continue;
      }

      // Auto-apply non-critical mutations
      switch (proposal.type) {
        case "edge_weight_changed": {
          const weight = proposal.proposedChanges.weight as number;
          await client.mutation(api.graph_edges.updateWeight, {
            edgeId: proposal.targetId,
            weight,
          });
          break;
        }
        case "edge_myelinated": {
          await client.mutation(api.graph_edges.myelinate, {
            edgeId: proposal.targetId,
          });
          break;
        }
        case "edge_pruned": {
          await client.mutation(api.graph_edges.remove, {
            edgeId: proposal.targetId,
          });
          break;
        }
        default:
          break;
      }

      // Record the auto-approved event
      await client.mutation(api.evolution.record, {
        eventType: proposal.type,
        targetId: proposal.targetId,
        previousState: {},
        newState: proposal.proposedChanges,
        reason: proposal.reason,
        triggeredBy: "evolution_cycle",
        requiresApproval: false,
        approvalStatus: "auto_approved",
        stationId: state.sourceStationId,
        createdAt: now,
      });
    }

    return {
      nodesVisited: [nodeId],
      nodeLatencies: { [nodeId]: Date.now() - start },
      pendingApproval: hasPendingApproval,
    };
  } catch (err) {
    return {
      nodesVisited: [nodeId],
      nodeLatencies: { [nodeId]: Date.now() - start },
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// Conditional routing: needs human approval?
export function needsApproval(state: NeuralGraphStateType): string {
  return state.pendingApproval ? "human_gate" : "__end__";
}
