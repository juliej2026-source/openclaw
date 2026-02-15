// ---------------------------------------------------------------------------
// OpenClaw AI agent bridge — HTTP client for /v1/chat/completions
// ---------------------------------------------------------------------------

export type AiBridgeConfig = {
  gatewayUrl: string;
  gatewayToken: string;
  agentId?: string;
  timeoutMs?: number;
};

export type AiResponse = {
  content: string;
  model: string;
  finishReason: string;
  latencyMs: number;
};

export type AiBridge = {
  chat(params: { message: string; sessionKey: string }): Promise<AiResponse>;
  isAvailable(): Promise<boolean>;
};

export function createAiBridge(config: AiBridgeConfig): AiBridge {
  const { gatewayUrl, gatewayToken, agentId = "main", timeoutMs = 120_000 } = config;

  const baseUrl = gatewayUrl.replace(/\/+$/, "");

  async function chat(params: { message: string; sessionKey: string }): Promise<AiResponse> {
    const start = Date.now();
    const url = `${baseUrl}/v1/chat/completions`;

    const body = {
      model: agentId,
      messages: [{ role: "user", content: params.message }],
      user: params.sessionKey,
      stream: false,
    };

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${gatewayToken}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`AI gateway returned ${res.status}: ${text.slice(0, 200)}`);
    }

    const data = (await res.json()) as {
      choices?: Array<{
        message?: { content?: string };
        finish_reason?: string;
      }>;
      model?: string;
    };

    const choice = data.choices?.[0];
    const content = choice?.message?.content ?? "";
    const finishReason = choice?.finish_reason ?? "unknown";
    const model = data.model ?? agentId;

    return {
      content,
      model,
      finishReason,
      latencyMs: Date.now() - start,
    };
  }

  async function isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${baseUrl}/health`, {
        method: "GET",
        signal: AbortSignal.timeout(5_000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  return { chat, isAvailable };
}
