import { describe, expect, it } from "vitest";
import type { OllamaModelTag } from "../types.js";
import { inferCapabilities, ollamaTagToLocalModel } from "../discovery.js";

describe("inferCapabilities", () => {
  it("detects code models", () => {
    expect(inferCapabilities("codellama:13b")).toContain("code");
    expect(inferCapabilities("deepseek-coder:6.7b")).toContain("code");
    expect(inferCapabilities("starcoder2:7b")).toContain("code");
    expect(inferCapabilities("codestral:22b")).toContain("code");
    expect(inferCapabilities("qwen3:14b", "codegemma")).toContain("code");
  });

  it("detects vision models", () => {
    expect(inferCapabilities("llava:13b")).toContain("vision");
    expect(inferCapabilities("llama3.2-vision:11b")).toContain("vision");
    expect(inferCapabilities("moondream:1.8b")).toContain("vision");
    expect(inferCapabilities("minicpm-v:8b")).toContain("vision");
    expect(inferCapabilities("qwen-vl:7b")).toContain("vision");
  });

  it("detects reasoning models", () => {
    expect(inferCapabilities("deepseek-r1:14b")).toContain("reasoning");
    expect(inferCapabilities("qwq:32b")).toContain("reasoning");
  });

  it("detects embedding models", () => {
    expect(inferCapabilities("nomic-embed-text:latest")).toContain("embedding");
    expect(inferCapabilities("bge-large:latest")).toContain("embedding");
    expect(inferCapabilities("mxbai-embed-large:latest")).toContain("embedding");
    expect(inferCapabilities("all-minilm:latest")).toContain("embedding");
  });

  it("defaults to chat for generic models", () => {
    const caps = inferCapabilities("llama3.3:70b");
    expect(caps).toContain("chat");
    expect(caps).not.toContain("code");
    expect(caps).not.toContain("vision");
  });

  it("adds chat alongside code capabilities", () => {
    const caps = inferCapabilities("codellama:7b");
    expect(caps).toContain("code");
    expect(caps).toContain("chat");
  });

  it("does not add chat to embedding models", () => {
    const caps = inferCapabilities("nomic-embed-text:latest");
    expect(caps).toContain("embedding");
    expect(caps).not.toContain("chat");
  });
});

describe("ollamaTagToLocalModel", () => {
  it("converts a typical Ollama tag", () => {
    const tag: OllamaModelTag = {
      name: "qwen3:14b",
      model: "qwen3:14b",
      modified_at: "2025-01-15T10:30:00Z",
      size: 8_500_000_000,
      digest: "sha256:abc123",
      details: {
        format: "gguf",
        family: "qwen2",
        parameter_size: "14.8B",
        quantization_level: "Q4_K_M",
      },
    };

    const model = ollamaTagToLocalModel(tag);
    expect(model.id).toBe("qwen3:14b");
    expect(model.runtime).toBe("ollama");
    expect(model.ollamaTag).toBe("qwen3:14b");
    expect(model.sizeBytes).toBe(8_500_000_000);
    expect(model.quantization).toBe("Q4_K_M");
    expect(model.parameterCount).toBe("14.8B");
    expect(model.family).toBe("qwen2");
    expect(model.capabilities).toContain("chat");
    expect(model.contextWindow).toBeGreaterThan(0);
    expect(model.maxTokens).toBe(8192);
    expect(model.usageCount).toBe(0);
  });

  it("extracts parameter count from name when details lack it", () => {
    const tag: OllamaModelTag = {
      name: "llama3.3:70b",
      model: "llama3.3:70b",
      modified_at: "2025-01-15T10:30:00Z",
      size: 40_000_000_000,
      digest: "sha256:def456",
      details: {
        format: "gguf",
        family: "llama",
        parameter_size: "",
        quantization_level: "Q4_0",
      },
    };

    const model = ollamaTagToLocalModel(tag);
    expect(model.parameterCount).toBe("70B");
  });
});
