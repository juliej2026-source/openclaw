// ---------------------------------------------------------------------------
// Peer station client — dispatch commands, tandem tasks, and delegations
// to peer stations on the hive network.
// ---------------------------------------------------------------------------

import type {
  NetworkCommand,
  CommandResponse,
  TandemTaskRequest,
  TandemTaskResponse,
  TandemTaskCallback,
  DelegationRequest,
  DelegationResponse,
  PeerStation,
} from "./types.js";
import { STATION_ID, STATION_IP, STATION_PORT, PEER_STATIONS } from "./types.js";
import { UNIFI_API_KEY } from "./unifi-types.js";

const DEFAULT_TIMEOUT_MS = 30_000;

export type PeerClientOptions = {
  timeoutMs?: number;
};

export class PeerClient {
  private readonly timeoutMs: number;
  private readonly peers: Map<string, PeerStation>;

  constructor(opts?: PeerClientOptions) {
    this.timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.peers = new Map();
    for (const peer of PEER_STATIONS) {
      this.peers.set(peer.station_id, { ...peer });
    }
  }

  /** Get all known peer stations. */
  getPeers(): PeerStation[] {
    return [...this.peers.values()];
  }

  /** Get a specific peer by station ID. */
  getPeer(stationId: string): PeerStation | undefined {
    return this.peers.get(stationId);
  }

  /** Update a peer's reachability status. */
  updateReachability(stationId: string, reachable: boolean): void {
    const peer = this.peers.get(stationId);
    if (peer) {
      peer.reachable = reachable;
      peer.last_seen = reachable ? new Date().toISOString() : peer.last_seen;
    }
  }

  /** Build the base URL for a peer. */
  private baseUrl(peer: PeerStation): string {
    return `http://${peer.ip}:${peer.port}`;
  }

  /** Dispatch a command to a peer station. */
  async dispatchCommand(stationId: string, cmd: NetworkCommand): Promise<CommandResponse> {
    const peer = this.peers.get(stationId);
    if (!peer) {
      return {
        success: false,
        command: cmd.command,
        request_id: cmd.request_id,
        error: `Unknown peer station: ${stationId}`,
        latency_ms: 0,
      };
    }

    const start = Date.now();
    try {
      const res = await fetch(`${this.baseUrl(peer)}/api/network/command`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": UNIFI_API_KEY,
        },
        body: JSON.stringify(cmd),
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (!res.ok) {
        return {
          success: false,
          command: cmd.command,
          request_id: cmd.request_id,
          error: `Peer ${stationId} returned ${res.status}`,
          latency_ms: Date.now() - start,
        };
      }

      const data = (await res.json()) as CommandResponse;
      this.updateReachability(stationId, true);
      return { ...data, latency_ms: Date.now() - start };
    } catch (err) {
      this.updateReachability(stationId, false);
      return {
        success: false,
        command: cmd.command,
        request_id: cmd.request_id,
        error: err instanceof Error ? err.message : String(err),
        latency_ms: Date.now() - start,
      };
    }
  }

  /** Send a tandem task to a peer station. */
  async sendTandemTask(
    stationId: string,
    taskType: string,
    payload: Record<string, unknown>,
  ): Promise<TandemTaskResponse> {
    const peer = this.peers.get(stationId);
    if (!peer) {
      return {
        accepted: false,
        task_id: "",
        station_id: stationId,
        error: `Unknown peer station: ${stationId}`,
      };
    }

    const taskId = `tandem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const callbackUrl = `http://${STATION_IP}:${STATION_PORT}/api/network/tandem/callback`;

    const request: TandemTaskRequest = {
      task_id: taskId,
      from_station: STATION_ID,
      task_type: taskType,
      payload,
      callback_url: callbackUrl,
      timeout_ms: this.timeoutMs,
    };

    try {
      const res = await fetch(`${this.baseUrl(peer)}/api/network/tandem`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": UNIFI_API_KEY,
        },
        body: JSON.stringify(request),
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (!res.ok) {
        return {
          accepted: false,
          task_id: taskId,
          station_id: stationId,
          error: `Peer returned ${res.status}`,
        };
      }

      this.updateReachability(stationId, true);
      return (await res.json()) as TandemTaskResponse;
    } catch (err) {
      this.updateReachability(stationId, false);
      return {
        accepted: false,
        task_id: taskId,
        station_id: stationId,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /** Delegate a task to a peer station. */
  async delegateTask(
    stationId: string,
    command: string,
    params?: Record<string, unknown>,
  ): Promise<DelegationResponse> {
    const peer = this.peers.get(stationId);
    if (!peer) {
      return {
        accepted: false,
        task_id: "",
        station_id: stationId,
        error: `Unknown peer station: ${stationId}`,
      };
    }

    const taskId = `deleg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const callbackUrl = `http://${STATION_IP}:${STATION_PORT}/api/network/delegation/callback`;

    const request: DelegationRequest = {
      task_id: taskId,
      from_station: STATION_ID,
      command,
      params,
      callback_url: callbackUrl,
    };

    try {
      const res = await fetch(`${this.baseUrl(peer)}/api/network/delegation/inbound`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": UNIFI_API_KEY,
        },
        body: JSON.stringify(request),
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (!res.ok) {
        return {
          accepted: false,
          task_id: taskId,
          station_id: stationId,
          error: `Peer returned ${res.status}`,
        };
      }

      this.updateReachability(stationId, true);
      return (await res.json()) as DelegationResponse;
    } catch (err) {
      this.updateReachability(stationId, false);
      return {
        accepted: false,
        task_id: taskId,
        station_id: stationId,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /** Check if a peer station is reachable via /health. */
  async checkPeerHealth(stationId: string): Promise<boolean> {
    const peer = this.peers.get(stationId);
    if (!peer) return false;

    try {
      const res = await fetch(`${this.baseUrl(peer)}/health`, {
        signal: AbortSignal.timeout(3_000),
      });
      const reachable = res.ok;
      this.updateReachability(stationId, reachable);
      return reachable;
    } catch {
      this.updateReachability(stationId, false);
      return false;
    }
  }

  /** Find peers that have a given capability. */
  findByCapability(capability: string): PeerStation[] {
    return [...this.peers.values()].filter((p) => p.capabilities.includes(capability));
  }
}
