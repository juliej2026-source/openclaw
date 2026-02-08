import { describe, expect, it } from "vitest";
import { OllamaClient } from "../ollama-client.js";

describe("OllamaClient", () => {
  it("constructs with default options", () => {
    const client = new OllamaClient();
    expect(client).toBeDefined();
  });

  it("constructs with custom base URL", () => {
    const client = new OllamaClient({ baseUrl: "http://localhost:11435" });
    expect(client).toBeDefined();
  });

  it("isAvailable returns false when server is unreachable", async () => {
    // Use a port that's almost certainly not running Ollama
    const client = new OllamaClient({ baseUrl: "http://127.0.0.1:19999" });
    const available = await client.isAvailable();
    expect(available).toBe(false);
  });

  it("listModels throws on unreachable server", async () => {
    const client = new OllamaClient({
      baseUrl: "http://127.0.0.1:19999",
      timeoutMs: 1000,
    });
    await expect(client.listModels()).rejects.toThrow();
  });

  it("deleteModel throws on unreachable server", async () => {
    const client = new OllamaClient({
      baseUrl: "http://127.0.0.1:19999",
      timeoutMs: 1000,
    });
    await expect(client.deleteModel("test:latest")).rejects.toThrow();
  });

  it("showModel throws on unreachable server", async () => {
    const client = new OllamaClient({
      baseUrl: "http://127.0.0.1:19999",
      timeoutMs: 1000,
    });
    await expect(client.showModel("test:latest")).rejects.toThrow();
  });
});
