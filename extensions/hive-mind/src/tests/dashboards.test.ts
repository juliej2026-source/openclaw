import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// Load all dashboard JSON files
// ---------------------------------------------------------------------------

const DASHBOARD_DIR = path.resolve(__dirname, "../../../../monitoring/grafana/dashboards");

type GrafanaPanel = {
  id: number;
  type: string;
  title?: string;
  gridPos: { h: number; w: number; x: number; y: number };
  targets?: unknown[];
  datasource?: unknown;
  fieldConfig?: unknown;
  panels?: GrafanaPanel[];
  collapsed?: boolean;
};

type GrafanaDashboard = {
  id: unknown;
  uid: string;
  title: string;
  description?: string;
  tags: string[];
  schemaVersion: number;
  version: number;
  refresh?: string;
  time?: { from: string; to: string };
  templating?: { list: Array<{ name: string; type: string }> };
  panels: GrafanaPanel[];
};

const DASHBOARD_FILES = [
  "00-total-overview.json",
  "01-hive-command-center.json",
  "02-ai-intelligence.json",
  "03-network-health.json",
  "04-gateway-operations.json",
  "05-token-economics.json",
  "06-hive-evolution.json",
];

const dashboards: Map<string, GrafanaDashboard> = new Map();

for (const file of DASHBOARD_FILES) {
  const filePath = path.join(DASHBOARD_DIR, file);
  const raw = fs.readFileSync(filePath, "utf-8");
  dashboards.set(file, JSON.parse(raw) as GrafanaDashboard);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Grafana dashboard JSON validation", () => {
  describe("all 6 dashboards exist and are valid JSON", () => {
    for (const file of DASHBOARD_FILES) {
      it(`${file} exists and parses as valid JSON`, () => {
        const filePath = path.join(DASHBOARD_DIR, file);
        expect(fs.existsSync(filePath)).toBe(true);

        const raw = fs.readFileSync(filePath, "utf-8");
        expect(() => JSON.parse(raw)).not.toThrow();
      });
    }
  });

  describe("required top-level fields", () => {
    for (const [file, dashboard] of dashboards) {
      describe(file, () => {
        it("has a uid", () => {
          expect(dashboard.uid).toBeDefined();
          expect(typeof dashboard.uid).toBe("string");
          expect(dashboard.uid.length).toBeGreaterThan(0);
        });

        it("has a title", () => {
          expect(dashboard.title).toBeDefined();
          expect(typeof dashboard.title).toBe("string");
          expect(dashboard.title.length).toBeGreaterThan(0);
        });

        it("has schemaVersion", () => {
          expect(dashboard.schemaVersion).toBeDefined();
          expect(typeof dashboard.schemaVersion).toBe("number");
          expect(dashboard.schemaVersion).toBeGreaterThanOrEqual(30);
        });

        it("has panels array", () => {
          expect(Array.isArray(dashboard.panels)).toBe(true);
          expect(dashboard.panels.length).toBeGreaterThan(0);
        });

        it("has tags including openclaw", () => {
          expect(Array.isArray(dashboard.tags)).toBe(true);
          expect(dashboard.tags).toContain("openclaw");
        });

        it("has a refresh interval set", () => {
          expect(dashboard.refresh).toBeDefined();
          expect(typeof dashboard.refresh).toBe("string");
        });

        it("has a time range", () => {
          expect(dashboard.time).toBeDefined();
          expect(dashboard.time!.from).toBeDefined();
          expect(dashboard.time!.to).toBeDefined();
        });
      });
    }
  });

  describe("unique UIDs across all dashboards", () => {
    it("no two dashboards share the same uid", () => {
      const uids = [...dashboards.values()].map((d) => d.uid);
      const uniqueUids = new Set(uids);
      expect(uids.length).toBe(uniqueUids.size);
    });

    it("UIDs follow the openclaw-NN convention", () => {
      for (const dashboard of dashboards.values()) {
        expect(dashboard.uid).toMatch(/^openclaw-\d{2}$/);
      }
    });
  });

  describe("panel structure", () => {
    for (const [file, dashboard] of dashboards) {
      describe(file, () => {
        it("all panels have unique IDs", () => {
          const ids = dashboard.panels.map((p) => p.id);
          const uniqueIds = new Set(ids);
          expect(ids.length, `Duplicate panel IDs in ${file}`).toBe(uniqueIds.size);
        });

        it("all panels have gridPos with h, w, x, y", () => {
          for (const panel of dashboard.panels) {
            expect(
              panel.gridPos,
              `Panel ${panel.id} (${panel.title}) missing gridPos`,
            ).toBeDefined();
            expect(typeof panel.gridPos.h).toBe("number");
            expect(typeof panel.gridPos.w).toBe("number");
            expect(typeof panel.gridPos.x).toBe("number");
            expect(typeof panel.gridPos.y).toBe("number");
          }
        });

        it("gridPos width does not exceed 24 columns", () => {
          for (const panel of dashboard.panels) {
            expect(
              panel.gridPos.x + panel.gridPos.w,
              `Panel ${panel.id} (${panel.title}) exceeds 24-col grid`,
            ).toBeLessThanOrEqual(24);
          }
        });

        it("gridPos x is within bounds (0-23)", () => {
          for (const panel of dashboard.panels) {
            expect(panel.gridPos.x).toBeGreaterThanOrEqual(0);
            expect(panel.gridPos.x).toBeLessThan(24);
          }
        });

        it("all content panels (non-row) have a type", () => {
          const contentPanels = dashboard.panels.filter((p) => p.type !== "row");
          for (const panel of contentPanels) {
            expect(panel.type, `Panel ${panel.id} missing type`).toBeDefined();
            expect(typeof panel.type).toBe("string");
            expect(panel.type.length).toBeGreaterThan(0);
          }
        });

        it("all content panels have targets array", () => {
          const contentPanels = dashboard.panels.filter((p) => p.type !== "row");
          for (const panel of contentPanels) {
            expect(
              Array.isArray(panel.targets),
              `Panel ${panel.id} (${panel.title}) missing targets`,
            ).toBe(true);
          }
        });

        it("all content panels have a datasource", () => {
          const contentPanels = dashboard.panels.filter((p) => p.type !== "row");
          for (const panel of contentPanels) {
            expect(
              panel.datasource,
              `Panel ${panel.id} (${panel.title}) missing datasource`,
            ).toBeDefined();
          }
        });

        it("row panels have collapsed field", () => {
          const rowPanels = dashboard.panels.filter((p) => p.type === "row");
          for (const panel of rowPanels) {
            expect(
              panel.collapsed,
              `Row panel ${panel.id} (${panel.title}) missing collapsed field`,
            ).toBeDefined();
          }
        });

        it("row panels have a title", () => {
          const rowPanels = dashboard.panels.filter((p) => p.type === "row");
          for (const panel of rowPanels) {
            expect(panel.title, `Row panel ${panel.id} missing title`).toBeDefined();
            expect(typeof panel.title).toBe("string");
            expect(panel.title!.length).toBeGreaterThan(0);
          }
        });

        it("has at least one row panel", () => {
          const rowPanels = dashboard.panels.filter((p) => p.type === "row");
          expect(rowPanels.length).toBeGreaterThan(0);
        });

        it("has more content panels than row panels", () => {
          const rowPanels = dashboard.panels.filter((p) => p.type === "row");
          const contentPanels = dashboard.panels.filter((p) => p.type !== "row");
          expect(contentPanels.length).toBeGreaterThan(rowPanels.length);
        });
      });
    }
  });

  describe("template variables", () => {
    for (const [file, dashboard] of dashboards) {
      it(`${file} has templating section`, () => {
        expect(dashboard.templating).toBeDefined();
        expect(dashboard.templating!.list).toBeDefined();
        expect(Array.isArray(dashboard.templating!.list)).toBe(true);
      });
    }

    it("dashboard 01 has $station variable", () => {
      const d = dashboards.get("01-hive-command-center.json")!;
      const names = d.templating!.list.map((v) => v.name);
      expect(names).toContain("station");
    });

    it("dashboard 03 has $station variable", () => {
      const d = dashboards.get("03-network-health.json")!;
      const names = d.templating!.list.map((v) => v.name);
      expect(names).toContain("station");
    });

    it("dashboard 06 has $model variable", () => {
      const d = dashboards.get("06-hive-evolution.json")!;
      const names = d.templating!.list.map((v) => v.name);
      expect(names).toContain("model");
    });
  });

  describe("panel type distribution", () => {
    it("dashboard 01 contains stat panels (overview stats)", () => {
      const d = dashboards.get("01-hive-command-center.json")!;
      const types = d.panels.map((p) => p.type);
      expect(types).toContain("stat");
    });

    it("dashboard 02 contains table or heatmap panels (performance matrix)", () => {
      const d = dashboards.get("02-ai-intelligence.json")!;
      const types = d.panels.map((p) => p.type);
      expect(types.some((t) => t === "table" || t === "heatmap")).toBe(true);
    });

    it("dashboard 03 contains state-timeline panels (reachability)", () => {
      const d = dashboards.get("03-network-health.json")!;
      const types = d.panels.map((p) => p.type);
      expect(types).toContain("state-timeline");
    });

    it("dashboard 04 contains timeseries panels (throughput)", () => {
      const d = dashboards.get("04-gateway-operations.json")!;
      const types = d.panels.map((p) => p.type);
      expect(types).toContain("timeseries");
    });

    it("dashboard 05 contains stat panels (cost headlines)", () => {
      const d = dashboards.get("05-token-economics.json")!;
      const types = d.panels.map((p) => p.type);
      expect(types).toContain("stat");
    });

    it("dashboard 06 contains timeseries panels (learning loop)", () => {
      const d = dashboards.get("06-hive-evolution.json")!;
      const types = d.panels.map((p) => p.type);
      expect(types).toContain("timeseries");
    });
  });

  describe("datasource references", () => {
    it("all dashboards reference Prometheus datasource", () => {
      for (const [file, dashboard] of dashboards) {
        const contentPanels = dashboard.panels.filter((p) => p.type !== "row");
        const hasProm = contentPanels.some((p) => {
          const ds = p.datasource as Record<string, string> | undefined;
          return ds?.type === "prometheus" || ds?.uid?.includes("PROMETHEUS");
        });
        expect(hasProm, `${file} should reference Prometheus`).toBe(true);
      }
    });

    it("dashboard 03 references Loki datasource (for logs)", () => {
      const d = dashboards.get("03-network-health.json")!;
      const serialized = JSON.stringify(d);
      expect(serialized.toLowerCase()).toMatch(/loki/i);
    });

    it("dashboard 06 references Loki datasource (for logs)", () => {
      const d = dashboards.get("06-hive-evolution.json")!;
      const serialized = JSON.stringify(d);
      expect(serialized.toLowerCase()).toMatch(/loki/i);
    });
  });

  describe("metric references", () => {
    it("dashboard 01 references hivemind_station_reachable", () => {
      const serialized = JSON.stringify(dashboards.get("01-hive-command-center.json")!);
      expect(serialized).toContain("hivemind_station_reachable");
    });

    it("dashboard 02 references hivemind_perf_success_rate", () => {
      const serialized = JSON.stringify(dashboards.get("02-ai-intelligence.json")!);
      expect(serialized).toContain("hivemind_perf_success_rate");
    });

    it("dashboard 03 references hivemind_wan_active_path", () => {
      const serialized = JSON.stringify(dashboards.get("03-network-health.json")!);
      expect(serialized).toContain("hivemind_wan_active_path");
    });

    it("dashboard 04 references openclaw gateway metrics", () => {
      const serialized = JSON.stringify(dashboards.get("04-gateway-operations.json")!);
      expect(serialized).toContain("openclaw_");
    });

    it("dashboard 05 references openclaw_tokens_total", () => {
      const serialized = JSON.stringify(dashboards.get("05-token-economics.json")!);
      expect(serialized).toContain("openclaw_tokens_total");
    });

    it("dashboard 06 references hivemind_perf_success_rate (learning loop)", () => {
      const serialized = JSON.stringify(dashboards.get("06-hive-evolution.json")!);
      expect(serialized).toContain("hivemind_perf_success_rate");
    });

    it("dashboard 01 references hivemind_uptime_seconds", () => {
      const serialized = JSON.stringify(dashboards.get("01-hive-command-center.json")!);
      expect(serialized).toContain("hivemind_uptime_seconds");
    });

    it("dashboard 01 references hivemind_alert_active_count", () => {
      const serialized = JSON.stringify(dashboards.get("01-hive-command-center.json")!);
      expect(serialized).toContain("hivemind_alert_active_count");
    });
  });

  describe("dashboard sizing", () => {
    for (const [file, dashboard] of dashboards) {
      it(`${file} has reasonable number of panels (5-30)`, () => {
        expect(dashboard.panels.length).toBeGreaterThanOrEqual(5);
        expect(dashboard.panels.length).toBeLessThanOrEqual(30);
      });
    }

    for (const [file, dashboard] of dashboards) {
      it(`${file} JSON size is under 100KB`, () => {
        const raw = JSON.stringify(dashboard);
        expect(raw.length).toBeLessThan(100_000);
      });
    }
  });
});
