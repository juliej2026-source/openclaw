import { AGENT_PROMPTS, getAgentPrompt } from "./agents/prompts.js";
import { executeWellnessQuery } from "./graph/compiler.js";
import { getAuditLog } from "./tools/audit.js";
import { TOOL_REGISTRY, getAllToolIds } from "./tools/registry.js";
import { AGENT_IDS, TOOL_IDS, STATION_ID } from "./types.js";

// ---------------------------------------------------------------------------
// API Handlers — HTTP route handlers for /api/wellness/*
// ---------------------------------------------------------------------------

// In-memory session tracking (production: Convex)
const sessions = new Map<
  string,
  {
    sessionId: string;
    userId: string;
    status: string;
    intent?: string;
    agent?: string;
    createdAt: string;
    updatedAt: string;
  }
>();

// In-memory CAPA findings (production: Convex)
const capaFindings: Array<{
  findingId: string;
  sessionId: string;
  category: string;
  severity: string;
  description: string;
  recommendation: string;
  agentId: string;
  resolved: boolean;
  createdAt: string;
}> = [];

// Metrics counters
let totalQueries = 0;
let totalEscalations = 0;
let totalErrors = 0;

/**
 * GET /api/wellness/status — Graph health + session counts
 */
export async function handleWellnessStatus() {
  return {
    status: "ok",
    stationId: STATION_ID,
    version: "2026.2.16",
    agents: AGENT_IDS.length,
    tools: TOOL_IDS.length,
    activeSessions: sessions.size,
    totalQueries,
    totalEscalations,
    totalErrors,
    uptime: process.uptime(),
  };
}

/**
 * POST /api/wellness/query — Submit user message through graph
 */
export async function handleWellnessQuery(body: {
  message: string;
  userId?: string;
  sessionId?: string;
}) {
  if (!body.message || typeof body.message !== "string") {
    return { error: "message is required", status: 400 };
  }

  const sessionId = body.sessionId ?? `session-${Date.now()}`;
  const userId = body.userId ?? "anonymous";

  try {
    totalQueries++;
    const result = await executeWellnessQuery(body.message, userId, sessionId);

    if (result.intent === "crisis") {
      totalEscalations++;
    }

    // Track session
    sessions.set(sessionId, {
      sessionId,
      userId,
      status: result.intent === "crisis" ? "escalated" : "active",
      intent: result.intent,
      agent: result.selectedAgent,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    return {
      sessionId,
      intent: result.intent,
      selectedAgent: result.selectedAgent,
      response: result.response,
      agentsVisited: result.agentsVisited,
      escalationLevel: result.escalationLevel,
      success: result.success,
      agentLatencies: result.agentLatencies,
    };
  } catch (err: any) {
    totalErrors++;
    return { error: err.message, status: 500 };
  }
}

/**
 * GET /api/wellness/sessions — List active sessions
 */
export async function handleWellnessSessions() {
  return {
    sessions: [...sessions.values()],
    total: sessions.size,
  };
}

/**
 * GET /api/wellness/session/:id — Session detail
 */
export async function handleWellnessSessionDetail(sessionId: string) {
  const session = sessions.get(sessionId);
  if (!session) {
    return { error: "Session not found", status: 404 };
  }
  return session;
}

/**
 * POST /api/wellness/consent — Grant/revoke consent scopes
 */
export async function handleWellnessConsent(body: {
  userId: string;
  scope: string;
  granted: boolean;
}) {
  if (!body.userId || !body.scope) {
    return { error: "userId and scope are required", status: 400 };
  }
  return {
    userId: body.userId,
    scope: body.scope,
    granted: body.granted,
    recordedAt: new Date().toISOString(),
  };
}

/**
 * GET /api/wellness/agents — Agent configs (non-sensitive)
 */
export async function handleWellnessAgents() {
  return {
    agents: AGENT_IDS.map((id) => {
      const config = getAgentPrompt(id);
      return {
        agentId: id,
        name: config?.name ?? id,
        role: config?.role ?? "unknown",
        routingIntents: config?.routingIntents ?? [],
        temperature: config?.temperature,
        maxTokens: config?.maxTokens,
      };
    }),
    total: AGENT_IDS.length,
  };
}

/**
 * GET /api/wellness/tools — Tool registry
 */
export async function handleWellnessTools() {
  return {
    tools: Object.values(TOOL_REGISTRY).map((tool) => ({
      id: tool.id,
      type: tool.type,
      description: tool.description,
      allowedAgents: tool.allowed_by_agents,
      requiredConsentScopes: tool.required_consent_scopes,
      auditLevel: tool.audit_level,
    })),
    total: getAllToolIds().length,
  };
}

/**
 * GET /api/wellness/audit — Audit log (paginated)
 */
export async function handleWellnessAudit(query?: { limit?: number; offset?: number }) {
  const log = getAuditLog();
  const limit = query?.limit ?? 50;
  const offset = query?.offset ?? 0;
  const page = log.slice(offset, offset + limit);

  return {
    entries: page,
    total: log.length,
    limit,
    offset,
  };
}

/**
 * GET /api/wellness/capa — CAPA findings
 */
export async function handleWellnessCapa() {
  return {
    findings: capaFindings,
    total: capaFindings.length,
    unresolved: capaFindings.filter((f) => !f.resolved).length,
  };
}

/**
 * POST /api/wellness/escalate — Manual escalation trigger
 */
export async function handleWellnessEscalate(body: {
  sessionId: string;
  reason: string;
  level?: number;
}) {
  if (!body.sessionId || !body.reason) {
    return { error: "sessionId and reason are required", status: 400 };
  }

  totalEscalations++;
  const session = sessions.get(body.sessionId);
  if (session) {
    session.status = "escalated";
    session.updatedAt = new Date().toISOString();
  }

  return {
    escalated: true,
    sessionId: body.sessionId,
    reason: body.reason,
    level: body.level ?? 2,
    timestamp: new Date().toISOString(),
  };
}

/**
 * GET /api/wellness/metrics — Prometheus metrics
 */
export async function handleWellnessMetrics() {
  const lines = [
    `# HELP emwcp_sessions_total Total wellness sessions`,
    `# TYPE emwcp_sessions_total counter`,
    `emwcp_sessions_total ${sessions.size}`,
    `# HELP emwcp_queries_total Total wellness queries`,
    `# TYPE emwcp_queries_total counter`,
    `emwcp_queries_total ${totalQueries}`,
    `# HELP emwcp_escalations_total Total escalations`,
    `# TYPE emwcp_escalations_total counter`,
    `emwcp_escalations_total ${totalEscalations}`,
    `# HELP emwcp_errors_total Total errors`,
    `# TYPE emwcp_errors_total counter`,
    `emwcp_errors_total ${totalErrors}`,
    `# HELP emwcp_active_sessions Currently active sessions`,
    `# TYPE emwcp_active_sessions gauge`,
    `emwcp_active_sessions ${[...sessions.values()].filter((s) => s.status === "active").length}`,
  ];
  return lines.join("\n") + "\n";
}
