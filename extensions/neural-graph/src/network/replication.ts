import type { GraphNode, GraphEdge, EvolutionEvent } from "../types.js";
import { api } from "../../convex/_generated/api.js";
import { getConvexClient, isConvexHealthy } from "../persistence/convex-client.js";

// ---------------------------------------------------------------------------
// Network replication — 3 modes based on connectivity
// ---------------------------------------------------------------------------

export type ReplicationMode = "convex-realtime" | "julia-relay" | "offline";

export type GraphDelta = {
  nodesAdded: GraphNode[];
  nodesUpdated: Array<{ nodeId: string; changes: Partial<GraphNode> }>;
  nodesRemoved: string[];
  edgesAdded: GraphEdge[];
  edgesUpdated: Array<{ edgeId: string; changes: Partial<GraphEdge> }>;
  edgesRemoved: string[];
  events: EvolutionEvent[];
  stationId: string;
  timestamp: string;
};

export async function detectReplicationMode(): Promise<ReplicationMode> {
  // Check if shared Convex deployment is reachable
  const convexOk = await isConvexHealthy();
  if (convexOk) return "convex-realtime";

  // Check if JULIA is reachable
  const juliaUrl = process.env.JULIA_BASE_URL ?? "http://10.1.7.87:8000";
  try {
    const resp = await fetch(`${juliaUrl}/health`, {
      signal: AbortSignal.timeout(3000),
    });
    if (resp.ok) return "julia-relay";
  } catch {
    // JULIA not reachable
  }

  return "offline";
}

// ---------------------------------------------------------------------------
// Convex-realtime: automatic via Convex subscriptions
// No explicit replication needed — all stations read/write same tables.
// stationId field enables filtering for station-specific views.
// ---------------------------------------------------------------------------

export async function replicateViaConvex(
  _delta: GraphDelta,
): Promise<{ success: boolean; mode: "convex-realtime" }> {
  // In convex-realtime mode, mutations are applied directly to Convex.
  // Other stations see changes via real-time subscriptions.
  return { success: true, mode: "convex-realtime" };
}

// ---------------------------------------------------------------------------
// JULIA-relay: batch graph deltas through JULIA's API
// ---------------------------------------------------------------------------

export async function replicateViaJulia(
  delta: GraphDelta,
): Promise<{ success: boolean; mode: "julia-relay" }> {
  const juliaUrl = process.env.JULIA_BASE_URL ?? "http://10.1.7.87:8000";

  try {
    const resp = await fetch(`${juliaUrl}/api/neural/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(delta),
      signal: AbortSignal.timeout(10_000),
    });

    return { success: resp.ok, mode: "julia-relay" };
  } catch {
    return { success: false, mode: "julia-relay" };
  }
}

// ---------------------------------------------------------------------------
// Offline: queue deltas for later sync
// ---------------------------------------------------------------------------

const offlineQueue: GraphDelta[] = [];

export function queueForOfflineSync(delta: GraphDelta): void {
  offlineQueue.push(delta);
}

export function getOfflineQueue(): GraphDelta[] {
  return [...offlineQueue];
}

export function clearOfflineQueue(): void {
  offlineQueue.length = 0;
}

// ---------------------------------------------------------------------------
// Unified replication entry point
// ---------------------------------------------------------------------------

export async function replicateDelta(
  delta: GraphDelta,
): Promise<{ success: boolean; mode: ReplicationMode }> {
  const mode = await detectReplicationMode();

  switch (mode) {
    case "convex-realtime":
      return replicateViaConvex(delta);
    case "julia-relay":
      return replicateViaJulia(delta);
    case "offline":
      queueForOfflineSync(delta);
      return { success: true, mode: "offline" };
  }
}
