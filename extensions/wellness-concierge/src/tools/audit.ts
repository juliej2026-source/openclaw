import type { AgentId, ToolId, PrivacyLabel } from "../types.js";

// ---------------------------------------------------------------------------
// Audit — tool invocation audit entry creation
// ---------------------------------------------------------------------------

export type AuditEntry = {
  invocation_id: string;
  tool_id: ToolId;
  agent_id: AgentId;
  session_id: string;
  timestamp: string;
  consent_verified: boolean;
  duration_ms: number;
  audit_level: PrivacyLabel;
  result: "success" | "denied_consent" | "denied_agent" | "error";
  error_message?: string;
};

let auditLog: AuditEntry[] = [];

/**
 * Create an audit entry for a tool invocation.
 */
export function createAuditEntry(params: {
  toolId: ToolId;
  agentId: AgentId;
  sessionId: string;
  consentVerified: boolean;
  durationMs: number;
  auditLevel: PrivacyLabel;
  result: AuditEntry["result"];
  errorMessage?: string;
}): AuditEntry {
  const entry: AuditEntry = {
    invocation_id: `inv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    tool_id: params.toolId,
    agent_id: params.agentId,
    session_id: params.sessionId,
    timestamp: new Date().toISOString(),
    consent_verified: params.consentVerified,
    duration_ms: params.durationMs,
    audit_level: params.auditLevel,
    result: params.result,
    error_message: params.errorMessage,
  };

  auditLog.push(entry);
  return entry;
}

/**
 * Get the in-memory audit log.
 */
export function getAuditLog(): AuditEntry[] {
  return [...auditLog];
}

/**
 * Clear the in-memory audit log (for testing).
 */
export function clearAuditLog(): void {
  auditLog = [];
}
