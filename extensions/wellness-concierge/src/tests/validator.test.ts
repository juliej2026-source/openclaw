import { describe, it, expect } from "vitest";
import { validateInterAgentMessage } from "../schema/validator.js";

/** Helper: build a minimal valid inter-agent message */
function validMessage(overrides: Record<string, unknown> = {}) {
  return {
    schema_version: "emwcp-agent-message.v1",
    timestamp: "2026-02-16T00:00:00Z",
    conversation_id: "conv-abc123",
    message_id: "msg-def456",
    agent_id: "daily_coach",
    role: "daily_coach",
    privacy: {
      label: "LOW",
      consent: {
        status: "ok",
        required_scopes: [],
        missing_scopes: [],
      },
      allowed_fields: ["energy", "stress"],
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
    client_response: "Here is your morning routine.",
    internal_actions: [
      {
        type: "REMINDER",
        priority: "P3",
        summary: "Check in at 2pm",
      },
    ],
    ...overrides,
  };
}

describe("EMWCP schema validator", () => {
  describe("valid messages", () => {
    it("accepts a minimal valid message", () => {
      const result = validateInterAgentMessage(validMessage());
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.message).toBeDefined();
    });

    it("accepts message with measurement_updates", () => {
      const result = validateInterAgentMessage(
        validMessage({
          measurement_updates: {
            timepoint: "baseline",
            metrics: [
              {
                metric_id: "stress_0_10",
                value: 6,
                unit: "score",
                source: "self_report",
              },
            ],
          },
        }),
      );
      expect(result.valid).toBe(true);
    });

    it("accepts message with handoff", () => {
      const result = validateInterAgentMessage(
        validMessage({
          handoff: {
            to_provider_type: "therapist",
            minimum_fields: {
              reason_for_referral: "Elevated stress",
              risk_tier: 1,
            },
          },
        }),
      );
      expect(result.valid).toBe(true);
    });

    it("accepts message with device_context", () => {
      const result = validateInterAgentMessage(
        validMessage({
          device_context: {
            connected_sources: ["wearable_hr", "wearable_hrv"],
            data_availability: "verified",
            trend_summary: "HR 8bpm above baseline",
            confidence: "medium",
          },
        }),
      );
      expect(result.valid).toBe(true);
    });

    it("accepts message with capa_ticket", () => {
      const result = validateInterAgentMessage(
        validMessage({
          capa_ticket: {
            ticket_id: "CAPA-001",
            issue: "Delayed escalation",
            root_cause_hypothesis: "Intent misclassification",
            corrective_actions: ["Retrain classifier"],
            preventive_actions: ["Add integration test"],
            success_metric: "Zero missed escalations in 30 days",
            rollback_plan: "Revert to previous classifier",
          },
        }),
      );
      expect(result.valid).toBe(true);
    });

    it("accepts crisis-level message", () => {
      const result = validateInterAgentMessage(
        validMessage({
          agent_id: "clinical_safety_escalation",
          role: "clinical_safety_escalation",
          privacy: {
            label: "HIGH",
            consent: {
              status: "ok",
              required_scopes: ["consent.share_with_provider"],
              missing_scopes: [],
            },
            allowed_fields: [],
            redactions: [{ field: "crisis_details", action: "move_to_secure_channel" }],
          },
          risk: {
            tier: 3,
            signals: ["self_harm_ideation"],
            escalation: {
              required: true,
              target: "emergency_services",
              crisis_script_used: true,
              notes: "User expressed self-harm intent",
            },
          },
          client_response:
            "Are you in immediate danger right now? If yes, please call emergency services.",
          internal_actions: [
            {
              type: "ESCALATION",
              priority: "P0",
              summary: "Crisis escalation triggered",
              assignee: "case_lead",
            },
          ],
        }),
      );
      expect(result.valid).toBe(true);
    });
  });

  describe("invalid messages", () => {
    it("rejects null", () => {
      const result = validateInterAgentMessage(null);
      expect(result.valid).toBe(false);
    });

    it("rejects empty object", () => {
      const result = validateInterAgentMessage({});
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("rejects missing required fields", () => {
      const result = validateInterAgentMessage({
        schema_version: "emwcp-agent-message.v1",
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("required"))).toBe(true);
    });

    it("rejects invalid schema_version", () => {
      const result = validateInterAgentMessage(validMessage({ schema_version: "wrong-version" }));
      expect(result.valid).toBe(false);
    });

    it("rejects invalid agent_id", () => {
      const result = validateInterAgentMessage(validMessage({ agent_id: "nonexistent_agent" }));
      expect(result.valid).toBe(false);
    });

    it("rejects invalid risk tier", () => {
      const msg = validMessage();
      (msg.risk as any).tier = 5;
      const result = validateInterAgentMessage(msg);
      expect(result.valid).toBe(false);
    });

    it("rejects invalid privacy label", () => {
      const msg = validMessage();
      (msg.privacy as any).label = "CRITICAL";
      const result = validateInterAgentMessage(msg);
      expect(result.valid).toBe(false);
    });

    it("rejects invalid internal action type", () => {
      const result = validateInterAgentMessage(
        validMessage({
          internal_actions: [{ type: "INVALID_TYPE", priority: "P1", summary: "test" }],
        }),
      );
      expect(result.valid).toBe(false);
    });

    it("rejects additional properties", () => {
      const result = validateInterAgentMessage(validMessage({ unexpected_field: "value" }));
      expect(result.valid).toBe(false);
    });

    it("rejects empty client_response", () => {
      const result = validateInterAgentMessage(validMessage({ client_response: "" }));
      expect(result.valid).toBe(false);
    });
  });
});
