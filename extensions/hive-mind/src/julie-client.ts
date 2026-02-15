import type {
  StationIdentity,
  ExecutionRecord,
  RegistrationResponse,
  ExecutionReportResponse,
  RegistrationPayload,
} from "./types.js";
import { JULIE_BASE_URL, STATION_ID } from "./types.js";

const DEFAULT_TIMEOUT_MS = 10_000;

export type JulieClientOptions = {
  baseUrl?: string;
  timeoutMs?: number;
};

export class JulieClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(opts?: JulieClientOptions) {
    this.baseUrl = (opts?.baseUrl ?? JULIE_BASE_URL).replace(/\/+$/, "");
    this.timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async register(identity: StationIdentity): Promise<RegistrationResponse> {
    const payload: RegistrationPayload = {
      agent_id: STATION_ID,
      identity_data: {
        capabilities: identity.capabilities,
        availableModels: identity.models.map((m) => m.id),
        version: identity.version,
        platform: identity.platform,
        layers: identity.layers,
        commands: identity.commands,
        endpoints: identity.endpoints,
        runtime: identity.runtime,
      },
    };

    const res = await fetch(`${this.baseUrl}/api/v1/orchestration/hive/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    if (!res.ok) {
      throw new Error(`Julie registration failed: ${res.status} ${res.statusText}`);
    }

    return (await res.json()) as RegistrationResponse;
  }

  async reportExecution(record: ExecutionRecord): Promise<ExecutionReportResponse> {
    const res = await fetch(`${this.baseUrl}/api/v1/orchestration/hive/record`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(record),
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    if (!res.ok) {
      throw new Error(`Julie execution report failed: ${res.status} ${res.statusText}`);
    }

    return (await res.json()) as ExecutionReportResponse;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/health`, {
        signal: AbortSignal.timeout(3_000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}
