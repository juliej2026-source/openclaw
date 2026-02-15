# EMWCP Ralph-Loop Build Prompt

Use this with:

```bash
/ralph-loop Build the EMWCP wellness-concierge extension following the 8-phase plan. Check existing files to determine current phase and continue from where you left off. Run tests after each phase. --max-iterations 20 --completion-promise 'ALL 8 PHASES COMPLETE AND ALL TESTS PASSING'
```

---

## Full Prompt (copy everything below this line)

Build the Executive Mental Wellbeing Concierge Platform (EMWCP) as a new OpenClaw extension at `extensions/wellness-concierge/`. This is a multi-agent wellness orchestration system using LangGraph, following the same patterns as `extensions/neural-graph/`.

PROGRESS TRACKING: On each iteration, first check what files already exist in `extensions/wellness-concierge/` and what tests pass. Continue from where you left off. Do NOT recreate files that already exist and pass tests.

REFERENCE FILES (read these for patterns):

- `extensions/neural-graph/index.ts` — plugin entry point pattern
- `extensions/neural-graph/src/graph/compiler.ts` — StateGraph compilation
- `extensions/neural-graph/src/graph/state.ts` — Annotation.Root() channels
- `extensions/neural-graph/src/graph/orchestrator.ts` — Command(goto) routing
- `extensions/neural-graph/convex/schema.ts` — Convex table definitions
- `extensions/hive-mind/portal/htdocs/js/pages/neural-graph.js` — portal page pattern
- `extensions/hive-mind/portal/htdocs/js/router.js` — SPA route registration

========================================================================
PHASE 1: SCAFFOLD + TYPES
========================================================================

Create these files:

1. `extensions/wellness-concierge/package.json`:

```json
{
  "name": "@openclaw/wellness-concierge",
  "version": "2026.2.16",
  "description": "Executive Mental Wellbeing Concierge Platform — multi-agent wellness orchestration with PDPA-aligned privacy",
  "type": "module",
  "dependencies": {
    "@langchain/core": "^0.3.26",
    "@langchain/langgraph": "^0.2.36",
    "convex": "^1.17.4",
    "ajv": "^8.17.1",
    "ajv-formats": "^3.0.1"
  },
  "devDependencies": {
    "openclaw": "workspace:*"
  },
  "peerDependencies": {
    "openclaw": ">=2026.1.26"
  },
  "openclaw": {
    "extensions": ["./index.ts"]
  }
}
```

2. `extensions/wellness-concierge/openclaw.plugin.json`:

```json
{
  "id": "wellness-concierge",
  "name": "Executive Mental Wellbeing Concierge",
  "description": "Multi-agent wellness orchestration platform with PDPA-aligned privacy, crisis escalation, and executive-grade coaching",
  "configSchema": {
    "type": "object",
    "additionalProperties": false,
    "properties": {}
  }
}
```

3. `extensions/wellness-concierge/index.ts` — minimal plugin with one health route:

```typescript
export default function wellnessConciergePlugin(api: {
  registerHttpRoute: (opts: {
    method?: string;
    path: string;
    handler: (req: any, res: any) => void | Promise<void>;
  }) => void;
  registerService: (opts: {
    id: string;
    start: () => Promise<void>;
    stop: () => Promise<void>;
  }) => void;
}) {
  api.registerHttpRoute({
    method: "GET",
    path: "/api/wellness/status",
    handler: async (_req, res) => {
      res.json({ status: "ok", phase: "scaffold", agents: 8, version: "2026.2.16" });
    },
  });
}
```

4. `extensions/wellness-concierge/src/types.ts` — Full type definitions:

```typescript
// Agent IDs
export const AGENT_IDS = [
  "orchestrator_router",
  "clinical_safety_escalation",
  "data_steward_pdpa",
  "daily_coach",
  "concierge_operator",
  "rag_knowledge",
  "device_integration_optional",
  "evaluation_capa",
] as const;
export type AgentId = (typeof AGENT_IDS)[number];

// Privacy
export type PrivacyLabel = "LOW" | "MED" | "HIGH";
export type RiskTier = 0 | 1 | 2 | 3;
export const RISK_TIER_NAMES: Record<RiskTier, string> = {
  0: "Stable",
  1: "Elevated",
  2: "High",
  3: "Crisis",
};

// Consent scopes
export const CONSENT_SCOPES = [
  "consent.basic_profile",
  "consent.calendar_read",
  "consent.calendar_write",
  "consent.messaging",
  "consent.wearable_data",
  "consent.biometric_data",
  "consent.neuro_data",
  "consent.share_with_provider",
  "consent.cross_border_transfer",
] as const;
export type ConsentScope = (typeof CONSENT_SCOPES)[number];

// Internal action types
export type InternalActionType =
  | "TASK"
  | "BOOKING_REQUEST"
  | "ESCALATION"
  | "FLAG"
  | "REMINDER"
  | "DATA_ACCESS_LOG";
export type ActionPriority = "P0" | "P1" | "P2" | "P3";

// Tool IDs
export const TOOL_IDS = [
  "secure_messaging.send",
  "calendar.read",
  "calendar.write",
  "scheduling.book_provider",
  "rag.retrieve",
  "wearables.sync",
  "cgm.sync",
  "consent.check",
  "audit.log_event",
  "incident.create",
] as const;
export type ToolId = (typeof TOOL_IDS)[number];

// Risk signals
export const RISK_SIGNALS = [
  "none",
  "insomnia_severe",
  "panic_symptoms",
  "trauma_triggers",
  "self_harm_ideation",
  "self_harm_plan",
  "imminent_danger",
  "psychosis_mania_signals",
  "substance_withdrawal_risk",
  "medical_emergency_symptoms",
  "unknown",
] as const;
export type RiskSignal = (typeof RISK_SIGNALS)[number];

// Escalation targets
export type EscalationTarget =
  | "none"
  | "case_lead"
  | "licensed_clinician"
  | "emergency_services"
  | "crisis_hotline";

// Metric IDs
export const METRIC_IDS = [
  "sleep_hours",
  "sleep_regularity",
  "sleep_quality_score",
  "stress_0_10",
  "energy_0_10",
  "resting_hr_trend",
  "hrv_trend",
  "afternoon_crash_flag",
  "meeting_readiness",
  "adherence_non_negotiables",
  "screen_anxiety_score",
  "screen_depression_score",
  "screen_trauma_symptom_score",
] as const;
export type MetricId = (typeof METRIC_IDS)[number];

// Measurement timepoints
export type MeasurementTimepoint =
  | "baseline"
  | "immediate_post"
  | "hold_day7"
  | "hold_day30"
  | "weekly"
  | "monthly"
  | "quarterly"
  | "ad_hoc";

// Provider types
export type ProviderType =
  | "therapist"
  | "psychiatrist"
  | "sleep_medicine"
  | "primary_care"
  | "coach"
  | "other";

// Device sources
export type DeviceSource =
  | "wearable_sleep"
  | "wearable_hr"
  | "wearable_hrv"
  | "bp_cuff"
  | "cgm"
  | "eeg_biofeedback"
  | "other";

// Inter-agent message (matches JSON Schema)
export type InterAgentMessage = {
  schema_version: "emwcp-agent-message.v1";
  timestamp: string;
  conversation_id: string;
  message_id: string;
  agent_id: AgentId;
  role: AgentId;
  privacy: {
    label: PrivacyLabel;
    consent: {
      status: "ok" | "required" | "blocked";
      required_scopes: ConsentScope[];
      missing_scopes: ConsentScope[];
    };
    allowed_fields: string[];
    redactions: Array<{
      field: string;
      action: "remove" | "mask" | "summarize" | "move_to_secure_channel";
      note?: string;
    }>;
    notification_policy?: {
      push_notification_allowed: boolean;
      push_notification_max_detail: "none" | "generic_only" | "low_detail";
    };
  };
  risk: {
    tier: RiskTier;
    signals: RiskSignal[];
    escalation: {
      required: boolean;
      target: EscalationTarget;
      crisis_script_used: boolean;
      notes?: string;
    };
  };
  client_response: string;
  internal_actions: Array<{
    type: InternalActionType;
    priority: ActionPriority;
    summary: string;
    due_at?: string;
    assignee?: string;
    metadata?: Record<string, unknown>;
  }>;
  measurement_updates?: {
    timepoint: MeasurementTimepoint;
    metrics: Array<{
      metric_id: MetricId;
      value: number | string | boolean;
      unit: string;
      baseline_value?: number | string | boolean | null;
      delta_from_baseline?: number | null;
      source: "self_report" | "wearable" | "clinician" | "operator" | "unknown";
      notes?: string;
    }>;
    scorecard_summary?: string;
  };
  handoff?: {
    to_provider_type: ProviderType;
    minimum_fields: {
      reason_for_referral?: string;
      goals_and_constraints?: string;
      risk_tier?: RiskTier;
      recent_trends?: string;
      next_steps?: string;
      follow_up_date?: string;
    };
  };
  device_context?: {
    connected_sources: DeviceSource[];
    data_availability: "none" | "partial" | "verified";
    trend_summary?: string;
    confidence: "low" | "medium" | "high";
  };
  capa_ticket?: {
    ticket_id: string;
    issue: string;
    root_cause_hypothesis: string;
    corrective_actions: string[];
    preventive_actions: string[];
    success_metric: string;
    impact_assessment?: string;
    rollback_plan: string;
  };
};

// Tool definition
export type ToolDefinition = {
  id: ToolId;
  type: string;
  description: string;
  allowed_by_agents: AgentId[];
  required_consent_scopes: ConsentScope[];
  audit_level: PrivacyLabel;
  constraints: Record<string, unknown>;
};

// Tool invocation
export type ToolInvocation = {
  invocation_id: string;
  tool_id: ToolId;
  agent_id: AgentId;
  session_id: string;
  timestamp: string;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  consent_verified: boolean;
  duration_ms: number;
};

// Session
export type SessionStatus = "active" | "paused" | "completed" | "escalated";
export type WellnessSession = {
  session_id: string;
  user_id: string;
  status: SessionStatus;
  current_agent: AgentId;
  agents_visited: AgentId[];
  escalation_level: RiskTier;
  consent_grants: ConsentScope[];
  created_at: string;
  updated_at: string;
  metadata: Record<string, unknown>;
};

// Agent prompt config
export type AgentPromptConfig = {
  agentId: AgentId;
  name: string;
  role: string;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  routingIntents: string[];
  requiredOutputs: string[];
};

// Constants
export const STATION_ID = process.env.STATION_ID ?? "iot-hub";
export const SESSION_TIMEOUT_MS = 24 * 60 * 60 * 1000;
export const WELLNESS_CHECK_INTERVAL_MS = 30 * 60 * 1000;
export const CONVEX_URL = process.env.CONVEX_URL ?? "http://127.0.0.1:3210";
```

5. `extensions/wellness-concierge/src/tests/types.test.ts`:

- Test AGENT_IDS has 8 entries
- Test each agent ID is a valid string
- Test CONSENT_SCOPES has 9 entries
- Test TOOL_IDS has 10 entries
- Test RISK_TIER_NAMES covers all 4 tiers
- Test METRIC_IDS has 13 entries

Run: `pnpm install && pnpm vitest run extensions/wellness-concierge/src/tests/types.test.ts`
DONE WHEN: All files exist and tests pass.

========================================================================
PHASE 2: SYSTEM PROMPTS + SCHEMA VALIDATION
========================================================================

REFERENCE: Read `extensions/neural-graph/src/graph/orchestrator.ts` for prompt patterns.

1. `src/agents/global-prompt.ts` — Export GLOBAL_SYSTEM_PROMPT as const string. Content adapted from the spec:

The global prompt must include ALL of these sections:

- PRIMARY OBJECTIVE: Improve client outcomes through measurable routines, scheduling/coordination, clinician-led pathways. Durable follow-up: baseline -> Day 7 -> Day 30 -> monthly/quarterly. Executive-grade discretion.
- NON-NEGOTIABLE SAFETY BOUNDARIES:
  1. No diagnosis, no medical treatment, no medication advice, no cure claims
  2. Crisis override: self-harm/suicidality/danger/psychosis -> Crisis Script -> emergency services -> escalate to Case Lead
  3. Data truthfulness: never state biometric conditions without verified data
  4. PDPA privacy: collect minimum, explicit consent for sensitive data, no sensitive push notifications, least-privilege
  5. No pseudoscience: no "dopamine reset" claims
- UX PRINCIPLES: Executive-friendly, max 2 questions, 2-3 touches/day, one plan at a time with timing
- OPENCLAW CONTEXT: Running on OpenClaw station {STATION_ID}, neural-graph backbone for orchestration, Convex persistence
- OUTPUT REQUIREMENTS: client_response, internal_actions, measurement_updates, privacy_label
- CRISIS SCRIPT: "Are you in immediate danger?" -> emergency services -> Singapore crisis resources -> notify Case Lead
- MEASUREMENT FRAMEWORK: self-report (energy/stress/sleep), trends (HR/HRV), function (meeting readiness, crash flag), timepoints
- TOOL USE RULES: only scheduling, secure messaging, authorized retrieval, RAG. Log every access.
- FAIL-SAFE: uncertain -> ask or route to clinician; risk doubt -> clinical safety; privacy doubt -> data steward blocks

2. `src/agents/prompts.ts` — Export AGENT_PROMPTS as Record<AgentId, AgentPromptConfig> with full system prompts for all 8 agents. Each prompt adapted for OpenClaw with tool awareness:

**orchestrator_router**: Route by Safety > Privacy > Correctness > Value. Steps: 1) Risk triage (red flags -> clinical_safety), 2) Privacy classification (sensitive -> data_steward), 3) Intent routing (daily -> daily_coach, scheduling -> concierge, device -> device_integration, docs -> rag), 4) Compile response. Uses Command(goto) for dynamic routing. Temperature 0.1, maxTokens 512.

**clinical_safety_escalation**: Safety gatekeeper. Suicidality -> crisis script + emergency. Psychosis/mania -> urgent clinical. Severe panic + chest pain -> emergency. Never reassure incorrectly. Output: risk_tier (2 or 3), escalation_required, crisis_script_used. Temperature 0.0, maxTokens 1024.

**data_steward_pdpa**: Privacy enforcement. Consent management for health/biometric/neuro. Least-privilege sharing. No sensitive push notifications. Retention schedules. Audit logging. Output: privacy_label, allowed_fields, redactions, consent_required. Temperature 0.1, maxTokens 512.

**daily_coach**: Low-friction routines. Uses calendar timing, self-report, verified wearable trends. One plan at a time, max 2 questions. Green/Yellow/Red readiness model. Route medical to clinician. Output: action_now, optional_question, micro_commitment. Temperature 0.4, maxTokens 1024.

**concierge_operator**: Care coordination. Book per SLA. Weekly 15-min check-ins, Day 7/Day 30 holds. 1-page scorecard + clinician summary. Minimum-field handoffs. Escalate when risk >= 2. Output: appointment_options, next_checkin, handoff_summary. Temperature 0.2, maxTokens 1024.

**rag_knowledge**: Approved internal sources only. No fabrication. Draft new protocols from v1 structure. Output: retrieved_summary, internal_refs, gaps_and_defaults. Temperature 0.1, maxTokens 2048.

**device_integration_optional**: Verified signals only. Trends relative to baseline. Wellness framing. Route risk to clinical. Device lifecycle governance. Output: data_availability, trend_summary, recommendation, privacy_requirements. Temperature 0.2, maxTokens 512.

**evaluation_capa**: Quality loop. Inputs: adherence, outcomes, feedback, incidents, SLA. Process: identify failure -> corrective -> preventive -> change request with rollback. Output: capa_ticket. Temperature 0.1, maxTokens 1024.

3. `src/schema/inter-agent-message.ts` — Full JSON Schema as TypeScript object:

Export INTER_AGENT_MESSAGE_SCHEMA containing the complete draft 2020-12 schema with:

- Required: schema_version, timestamp, conversation_id, message_id, agent_id, role, privacy, risk, client_response, internal_actions
- privacy object: label enum, consent (status/required_scopes/missing_scopes), allowed_fields, redactions array, notification_policy
- risk object: tier (0-3), signals enum (11 values), escalation (required, target, crisis_script_used, notes)
- internal_actions: array of {type enum, priority enum, summary, due_at?, assignee?, metadata?}
- measurement_updates: timepoint enum, metrics array (metric_id enum, value, unit, baseline, delta, source enum), scorecard_summary
- handoff: to_provider_type enum, minimum_fields
- device_context: connected_sources array, data_availability, trend_summary, confidence
- capa_ticket: ticket_id, issue, root_cause, corrective_actions[], preventive_actions[], success_metric, rollback_plan
- $defs for internal_action, metric_update, capa_ticket

4. `src/schema/validator.ts`:

```typescript
import Ajv from "ajv";
import addFormats from "ajv-formats";
import { INTER_AGENT_MESSAGE_SCHEMA } from "./inter-agent-message.js";
import type { InterAgentMessage } from "../types.js";

const ajv = new Ajv({ allErrors: true });
addFormats(ajv);
const validate = ajv.compile(INTER_AGENT_MESSAGE_SCHEMA);

export function validateInterAgentMessage(msg: unknown): {
  valid: boolean;
  errors: string[];
  message?: InterAgentMessage;
} {
  const valid = validate(msg);
  if (valid) return { valid: true, errors: [], message: msg as InterAgentMessage };
  return {
    valid: false,
    errors: (validate.errors ?? []).map((e) => `${e.instancePath}: ${e.message}`),
  };
}
```

5. Tests:

- `src/tests/prompts.test.ts`: all 8 agents have prompts, non-empty systemPrompt, valid temperature/maxTokens, non-empty routingIntents and requiredOutputs
- `src/tests/validator.test.ts`: valid message passes, missing required fields fail, invalid enum values fail, correct error paths reported

Run tests. DONE WHEN: All 8 prompts defined with full text, schema validates correctly, tests pass.

========================================================================
PHASE 3: LANGGRAPH STATE + GRAPH COMPILATION
========================================================================

REFERENCE: Read `extensions/neural-graph/src/graph/compiler.ts` and `extensions/neural-graph/src/graph/state.ts`.

1. `src/graph/state.ts` — WellnessGraphState using Annotation.Root():

- sessionId, userId, userMessage (string, replace reducer)
- selectedAgent, intent (string, replace)
- routingConfidence (number, replace)
- consentGrants (string[], set-append reducer: [...new Set([...prev, ...next])])
- consentRequired (string[], replace)
- messages (InterAgentMessage[], append reducer)
- agentsVisited (string[], append)
- agentLatencies (Record<string, number>, merge reducer)
- escalationLevel (number, replace)
- safetyFlags (string[], set-append)
- response (unknown, replace)
- success (boolean, replace)
- error (string, replace)
- capaFindings (Record<string, unknown>[], append)
- pendingEscalation (boolean, replace)

2. `src/graph/orchestrator-router.ts`:

- classifyWellnessIntent(message: string): { intent: string; confidence: number }
- Pattern-match: crisis keywords (suicide, self-harm, hurt myself, end my life, kill, emergency, danger) -> "crisis"
- scheduling/booking/appointment/calendar -> "scheduling"
- device/wearable/heart rate/HRV/sleep tracker/biometric -> "device"
- privacy/consent/data/delete my data/PDPA -> "privacy"
- protocol/SOP/guide/documentation/policy -> "knowledge"
- Default -> "coaching"
- INTENT_ROUTES: crisis->clinical_safety_escalation, scheduling->concierge_operator, device->device_integration_optional, privacy->data_steward_pdpa, knowledge->rag_knowledge, coaching->daily_coach
- Export orchestratorRouter function returning Command({ update: { intent, selectedAgent, routingConfidence, agentsVisited }, goto: route })

3. `src/graph/agent-nodes.ts` — 7 stub functions (clinicalSafetyEscalation, dataStewardPdpa, dailyCoach, conciergeOperator, ragKnowledge, deviceIntegration, evaluationCapa):

- Each records timing, produces minimal valid state update
- evaluationCapa checks escalationLevel and sets pendingEscalation if needed
- Export needsEscalation conditional function

4. `src/graph/safety-gate.ts`:

- Uses interrupt() from @langchain/langgraph for human-in-the-loop
- Blocks until crisis is reviewed

5. `src/graph/compiler.ts`:

- compileWellnessGraph() builds StateGraph with 9 nodes
- Edges: START->orchestrator, orchestrator uses Command goto (default edge to daily_coach), all 5 agent nodes -> evaluation_capa, evaluation -> conditional (needsEscalation) -> clinical_safety or END, clinical_safety -> conditional -> safety_gate or END, safety_gate -> END
- executeWellnessQuery(message, userId?, sessionId?) compiles graph and invokes

6. `src/tests/compiler.test.ts`: graph compiles, routes "I want to hurt myself" -> clinical_safety, routes "feeling tired" -> daily_coach, routes "book appointment" -> concierge

Run tests. DONE WHEN: Graph compiles, routing correct, tests pass.

========================================================================
PHASE 4: TOOL REGISTRY + AUDIT
========================================================================

1. `src/tools/registry.ts` — TOOL_REGISTRY Record<ToolId, ToolDefinition> with 10 tools:

| tool_id                  | type          | allowed_by                                                | consent_scopes                                | audit |
| ------------------------ | ------------- | --------------------------------------------------------- | --------------------------------------------- | ----- |
| secure_messaging.send    | communication | orchestrator, daily_coach, concierge, clinical_safety     | consent.messaging                             | MED   |
| calendar.read            | calendar      | orchestrator, daily_coach, concierge                      | consent.calendar_read                         | MED   |
| calendar.write           | calendar      | concierge                                                 | consent.calendar_write                        | MED   |
| scheduling.book_provider | scheduling    | concierge                                                 | consent.share_with_provider                   | HIGH  |
| rag.retrieve             | knowledge     | rag_knowledge, orchestrator                               | (none)                                        | LOW   |
| wearables.sync           | device        | device_integration, orchestrator                          | consent.wearable_data, consent.biometric_data | HIGH  |
| cgm.sync                 | device        | device_integration                                        | consent.biometric_data                        | HIGH  |
| consent.check            | governance    | data_steward, orchestrator                                | (none)                                        | MED   |
| audit.log_event          | governance    | data_steward, orchestrator, concierge, device_integration | (none)                                        | MED   |
| incident.create          | safety        | clinical_safety, data_steward                             | consent.share_with_provider                   | HIGH  |

Include constraints from the spec (no_sensitive_push, trend_only_reporting, neutral_event_titles, etc.)

2. `src/tools/tool-stubs.ts`:

- executeTool(toolId, input, context: { agentId, sessionId, consentGrants }) -> { success, result, auditEntry }
- Check agent authorization (reject if not in allowed_by_agents)
- Check consent (reject if missing required scopes)
- Run stub implementation (return realistic mock data)
- Create audit entry

3. `src/tools/audit.ts` — createAuditEntry() helper

4. `src/tests/tools.test.ts`: 10 tools exist, unauthorized agent rejected, missing consent rejected, authorized+consented succeeds

Run tests. DONE WHEN: All 10 tools, consent/auth enforced, tests pass.

========================================================================
PHASE 5: CONVEX PERSISTENCE
========================================================================

REFERENCE: Read `extensions/neural-graph/convex/schema.ts`.

1. `convex/schema.ts` — 5 tables:

- wellness_sessions: sessionId, userId, status, currentAgent, agentsVisited, escalationLevel, consentGrants, createdAt, updatedAt, metadata. Indexes: by_sessionId, by_userId, by_status
- consent_records: sessionId, userId, scope, granted, grantedAt, revokedAt?, agentId. Indexes: by_userId, by_sessionId
- audit_log: invocationId, toolId, agentId, sessionId, timestamp, consentVerified, durationMs, auditLevel. Indexes: by_sessionId, by_timestamp
- capa_findings: findingId, sessionId, category, severity, description, recommendation, agentId, createdAt, resolved. Indexes: by_sessionId, by_severity
- checkpoints: threadId, checkpointId, parentCheckpointId?, channelValues, channelVersions, createdAt. Indexes: by_threadId, by_checkpointId

2. `src/persistence/convex-client.ts` — getConvexClient() singleton
3. `src/persistence/convex-checkpointer.ts` — ConvexCheckpointSaver implementing BaseCheckpointSaver

DONE WHEN: Schema compiles, client connects, checkpointer implemented.

========================================================================
PHASE 6: API HANDLERS + FULL PLUGIN WIRING
========================================================================

REFERENCE: Read `extensions/neural-graph/index.ts` for the exact pattern.

1. `src/api-handlers.ts` — Handler functions:

- handleWellnessStatus(stationId): { status, phase, agents, activeSessions, totalQueries, avgResponseMs, escalationCount }
- handleWellnessQuery(message, userId?, sessionId?): runs executeWellnessQuery(), returns graph result
- handleWellnessSessions(): list active sessions from Convex
- handleWellnessConsent(sessionId, scope, granted): record consent
- handleWellnessAgents(): return non-sensitive agent configs (names, roles, routing intents)
- handleWellnessTools(): return tool registry (public info)
- handleWellnessAudit(sessionId?, limit?): paginated audit log
- handleWellnessCapa(sessionId?): CAPA findings
- handleWellnessEscalate(sessionId, reason): manual escalation trigger

2. `index.ts` — Full plugin:

- Register all 11 HTTP routes (GET /api/wellness/status, POST /api/wellness/query, etc.)
- Register background service: session cleanup every 30 minutes
- Use lazy imports for handlers

3. `src/metrics/wellness-metrics.ts` — Prometheus format:

- wellness_sessions_total (counter)
- wellness_queries_total (counter)
- wellness_escalations_total (counter)
- wellness_tool_invocations_total (counter, by tool_id)
- wellness_active_sessions (gauge)
- wellness_consent_compliance_rate (gauge)

4. `src/tests/api-handlers.test.ts`

Run: pnpm install, restart hive-mind, curl http://localhost:3001/api/wellness/status
DONE WHEN: All routes respond, server starts clean, tests pass.

========================================================================
PHASE 7: PORTAL PAGE
========================================================================

REFERENCE: Read `extensions/hive-mind/portal/htdocs/js/pages/neural-graph.js` and `extensions/hive-mind/portal/htdocs/js/router.js`.

1. `extensions/hive-mind/portal/htdocs/js/pages/wellness.js`:

- export async function render(container, query) {}
- export async function refresh(container, query) {}
- export function destroy() {}
- Fetch from /api/wellness/status, /api/wellness/sessions, /api/wellness/agents, /api/wellness/audit, /api/wellness/capa
- TOP: 6 status cards in grid (Active Sessions, Total Queries, Avg Response, Escalations, Consent Rate, Agent Health)
- MIDDLE: Force-directed SVG topology (780x400) of 8 agent nodes with edges showing message flows:
  - Node colors: green (daily_coach), red (clinical_safety), blue (data_steward), purple (orchestrator), orange (concierge), cyan (rag), yellow (device), gray (evaluation)
  - Edges: orchestrator -> all others, all -> evaluation, evaluation -> clinical_safety (conditional)
  - Fullscreen button (reuse .flow-btn pattern from topology.css)
- BOTTOM: Active sessions table, CAPA findings, audit log, escalation queue

2. Edit `extensions/hive-mind/portal/htdocs/js/router.js`:

- Add: `"/wellness": () => import("./pages/wellness.js"),`

3. Edit `extensions/hive-mind/portal/htdocs/index.html`:

- Add Wellness nav link in sidebar after hotel-scraper

4. Deploy: rsync to /opt/openclaw-portal/htdocs/
   DONE WHEN: Navigate to /#/wellness, page renders with cards + SVG + tables.

========================================================================
PHASE 8: INTEGRATION TESTING + POLISH
========================================================================

1. `src/tests/integration.test.ts`:

- Normal flow: "I'm feeling stressed today" -> orchestrator -> daily_coach -> evaluation -> response with action_now
- Crisis flow: "I want to hurt myself" -> orchestrator -> clinical_safety -> safety_gate with crisis script
- Consent flow: tool requires consent -> blocked -> granted -> executes
- Validation flow: malformed message -> rejected by validator
- Privacy flow: data_steward blocks HIGH sensitivity in notification

2. Run ALL tests: pnpm vitest run extensions/wellness-concierge/
3. Verify portal page with live data in browser
4. Commit all changes

DONE WHEN: All tests pass, portal functional, server running clean.

========================================================================
COMPLETION: Output <promise>ALL 8 PHASES COMPLETE AND ALL TESTS PASSING</promise> ONLY when genuinely true.
========================================================================
