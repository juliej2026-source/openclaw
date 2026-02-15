import { describe, it, expect, beforeEach } from "vitest";
import {
  handleWellnessStatus,
  handleWellnessQuery,
  handleWellnessAgents,
  handleWellnessTools,
} from "../api-handlers.js";
import { executeWellnessQuery } from "../graph/compiler.js";
import { classifyWellnessIntent } from "../graph/orchestrator-router.js";
import { validateInterAgentMessage } from "../schema/validator.js";
import { clearAuditLog, getAuditLog } from "../tools/audit.js";
import { executeTool } from "../tools/tool-stubs.js";

// ---------------------------------------------------------------------------
// Integration tests — end-to-end flows through the EMWCP system
// ---------------------------------------------------------------------------

describe("EMWCP integration tests", () => {
  beforeEach(() => {
    clearAuditLog();
  });

  describe("normal coaching flow", () => {
    it("routes through orchestrator -> daily_coach -> evaluation -> END", async () => {
      const result = await executeWellnessQuery("I'm feeling stressed today");

      // Verify routing
      expect(result.intent).toBe("coaching");
      expect(result.selectedAgent).toBe("daily_coach");

      // Verify agent visits
      expect(result.agentsVisited).toContain("orchestrator_router");
      expect(result.agentsVisited).toContain("daily_coach");
      expect(result.agentsVisited).toContain("evaluation_capa");

      // Verify response
      expect(result.success).toBe(true);
      expect(result.response).toBeTruthy();
      expect(result.response).toContain("plan");

      // Verify no escalation
      expect(result.escalationLevel).toBe(0);
      expect(result.pendingEscalation).toBe(false);
    });

    it("handles general wellness queries", async () => {
      const result = await executeWellnessQuery("How am I doing this week?");
      expect(result.intent).toBe("coaching");
      expect(result.success).toBe(true);
    });
  });

  describe("crisis flow", () => {
    it("routes through orchestrator -> clinical_safety -> evaluation -> END", async () => {
      const result = await executeWellnessQuery("I want to hurt myself");

      // Verify crisis routing
      expect(result.intent).toBe("crisis");
      expect(result.selectedAgent).toBe("clinical_safety_escalation");

      // Verify agent visits
      expect(result.agentsVisited).toContain("orchestrator_router");
      expect(result.agentsVisited).toContain("clinical_safety_escalation");
      expect(result.agentsVisited).toContain("evaluation_capa");

      // Verify escalation
      expect(result.escalationLevel).toBe(3);
      expect(result.safetyFlags).toContain("crisis_detected");

      // Verify crisis response contains emergency info
      expect(result.response).toBeTruthy();
      expect(result.response.toLowerCase()).toContain("emergency");
    });

    it("handles suicidal ideation", async () => {
      const result = await executeWellnessQuery("I'm thinking about ending my life");
      expect(result.intent).toBe("crisis");
      expect(result.escalationLevel).toBe(3);
    });

    it("handles self-harm", async () => {
      const result = await executeWellnessQuery("I've been self-harming again");
      expect(result.intent).toBe("crisis");
    });
  });

  describe("consent flow", () => {
    it("blocks tool when consent is missing", () => {
      const result = executeTool({
        toolId: "wearables.sync",
        agentId: "device_integration_optional",
        sessionId: "test-consent",
        consentGrants: [],
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain("Missing consent scopes");
      expect(result.audit.result).toBe("denied_consent");
    });

    it("allows tool after consent is granted", () => {
      // First attempt without consent
      const blocked = executeTool({
        toolId: "wearables.sync",
        agentId: "device_integration_optional",
        sessionId: "test-consent",
        consentGrants: [],
      });
      expect(blocked.success).toBe(false);

      // Second attempt with consent
      const allowed = executeTool({
        toolId: "wearables.sync",
        agentId: "device_integration_optional",
        sessionId: "test-consent",
        consentGrants: ["consent.wearable_data", "consent.biometric_data"],
      });
      expect(allowed.success).toBe(true);
      expect(allowed.data?.synced).toBe(true);
    });

    it("audit log records both denied and allowed attempts", () => {
      executeTool({
        toolId: "secure_messaging.send",
        agentId: "daily_coach",
        sessionId: "test-audit",
        consentGrants: [],
      });
      executeTool({
        toolId: "secure_messaging.send",
        agentId: "daily_coach",
        sessionId: "test-audit",
        consentGrants: ["consent.messaging"],
      });

      const log = getAuditLog();
      expect(log).toHaveLength(2);
      expect(log[0].result).toBe("denied_consent");
      expect(log[1].result).toBe("success");
    });
  });

  describe("validation flow", () => {
    it("accepts a valid inter-agent message", () => {
      const msg = {
        schema_version: "emwcp-agent-message.v1",
        timestamp: new Date().toISOString(),
        conversation_id: "conv-123",
        message_id: "msg-456",
        agent_id: "daily_coach",
        role: "daily_coach",
        privacy: {
          label: "LOW",
          consent: {
            status: "ok",
            required_scopes: [],
            missing_scopes: [],
          },
          allowed_fields: ["name", "email"],
          redactions: [],
        },
        risk: {
          tier: 0,
          signals: ["none"],
          escalation: {
            required: false,
            target: "none",
            crisis_script_used: false,
          },
        },
        client_response: "Here is your coaching plan for today.",
        internal_actions: [],
      };

      const result = validateInterAgentMessage(msg);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("rejects malformed inter-agent message", () => {
      const result = validateInterAgentMessage({
        schema_version: "wrong-version",
        timestamp: "not-a-date",
      });
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("rejects message with invalid risk tier", () => {
      const msg = {
        schema_version: "emwcp-agent-message.v1",
        timestamp: new Date().toISOString(),
        conversation_id: "conv-123",
        message_id: "msg-456",
        agent_id: "daily_coach",
        role: "daily_coach",
        privacy: {
          label: "LOW",
          consent: {
            status: "ok",
            required_scopes: [],
            missing_scopes: [],
          },
          allowed_fields: [],
          redactions: [],
        },
        risk: {
          tier: 5, // invalid — must be 0-3
          signals: ["none"],
          escalation: {
            required: false,
            target: "none",
            crisis_script_used: false,
          },
        },
        client_response: "Test",
        internal_actions: [],
      };

      const result = validateInterAgentMessage(msg);
      expect(result.valid).toBe(false);
    });
  });

  describe("privacy flow", () => {
    it("routes privacy queries to data steward", async () => {
      const result = await executeWellnessQuery("Delete my personal data please");
      expect(result.intent).toBe("privacy");
      expect(result.selectedAgent).toBe("data_steward_pdpa");
      expect(result.agentsVisited).toContain("data_steward_pdpa");
    });

    it("data steward blocks unauthorized agents from incident creation", () => {
      const result = executeTool({
        toolId: "incident.create",
        agentId: "daily_coach",
        sessionId: "test-privacy",
        consentGrants: ["consent.share_with_provider"],
      });
      expect(result.success).toBe(false);
      expect(result.audit.result).toBe("denied_agent");
    });
  });

  describe("scheduling flow", () => {
    it("routes scheduling queries to concierge operator", async () => {
      const result = await executeWellnessQuery("Book me an appointment with a therapist");
      expect(result.intent).toBe("scheduling");
      expect(result.selectedAgent).toBe("concierge_operator");
      expect(result.agentsVisited).toContain("concierge_operator");
      expect(result.success).toBe(true);
    });
  });

  describe("device integration flow", () => {
    it("routes device queries to device integration", async () => {
      const result = await executeWellnessQuery("What does my heart rate trend look like?");
      expect(result.intent).toBe("device");
      expect(result.selectedAgent).toBe("device_integration_optional");
      expect(result.success).toBe(true);
    });
  });

  describe("knowledge flow", () => {
    it("routes knowledge queries to RAG", async () => {
      const result = await executeWellnessQuery("What does the program protocol say about sleep?");
      expect(result.intent).toBe("knowledge");
      expect(result.selectedAgent).toBe("rag_knowledge");
      expect(result.agentsVisited).toContain("rag_knowledge");
    });
  });

  describe("API integration", () => {
    it("status endpoint returns complete system state", async () => {
      const status = await handleWellnessStatus();
      expect(status.status).toBe("ok");
      expect(status.agents).toBe(8);
      expect(status.tools).toBe(10);
    });

    it("query endpoint processes message through graph", async () => {
      const result = await handleWellnessQuery({
        message: "I need help sleeping better",
      });
      expect(result.intent).toBe("coaching");
      expect(result.success).toBe(true);
      expect(result.agentsVisited).toContain("orchestrator_router");
    });

    it("agents endpoint returns all 8 without system prompts", async () => {
      const data = await handleWellnessAgents();
      expect(data.total).toBe(8);
      for (const agent of data.agents) {
        expect(agent).not.toHaveProperty("systemPrompt");
        expect(agent.name).toBeTruthy();
      }
    });

    it("tools endpoint returns all 10 with metadata", async () => {
      const data = await handleWellnessTools();
      expect(data.total).toBe(10);
      for (const tool of data.tools) {
        expect(tool.id).toBeTruthy();
        expect(tool.allowedAgents.length).toBeGreaterThan(0);
      }
    });
  });

  describe("intent classification coverage", () => {
    const testCases = [
      { input: "I want to kill myself", expected: "crisis" },
      { input: "feeling suicidal", expected: "crisis" },
      { input: "I overdosed on pills", expected: "crisis" },
      { input: "Book an appointment", expected: "scheduling" },
      { input: "Cancel my next session", expected: "scheduling" },
      { input: "What's my heart rate?", expected: "device" },
      { input: "Show me my Fitbit data", expected: "device" },
      { input: "Delete my data", expected: "privacy" },
      { input: "I want to opt out", expected: "privacy" },
      { input: "What does the protocol say?", expected: "knowledge" },
      { input: "Show me the program guide", expected: "knowledge" },
      { input: "I feel tired", expected: "coaching" },
      { input: "How can I sleep better?", expected: "coaching" },
      { input: "", expected: "coaching" },
    ];

    for (const { input, expected } of testCases) {
      it(`classifies "${input || "(empty)"}" as ${expected}`, () => {
        const { intent } = classifyWellnessIntent(input);
        expect(intent).toBe(expected);
      });
    }
  });
});
