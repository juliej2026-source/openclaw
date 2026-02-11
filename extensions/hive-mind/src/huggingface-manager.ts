import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const HF_API_BASE = "https://huggingface.co/api";
const DEFAULT_TIMEOUT_MS = 15_000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type HfSpace = {
  id: string;
  author: string;
  lastModified: string;
  sdk?: string;
  status?: string;
  likes?: number;
  private?: boolean;
};

export type HfDataset = {
  id: string;
  author: string;
  lastModified: string;
  downloads?: number;
  likes?: number;
  private?: boolean;
  tags?: string[];
};

export type HfModel = {
  id: string;
  author?: string;
  lastModified?: string;
  downloads?: number;
  likes?: number;
  pipeline_tag?: string;
  private?: boolean;
  tags?: string[];
};

export type HfJob = {
  id: string;
  status: string;
  created_at?: string;
  hardware?: string;
  command?: string[];
};

// ---------------------------------------------------------------------------
// Token loading
// ---------------------------------------------------------------------------

export function loadHfToken(): string {
  if (process.env.HF_TOKEN) return process.env.HF_TOKEN;

  const tokenPath = path.join(process.env.HOME ?? os.homedir(), ".cache", "huggingface", "token");
  try {
    return fs.readFileSync(tokenPath, "utf-8").trim();
  } catch {
    throw new Error("HF token not found. Set HF_TOKEN or run 'hf auth login'.");
  }
}

// ---------------------------------------------------------------------------
// Manager
// ---------------------------------------------------------------------------

export class HuggingFaceManager {
  private readonly token: string;
  private readonly timeoutMs: number;

  constructor(opts: { token: string; timeoutMs?: number }) {
    this.token = opts.token;
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  private async request<T>(endpoint: string): Promise<T> {
    const res = await fetch(`${HF_API_BASE}${endpoint}`, {
      signal: AbortSignal.timeout(this.timeoutMs),
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${this.token}`,
      },
    });

    if (!res.ok) {
      throw new Error(`HF API error: ${res.status} ${res.statusText}`);
    }

    return (await res.json()) as T;
  }

  // -- whoami ---------------------------------------------------------------

  async getWhoAmI(): Promise<{ name: string }> {
    return this.request("/whoami-v2");
  }

  // -- spaces ---------------------------------------------------------------

  async listSpaces(opts?: { limit?: number; author?: string }): Promise<HfSpace[]> {
    const params = new URLSearchParams();
    if (opts?.author) params.set("author", opts.author);
    if (opts?.limit) params.set("limit", String(opts.limit));
    const qs = params.toString();
    return this.request(`/spaces${qs ? `?${qs}` : ""}`);
  }

  async getSpaceInfo(id: string): Promise<HfSpace> {
    return this.request(`/spaces/${id}`);
  }

  // -- datasets -------------------------------------------------------------

  async listDatasets(opts?: { limit?: number; author?: string }): Promise<HfDataset[]> {
    const params = new URLSearchParams();
    if (opts?.author) params.set("author", opts.author);
    if (opts?.limit) params.set("limit", String(opts.limit));
    const qs = params.toString();
    return this.request(`/datasets${qs ? `?${qs}` : ""}`);
  }

  async getDatasetInfo(id: string): Promise<HfDataset> {
    return this.request(`/datasets/${id}`);
  }

  // -- models ---------------------------------------------------------------

  async listModels(opts?: { limit?: number; author?: string }): Promise<HfModel[]> {
    const params = new URLSearchParams();
    if (opts?.author) params.set("author", opts.author);
    if (opts?.limit) params.set("limit", String(opts.limit));
    const qs = params.toString();
    return this.request(`/models${qs ? `?${qs}` : ""}`);
  }

  async getModelInfo(id: string): Promise<HfModel> {
    return this.request(`/models/${id}`);
  }

  // -- jobs -----------------------------------------------------------------

  async listJobs(): Promise<HfJob[]> {
    return this.request("/jobs");
  }

  async getJobInfo(id: string): Promise<HfJob> {
    return this.request(`/jobs/${id}`);
  }

  // -- health ---------------------------------------------------------------

  async isAvailable(): Promise<boolean> {
    try {
      await this.getWhoAmI();
      return true;
    } catch {
      return false;
    }
  }
}
