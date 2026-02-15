// ---------------------------------------------------------------------------
// Data Mine Metrics — Prometheus-compatible metrics
// ---------------------------------------------------------------------------

type Counter = { value: number; inc: (n?: number) => void; reset: () => void };
type Gauge = {
  value: number;
  set: (n: number) => void;
  inc: (n?: number) => void;
  dec: (n?: number) => void;
  reset: () => void;
};

function makeCounter(): Counter {
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

function makeGauge(): Gauge {
  return {
    value: 0,
    set(n) {
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

export const analysesTotal = makeCounter();
export const datasetsImported = makeCounter();
export const experimentsCreated = makeCounter();
export const anomaliesDetected = makeCounter();

export const activeAnalyses = makeGauge();
export const cachedResults = makeGauge();
export const avgAnalysisDurationMs = makeGauge();

export function formatMetrics(): string {
  const lines = [
    `# HELP data_mine_analyses_total Total analyses executed`,
    `# TYPE data_mine_analyses_total counter`,
    `data_mine_analyses_total ${analysesTotal.value}`,
    `# HELP data_mine_datasets_imported Total datasets imported`,
    `# TYPE data_mine_datasets_imported counter`,
    `data_mine_datasets_imported ${datasetsImported.value}`,
    `# HELP data_mine_experiments_created Total experiments created`,
    `# TYPE data_mine_experiments_created counter`,
    `data_mine_experiments_created ${experimentsCreated.value}`,
    `# HELP data_mine_anomalies_detected Total anomalies detected`,
    `# TYPE data_mine_anomalies_detected counter`,
    `data_mine_anomalies_detected ${anomaliesDetected.value}`,
    `# HELP data_mine_active_analyses Currently running analyses`,
    `# TYPE data_mine_active_analyses gauge`,
    `data_mine_active_analyses ${activeAnalyses.value}`,
    `# HELP data_mine_cached_results Cached analysis results`,
    `# TYPE data_mine_cached_results gauge`,
    `data_mine_cached_results ${cachedResults.value}`,
    `# HELP data_mine_avg_analysis_duration_ms Average analysis duration`,
    `# TYPE data_mine_avg_analysis_duration_ms gauge`,
    `data_mine_avg_analysis_duration_ms ${avgAnalysisDurationMs.value}`,
  ];
  return lines.join("\n") + "\n";
}
