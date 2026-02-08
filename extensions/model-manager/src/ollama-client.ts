import type {
  OllamaModelInfo,
  OllamaModelTag,
  OllamaPullProgress,
  OllamaRunningModel,
} from "./types.js";

const DEFAULT_BASE_URL = "http://127.0.0.1:11434";
const DEFAULT_TIMEOUT_MS = 10_000;
const PULL_TIMEOUT_MS = 30 * 60 * 1000; // 30 min for large model downloads

export type OllamaClientOptions = {
  baseUrl?: string;
  timeoutMs?: number;
};

/** Lightweight Ollama HTTP API client. */
export class OllamaClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(opts?: OllamaClientOptions) {
    this.baseUrl = (opts?.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  /** Check if the Ollama server is reachable. */
  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/version`, {
        signal: AbortSignal.timeout(3_000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  /** List all locally available models (GET /api/tags). */
  async listModels(): Promise<OllamaModelTag[]> {
    const res = await fetch(`${this.baseUrl}/api/tags`, {
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!res.ok) {
      throw new Error(`Ollama list failed: ${res.status} ${res.statusText}`);
    }
    const body = (await res.json()) as { models?: OllamaModelTag[] };
    return body.models ?? [];
  }

  /**
   * Pull (download) a model. Streams progress events.
   * Returns an async iterable of progress events.
   */
  async *pull(model: string, opts?: { insecure?: boolean }): AsyncIterable<OllamaPullProgress> {
    const res = await fetch(`${this.baseUrl}/api/pull`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: model, insecure: opts?.insecure ?? false, stream: true }),
      signal: AbortSignal.timeout(PULL_TIMEOUT_MS),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Ollama pull failed: ${res.status} ${text}`);
    }
    if (!res.body) {
      throw new Error("Ollama pull: no response body");
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        buffer += decoder.decode(value, { stream: true });
        // Each line is a JSON object
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) {
            continue;
          }
          try {
            yield JSON.parse(trimmed) as OllamaPullProgress;
          } catch {
            // Skip malformed lines
          }
        }
      }
      // Process remaining buffer
      if (buffer.trim()) {
        try {
          yield JSON.parse(buffer.trim()) as OllamaPullProgress;
        } catch {
          // Skip
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Pull a model and wait for completion. Returns the final status.
   * Optionally calls onProgress with each streaming event.
   */
  async pullAndWait(
    model: string,
    onProgress?: (event: OllamaPullProgress) => void,
  ): Promise<{ success: boolean; finalStatus: string }> {
    let finalStatus = "";
    for await (const event of this.pull(model)) {
      finalStatus = event.status;
      onProgress?.(event);
    }
    return {
      success: finalStatus === "success",
      finalStatus,
    };
  }

  /** Delete a model (DELETE /api/delete). */
  async deleteModel(model: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/delete`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: model }),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Ollama delete failed: ${res.status} ${text}`);
    }
  }

  /** Get detailed info about a model (POST /api/show). */
  async showModel(model: string): Promise<OllamaModelInfo> {
    const res = await fetch(`${this.baseUrl}/api/show`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: model }),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Ollama show failed: ${res.status} ${text}`);
    }
    return (await res.json()) as OllamaModelInfo;
  }

  /** List currently running/loaded models (GET /api/ps). */
  async listRunning(): Promise<OllamaRunningModel[]> {
    const res = await fetch(`${this.baseUrl}/api/ps`, {
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!res.ok) {
      throw new Error(`Ollama ps failed: ${res.status} ${res.statusText}`);
    }
    const body = (await res.json()) as { models?: OllamaRunningModel[] };
    return body.models ?? [];
  }
}
