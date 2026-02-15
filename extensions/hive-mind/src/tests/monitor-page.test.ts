import { describe, it, expect } from "vitest";
import { generateMonitorHtml } from "../monitor-page.js";

const html = generateMonitorHtml();

describe("Monitor page — HTML structure", () => {
  it("starts with DOCTYPE", () => {
    expect(html).toMatch(/^<!DOCTYPE html>/i);
  });

  it("has page title", () => {
    expect(html).toContain("<title>OpenClaw Hive Monitor</title>");
  });

  it("has header with brand", () => {
    expect(html).toContain("OpenClaw Hive Monitor");
    expect(html).toContain('id="status-dot"');
    expect(html).toContain('id="last-update"');
  });

  it("has error banner", () => {
    expect(html).toContain('id="error-banner"');
  });

  it("has theme toggle button", () => {
    expect(html).toContain('id="theme-toggle"');
  });

  it("has dark mode CSS variables", () => {
    expect(html).toContain('[data-theme="dark"]');
  });

  it("loads DM Sans and JetBrains Mono fonts", () => {
    expect(html).toContain("DM+Sans");
    expect(html).toContain("JetBrains+Mono");
  });

  it("has glass-morphism backdrop-filter", () => {
    expect(html).toContain("backdrop-filter");
  });
});

describe("Monitor page — System Status section", () => {
  it("has all 6 status cards", () => {
    expect(html).toContain('id="m-uptime"');
    expect(html).toContain('id="m-stations-online"');
    expect(html).toContain('id="m-wan-status"');
    expect(html).toContain('id="m-alerts"');
    expect(html).toContain('id="m-julie"');
    expect(html).toContain('id="m-models"');
  });

  it("has Julie heartbeat sub-text element", () => {
    expect(html).toContain('id="m-julie-sub"');
  });
});

describe("Monitor page — Network Topology section", () => {
  it("has topology container", () => {
    expect(html).toContain('id="topology-container"');
  });

  it("defines all 6 topology nodes in JS", () => {
    expect(html).toContain('"UDM-Pro"');
    expect(html).toContain('"HR02-5G"');
    expect(html).toContain('"Julie"');
    expect(html).toContain('"IOT-HUB"');
    expect(html).toContain('"Caesar"');
    expect(html).toContain('"BRAVIA"');
  });

  it("defines topology links", () => {
    expect(html).toContain("TOPO_LINKS");
    expect(html).toContain('"wired"');
    expect(html).toContain('"wireless"');
    expect(html).toContain('"api"');
  });

  it("defines role colors", () => {
    expect(html).toContain("ROLE_COLORS");
    expect(html).toContain("gateway");
    expect(html).toContain("decommissioned");
  });

  it("has station health grid", () => {
    expect(html).toContain('id="station-list"');
  });

  it("has animated data-flow particles system", () => {
    expect(html).toContain("initParticles");
    expect(html).toContain("animateParticles");
    expect(html).toContain("topo-particles");
    expect(html).toContain("requestAnimationFrame");
  });

  it("has SVG pulse animation for online nodes", () => {
    expect(html).toContain("glow-up");
    expect(html).toContain("repeatCount");
  });

  it("has Flow toggle button", () => {
    expect(html).toContain('id="flow-toggle"');
    expect(html).toContain("flow-btn");
    expect(html).toContain("flowExpanded");
  });

  it("has expandable topology body", () => {
    expect(html).toContain('id="topo-body"');
    expect(html).toContain("topo-body");
    expect(html).toContain(".expanded");
  });

  it("has particle trails in expanded mode", () => {
    expect(html).toContain("topo-trails");
    expect(html).toContain("p.trail");
  });

  it("has flow stats bar", () => {
    expect(html).toContain('id="flow-stats"');
    expect(html).toContain("particle-count");
    expect(html).toContain("Active Links");
    expect(html).toContain("Nodes Online");
  });

  it("has link glow filters for expanded mode", () => {
    expect(html).toContain("link-glow");
    expect(html).toContain("flow-grad-green");
  });
});

describe("Monitor page — Network Health (UniFi) section", () => {
  it("has WAN/LAN/WLAN health cards", () => {
    expect(html).toContain('id="uf-wan"');
    expect(html).toContain('id="uf-lan"');
    expect(html).toContain('id="uf-wlan"');
  });

  it("has clients table", () => {
    expect(html).toContain('id="clients-table"');
    expect(html).toContain('id="clients-body"');
  });
});

describe("Monitor page — Dual-WAN section", () => {
  it("has WAN path elements", () => {
    expect(html).toContain('id="wan-paths"');
    expect(html).toContain('id="wan-latency"');
    expect(html).toContain('id="wan-loss"');
    expect(html).toContain('id="m-switches"');
  });
});

describe("Monitor page — Hotel Scraper section", () => {
  it("has scraper status cards", () => {
    expect(html).toContain('id="hs-sources"');
    expect(html).toContain('id="hs-areas"');
    expect(html).toContain('id="hs-scheduler"');
    expect(html).toContain('id="hs-timers"');
    expect(html).toContain('id="hs-jobs"');
    expect(html).toContain('id="hs-playwright"');
  });

  it("has recent jobs table", () => {
    expect(html).toContain('id="hs-jobs-table"');
    expect(html).toContain('id="hs-jobs-body"');
  });
});

describe("Monitor page — Activity & Executions section", () => {
  it("has execution cards", () => {
    expect(html).toContain('id="m-exec-total"');
    expect(html).toContain('id="m-exec-rate"');
    expect(html).toContain('id="exec-bar"');
    expect(html).toContain('id="m-recent-cmds"');
  });

  it("has executions table", () => {
    expect(html).toContain('id="exec-table"');
    expect(html).toContain('id="exec-body"');
  });
});

describe("Monitor page — AI Performance section", () => {
  it("has performance table", () => {
    expect(html).toContain('id="perf-table"');
    expect(html).toContain('id="perf-body"');
    expect(html).toContain('id="m-perf-total"');
  });
});

describe("Monitor page — Neural Graph section", () => {
  it("has neural graph container with canvas", () => {
    expect(html).toContain('id="neural-graph-container"');
    expect(html).toContain('id="neural-canvas"');
  });

  it("has maturation phase card", () => {
    expect(html).toContain('id="ng-phase"');
  });

  it("has graph node and edge count cards", () => {
    expect(html).toContain('id="ng-nodes"');
    expect(html).toContain('id="ng-edges"');
    expect(html).toContain('id="ng-nodes-sub"');
    expect(html).toContain('id="ng-edges-sub"');
  });

  it("has execution and fitness cards", () => {
    expect(html).toContain('id="ng-executions"');
    expect(html).toContain('id="ng-fitness"');
    expect(html).toContain('id="ng-fitness-bar"');
  });

  it("has Convex backend status", () => {
    expect(html).toContain('id="ng-convex"');
    expect(html).toContain('id="card-ng-convex"');
  });

  it("has neural graph animation loop", () => {
    expect(html).toContain("animateNeuralGraph");
    expect(html).toContain("neuralParticles");
    expect(html).toContain("layoutNeuralGraph");
  });

  it("renders node types with different colors", () => {
    expect(html).toContain("station");
    expect(html).toContain("capability");
  });

  it("renders edge types", () => {
    expect(html).toContain("activation");
    expect(html).toContain("data_flow");
    expect(html).toContain("myelinated");
  });

  it("has renderNeuralStatus function", () => {
    expect(html).toContain("renderNeuralStatus");
    expect(html).toContain("renderNeuralTopology");
  });
});

describe("Monitor page — Alerts section", () => {
  it("has alert list", () => {
    expect(html).toContain('id="alert-list"');
  });
});

describe("Monitor page — Quick Links", () => {
  it("has links to portal pages", () => {
    expect(html).toContain('href="/grafana"');
    expect(html).toContain('href="/#/topology"');
    expect(html).toContain('href="/#/hotel-scraper"');
    expect(html).toContain('href="/#/network"');
    expect(html).toContain('href="/#/neural-graph"');
  });
});

describe("Monitor page — Data fetching", () => {
  it("fetches /metrics endpoint", () => {
    expect(html).toContain("fetch('/metrics')");
  });

  it("fetches /api/network/dashboard", () => {
    expect(html).toContain("'/api/network/dashboard'");
  });

  it("fetches /api/unifi/health", () => {
    expect(html).toContain("'/api/unifi/health'");
  });

  it("fetches /api/unifi/clients", () => {
    expect(html).toContain("'/api/unifi/clients'");
  });

  it("fetches /api/hotel-scraper/status", () => {
    expect(html).toContain("'/api/hotel-scraper/status'");
  });

  it("fetches /api/hotel-scraper/jobs", () => {
    expect(html).toContain("'/api/hotel-scraper/jobs");
  });

  it("fetches /api/neural/status", () => {
    expect(html).toContain("'/api/neural/status'");
  });

  it("fetches /api/neural/topology", () => {
    expect(html).toContain("'/api/neural/topology'");
  });

  it("uses Promise.allSettled for parallel fetching", () => {
    expect(html).toContain("Promise.allSettled");
  });

  it("has 30s refresh interval", () => {
    expect(html).toContain("30000");
  });
});

describe("Monitor page — Footer", () => {
  it("has footer with links", () => {
    expect(html).toContain('href="/metrics"');
    expect(html).toContain('href="/api/network/dashboard"');
    expect(html).toContain("Station: IOT-HUB");
  });
});

describe("Monitor page — Visual design features", () => {
  it("defaults to light mode (no dark attribute)", () => {
    // Light mode is default — dark only applied via JS localStorage
    expect(html).toContain("--bg: #f6f6f9");
  });

  it("has card entrance animations", () => {
    expect(html).toContain("card-in");
    expect(html).toContain("animation-delay");
  });

  it("has value update animations", () => {
    expect(html).toContain("value-update");
    expect(html).toContain("count-up");
  });

  it("has accent-line card indicators", () => {
    expect(html).toContain("accent-line");
  });

  it("has responsive breakpoints", () => {
    expect(html).toContain("max-width: 768px");
    expect(html).toContain("max-width: 480px");
  });

  it("has gradient mesh background", () => {
    expect(html).toContain("radial-gradient");
    expect(html).toContain("body::before");
  });
});
