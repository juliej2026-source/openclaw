import { describe, it, expect } from "vitest";
import { CONFIG_TEMPLATES, findTemplate, listTemplateNames } from "../training/config-templates.js";

describe("CONFIG_TEMPLATES", () => {
  it("has templates for all major families", () => {
    const families = new Set(CONFIG_TEMPLATES.map((t) => t.family));
    expect(families.has("llama")).toBe(true);
    expect(families.has("qwen")).toBe(true);
    expect(families.has("mistral")).toBe(true);
    expect(families.has("gemma")).toBe(true);
    expect(families.has("phi")).toBe(true);
    expect(families.has("deepseek")).toBe(true);
    expect(families.has("codellama")).toBe(true);
  });

  it("all templates have valid hyperparams", () => {
    for (const t of CONFIG_TEMPLATES) {
      expect(t.hyperparams.epochs).toBeGreaterThan(0);
      expect(t.hyperparams.batchSize).toBeGreaterThan(0);
      expect(t.hyperparams.learningRate).toBeGreaterThan(0);
      expect(t.hyperparams.loraRank).toBeGreaterThan(0);
      expect(t.hyperparams.loraAlpha).toBeGreaterThan(0);
      expect(t.hyperparams.maxSeqLength).toBeGreaterThan(0);
    }
  });

  it("8GB configs use smaller batch sizes than 24GB configs", () => {
    const small = CONFIG_TEMPLATES.find((t) => t.vramTier === "8gb");
    const large = CONFIG_TEMPLATES.find((t) => t.vramTier === "24gb");
    expect(small).toBeDefined();
    expect(large).toBeDefined();
    expect(small!.hyperparams.batchSize).toBeLessThanOrEqual(large!.hyperparams.batchSize);
  });
});

describe("findTemplate", () => {
  it("finds a Llama template for llama model name", () => {
    const template = findTemplate("llama3.3:7b");
    expect(template.family).toBe("llama");
  });

  it("finds a Qwen template for qwen model name", () => {
    const template = findTemplate("qwen3:14b", 24);
    expect(template.family).toBe("qwen");
  });

  it("selects correct VRAM tier", () => {
    const t8 = findTemplate("llama3:7b", 8);
    expect(t8.vramTier).toBe("8gb");

    const t16 = findTemplate("llama3:7b", 16);
    expect(t16.vramTier).toBe("16gb");

    const t24 = findTemplate("llama3:7b", 24);
    expect(t24.vramTier).toBe("24gb");
  });

  it("falls back to lower tier when exact match unavailable", () => {
    // phi only has 8gb tier, so 24gb should fall back
    const template = findTemplate("phi3:3b", 24);
    expect(template.family).toBe("phi");
    expect(template.vramTier).toBe("8gb");
  });

  it("returns a valid template for unknown model families", () => {
    const template = findTemplate("some-unknown-model:7b");
    expect(template).toBeDefined();
    expect(template.hyperparams.epochs).toBeGreaterThan(0);
  });

  it("handles codellama before llama in matching", () => {
    const template = findTemplate("codellama:13b", 24);
    expect(template.family).toBe("codellama");
  });
});

describe("listTemplateNames", () => {
  it("returns all template names", () => {
    const names = listTemplateNames();
    expect(names.length).toBe(CONFIG_TEMPLATES.length);
    expect(names).toContain("llama-7b-8gb");
    expect(names).toContain("qwen-14b-24gb");
  });
});
