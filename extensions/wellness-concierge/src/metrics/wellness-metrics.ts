// ---------------------------------------------------------------------------
// Wellness Metrics — Prometheus-compatible metrics for EMWCP
// ---------------------------------------------------------------------------

type Counter = { value: number; inc: (n?: number) => void; reset: () => void };
type Gauge = {
  value: number;
  set: (n: number) => void;
  inc: (n?: number) => void;
  dec: (n?: number) => void;
  reset: () => void;
};

function makeCounter(name: string): Counter {
  return {
    value: 0,
    inc(n = 1) {
      this.value += n;
    },
    reset() {
      this.value = 0;
    },
  };
}

function makeGauge(name: string): Gauge {
  return {
    value: 0,
    set(n: number) {
      this.value = n;
    },
    inc(n = 1) {
      this.value += n;
    },
    dec(n = 1) {
      this.value -= n;
    },
    reset() {
      this.value = 0;
    },
  };
}

// ---- Counters ----
export const sessionsTotal = makeCounter("emwcp_sessions_total");
export const queriesTotal = makeCounter("emwcp_queries_total");
export const escalationsTotal = makeCounter("emwcp_escalations_total");
export const toolInvocationsTotal = makeCounter("emwcp_tool_invocations_total");

// ---- Gauges ----
export const activeSessions = makeGauge("emwcp_active_sessions");
export const consentComplianceRate = makeGauge("emwcp_consent_compliance_rate");

/**
 * Format all metrics in Prometheus exposition format.
 */
export function formatMetrics(): string {
  const lines = [
    `# HELP emwcp_sessions_total Total wellness sessions`,
    `# TYPE emwcp_sessions_total counter`,
    `emwcp_sessions_total ${sessionsTotal.value}`,
    `# HELP emwcp_queries_total Total wellness queries processed`,
    `# TYPE emwcp_queries_total counter`,
    `emwcp_queries_total ${queriesTotal.value}`,
    `# HELP emwcp_escalations_total Total safety escalations triggered`,
    `# TYPE emwcp_escalations_total counter`,
    `emwcp_escalations_total ${escalationsTotal.value}`,
    `# HELP emwcp_tool_invocations_total Total tool invocations`,
    `# TYPE emwcp_tool_invocations_total counter`,
    `emwcp_tool_invocations_total ${toolInvocationsTotal.value}`,
    `# HELP emwcp_active_sessions Currently active sessions`,
    `# TYPE emwcp_active_sessions gauge`,
    `emwcp_active_sessions ${activeSessions.value}`,
    `# HELP emwcp_consent_compliance_rate Consent compliance rate (0-1)`,
    `# TYPE emwcp_consent_compliance_rate gauge`,
    `emwcp_consent_compliance_rate ${consentComplianceRate.value}`,
  ];
  return lines.join("\n") + "\n";
}
