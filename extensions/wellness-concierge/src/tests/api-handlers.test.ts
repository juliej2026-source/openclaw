import { describe, it, expect } from "vitest";
import {
  handleWellnessStatus,
  handleWellnessQuery,
  handleWellnessSessions,
  handleWellnessAgents,
  handleWellnessTools,
  handleWellnessAudit,
  handleWellnessCapa,
  handleWellnessConsent,
  handleWellnessEscalate,
  handleWellnessMetrics,
} from "../api-handlers.js";

describe("EMWCP API handlers", () => {
  describe("handleWellnessStatus", () => {
    it("returns status ok", async () => {
      const result = await handleWellnessStatus();
      expect(result.status).toBe("ok");
      expect(result.agents).toBe(8);
      expect(result.tools).toBe(10);
      expect(typeof result.uptime).toBe("number");
    });
  });

  describe("handleWellnessQuery", () => {
    it("executes a coaching query", async () => {
      const result = await handleWellnessQuery({
        message: "I'm feeling tired today",
      });
      expect(result.intent).toBe("coaching");
      expect(result.selectedAgent).toBe("daily_coach");
      expect(result.success).toBe(true);
      expect(result.response).toBeTruthy();
    });

    it("executes a crisis query with escalation", async () => {
      const result = await handleWellnessQuery({
        message: "I want to hurt myself",
      });
      expect(result.intent).toBe("crisis");
      expect(result.selectedAgent).toBe("clinical_safety_escalation");
      expect(result.escalationLevel).toBe(3);
    });

    it("returns error for missing message", async () => {
      const result = await handleWellnessQuery({} as any);
      expect(result.error).toBeDefined();
      expect(result.status).toBe(400);
    });

    it("accepts optional userId and sessionId", async () => {
      const result = await handleWellnessQuery({
        message: "Hello",
        userId: "user-123",
        sessionId: "session-123",
      });
      expect(result.sessionId).toBe("session-123");
      expect(result.success).toBe(true);
    });

    it("returns timing information", async () => {
      const result = await handleWellnessQuery({
        message: "How are you?",
      });
      expect(result.agentLatencies).toBeDefined();
    });
  });

  describe("handleWellnessSessions", () => {
    it("returns session list", async () => {
      const result = await handleWellnessSessions();
      expect(Array.isArray(result.sessions)).toBe(true);
      expect(typeof result.total).toBe("number");
    });
  });

  describe("handleWellnessAgents", () => {
    it("returns all 8 agent configs", async () => {
      const result = await handleWellnessAgents();
      expect(result.total).toBe(8);
      expect(result.agents).toHaveLength(8);
    });

    it("does not expose system prompts", async () => {
      const result = await handleWellnessAgents();
      for (const agent of result.agents) {
        expect(agent).not.toHaveProperty("systemPrompt");
      }
    });

    it("includes agent metadata", async () => {
      const result = await handleWellnessAgents();
      const router = result.agents.find((a: any) => a.agentId === "orchestrator_router");
      expect(router).toBeDefined();
      expect(router!.name).toBeTruthy();
      expect(router!.role).toBeTruthy();
    });
  });

  describe("handleWellnessTools", () => {
    it("returns all 10 tools", async () => {
      const result = await handleWellnessTools();
      expect(result.total).toBe(10);
      expect(result.tools).toHaveLength(10);
    });

    it("includes tool metadata", async () => {
      const result = await handleWellnessTools();
      const rag = result.tools.find((t: any) => t.id === "rag.retrieve");
      expect(rag).toBeDefined();
      expect(rag!.type).toBe("knowledge");
      expect(rag!.allowedAgents).toContain("rag_knowledge");
    });
  });

  describe("handleWellnessAudit", () => {
    it("returns audit log with pagination", async () => {
      const result = await handleWellnessAudit();
      expect(Array.isArray(result.entries)).toBe(true);
      expect(typeof result.total).toBe("number");
      expect(result.limit).toBe(50);
      expect(result.offset).toBe(0);
    });

    it("supports custom pagination", async () => {
      const result = await handleWellnessAudit({ limit: 10, offset: 5 });
      expect(result.limit).toBe(10);
      expect(result.offset).toBe(5);
    });
  });

  describe("handleWellnessCapa", () => {
    it("returns CAPA findings", async () => {
      const result = await handleWellnessCapa();
      expect(Array.isArray(result.findings)).toBe(true);
      expect(typeof result.total).toBe("number");
      expect(typeof result.unresolved).toBe("number");
    });
  });

  describe("handleWellnessConsent", () => {
    it("records consent grant", async () => {
      const result = await handleWellnessConsent({
        userId: "user-1",
        scope: "consent.messaging",
        granted: true,
      });
      expect(result.userId).toBe("user-1");
      expect(result.scope).toBe("consent.messaging");
      expect(result.granted).toBe(true);
      expect(result.recordedAt).toBeTruthy();
    });

    it("returns error for missing fields", async () => {
      const result = await handleWellnessConsent({} as any);
      expect(result.error).toBeDefined();
      expect(result.status).toBe(400);
    });
  });

  describe("handleWellnessEscalate", () => {
    it("triggers manual escalation", async () => {
      const result = await handleWellnessEscalate({
        sessionId: "session-escalate-1",
        reason: "User requested",
        level: 2,
      });
      expect(result.escalated).toBe(true);
      expect(result.level).toBe(2);
    });

    it("defaults to level 2", async () => {
      const result = await handleWellnessEscalate({
        sessionId: "session-escalate-2",
        reason: "Safety concern",
      });
      expect(result.level).toBe(2);
    });

    it("returns error for missing fields", async () => {
      const result = await handleWellnessEscalate({} as any);
      expect(result.error).toBeDefined();
      expect(result.status).toBe(400);
    });
  });

  describe("handleWellnessMetrics", () => {
    it("returns Prometheus-formatted metrics", async () => {
      const result = await handleWellnessMetrics();
      expect(typeof result).toBe("string");
      expect(result).toContain("emwcp_sessions_total");
      expect(result).toContain("emwcp_queries_total");
      expect(result).toContain("emwcp_escalations_total");
      expect(result).toContain("emwcp_active_sessions");
    });
  });
});
