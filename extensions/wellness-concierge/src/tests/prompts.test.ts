import { describe, it, expect } from "vitest";
import { GLOBAL_SYSTEM_PROMPT } from "../agents/global-prompt.js";
import { AGENT_PROMPTS, getAgentPrompt } from "../agents/prompts.js";
import { AGENT_IDS } from "../types.js";

describe("EMWCP system prompts", () => {
  describe("GLOBAL_SYSTEM_PROMPT", () => {
    it("is a non-empty string", () => {
      expect(typeof GLOBAL_SYSTEM_PROMPT).toBe("string");
      expect(GLOBAL_SYSTEM_PROMPT.length).toBeGreaterThan(100);
    });

    it("contains safety boundaries", () => {
      expect(GLOBAL_SYSTEM_PROMPT).toContain("NO DIAGNOSIS");
      expect(GLOBAL_SYSTEM_PROMPT).toContain("CRISIS");
      expect(GLOBAL_SYSTEM_PROMPT).toContain("PDPA");
    });

    it("contains OpenClaw context", () => {
      expect(GLOBAL_SYSTEM_PROMPT).toContain("OpenClaw");
      expect(GLOBAL_SYSTEM_PROMPT).toContain("LangGraph");
    });
  });

  describe("AGENT_PROMPTS", () => {
    it("has prompts for all 8 agents", () => {
      expect(Object.keys(AGENT_PROMPTS)).toHaveLength(8);
    });

    for (const agentId of AGENT_IDS) {
      describe(`${agentId}`, () => {
        it("exists in AGENT_PROMPTS", () => {
          expect(AGENT_PROMPTS[agentId]).toBeDefined();
        });

        it("has correct agentId", () => {
          expect(AGENT_PROMPTS[agentId].agentId).toBe(agentId);
        });

        it("has non-empty name", () => {
          expect(AGENT_PROMPTS[agentId].name.length).toBeGreaterThan(0);
        });

        it("has non-empty role", () => {
          expect(AGENT_PROMPTS[agentId].role.length).toBeGreaterThan(0);
        });

        it("has non-empty systemPrompt (>50 chars)", () => {
          expect(AGENT_PROMPTS[agentId].systemPrompt.length).toBeGreaterThan(50);
        });

        it("has valid temperature (0-1)", () => {
          const t = AGENT_PROMPTS[agentId].temperature;
          expect(t).toBeGreaterThanOrEqual(0);
          expect(t).toBeLessThanOrEqual(1);
        });

        it("has valid maxTokens (>0)", () => {
          expect(AGENT_PROMPTS[agentId].maxTokens).toBeGreaterThan(0);
        });

        it("has non-empty routingIntents array", () => {
          expect(AGENT_PROMPTS[agentId].routingIntents.length).toBeGreaterThan(0);
        });

        it("has non-empty requiredOutputs array", () => {
          expect(AGENT_PROMPTS[agentId].requiredOutputs.length).toBeGreaterThan(0);
        });
      });
    }
  });

  describe("getAgentPrompt", () => {
    it("returns correct config for orchestrator_router", () => {
      const config = getAgentPrompt("orchestrator_router");
      expect(config.agentId).toBe("orchestrator_router");
      expect(config.name).toContain("Orchestrator");
    });

    it("returns correct config for clinical_safety_escalation", () => {
      const config = getAgentPrompt("clinical_safety_escalation");
      expect(config.systemPrompt).toContain("Crisis Script");
    });
  });
});
