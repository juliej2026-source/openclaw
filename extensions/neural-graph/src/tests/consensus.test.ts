import { describe, it, expect } from "vitest";
import type { EvolutionProposal } from "../types.js";
import {
  proposeConsensus,
  castVote,
  resolveConsensus,
  getPendingConsensus,
} from "../network/consensus.js";

const mockProposal: EvolutionProposal = {
  type: "node_pruned",
  targetId: "synth-1",
  reason: "Low fitness",
  requiresApproval: true,
  proposedChanges: { status: "pruned" },
};

describe("Neural Graph — consensus protocol", () => {
  it("creates a consensus request", () => {
    const request = proposeConsensus(mockProposal, "iot-hub", ["julia", "scraper"]);
    expect(request.proposalId).toBeDefined();
    expect(request.affectedStationIds).toEqual(["julia", "scraper"]);
    expect(request.proposerStationId).toBe("iot-hub");
  });

  it("accepts votes", () => {
    const request = proposeConsensus(mockProposal, "iot-hub", ["julia"]);
    const ok = castVote(request.proposalId, "julia", "approve");
    expect(ok).toBe(true);
  });

  it("rejects votes for unknown proposals", () => {
    const ok = castVote("nonexistent", "julia", "approve");
    expect(ok).toBe(false);
  });

  it("resolves with majority approval", () => {
    const request = proposeConsensus(mockProposal, "iot-hub", ["julia", "scraper"]);
    castVote(request.proposalId, "julia", "approve");
    castVote(request.proposalId, "scraper", "approve");

    const result = resolveConsensus(request.proposalId);
    expect(result).not.toBeNull();
    expect(result!.approved).toBe(true);
  });

  it("resolves with majority rejection", () => {
    const request = proposeConsensus(mockProposal, "iot-hub", ["julia", "scraper"]);
    castVote(request.proposalId, "julia", "reject");
    castVote(request.proposalId, "scraper", "reject");

    const result = resolveConsensus(request.proposalId);
    expect(result).not.toBeNull();
    expect(result!.approved).toBe(false);
  });

  it("returns null if not all votes are in yet", () => {
    const request = proposeConsensus(mockProposal, "iot-hub", ["julia", "scraper"]);
    castVote(request.proposalId, "julia", "approve");
    // scraper hasn't voted

    const result = resolveConsensus(request.proposalId);
    expect(result).toBeNull(); // Still waiting
  });

  it("tracks pending consensus requests", () => {
    const before = getPendingConsensus().length;
    proposeConsensus(mockProposal, "iot-hub", ["julia"]);
    expect(getPendingConsensus().length).toBe(before + 1);
  });
});
