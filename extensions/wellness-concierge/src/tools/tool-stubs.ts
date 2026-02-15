import type { AgentId, ConsentScope, ToolId } from "../types.js";
import { createAuditEntry, type AuditEntry } from "./audit.js";
import { TOOL_REGISTRY } from "./registry.js";

// ---------------------------------------------------------------------------
// Tool Stubs — execute tools with consent + agent authorization checks
// ---------------------------------------------------------------------------

export type ToolExecutionResult = {
  success: boolean;
  data?: Record<string, unknown>;
  audit: AuditEntry;
  error?: string;
};

/**
 * Execute a tool with consent and agent authorization checks.
 *
 * 1. Verify tool exists in registry
 * 2. Verify agent is authorized to use this tool
 * 3. Verify all required consent scopes are granted
 * 4. Execute the stub implementation
 * 5. Create and return audit entry
 */
export function executeTool(params: {
  toolId: ToolId;
  agentId: AgentId;
  sessionId: string;
  consentGrants: ConsentScope[];
  input?: Record<string, unknown>;
}): ToolExecutionResult {
  const start = Date.now();
  const tool = TOOL_REGISTRY[params.toolId];

  // 1. Verify tool exists
  if (!tool) {
    const audit = createAuditEntry({
      toolId: params.toolId,
      agentId: params.agentId,
      sessionId: params.sessionId,
      consentVerified: false,
      durationMs: Date.now() - start,
      auditLevel: "LOW",
      result: "error",
      errorMessage: `Unknown tool: ${params.toolId}`,
    });
    return { success: false, audit, error: `Unknown tool: ${params.toolId}` };
  }

  // 2. Verify agent authorization
  if (!tool.allowed_by_agents.includes(params.agentId)) {
    const audit = createAuditEntry({
      toolId: params.toolId,
      agentId: params.agentId,
      sessionId: params.sessionId,
      consentVerified: false,
      durationMs: Date.now() - start,
      auditLevel: tool.audit_level,
      result: "denied_agent",
      errorMessage: `Agent ${params.agentId} is not authorized to use ${params.toolId}`,
    });
    return {
      success: false,
      audit,
      error: `Agent ${params.agentId} is not authorized to use ${params.toolId}`,
    };
  }

  // 3. Verify consent scopes
  const missingScopes = tool.required_consent_scopes.filter(
    (scope) => !params.consentGrants.includes(scope),
  );

  if (missingScopes.length > 0) {
    const audit = createAuditEntry({
      toolId: params.toolId,
      agentId: params.agentId,
      sessionId: params.sessionId,
      consentVerified: false,
      durationMs: Date.now() - start,
      auditLevel: tool.audit_level,
      result: "denied_consent",
      errorMessage: `Missing consent scopes: ${missingScopes.join(", ")}`,
    });
    return {
      success: false,
      audit,
      error: `Missing consent scopes: ${missingScopes.join(", ")}`,
    };
  }

  // 4. Execute stub implementation
  const data = executeStub(params.toolId, params.input);

  // 5. Create audit entry
  const audit = createAuditEntry({
    toolId: params.toolId,
    agentId: params.agentId,
    sessionId: params.sessionId,
    consentVerified: true,
    durationMs: Date.now() - start,
    auditLevel: tool.audit_level,
    result: "success",
  });

  return { success: true, data, audit };
}

// ---------------------------------------------------------------------------
// Stub implementations — return mock data for each tool
// ---------------------------------------------------------------------------

function executeStub(toolId: ToolId, input?: Record<string, unknown>): Record<string, unknown> {
  switch (toolId) {
    case "secure_messaging.send":
      return {
        message_id: `msg-${Date.now()}`,
        delivered: true,
        channel: "encrypted",
      };

    case "calendar.read":
      return {
        events: [
          {
            id: "evt-001",
            title: "Wellness Check-in",
            date: new Date(Date.now() + 7 * 86400000).toISOString(),
            type: "check_in",
          },
        ],
        total: 1,
      };

    case "calendar.write":
      return {
        event_id: `evt-${Date.now()}`,
        created: true,
        title: (input?.title as string) ?? "New Session",
      };

    case "scheduling.book_provider":
      return {
        booking_id: `bk-${Date.now()}`,
        provider_type: (input?.provider_type as string) ?? "therapist",
        status: "pending_confirmation",
        sla_hours: 48,
      };

    case "rag.retrieve":
      return {
        chunks: [
          {
            source: "Executive Wellbeing Program Guide v1",
            section: "2.3",
            text: "Program protocols recommend structured sleep hygiene routines...",
          },
        ],
        total_chunks: 1,
      };

    case "wearables.sync":
      return {
        synced: true,
        device: "fitbit_sense",
        metrics: {
          resting_hr: 62,
          hrv: 45,
          sleep_hours: 7.2,
        },
        last_sync: new Date().toISOString(),
      };

    case "cgm.sync":
      return {
        synced: true,
        device: "dexcom_g7",
        avg_glucose_mg_dl: 95,
        time_in_range_pct: 87,
        last_sync: new Date().toISOString(),
      };

    case "consent.check":
      return {
        user_id: (input?.user_id as string) ?? "anonymous",
        scopes_granted: [],
        scopes_pending: [],
        last_updated: new Date().toISOString(),
      };

    case "audit.log_event":
      return {
        logged: true,
        event_id: `aud-${Date.now()}`,
      };

    case "incident.create":
      return {
        incident_id: `inc-${Date.now()}`,
        severity: "high",
        status: "open",
        notification_sent: true,
      };

    default:
      return { error: `No stub for tool: ${toolId}` };
  }
}
