import type { ToolDefinition } from "../types.js";

// ---------------------------------------------------------------------------
// EMWCP Tool Registry — 10 tool definitions from the specification
// Each tool has: allowed agents, required consent scopes, audit level
// ---------------------------------------------------------------------------

export const TOOL_REGISTRY: Record<string, ToolDefinition> = {
  "secure_messaging.send": {
    id: "secure_messaging.send",
    type: "communication",
    description: "Send an encrypted message to the user via the secure messaging channel",
    allowed_by_agents: [
      "orchestrator_router",
      "daily_coach",
      "concierge_operator",
      "clinical_safety_escalation",
    ],
    required_consent_scopes: ["consent.messaging"],
    audit_level: "MED",
    constraints: {
      max_message_length: 4096,
      rate_limit_per_minute: 10,
    },
  },

  "calendar.read": {
    id: "calendar.read",
    type: "calendar",
    description: "Read the user's calendar to check availability and scheduled sessions",
    allowed_by_agents: ["orchestrator_router", "daily_coach", "concierge_operator"],
    required_consent_scopes: ["consent.calendar_read"],
    audit_level: "MED",
    constraints: {
      max_range_days: 90,
    },
  },

  "calendar.write": {
    id: "calendar.write",
    type: "calendar",
    description: "Create, update, or cancel calendar events for wellness sessions",
    allowed_by_agents: ["concierge_operator"],
    required_consent_scopes: ["consent.calendar_write"],
    audit_level: "MED",
    constraints: {
      max_events_per_request: 5,
      requires_confirmation: true,
    },
  },

  "scheduling.book_provider": {
    id: "scheduling.book_provider",
    type: "scheduling",
    description: "Book an appointment with a healthcare provider (therapist, psychiatrist, etc.)",
    allowed_by_agents: ["concierge_operator"],
    required_consent_scopes: ["consent.share_with_provider"],
    audit_level: "HIGH",
    constraints: {
      sla_response_hours: 48,
      minimum_fields: ["reason_for_referral", "risk_tier", "next_steps"],
    },
  },

  "rag.retrieve": {
    id: "rag.retrieve",
    type: "knowledge",
    description: "Retrieve approved program documentation and SOPs via RAG pipeline",
    allowed_by_agents: ["rag_knowledge", "orchestrator_router"],
    required_consent_scopes: [],
    audit_level: "LOW",
    constraints: {
      max_chunks: 10,
      approved_sources_only: true,
    },
  },

  "wearables.sync": {
    id: "wearables.sync",
    type: "device",
    description:
      "Sync and retrieve data from connected wearable devices (Fitbit, Apple Watch, Garmin, Oura)",
    allowed_by_agents: ["device_integration_optional", "orchestrator_router"],
    required_consent_scopes: ["consent.wearable_data", "consent.biometric_data"],
    audit_level: "HIGH",
    constraints: {
      sync_interval_minutes: 15,
      verified_signals_only: true,
    },
  },

  "cgm.sync": {
    id: "cgm.sync",
    type: "device",
    description: "Sync continuous glucose monitor data for metabolic health tracking",
    allowed_by_agents: ["device_integration_optional"],
    required_consent_scopes: ["consent.biometric_data"],
    audit_level: "HIGH",
    constraints: {
      sync_interval_minutes: 30,
      verified_signals_only: true,
    },
  },

  "consent.check": {
    id: "consent.check",
    type: "governance",
    description: "Check current consent status for a user across all scopes",
    allowed_by_agents: ["data_steward_pdpa", "orchestrator_router"],
    required_consent_scopes: [],
    audit_level: "MED",
    constraints: {},
  },

  "audit.log_event": {
    id: "audit.log_event",
    type: "governance",
    description: "Log an audit event for compliance and traceability",
    allowed_by_agents: [
      "data_steward_pdpa",
      "orchestrator_router",
      "concierge_operator",
      "device_integration_optional",
    ],
    required_consent_scopes: [],
    audit_level: "MED",
    constraints: {
      retention_days: 365,
    },
  },

  "incident.create": {
    id: "incident.create",
    type: "safety",
    description: "Create a clinical incident report for safety escalation or PDPA breach",
    allowed_by_agents: ["clinical_safety_escalation", "data_steward_pdpa"],
    required_consent_scopes: ["consent.share_with_provider"],
    audit_level: "HIGH",
    constraints: {
      requires_immediate_notification: true,
      escalation_sla_minutes: 15,
    },
  },
};

/**
 * Get a tool definition by ID.
 */
export function getToolDefinition(toolId: string): ToolDefinition | undefined {
  return TOOL_REGISTRY[toolId];
}

/**
 * Get all tool IDs.
 */
export function getAllToolIds(): string[] {
  return Object.keys(TOOL_REGISTRY);
}

/**
 * Get tools available to a specific agent.
 */
export function getToolsForAgent(agentId: string): ToolDefinition[] {
  return Object.values(TOOL_REGISTRY).filter((tool) =>
    tool.allowed_by_agents.includes(agentId as any),
  );
}
