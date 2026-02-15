import { describe, it, expect, vi, afterEach } from "vitest";
import { createAiBridge } from "../discord/ai-bridge.js";

describe("ai-bridge", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  const defaultConfig = {
    gatewayUrl: "http://127.0.0.1:18789",
    gatewayToken: "test-token",
    agentId: "main",
  };

  it("sends correct request to /v1/chat/completions", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [{ message: { content: "Hello!" }, finish_reason: "stop" }],
          model: "main",
        }),
    });

    const bridge = createAiBridge(defaultConfig);
    const response = await bridge.chat({ message: "Hi", sessionKey: "session-1" });

    expect(response.content).toBe("Hello!");
    expect(response.model).toBe("main");
    expect(response.finishReason).toBe("stop");
    expect(response.latencyMs).toBeGreaterThanOrEqual(0);

    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledWith(
      "http://127.0.0.1:18789/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          Authorization: "Bearer test-token",
        }),
      }),
    );

    // Verify request body
    const callArgs = vi.mocked(globalThis.fetch).mock.calls[0];
    const body = JSON.parse(callArgs[1]?.body as string);
    expect(body.model).toBe("main");
    expect(body.messages).toEqual([{ role: "user", content: "Hi" }]);
    expect(body.user).toBe("session-1");
    expect(body.stream).toBe(false);
  });

  it("throws on non-ok response", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve("Internal Server Error"),
    });

    const bridge = createAiBridge(defaultConfig);
    await expect(bridge.chat({ message: "Hi", sessionKey: "s" })).rejects.toThrow(
      "AI gateway returned 500",
    );
  });

  it("handles missing choices gracefully", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ choices: [] }),
    });

    const bridge = createAiBridge(defaultConfig);
    const response = await bridge.chat({ message: "Hi", sessionKey: "s" });
    expect(response.content).toBe("");
    expect(response.finishReason).toBe("unknown");
  });

  it("uses custom agent ID in request body", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [{ message: { content: "ok" }, finish_reason: "stop" }],
          model: "custom-agent",
        }),
    });

    const bridge = createAiBridge({ ...defaultConfig, agentId: "custom-agent" });
    await bridge.chat({ message: "test", sessionKey: "s" });

    const callArgs = vi.mocked(globalThis.fetch).mock.calls[0];
    const body = JSON.parse(callArgs[1]?.body as string);
    expect(body.model).toBe("custom-agent");
  });

  it("strips trailing slash from gatewayUrl", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [{ message: { content: "ok" }, finish_reason: "stop" }],
        }),
    });

    const bridge = createAiBridge({ ...defaultConfig, gatewayUrl: "http://localhost:8080/" });
    await bridge.chat({ message: "test", sessionKey: "s" });

    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledWith(
      "http://localhost:8080/v1/chat/completions",
      expect.anything(),
    );
  });

  describe("isAvailable", () => {
    it("returns true when /health returns ok", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({ ok: true });

      const bridge = createAiBridge(defaultConfig);
      const result = await bridge.isAvailable();
      expect(result).toBe(true);
      expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledWith(
        "http://127.0.0.1:18789/health",
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("returns false when /health returns non-ok", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({ ok: false });

      const bridge = createAiBridge(defaultConfig);
      const result = await bridge.isAvailable();
      expect(result).toBe(false);
    });

    it("returns false when /health throws", async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error("connection refused"));

      const bridge = createAiBridge(defaultConfig);
      const result = await bridge.isAvailable();
      expect(result).toBe(false);
    });
  });
});
