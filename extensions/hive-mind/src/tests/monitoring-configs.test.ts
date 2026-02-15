import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// Helper: load YAML-like config as raw text (no yaml parser dependency)
// We test structural properties by pattern-matching the raw content.
// ---------------------------------------------------------------------------

const MONITORING_DIR = path.resolve(__dirname, "../../../../monitoring");

function readConfig(relativePath: string): string {
  return fs.readFileSync(path.join(MONITORING_DIR, relativePath), "utf-8");
}

// ---------------------------------------------------------------------------
// docker-compose.yml
// ---------------------------------------------------------------------------

describe("docker-compose.yml", () => {
  const compose = readConfig("docker-compose.yml");

  it("exists and is non-empty", () => {
    expect(compose.length).toBeGreaterThan(0);
  });

  it("defines otel-collector service", () => {
    expect(compose).toContain("otel-collector:");
  });

  it("defines prometheus service", () => {
    expect(compose).toContain("prometheus:");
  });

  it("defines grafana service", () => {
    expect(compose).toContain("grafana:");
  });

  it("defines loki service", () => {
    expect(compose).toContain("loki:");
  });

  it("defines tempo service", () => {
    expect(compose).toContain("tempo:");
  });

  it("defines all 5 services", () => {
    const servicePattern = /^\s{2}\w[\w-]+:/gm;
    const services = compose.match(servicePattern);
    expect(services).not.toBeNull();
    expect(services!.length).toBeGreaterThanOrEqual(5);
  });

  it("maps Grafana to host port 3030 (not 3000)", () => {
    // Should find "3030:3000" and NOT "3000:3000"
    expect(compose).toContain("3030:3000");
    expect(compose).not.toMatch(/"3000:3000"/);
  });

  it("exposes Prometheus on port 9090", () => {
    expect(compose).toContain("9090:9090");
  });

  it("exposes OTEL collector on port 4318", () => {
    expect(compose).toContain("4318:4318");
  });

  it("exposes Loki on port 3100", () => {
    expect(compose).toContain("3100:3100");
  });

  it("exposes Tempo on port 3200", () => {
    expect(compose).toContain("3200:3200");
  });

  it("no duplicate host ports", () => {
    const portPattern = /"(\d+):\d+"/g;
    const hostPorts: string[] = [];
    let match;
    while ((match = portPattern.exec(compose)) !== null) {
      hostPorts.push(match[1]);
    }
    const unique = new Set(hostPorts);
    expect(hostPorts.length, "Duplicate host port mappings found").toBe(unique.size);
  });

  it("uses a monitoring network", () => {
    expect(compose).toContain("networks:");
    expect(compose).toContain("monitoring");
  });

  it("defines persistent volumes", () => {
    expect(compose).toContain("prometheus-data:");
    expect(compose).toContain("grafana-data:");
    expect(compose).toContain("loki-data:");
    expect(compose).toContain("tempo-data:");
  });

  it("enables Prometheus remote write receiver", () => {
    expect(compose).toContain("--web.enable-remote-write-receiver");
  });

  it("sets Prometheus retention to 30 days", () => {
    expect(compose).toContain("--storage.tsdb.retention.time=30d");
  });

  it("enables anonymous Grafana access", () => {
    expect(compose).toContain("GF_AUTH_ANONYMOUS_ENABLED");
  });

  it("mounts config files from correct paths", () => {
    expect(compose).toContain("./otel-collector/config.yaml");
    expect(compose).toContain("./prometheus/prometheus.yml");
    expect(compose).toContain("./grafana/provisioning");
    expect(compose).toContain("./grafana/dashboards");
    expect(compose).toContain("./loki/config.yaml");
    expect(compose).toContain("./tempo/config.yaml");
  });

  it("all mounted config files actually exist", () => {
    const configFiles = [
      "otel-collector/config.yaml",
      "prometheus/prometheus.yml",
      "grafana/provisioning/datasources/datasources.yaml",
      "grafana/provisioning/dashboards/provider.yaml",
      "loki/config.yaml",
      "tempo/config.yaml",
    ];

    for (const file of configFiles) {
      const fullPath = path.join(MONITORING_DIR, file);
      expect(fs.existsSync(fullPath), `Missing config: ${file}`).toBe(true);
    }
  });

  it("grafana depends_on prometheus, loki, and tempo", () => {
    // After grafana: section, should find depends_on with all 3
    const grafanaSection = compose.slice(compose.indexOf("grafana:"));
    expect(grafanaSection).toContain("prometheus");
    expect(grafanaSection).toContain("loki");
    expect(grafanaSection).toContain("tempo");
  });

  it("otel-collector depends_on prometheus, loki, and tempo", () => {
    const otelSection = compose.slice(
      compose.indexOf("otel-collector:"),
      compose.indexOf("prometheus:"),
    );
    expect(otelSection).toContain("depends_on");
    expect(otelSection).toContain("prometheus");
    expect(otelSection).toContain("loki");
    expect(otelSection).toContain("tempo");
  });

  it("all services have restart policy", () => {
    expect(compose).toMatch(/restart:\s*unless-stopped/);
    // Count occurrences — should be at least 5 (one per service)
    const restartCount = (compose.match(/restart:\s*unless-stopped/g) ?? []).length;
    expect(restartCount).toBeGreaterThanOrEqual(5);
  });
});

// ---------------------------------------------------------------------------
// OTEL Collector config
// ---------------------------------------------------------------------------

describe("otel-collector/config.yaml", () => {
  const config = readConfig("otel-collector/config.yaml");

  it("defines OTLP receiver", () => {
    expect(config).toContain("otlp:");
    expect(config).toContain("http:");
    expect(config).toContain("0.0.0.0:4318");
  });

  it("defines batch processor", () => {
    expect(config).toContain("batch:");
  });

  it("defines Prometheus remote write exporter", () => {
    expect(config).toContain("prometheusremotewrite:");
    expect(config).toContain("http://prometheus:9090/api/v1/write");
  });

  it("defines Tempo exporter", () => {
    expect(config).toContain("otlphttp/tempo:");
    expect(config).toContain("http://tempo:4318");
  });

  it("defines Loki exporter", () => {
    expect(config).toContain("otlphttp/loki:");
    expect(config).toContain("http://loki:3100/otlp");
  });

  it("has metrics pipeline", () => {
    expect(config).toContain("metrics:");
    expect(config).toContain("prometheusremotewrite");
  });

  it("has traces pipeline", () => {
    expect(config).toContain("traces:");
    expect(config).toContain("otlphttp/tempo");
  });

  it("has logs pipeline", () => {
    expect(config).toContain("logs:");
    expect(config).toContain("otlphttp/loki");
  });

  it("all pipelines use the batch processor", () => {
    // In the service.pipelines section, batch should appear
    const pipelinesSection = config.slice(config.indexOf("pipelines:"));
    const batchCount = (pipelinesSection.match(/batch/g) ?? []).length;
    expect(batchCount).toBeGreaterThanOrEqual(3); // metrics, traces, logs
  });
});

// ---------------------------------------------------------------------------
// Prometheus config
// ---------------------------------------------------------------------------

describe("prometheus/prometheus.yml", () => {
  const config = readConfig("prometheus/prometheus.yml");

  it("sets scrape_interval", () => {
    expect(config).toMatch(/scrape_interval:\s*\d+s/);
  });

  it("has hive-mind scrape job", () => {
    expect(config).toContain('job_name: "hive-mind"');
  });

  it("targets IOT-HUB at 10.1.8.158:3001", () => {
    expect(config).toContain("10.1.8.158:3001");
  });

  it("scrapes /metrics path", () => {
    expect(config).toContain("/metrics");
  });
});

// ---------------------------------------------------------------------------
// Grafana datasources
// ---------------------------------------------------------------------------

describe("grafana/provisioning/datasources/datasources.yaml", () => {
  const config = readConfig("grafana/provisioning/datasources/datasources.yaml");

  it("defines Prometheus datasource", () => {
    expect(config).toContain("name: Prometheus");
    expect(config).toContain("type: prometheus");
    expect(config).toContain("http://prometheus:9090");
  });

  it("sets Prometheus as default datasource", () => {
    expect(config).toContain("isDefault: true");
  });

  it("defines Tempo datasource", () => {
    expect(config).toContain("name: Tempo");
    expect(config).toContain("type: tempo");
    expect(config).toContain("http://tempo:3200");
  });

  it("defines Loki datasource", () => {
    expect(config).toContain("name: Loki");
    expect(config).toContain("type: loki");
    expect(config).toContain("http://loki:3100");
  });

  it("all datasources use proxy access mode", () => {
    const accessCount = (config.match(/access:\s*proxy/g) ?? []).length;
    expect(accessCount).toBeGreaterThanOrEqual(3);
  });

  it("has apiVersion 1", () => {
    expect(config).toMatch(/apiVersion:\s*1/);
  });
});

// ---------------------------------------------------------------------------
// Grafana dashboard provider
// ---------------------------------------------------------------------------

describe("grafana/provisioning/dashboards/provider.yaml", () => {
  const config = readConfig("grafana/provisioning/dashboards/provider.yaml");

  it("has apiVersion 1", () => {
    expect(config).toMatch(/apiVersion:\s*1/);
  });

  it("defines a provider", () => {
    expect(config).toContain("providers:");
  });

  it("uses file type", () => {
    expect(config).toContain("type: file");
  });

  it("points to correct dashboard path", () => {
    expect(config).toContain("/var/lib/grafana/dashboards");
  });

  it("has update interval set", () => {
    expect(config).toMatch(/updateIntervalSeconds:\s*\d+/);
  });

  it("specifies OpenClaw Hive folder", () => {
    expect(config).toContain("OpenClaw Hive");
  });
});

// ---------------------------------------------------------------------------
// Loki config
// ---------------------------------------------------------------------------

describe("loki/config.yaml", () => {
  const config = readConfig("loki/config.yaml");

  it("listens on port 3100", () => {
    expect(config).toContain("3100");
  });

  it("uses filesystem storage", () => {
    expect(config).toContain("filesystem");
  });

  it("has schema configuration", () => {
    expect(config).toContain("schema_config:");
  });

  it("uses TSDB store", () => {
    expect(config).toContain("tsdb");
  });

  it("allows structured metadata", () => {
    expect(config).toContain("allow_structured_metadata: true");
  });

  it("uses replication_factor of 1 (single instance)", () => {
    expect(config).toContain("replication_factor: 1");
  });
});

// ---------------------------------------------------------------------------
// Tempo config
// ---------------------------------------------------------------------------

describe("tempo/config.yaml", () => {
  const config = readConfig("tempo/config.yaml");

  it("listens on port 3200", () => {
    expect(config).toContain("3200");
  });

  it("accepts OTLP HTTP on port 4318", () => {
    expect(config).toContain("4318");
  });

  it("accepts OTLP gRPC on port 4317", () => {
    expect(config).toContain("4317");
  });

  it("uses local storage backend", () => {
    expect(config).toContain("backend: local");
  });

  it("has trace storage path configured", () => {
    expect(config).toContain("/var/tempo/traces");
  });

  it("has WAL path configured", () => {
    expect(config).toContain("/var/tempo/wal");
  });
});

// ---------------------------------------------------------------------------
// Cross-config consistency
// ---------------------------------------------------------------------------

describe("cross-config consistency", () => {
  it("OTEL collector Prometheus URL matches Prometheus service port", () => {
    const otelConfig = readConfig("otel-collector/config.yaml");
    const compose = readConfig("docker-compose.yml");

    // OTEL targets prometheus:9090
    expect(otelConfig).toContain("http://prometheus:9090");
    // Compose exposes 9090
    expect(compose).toContain("9090:9090");
  });

  it("OTEL collector Tempo URL matches Tempo service", () => {
    const otelConfig = readConfig("otel-collector/config.yaml");
    expect(otelConfig).toContain("http://tempo:4318");
  });

  it("OTEL collector Loki URL matches Loki service", () => {
    const otelConfig = readConfig("otel-collector/config.yaml");
    expect(otelConfig).toContain("http://loki:3100");
  });

  it("Grafana datasource URLs match docker-compose service names", () => {
    const dsConfig = readConfig("grafana/provisioning/datasources/datasources.yaml");

    // Datasources should use Docker service names (internal DNS)
    expect(dsConfig).toContain("http://prometheus:9090");
    expect(dsConfig).toContain("http://tempo:3200");
    expect(dsConfig).toContain("http://loki:3100");
  });

  it("dashboard provider path matches Grafana docker-compose volume mount", () => {
    const providerConfig = readConfig("grafana/provisioning/dashboards/provider.yaml");
    const compose = readConfig("docker-compose.yml");

    // Provider points to /var/lib/grafana/dashboards
    expect(providerConfig).toContain("/var/lib/grafana/dashboards");
    // Compose mounts ./grafana/dashboards:/var/lib/grafana/dashboards
    expect(compose).toContain("./grafana/dashboards:/var/lib/grafana/dashboards");
  });

  it("Prometheus scrapes the correct hive-mind endpoint", () => {
    const promConfig = readConfig("prometheus/prometheus.yml");
    // Should scrape the IOT-HUB IP on port 3001 (matching STATION_PORT)
    expect(promConfig).toContain("10.1.8.158:3001");
    expect(promConfig).toContain("/metrics");
  });

  it("all 8 dashboard files are present in the dashboards directory", () => {
    const dashboardDir = path.join(MONITORING_DIR, "grafana/dashboards");
    const files = fs.readdirSync(dashboardDir).filter((f) => f.endsWith(".json"));
    expect(files.length).toBe(8);
    expect(files.toSorted()).toEqual([
      "00-total-overview.json",
      "01-hive-command-center.json",
      "02-ai-intelligence.json",
      "03-network-health.json",
      "04-gateway-operations.json",
      "05-token-economics.json",
      "06-hive-evolution.json",
      "07-neural-graph.json",
    ]);
  });
});
