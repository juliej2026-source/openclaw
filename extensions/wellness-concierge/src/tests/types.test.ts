import { describe, it, expect } from "vitest";
import {
  AGENT_IDS,
  CONSENT_SCOPES,
  TOOL_IDS,
  RISK_TIER_NAMES,
  METRIC_IDS,
  RISK_SIGNALS,
  STATION_ID,
  SESSION_TIMEOUT_MS,
  WELLNESS_CHECK_INTERVAL_MS,
} from "../types.js";

describe("EMWCP types", () => {
  describe("AGENT_IDS", () => {
    it("has 8 agents", () => {
      expect(AGENT_IDS).toHaveLength(8);
    });

    it("includes all required agents", () => {
      expect(AGENT_IDS).toContain("orchestrator_router");
      expect(AGENT_IDS).toContain("clinical_safety_escalation");
      expect(AGENT_IDS).toContain("data_steward_pdpa");
      expect(AGENT_IDS).toContain("daily_coach");
      expect(AGENT_IDS).toContain("concierge_operator");
      expect(AGENT_IDS).toContain("rag_knowledge");
      expect(AGENT_IDS).toContain("device_integration_optional");
      expect(AGENT_IDS).toContain("evaluation_capa");
    });

    it("each agent ID is a non-empty string", () => {
      for (const id of AGENT_IDS) {
        expect(typeof id).toBe("string");
        expect(id.length).toBeGreaterThan(0);
      }
    });
  });

  describe("CONSENT_SCOPES", () => {
    it("has 9 scopes", () => {
      expect(CONSENT_SCOPES).toHaveLength(9);
    });

    it("all scopes start with consent.", () => {
      for (const scope of CONSENT_SCOPES) {
        expect(scope).toMatch(/^consent\./);
      }
    });
  });

  describe("TOOL_IDS", () => {
    it("has 10 tools", () => {
      expect(TOOL_IDS).toHaveLength(10);
    });

    it("includes key tools", () => {
      expect(TOOL_IDS).toContain("secure_messaging.send");
      expect(TOOL_IDS).toContain("rag.retrieve");
      expect(TOOL_IDS).toContain("incident.create");
      expect(TOOL_IDS).toContain("consent.check");
    });
  });

  describe("RISK_TIER_NAMES", () => {
    it("covers all 4 tiers", () => {
      expect(RISK_TIER_NAMES[0]).toBe("Stable");
      expect(RISK_TIER_NAMES[1]).toBe("Elevated");
      expect(RISK_TIER_NAMES[2]).toBe("High");
      expect(RISK_TIER_NAMES[3]).toBe("Crisis");
    });
  });

  describe("METRIC_IDS", () => {
    it("has 13 metrics", () => {
      expect(METRIC_IDS).toHaveLength(13);
    });

    it("includes core executive scorecard metrics", () => {
      expect(METRIC_IDS).toContain("sleep_hours");
      expect(METRIC_IDS).toContain("stress_0_10");
      expect(METRIC_IDS).toContain("energy_0_10");
      expect(METRIC_IDS).toContain("meeting_readiness");
    });
  });

  describe("RISK_SIGNALS", () => {
    it("has 11 signals", () => {
      expect(RISK_SIGNALS).toHaveLength(11);
    });

    it("includes crisis signals", () => {
      expect(RISK_SIGNALS).toContain("self_harm_ideation");
      expect(RISK_SIGNALS).toContain("self_harm_plan");
      expect(RISK_SIGNALS).toContain("imminent_danger");
      expect(RISK_SIGNALS).toContain("psychosis_mania_signals");
    });
  });

  describe("Constants", () => {
    it("STATION_ID defaults to iot-hub", () => {
      expect(STATION_ID).toBe("iot-hub");
    });

    it("SESSION_TIMEOUT_MS is 24 hours", () => {
      expect(SESSION_TIMEOUT_MS).toBe(24 * 60 * 60 * 1000);
    });

    it("WELLNESS_CHECK_INTERVAL_MS is 30 minutes", () => {
      expect(WELLNESS_CHECK_INTERVAL_MS).toBe(30 * 60 * 1000);
    });
  });
});
