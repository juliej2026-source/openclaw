// ---------------------------------------------------------------------------
// EMWCP — Executive Mental Wellbeing Concierge Platform
// Core type definitions, agent IDs, consent scopes, tool IDs, and constants
// ---------------------------------------------------------------------------

// ---- Agent IDs ----

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

// ---- Privacy & Risk ----

export type PrivacyLabel = "LOW" | "MED" | "HIGH";

export type RiskTier = 0 | 1 | 2 | 3;

export const RISK_TIER_NAMES: Record<RiskTier, string> = {
  0: "Stable",
  1: "Elevated",
  2: "High",
  3: "Crisis",
};

// ---- Consent Scopes (PDPA-aligned) ----

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

// ---- Internal Action Types ----

export type InternalActionType =
  | "TASK"
  | "BOOKING_REQUEST"
  | "ESCALATION"
  | "FLAG"
  | "REMINDER"
  | "DATA_ACCESS_LOG";

export type ActionPriority = "P0" | "P1" | "P2" | "P3";

// ---- Tool IDs ----

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

// ---- Risk Signals ----

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

// ---- Escalation Targets ----

export type EscalationTarget =
  | "none"
  | "case_lead"
  | "licensed_clinician"
  | "emergency_services"
  | "crisis_hotline";

// ---- Metric IDs (Executive Scorecard) ----

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

// ---- Measurement Timepoints ----

export type MeasurementTimepoint =
  | "baseline"
  | "immediate_post"
  | "hold_day7"
  | "hold_day30"
  | "weekly"
  | "monthly"
  | "quarterly"
  | "ad_hoc";

// ---- Provider Types ----

export type ProviderType =
  | "therapist"
  | "psychiatrist"
  | "sleep_medicine"
  | "primary_care"
  | "coach"
  | "other";

// ---- Device Sources ----

export type DeviceSource =
  | "wearable_sleep"
  | "wearable_hr"
  | "wearable_hrv"
  | "bp_cuff"
  | "cgm"
  | "eeg_biofeedback"
  | "other";

// ---- Inter-Agent Message (matches JSON Schema emwcp-agent-message.v1) ----

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

// ---- Tool Definition ----

export type ToolDefinition = {
  id: ToolId;
  type: string;
  description: string;
  allowed_by_agents: AgentId[];
  required_consent_scopes: ConsentScope[];
  audit_level: PrivacyLabel;
  constraints: Record<string, unknown>;
};

// ---- Tool Invocation ----

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

// ---- Session ----

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

// ---- Agent Prompt Config ----

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

// ---- Constants ----

export const STATION_ID = process.env.STATION_ID ?? "iot-hub";
export const SESSION_TIMEOUT_MS = 24 * 60 * 60 * 1000; // 24 hours
export const WELLNESS_CHECK_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
export const CONVEX_URL = process.env.CONVEX_URL ?? "http://127.0.0.1:3210";
