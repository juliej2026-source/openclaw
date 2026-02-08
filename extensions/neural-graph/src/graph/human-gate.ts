import { interrupt } from "@langchain/langgraph";
import type { NeuralGraphStateType } from "./state.js";

// ---------------------------------------------------------------------------
// Human gate — pauses execution for human approval
// Uses LangGraph's interrupt() to pause the graph and wait for a
// human to approve/reject pending evolution mutations via portal or CLI.
// ---------------------------------------------------------------------------

export async function humanGate(
  state: NeuralGraphStateType,
): Promise<Partial<NeuralGraphStateType>> {
  const nodeId = "human_gate";
  const start = Date.now();

  const pendingProposals = state.evolutionProposals.filter((p) => p.requiresApproval);

  if (pendingProposals.length === 0) {
    return {
      nodesVisited: [nodeId],
      nodeLatencies: { [nodeId]: Date.now() - start },
      pendingApproval: false,
    };
  }

  // Interrupt execution — the portal or CLI can resume with approval/rejection
  const approval = interrupt({
    type: "human_approval_required",
    proposals: pendingProposals,
    message: `${pendingProposals.length} evolution mutation(s) require approval`,
  });

  // When resumed, approval will contain the human's decision
  const approved = approval?.approved ?? false;

  return {
    nodesVisited: [nodeId],
    nodeLatencies: { [nodeId]: Date.now() - start },
    pendingApproval: false,
    result: {
      human_gate: {
        approved,
        proposals_count: pendingProposals.length,
      },
    },
  };
}
