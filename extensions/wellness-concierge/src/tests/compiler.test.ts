import { describe, it, expect } from "vitest";
import { compileWellnessGraph, executeWellnessQuery } from "../graph/compiler.js";
import { classifyWellnessIntent } from "../graph/orchestrator-router.js";

describe("EMWCP graph compilation", () => {
  describe("compileWellnessGraph", () => {
    it("compiles without error", () => {
      const graph = compileWellnessGraph();
      expect(graph).toBeDefined();
    });

    it("compiles to an executable app", () => {
      const graph = compileWellnessGraph();
      const app = graph.compile();
      expect(app).toBeDefined();
      expect(typeof app.invoke).toBe("function");
    });
  });

  describe("classifyWellnessIntent", () => {
    it("routes crisis keywords to crisis intent", () => {
      const { intent, confidence } = classifyWellnessIntent("I want to hurt myself");
      expect(intent).toBe("crisis");
      expect(confidence).toBeGreaterThan(0.9);
    });

    it("routes suicidal ideation to crisis", () => {
      const { intent } = classifyWellnessIntent("I'm thinking about ending my life");
      expect(intent).toBe("crisis");
    });

    it("routes self-harm to crisis", () => {
      const { intent } = classifyWellnessIntent("I've been self-harming again");
      expect(intent).toBe("crisis");
    });

    it("routes scheduling to concierge", () => {
      const { intent } = classifyWellnessIntent("Can you book an appointment with a therapist?");
      expect(intent).toBe("scheduling");
    });

    it("routes device queries to device integration", () => {
      const { intent } = classifyWellnessIntent("What does my heart rate trend look like?");
      expect(intent).toBe("device");
    });

    it("routes privacy to data steward", () => {
      const { intent } = classifyWellnessIntent("I want to delete my personal data");
      expect(intent).toBe("privacy");
    });

    it("routes knowledge to RAG", () => {
      const { intent } = classifyWellnessIntent("What does the program protocol say about sleep?");
      expect(intent).toBe("knowledge");
    });

    it("defaults to coaching for general messages", () => {
      const { intent } = classifyWellnessIntent("I'm feeling tired today");
      expect(intent).toBe("coaching");
    });

    it("defaults to coaching for empty messages", () => {
      const { intent } = classifyWellnessIntent("");
      expect(intent).toBe("coaching");
    });

    it("returns confidence scores", () => {
      const crisis = classifyWellnessIntent("I want to kill myself");
      expect(crisis.confidence).toBeGreaterThanOrEqual(0.9);

      const coaching = classifyWellnessIntent("feeling a bit stressed");
      expect(coaching.confidence).toBeGreaterThan(0);
      expect(coaching.confidence).toBeLessThan(1);
    });
  });

  describe("executeWellnessQuery", () => {
    it("executes a coaching query end-to-end", async () => {
      const result = await executeWellnessQuery("I'm feeling stressed today");
      expect(result).toBeDefined();
      expect(result.intent).toBe("coaching");
      expect(result.selectedAgent).toBe("daily_coach");
      expect(result.agentsVisited).toContain("orchestrator_router");
      expect(result.agentsVisited).toContain("daily_coach");
      expect(result.agentsVisited).toContain("evaluation_capa");
      expect(result.success).toBe(true);
      expect(result.response).toBeTruthy();
    });

    it("executes a crisis query with escalation", async () => {
      const result = await executeWellnessQuery("I want to hurt myself");
      expect(result).toBeDefined();
      expect(result.intent).toBe("crisis");
      expect(result.selectedAgent).toBe("clinical_safety_escalation");
      expect(result.agentsVisited).toContain("clinical_safety_escalation");
      expect(result.escalationLevel).toBe(3);
      expect(result.response).toContain("emergency");
    });

    it("executes a scheduling query", async () => {
      const result = await executeWellnessQuery("Book me an appointment with a therapist");
      expect(result).toBeDefined();
      expect(result.intent).toBe("scheduling");
      expect(result.selectedAgent).toBe("concierge_operator");
      expect(result.agentsVisited).toContain("concierge_operator");
    });

    it("executes a privacy query", async () => {
      const result = await executeWellnessQuery("Delete my personal data please");
      expect(result).toBeDefined();
      expect(result.intent).toBe("privacy");
      expect(result.selectedAgent).toBe("data_steward_pdpa");
    });

    it("includes timing information", async () => {
      const result = await executeWellnessQuery("How am I doing?");
      expect(result.agentLatencies).toBeDefined();
      expect(typeof result.agentLatencies.orchestrator_router).toBe("number");
    });
  });
});
