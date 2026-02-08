import type { EvolutionProposal } from "../types.js";

// ---------------------------------------------------------------------------
// Lightweight consensus for cross-station mutations
// Proposer broadcasts, affected stations vote, majority wins.
// Auto-approve on 5-minute timeout.
// ---------------------------------------------------------------------------

export type Vote = "approve" | "reject" | "timeout";

export type ConsensusRequest = {
  proposalId: string;
  proposal: EvolutionProposal;
  proposerStationId: string;
  affectedStationIds: string[];
  createdAt: string;
  expiresAt: string;
};

export type ConsensusResult = {
  proposalId: string;
  approved: boolean;
  votes: Record<string, Vote>;
  reason: string;
};

const CONSENSUS_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

const pendingConsensus = new Map<string, ConsensusRequest>();
const votes = new Map<string, Map<string, Vote>>();

export function proposeConsensus(
  proposal: EvolutionProposal,
  proposerStationId: string,
  affectedStationIds: string[],
): ConsensusRequest {
  const proposalId = `consensus-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date();
  const request: ConsensusRequest = {
    proposalId,
    proposal,
    proposerStationId,
    affectedStationIds,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + CONSENSUS_TIMEOUT_MS).toISOString(),
  };

  pendingConsensus.set(proposalId, request);
  votes.set(proposalId, new Map());

  return request;
}

export function castVote(proposalId: string, stationId: string, vote: Vote): boolean {
  const proposalVotes = votes.get(proposalId);
  if (!proposalVotes) return false;
  proposalVotes.set(stationId, vote);
  return true;
}

export function resolveConsensus(proposalId: string): ConsensusResult | null {
  const request = pendingConsensus.get(proposalId);
  const proposalVotes = votes.get(proposalId);
  if (!request || !proposalVotes) return null;

  const now = new Date();
  const expired = now >= new Date(request.expiresAt);

  // Fill in timeout votes for non-responding stations
  const allVotes: Record<string, Vote> = {};
  for (const stationId of request.affectedStationIds) {
    const vote = proposalVotes.get(stationId);
    if (vote) {
      allVotes[stationId] = vote;
    } else if (expired) {
      allVotes[stationId] = "timeout";
    }
  }

  // Check if all votes are in (or expired)
  const totalVoters = request.affectedStationIds.length;
  const votesIn = Object.keys(allVotes).length;
  if (votesIn < totalVoters && !expired) return null; // Still waiting

  // Count votes (timeout = approve per design)
  let approveCount = 0;
  let rejectCount = 0;
  for (const vote of Object.values(allVotes)) {
    if (vote === "approve" || vote === "timeout") approveCount++;
    else rejectCount++;
  }

  const approved = approveCount > rejectCount;

  // Clean up
  pendingConsensus.delete(proposalId);
  votes.delete(proposalId);

  return {
    proposalId,
    approved,
    votes: allVotes,
    reason: approved
      ? `Approved: ${approveCount}/${totalVoters} votes`
      : `Rejected: ${rejectCount}/${totalVoters} votes`,
  };
}

export function getPendingConsensus(): ConsensusRequest[] {
  return [...pendingConsensus.values()];
}
