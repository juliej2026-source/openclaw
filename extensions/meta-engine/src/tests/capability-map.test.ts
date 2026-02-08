import { describe, it, expect } from "vitest";
import {
  getCapabilityStrengths,
  getStrengthForTask,
  FAMILY_CAPABILITIES,
} from "../capability-map.js";

describe("FAMILY_CAPABILITIES", () => {
  const requiredFamilies = [
    "codellama",
    "llama",
    "qwen",
    "mistral",
    "gemma",
    "phi",
    "deepseek",
    "qwq",
    "llava",
  ];

  it("has entries for all expected model families", () => {
    for (const family of requiredFamilies) {
      expect(FAMILY_CAPABILITIES).toHaveProperty(family);
    }
  });

  it("has all capability values between 0 and 1", () => {
    for (const [family, strengths] of Object.entries(FAMILY_CAPABILITIES)) {
      for (const [capability, value] of Object.entries(strengths)) {
        expect(value, `${family}.${capability}`).toBeGreaterThanOrEqual(0);
        expect(value, `${family}.${capability}`).toBeLessThanOrEqual(1);
      }
    }
  });

  it("codellama has high coding strength", () => {
    expect(FAMILY_CAPABILITIES.codellama?.coding).toBe(0.9);
  });

  it("llama has high chat strength", () => {
    expect(FAMILY_CAPABILITIES.llama?.chat).toBe(0.85);
  });

  it("qwq has high reasoning strength", () => {
    expect(FAMILY_CAPABILITIES.qwq?.reasoning).toBe(0.95);
  });

  it("llava has high vision strength", () => {
    expect(FAMILY_CAPABILITIES.llava?.vision).toBe(0.9);
  });

  it("deepseek has high coding and reasoning strengths", () => {
    expect(FAMILY_CAPABILITIES.deepseek?.coding).toBe(0.85);
    expect(FAMILY_CAPABILITIES.deepseek?.reasoning).toBe(0.8);
  });

  it("phi has balanced moderate strengths", () => {
    expect(FAMILY_CAPABILITIES.phi?.coding).toBe(0.7);
    expect(FAMILY_CAPABILITIES.phi?.math).toBe(0.7);
  });

  it("mistral has good chat strength", () => {
    expect(FAMILY_CAPABILITIES.mistral?.chat).toBe(0.8);
  });

  it("gemma has moderate strengths across the board", () => {
    const gemma = FAMILY_CAPABILITIES.gemma;
    expect(gemma.coding).toBe(0.65);
    expect(gemma.chat).toBe(0.75);
    expect(gemma.summarization).toBe(0.7);
  });

  it("qwen has strong coding and reasoning", () => {
    expect(FAMILY_CAPABILITIES.qwen?.coding).toBe(0.8);
    expect(FAMILY_CAPABILITIES.qwen?.reasoning).toBe(0.8);
  });
});

describe("getCapabilityStrengths", () => {
  it("returns specific strengths for known families", () => {
    const codellama = getCapabilityStrengths("codellama");
    expect(codellama.coding).toBe(0.9);
    expect(codellama.chat).toBe(0.4);
    expect(codellama["tool-use"]).toBe(0.7);
  });

  it("returns specific strengths for llama family", () => {
    const llama = getCapabilityStrengths("llama");
    expect(llama.chat).toBe(0.85);
    expect(llama.coding).toBe(0.7);
    expect(llama.summarization).toBe(0.75);
  });

  it("returns default strengths for unknown families", () => {
    const unknown = getCapabilityStrengths("totally-unknown-model");
    expect(unknown.coding).toBe(0.5);
    expect(unknown.reasoning).toBe(0.5);
    expect(unknown.chat).toBe(0.6);
    expect(unknown.creative).toBe(0.5);
    expect(unknown.math).toBe(0.4);
    expect(unknown.analysis).toBe(0.5);
    expect(unknown["tool-use"]).toBe(0.5);
    expect(unknown.summarization).toBe(0.5);
  });

  it("handles case-insensitive lookup via lowercase input", () => {
    // The function lowercases the input, so "codellama" matches
    const strengths = getCapabilityStrengths("codellama");
    expect(strengths.coding).toBe(0.9);
  });

  it("lowercases the family name before lookup", () => {
    // Uppercase input gets lowercased internally
    const strengths = getCapabilityStrengths("CodeLlama");
    // Since FAMILY_CAPABILITIES keys are lowercase, "codellama" should match
    expect(strengths.coding).toBe(0.9);
  });

  it("returns default for empty string", () => {
    const strengths = getCapabilityStrengths("");
    // Empty string won't match any family
    expect(strengths.chat).toBe(0.6);
  });
});

describe("getStrengthForTask", () => {
  it("returns the correct value for known family + task combos", () => {
    expect(getStrengthForTask("codellama", "coding")).toBe(0.9);
    expect(getStrengthForTask("llama", "chat")).toBe(0.85);
    expect(getStrengthForTask("qwq", "reasoning")).toBe(0.95);
    expect(getStrengthForTask("qwq", "math")).toBe(0.9);
    expect(getStrengthForTask("llava", "vision")).toBe(0.9);
    expect(getStrengthForTask("deepseek", "coding")).toBe(0.85);
  });

  it("returns default strengths for known family with specific task", () => {
    // codellama has coding=0.9 but chat=0.4
    expect(getStrengthForTask("codellama", "chat")).toBe(0.4);
    expect(getStrengthForTask("codellama", "creative")).toBe(0.3);
  });

  it("returns 0.5 for unknown task types", () => {
    // "unknown-task" is not a key in any CapabilityStrengths
    expect(getStrengthForTask("codellama", "unknown-task")).toBe(0.5);
    expect(getStrengthForTask("llama", "nonexistent")).toBe(0.5);
    expect(getStrengthForTask("qwen", "weather-prediction")).toBe(0.5);
  });

  it("returns 0.5 for unknown family with unknown task", () => {
    expect(getStrengthForTask("imaginary-model", "unknown-task")).toBe(0.5);
  });

  it("returns default values for unknown family with known tasks", () => {
    expect(getStrengthForTask("some-new-model", "coding")).toBe(0.5);
    expect(getStrengthForTask("some-new-model", "chat")).toBe(0.6);
    expect(getStrengthForTask("some-new-model", "math")).toBe(0.4);
  });

  it("handles uppercase family name via lowercasing", () => {
    expect(getStrengthForTask("CODELLAMA", "coding")).toBe(0.9);
    expect(getStrengthForTask("Llama", "chat")).toBe(0.85);
  });

  it("returns values from llava including vision capability", () => {
    // llava has vision=0.9 but doesn't have tool-use defined
    expect(getStrengthForTask("llava", "vision")).toBe(0.9);
    expect(getStrengthForTask("llava", "tool-use")).toBe(0.5); // Not set, fallback
  });
});
