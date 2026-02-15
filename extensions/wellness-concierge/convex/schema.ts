import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Wellness sessions — active user interactions
  wellness_sessions: defineTable({
    sessionId: v.string(),
    userId: v.string(),
    status: v.string(), // active | paused | completed | escalated
    currentAgent: v.string(),
    agentsVisited: v.array(v.string()),
    escalationLevel: v.float64(), // 0–3
    consentGrants: v.array(v.string()),
    userMessage: v.optional(v.string()),
    response: v.optional(v.string()),
    intent: v.optional(v.string()),
    createdAt: v.string(),
    updatedAt: v.string(),
    metadata: v.any(),
  })
    .index("by_sessionId", ["sessionId"])
    .index("by_userId", ["userId"])
    .index("by_status", ["status"]),

  // Consent records — PDPA-aligned consent tracking
  consent_records: defineTable({
    sessionId: v.string(),
    userId: v.string(),
    scope: v.string(), // consent.* scope
    granted: v.boolean(),
    grantedAt: v.string(),
    revokedAt: v.optional(v.string()),
    agentId: v.string(), // agent that recorded the consent
  })
    .index("by_sessionId", ["sessionId"])
    .index("by_userId", ["userId"])
    .index("by_scope", ["scope"]),

  // Audit log — tool invocation audit trail
  audit_log: defineTable({
    invocationId: v.string(),
    toolId: v.string(),
    agentId: v.string(),
    sessionId: v.string(),
    timestamp: v.string(),
    consentVerified: v.boolean(),
    durationMs: v.float64(),
    auditLevel: v.string(), // LOW | MED | HIGH
    result: v.string(), // success | denied_consent | denied_agent | error
    errorMessage: v.optional(v.string()),
  })
    .index("by_sessionId", ["sessionId"])
    .index("by_timestamp", ["timestamp"])
    .index("by_toolId", ["toolId"])
    .index("by_auditLevel", ["auditLevel"]),

  // CAPA findings — Corrective and Preventive Action records
  capa_findings: defineTable({
    findingId: v.string(),
    sessionId: v.string(),
    category: v.string(), // safety | privacy | quality | operational
    severity: v.string(), // low | medium | high | critical
    description: v.string(),
    recommendation: v.string(),
    agentId: v.string(),
    resolved: v.boolean(),
    resolvedAt: v.optional(v.string()),
    createdAt: v.string(),
    correctiveActions: v.optional(v.array(v.string())),
    preventiveActions: v.optional(v.array(v.string())),
  })
    .index("by_findingId", ["findingId"])
    .index("by_sessionId", ["sessionId"])
    .index("by_severity", ["severity"])
    .index("by_resolved", ["resolved"]),

  // LangGraph checkpoints — persistent graph state
  checkpoints: defineTable({
    threadId: v.string(),
    checkpointId: v.string(),
    parentCheckpointId: v.optional(v.string()),
    channelValues: v.string(), // JSON-serialized
    channelVersions: v.string(), // JSON-serialized
    createdAt: v.string(),
  })
    .index("by_threadId", ["threadId"])
    .index("by_checkpointId", ["checkpointId"]),
});
