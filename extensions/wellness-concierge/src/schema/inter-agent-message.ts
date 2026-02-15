// ---------------------------------------------------------------------------
// EMWCP — Inter-Agent Message JSON Schema (draft 2020-12)
// Runtime-validatable contract for all agent communications
// ---------------------------------------------------------------------------

import { AGENT_IDS, RISK_SIGNALS, METRIC_IDS } from "../types.js";

export const INTER_AGENT_MESSAGE_SCHEMA = {
  // Note: $schema omitted — AJV 8 uses draft-07 by default; the schema is
  // structurally compatible. The $id is kept for documentation purposes.
  $id: "https://openclaw.ai/schemas/emwcp-agent-message.v1.json",
  title: "Executive Mental Wellbeing Concierge Platform — Inter-Agent Message",
  type: "object",
  additionalProperties: false,
  required: [
    "schema_version",
    "timestamp",
    "conversation_id",
    "message_id",
    "agent_id",
    "role",
    "privacy",
    "risk",
    "client_response",
    "internal_actions",
  ],
  properties: {
    schema_version: {
      type: "string",
      const: "emwcp-agent-message.v1",
    },
    timestamp: {
      type: "string",
      format: "date-time",
    },
    conversation_id: {
      type: "string",
      minLength: 6,
    },
    message_id: {
      type: "string",
      minLength: 6,
    },
    agent_id: {
      type: "string",
      enum: [...AGENT_IDS],
    },
    role: {
      type: "string",
      enum: [...AGENT_IDS],
    },

    privacy: {
      type: "object",
      additionalProperties: false,
      required: ["label", "consent", "allowed_fields", "redactions"],
      properties: {
        label: {
          type: "string",
          enum: ["LOW", "MED", "HIGH"],
        },
        consent: {
          type: "object",
          additionalProperties: false,
          required: ["status", "required_scopes", "missing_scopes"],
          properties: {
            status: {
              type: "string",
              enum: ["ok", "required", "blocked"],
            },
            required_scopes: {
              type: "array",
              items: { type: "string" },
              uniqueItems: true,
            },
            missing_scopes: {
              type: "array",
              items: { type: "string" },
              uniqueItems: true,
            },
          },
        },
        allowed_fields: {
          type: "array",
          items: { type: "string" },
          uniqueItems: true,
        },
        redactions: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["field", "action"],
            properties: {
              field: { type: "string" },
              action: {
                type: "string",
                enum: ["remove", "mask", "summarize", "move_to_secure_channel"],
              },
              note: { type: "string" },
            },
          },
        },
        notification_policy: {
          type: "object",
          additionalProperties: false,
          properties: {
            push_notification_allowed: { type: "boolean" },
            push_notification_max_detail: {
              type: "string",
              enum: ["none", "generic_only", "low_detail"],
            },
          },
        },
      },
    },

    risk: {
      type: "object",
      additionalProperties: false,
      required: ["tier", "signals", "escalation"],
      properties: {
        tier: {
          type: "integer",
          enum: [0, 1, 2, 3],
        },
        signals: {
          type: "array",
          items: {
            type: "string",
            enum: [...RISK_SIGNALS],
          },
          uniqueItems: true,
        },
        escalation: {
          type: "object",
          additionalProperties: false,
          required: ["required", "target", "crisis_script_used"],
          properties: {
            required: { type: "boolean" },
            target: {
              type: "string",
              enum: [
                "none",
                "case_lead",
                "licensed_clinician",
                "emergency_services",
                "crisis_hotline",
              ],
            },
            crisis_script_used: { type: "boolean" },
            notes: { type: "string" },
          },
        },
      },
    },

    client_response: {
      type: "string",
      minLength: 1,
      maxLength: 4000,
    },

    internal_actions: {
      type: "array",
      minItems: 0,
      items: { $ref: "#/$defs/internal_action" },
    },

    measurement_updates: {
      type: "object",
      additionalProperties: false,
      properties: {
        timepoint: {
          type: "string",
          enum: [
            "baseline",
            "immediate_post",
            "hold_day7",
            "hold_day30",
            "weekly",
            "monthly",
            "quarterly",
            "ad_hoc",
          ],
        },
        metrics: {
          type: "array",
          items: { $ref: "#/$defs/metric_update" },
        },
        scorecard_summary: { type: "string" },
      },
    },

    handoff: {
      type: "object",
      additionalProperties: false,
      properties: {
        to_provider_type: {
          type: "string",
          enum: ["therapist", "psychiatrist", "sleep_medicine", "primary_care", "coach", "other"],
        },
        minimum_fields: {
          type: "object",
          additionalProperties: false,
          properties: {
            reason_for_referral: { type: "string" },
            goals_and_constraints: { type: "string" },
            risk_tier: { type: "integer", enum: [0, 1, 2, 3] },
            recent_trends: { type: "string" },
            next_steps: { type: "string" },
            follow_up_date: { type: "string", format: "date" },
          },
        },
      },
    },

    device_context: {
      type: "object",
      additionalProperties: false,
      properties: {
        connected_sources: {
          type: "array",
          items: {
            type: "string",
            enum: [
              "wearable_sleep",
              "wearable_hr",
              "wearable_hrv",
              "bp_cuff",
              "cgm",
              "eeg_biofeedback",
              "other",
            ],
          },
          uniqueItems: true,
        },
        data_availability: {
          type: "string",
          enum: ["none", "partial", "verified"],
        },
        trend_summary: { type: "string" },
        confidence: {
          type: "string",
          enum: ["low", "medium", "high"],
        },
      },
    },

    capa_ticket: {
      $ref: "#/$defs/capa_ticket",
    },
  },

  $defs: {
    internal_action: {
      type: "object",
      additionalProperties: false,
      required: ["type", "priority", "summary"],
      properties: {
        type: {
          type: "string",
          enum: ["TASK", "BOOKING_REQUEST", "ESCALATION", "FLAG", "REMINDER", "DATA_ACCESS_LOG"],
        },
        priority: {
          type: "string",
          enum: ["P0", "P1", "P2", "P3"],
        },
        summary: {
          type: "string",
          minLength: 1,
          maxLength: 500,
        },
        due_at: {
          type: "string",
          format: "date-time",
        },
        assignee: {
          type: "string",
        },
        metadata: {
          type: "object",
          additionalProperties: true,
        },
      },
    },

    metric_update: {
      type: "object",
      additionalProperties: false,
      required: ["metric_id", "value", "unit"],
      properties: {
        metric_id: {
          type: "string",
          enum: [...METRIC_IDS],
        },
        value: {
          type: ["number", "integer", "string", "boolean"],
        },
        unit: {
          type: "string",
          minLength: 1,
        },
        baseline_value: {
          type: ["number", "integer", "string", "boolean", "null"],
        },
        delta_from_baseline: {
          type: ["number", "integer", "null"],
        },
        source: {
          type: "string",
          enum: ["self_report", "wearable", "clinician", "operator", "unknown"],
        },
        notes: { type: "string" },
      },
    },

    capa_ticket: {
      type: "object",
      additionalProperties: false,
      required: [
        "ticket_id",
        "issue",
        "root_cause_hypothesis",
        "corrective_actions",
        "preventive_actions",
        "success_metric",
        "rollback_plan",
      ],
      properties: {
        ticket_id: { type: "string" },
        issue: { type: "string" },
        root_cause_hypothesis: { type: "string" },
        corrective_actions: {
          type: "array",
          items: { type: "string" },
          minItems: 1,
        },
        preventive_actions: {
          type: "array",
          items: { type: "string" },
          minItems: 1,
        },
        success_metric: { type: "string" },
        impact_assessment: { type: "string" },
        rollback_plan: { type: "string" },
      },
    },
  },
} as const;
