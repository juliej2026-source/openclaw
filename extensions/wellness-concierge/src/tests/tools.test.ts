import { describe, it, expect, beforeEach } from "vitest";
import type { AgentId, ConsentScope, ToolId } from "../types.js";
import { clearAuditLog, getAuditLog } from "../tools/audit.js";
import {
  TOOL_REGISTRY,
  getToolDefinition,
  getAllToolIds,
  getToolsForAgent,
} from "../tools/registry.js";
import { executeTool, type ToolExecutionResult } from "../tools/tool-stubs.js";
import { TOOL_IDS, AGENT_IDS } from "../types.js";

describe("EMWCP tool registry", () => {
  describe("registry completeness", () => {
    it("contains all 10 tools from the specification", () => {
      expect(getAllToolIds()).toHaveLength(10);
      for (const toolId of TOOL_IDS) {
        expect(TOOL_REGISTRY[toolId]).toBeDefined();
      }
    });

    it("each tool has required fields", () => {
      for (const tool of Object.values(TOOL_REGISTRY)) {
        expect(tool.id).toBeTruthy();
        expect(tool.type).toBeTruthy();
        expect(tool.description).toBeTruthy();
        expect(tool.allowed_by_agents.length).toBeGreaterThan(0);
        expect(["LOW", "MED", "HIGH"]).toContain(tool.audit_level);
      }
    });

    it("all allowed_by_agents reference valid agent IDs", () => {
      for (const tool of Object.values(TOOL_REGISTRY)) {
        for (const agentId of tool.allowed_by_agents) {
          expect(AGENT_IDS).toContain(agentId);
        }
      }
    });

    it("all required_consent_scopes are valid", () => {
      const validScopes = [
        "consent.basic_profile",
        "consent.calendar_read",
        "consent.calendar_write",
        "consent.messaging",
        "consent.wearable_data",
        "consent.biometric_data",
        "consent.neuro_data",
        "consent.share_with_provider",
        "consent.cross_border_transfer",
      ];
      for (const tool of Object.values(TOOL_REGISTRY)) {
        for (const scope of tool.required_consent_scopes) {
          expect(validScopes).toContain(scope);
        }
      }
    });
  });

  describe("getToolDefinition", () => {
    it("returns a tool by ID", () => {
      const tool = getToolDefinition("rag.retrieve");
      expect(tool).toBeDefined();
      expect(tool!.id).toBe("rag.retrieve");
    });

    it("returns undefined for unknown tools", () => {
      expect(getToolDefinition("nonexistent.tool")).toBeUndefined();
    });
  });

  describe("getToolsForAgent", () => {
    it("returns tools available to orchestrator_router", () => {
      const tools = getToolsForAgent("orchestrator_router");
      const ids = tools.map((t) => t.id);
      expect(ids).toContain("secure_messaging.send");
      expect(ids).toContain("calendar.read");
      expect(ids).toContain("rag.retrieve");
      expect(ids).toContain("wearables.sync");
      expect(ids).toContain("consent.check");
      expect(ids).toContain("audit.log_event");
    });

    it("returns only concierge-allowed tools for concierge_operator", () => {
      const tools = getToolsForAgent("concierge_operator");
      const ids = tools.map((t) => t.id);
      expect(ids).toContain("calendar.write");
      expect(ids).toContain("scheduling.book_provider");
      expect(ids).not.toContain("cgm.sync");
      expect(ids).not.toContain("incident.create");
    });

    it("returns device tools for device_integration_optional", () => {
      const tools = getToolsForAgent("device_integration_optional");
      const ids = tools.map((t) => t.id);
      expect(ids).toContain("wearables.sync");
      expect(ids).toContain("cgm.sync");
      expect(ids).toContain("audit.log_event");
    });

    it("returns empty array for evaluation_capa (no tools)", () => {
      const tools = getToolsForAgent("evaluation_capa");
      expect(tools).toHaveLength(0);
    });
  });

  describe("tool-specific constraints", () => {
    it("secure_messaging has agent restrictions", () => {
      const tool = TOOL_REGISTRY["secure_messaging.send"];
      expect(tool.allowed_by_agents).toContain("daily_coach");
      expect(tool.allowed_by_agents).toContain("clinical_safety_escalation");
      expect(tool.allowed_by_agents).not.toContain("rag_knowledge");
    });

    it("scheduling.book_provider requires share_with_provider consent", () => {
      const tool = TOOL_REGISTRY["scheduling.book_provider"];
      expect(tool.required_consent_scopes).toContain("consent.share_with_provider");
      expect(tool.audit_level).toBe("HIGH");
    });

    it("rag.retrieve requires no consent", () => {
      const tool = TOOL_REGISTRY["rag.retrieve"];
      expect(tool.required_consent_scopes).toHaveLength(0);
    });

    it("wearables.sync requires dual consent scopes", () => {
      const tool = TOOL_REGISTRY["wearables.sync"];
      expect(tool.required_consent_scopes).toContain("consent.wearable_data");
      expect(tool.required_consent_scopes).toContain("consent.biometric_data");
    });

    it("incident.create is restricted to safety agents", () => {
      const tool = TOOL_REGISTRY["incident.create"];
      expect(tool.allowed_by_agents).toContain("clinical_safety_escalation");
      expect(tool.allowed_by_agents).toContain("data_steward_pdpa");
      expect(tool.allowed_by_agents).not.toContain("daily_coach");
    });
  });
});

describe("EMWCP tool execution", () => {
  beforeEach(() => {
    clearAuditLog();
  });

  describe("agent authorization", () => {
    it("allows authorized agent to execute tool", () => {
      const result = executeTool({
        toolId: "rag.retrieve",
        agentId: "rag_knowledge",
        sessionId: "test-session",
        consentGrants: [],
      });
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it("rejects unauthorized agent", () => {
      const result = executeTool({
        toolId: "calendar.write",
        agentId: "daily_coach",
        sessionId: "test-session",
        consentGrants: ["consent.calendar_write"],
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain("not authorized");
      expect(result.audit.result).toBe("denied_agent");
    });

    it("rejects rag_knowledge from using secure_messaging", () => {
      const result = executeTool({
        toolId: "secure_messaging.send",
        agentId: "rag_knowledge",
        sessionId: "test-session",
        consentGrants: ["consent.messaging"],
      });
      expect(result.success).toBe(false);
      expect(result.audit.result).toBe("denied_agent");
    });
  });

  describe("consent enforcement", () => {
    it("allows execution with all required consent scopes", () => {
      const result = executeTool({
        toolId: "secure_messaging.send",
        agentId: "daily_coach",
        sessionId: "test-session",
        consentGrants: ["consent.messaging"],
      });
      expect(result.success).toBe(true);
    });

    it("rejects execution when consent scope is missing", () => {
      const result = executeTool({
        toolId: "secure_messaging.send",
        agentId: "daily_coach",
        sessionId: "test-session",
        consentGrants: [],
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain("Missing consent scopes");
      expect(result.error).toContain("consent.messaging");
      expect(result.audit.result).toBe("denied_consent");
    });

    it("rejects when only partial consent scopes provided", () => {
      const result = executeTool({
        toolId: "wearables.sync",
        agentId: "device_integration_optional",
        sessionId: "test-session",
        consentGrants: ["consent.wearable_data"],
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain("consent.biometric_data");
    });

    it("allows tools that require no consent scopes", () => {
      const result = executeTool({
        toolId: "rag.retrieve",
        agentId: "orchestrator_router",
        sessionId: "test-session",
        consentGrants: [],
      });
      expect(result.success).toBe(true);
    });

    it("allows execution with all dual consent scopes for wearables", () => {
      const result = executeTool({
        toolId: "wearables.sync",
        agentId: "device_integration_optional",
        sessionId: "test-session",
        consentGrants: ["consent.wearable_data", "consent.biometric_data"],
      });
      expect(result.success).toBe(true);
      expect(result.data?.synced).toBe(true);
    });
  });

  describe("stub execution results", () => {
    it("secure_messaging returns delivery confirmation", () => {
      const result = executeTool({
        toolId: "secure_messaging.send",
        agentId: "daily_coach",
        sessionId: "test-session",
        consentGrants: ["consent.messaging"],
      });
      expect(result.data?.delivered).toBe(true);
      expect(result.data?.channel).toBe("encrypted");
    });

    it("calendar.read returns events", () => {
      const result = executeTool({
        toolId: "calendar.read",
        agentId: "concierge_operator",
        sessionId: "test-session",
        consentGrants: ["consent.calendar_read"],
      });
      expect(result.data?.total).toBe(1);
      expect(Array.isArray(result.data?.events)).toBe(true);
    });

    it("scheduling.book_provider returns booking", () => {
      const result = executeTool({
        toolId: "scheduling.book_provider",
        agentId: "concierge_operator",
        sessionId: "test-session",
        consentGrants: ["consent.share_with_provider"],
      });
      expect(result.data?.status).toBe("pending_confirmation");
      expect(result.data?.sla_hours).toBe(48);
    });

    it("incident.create returns incident with notification", () => {
      const result = executeTool({
        toolId: "incident.create",
        agentId: "clinical_safety_escalation",
        sessionId: "test-session",
        consentGrants: ["consent.share_with_provider"],
      });
      expect(result.data?.severity).toBe("high");
      expect(result.data?.notification_sent).toBe(true);
    });
  });

  describe("audit logging", () => {
    it("creates audit entry for successful execution", () => {
      executeTool({
        toolId: "rag.retrieve",
        agentId: "rag_knowledge",
        sessionId: "test-session",
        consentGrants: [],
      });

      const log = getAuditLog();
      expect(log).toHaveLength(1);
      expect(log[0].tool_id).toBe("rag.retrieve");
      expect(log[0].agent_id).toBe("rag_knowledge");
      expect(log[0].result).toBe("success");
      expect(log[0].consent_verified).toBe(true);
    });

    it("creates audit entry for denied execution", () => {
      executeTool({
        toolId: "calendar.write",
        agentId: "daily_coach",
        sessionId: "test-session",
        consentGrants: [],
      });

      const log = getAuditLog();
      expect(log).toHaveLength(1);
      expect(log[0].result).toBe("denied_agent");
    });

    it("records correct audit level from tool definition", () => {
      executeTool({
        toolId: "incident.create",
        agentId: "clinical_safety_escalation",
        sessionId: "test-session",
        consentGrants: ["consent.share_with_provider"],
      });

      const log = getAuditLog();
      expect(log[0].audit_level).toBe("HIGH");
    });

    it("accumulates multiple audit entries", () => {
      executeTool({
        toolId: "rag.retrieve",
        agentId: "rag_knowledge",
        sessionId: "s1",
        consentGrants: [],
      });
      executeTool({
        toolId: "consent.check",
        agentId: "data_steward_pdpa",
        sessionId: "s2",
        consentGrants: [],
      });
      executeTool({
        toolId: "secure_messaging.send",
        agentId: "daily_coach",
        sessionId: "s3",
        consentGrants: ["consent.messaging"],
      });

      const log = getAuditLog();
      expect(log).toHaveLength(3);
    });

    it("clearAuditLog resets the log", () => {
      executeTool({
        toolId: "rag.retrieve",
        agentId: "rag_knowledge",
        sessionId: "s1",
        consentGrants: [],
      });
      expect(getAuditLog()).toHaveLength(1);

      clearAuditLog();
      expect(getAuditLog()).toHaveLength(0);
    });
  });
});
