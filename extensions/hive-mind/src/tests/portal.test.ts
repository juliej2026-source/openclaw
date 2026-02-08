import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";

const PORTAL_ROOT = path.resolve(import.meta.dirname, "../../portal/htdocs");

const PORTAL_BASE = path.resolve(import.meta.dirname, "../../portal");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fileExists(relativePath: string): boolean {
  return fs.existsSync(path.join(PORTAL_ROOT, relativePath));
}

function readPortalFile(relativePath: string): string {
  return fs.readFileSync(path.join(PORTAL_ROOT, relativePath), "utf-8");
}

// ---------------------------------------------------------------------------
// Static file structure
// ---------------------------------------------------------------------------

describe("Portal — static file structure", () => {
  const expectedFiles = [
    "index.html",
    "css/variables.css",
    "css/layout.css",
    "css/cards.css",
    "css/topology.css",
    "css/responsive.css",
    "js/router.js",
    "js/api.js",
    "js/prometheus.js",
    "js/utils.js",
    "js/components.js",
    "js/topology.js",
    "js/pages/overview.js",
    "js/pages/topology-full.js",
    "js/pages/stations.js",
    "js/pages/alerts.js",
    "js/pages/models.js",
    "js/pages/training.js",
    "js/pages/wan.js",
    "js/pages/network.js",
    "js/pages/apache.js",
    "js/pages/neural-graph.js",
    "img/favicon.svg",
  ];

  for (const file of expectedFiles) {
    it(`${file} exists`, () => {
      expect(fileExists(file)).toBe(true);
    });
  }
});

// ---------------------------------------------------------------------------
// index.html structure
// ---------------------------------------------------------------------------

describe("Portal — index.html", () => {
  const html = readPortalFile("index.html");

  it("has DOCTYPE", () => {
    expect(html).toMatch(/^<!DOCTYPE html>/i);
  });

  it("has page title", () => {
    expect(html).toContain("<title>OpenClaw Hive Mind</title>");
  });

  it("includes all CSS files", () => {
    expect(html).toContain('href="/css/variables.css"');
    expect(html).toContain('href="/css/layout.css"');
    expect(html).toContain('href="/css/cards.css"');
    expect(html).toContain('href="/css/topology.css"');
    expect(html).toContain('href="/css/responsive.css"');
  });

  it("loads router.js as module", () => {
    expect(html).toContain('type="module" src="/js/router.js"');
  });

  it("has topbar with brand", () => {
    expect(html).toContain('class="topbar"');
    expect(html).toContain("OpenClaw Hive Mind");
  });

  it("has sidebar navigation", () => {
    expect(html).toContain('class="sidebar"');
    expect(html).toContain('class="nav-list"');
  });

  it("has all 10 navigation links", () => {
    expect(html).toContain('href="#/"');
    expect(html).toContain('href="#/topology"');
    expect(html).toContain('href="#/stations"');
    expect(html).toContain('href="#/alerts"');
    expect(html).toContain('href="#/models"');
    expect(html).toContain('href="#/training"');
    expect(html).toContain('href="#/wan"');
    expect(html).toContain('href="#/network"');
    expect(html).toContain('href="#/apache"');
    expect(html).toContain('href="#/neural-graph"');
  });

  it("has main content area", () => {
    expect(html).toContain('id="app"');
  });

  it("has live status indicator", () => {
    expect(html).toContain('id="live-dot"');
  });

  it("has alert badge element", () => {
    expect(html).toContain('id="alert-badge"');
  });

  it("has sidebar toggle for mobile", () => {
    expect(html).toContain('id="sidebar-toggle"');
  });

  it("has external links (Grafana, Metrics, Legacy Monitor)", () => {
    expect(html).toContain('href="/grafana/"');
    expect(html).toContain('href="/metrics"');
    expect(html).toContain('href="/monitor"');
  });

  it("has favicon link", () => {
    expect(html).toContain('href="/img/favicon.svg"');
  });
});

// ---------------------------------------------------------------------------
// JS page modules export render + refresh
// ---------------------------------------------------------------------------

describe("Portal — page modules export render & refresh", () => {
  const pages = [
    "js/pages/overview.js",
    "js/pages/topology-full.js",
    "js/pages/stations.js",
    "js/pages/alerts.js",
    "js/pages/models.js",
    "js/pages/training.js",
    "js/pages/wan.js",
    "js/pages/network.js",
    "js/pages/apache.js",
    "js/pages/neural-graph.js",
  ];

  for (const page of pages) {
    it(`${page} exports render()`, () => {
      const src = readPortalFile(page);
      expect(src).toMatch(/export\s+async\s+function\s+render\s*\(/);
    });

    it(`${page} exports refresh()`, () => {
      const src = readPortalFile(page);
      expect(src).toMatch(/export\s+async\s+function\s+refresh\s*\(/);
    });
  }
});

// ---------------------------------------------------------------------------
// CSS design tokens
// ---------------------------------------------------------------------------

describe("Portal — variables.css design tokens", () => {
  const css = readPortalFile("css/variables.css");

  const requiredTokens = [
    "--bg",
    "--surface",
    "--border",
    "--text",
    "--text-dim",
    "--text-bright",
    "--green",
    "--red",
    "--yellow",
    "--blue",
    "--purple",
    "--cyan",
    "--sidebar-width",
    "--topbar-height",
    "--radius",
    "--transition",
    "--font",
    "--font-mono",
  ];

  for (const token of requiredTokens) {
    it(`defines ${token}`, () => {
      expect(css).toContain(token);
    });
  }
});

// ---------------------------------------------------------------------------
// httpd.conf proxy directives
// ---------------------------------------------------------------------------

describe("Portal — httpd.conf", () => {
  const conf = fs.readFileSync(path.join(PORTAL_BASE, "httpd.conf"), "utf-8");

  it("defines VirtualHost on port 80", () => {
    expect(conf).toContain("<VirtualHost *:80>");
  });

  it("sets DocumentRoot", () => {
    expect(conf).toMatch(/DocumentRoot\s+\/opt\/openclaw-portal\/htdocs/);
  });

  it("proxies /api/ to Node.js backend", () => {
    expect(conf).toContain("ProxyPass        /api/     http://127.0.0.1:3001/api/");
  });

  it("proxies /metrics to Node.js backend", () => {
    expect(conf).toContain("ProxyPass        /metrics  http://127.0.0.1:3001/metrics");
  });

  it("proxies /monitor to Node.js backend", () => {
    expect(conf).toContain("ProxyPass        /monitor  http://127.0.0.1:3001/monitor");
  });

  it("proxies /health to Node.js backend", () => {
    expect(conf).toContain("ProxyPass        /health   http://127.0.0.1:3001/health");
  });

  it("proxies /grafana/ to Grafana sub-path", () => {
    expect(conf).toContain("ProxyPass        /grafana/ http://127.0.0.1:3030/grafana/");
  });

  it("has CORS headers for /api/", () => {
    expect(conf).toContain("Access-Control-Allow-Origin");
  });

  it("has SPA fallback rewrite rule", () => {
    expect(conf).toContain("RewriteRule ^ /index.html [L]");
  });

  it("has security headers", () => {
    expect(conf).toContain("X-Content-Type-Options");
    expect(conf).toContain("X-Frame-Options");
  });
});

// ---------------------------------------------------------------------------
// topology.js station nodes
// ---------------------------------------------------------------------------

describe("Portal — topology.js", () => {
  const src = readPortalFile("js/topology.js");

  const expectedNodes = ["UDM-Pro", "HR02-5G", "JULIA", "IOT-HUB", "SCRAPER", "CLERK", "Bravia"];

  for (const node of expectedNodes) {
    it(`defines node ${node}`, () => {
      expect(src).toContain(`id: '${node}'`);
    });
  }

  it("defines network links", () => {
    expect(src).toContain("LINKS");
    expect(src).toContain("from:");
    expect(src).toContain("to:");
  });

  it("supports wired, wireless, and API link types", () => {
    expect(src).toContain("'wired'");
    expect(src).toContain("'wireless'");
    expect(src).toContain("'api'");
  });

  it("exports renderTopology function", () => {
    expect(src).toMatch(/export\s+function\s+renderTopology/);
  });

  it("exports renderLegend function", () => {
    expect(src).toMatch(/export\s+function\s+renderLegend/);
  });
});

// ---------------------------------------------------------------------------
// deploy.sh
// ---------------------------------------------------------------------------

describe("Portal — deploy.sh", () => {
  const script = fs.readFileSync(path.join(PORTAL_BASE, "deploy.sh"), "utf-8");

  it("starts with shebang", () => {
    expect(script).toMatch(/^#!\/bin\/bash/);
  });

  it("copies htdocs to destination", () => {
    expect(script).toContain("htdocs");
  });

  it("installs Apache vhost", () => {
    expect(script).toContain("hivemind.conf");
  });

  it("enables site and reloads Apache", () => {
    expect(script).toContain("a2ensite");
    expect(script).toContain("systemctl reload apache2");
  });
});

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

describe("Portal — router.js", () => {
  const src = readPortalFile("js/router.js");

  it("defines all 10 routes", () => {
    expect(src).toContain("'/':"); // overview
    expect(src).toContain("'/topology':");
    expect(src).toContain("'/stations':");
    expect(src).toContain("'/alerts':");
    expect(src).toContain("'/models':");
    expect(src).toContain("'/training':");
    expect(src).toContain("'/wan':");
    expect(src).toContain("'/network':");
    expect(src).toContain("'/apache':");
    expect(src).toContain("'/neural-graph':");
  });

  it("uses dynamic import for lazy loading", () => {
    expect(src).toContain("import(");
  });

  it("listens to hashchange events", () => {
    expect(src).toContain("hashchange");
  });

  it("has 30s refresh interval", () => {
    expect(src).toContain("30_000");
  });

  it("updates alert badge from /metrics", () => {
    expect(src).toContain("/metrics");
    expect(src).toContain("alert-badge");
  });
});

// ---------------------------------------------------------------------------
// Shared modules
// ---------------------------------------------------------------------------

describe("Portal — api.js", () => {
  const src = readPortalFile("js/api.js");

  it("exports apiGet", () => {
    expect(src).toMatch(/export\s+(async\s+)?function\s+apiGet/);
  });

  it("exports apiPost", () => {
    expect(src).toMatch(/export\s+(async\s+)?function\s+apiPost/);
  });

  it("exports fetchMetrics", () => {
    expect(src).toMatch(/export\s+(async\s+)?function\s+fetchMetrics/);
  });

  it("exports sendCommand", () => {
    expect(src).toMatch(/export\s+(async\s+)?function\s+sendCommand/);
  });

  it("exports apiGetUnifi without client-side API key", () => {
    expect(src).toMatch(/export\s+(async\s+)?function\s+apiGetUnifi/);
    // API key is injected server-side by Apache, not embedded in client JS
    expect(src).not.toContain("openclaw-network-2026-kelvin");
  });
});

describe("Portal — prometheus.js", () => {
  const src = readPortalFile("js/prometheus.js");

  it("exports parsePrometheus", () => {
    expect(src).toMatch(/export\s+function\s+parsePrometheus/);
  });

  it("exports getScalar", () => {
    expect(src).toMatch(/export\s+function\s+getScalar/);
  });

  it("exports getAll", () => {
    expect(src).toMatch(/export\s+function\s+getAll/);
  });
});

describe("Portal — components.js", () => {
  const src = readPortalFile("js/components.js");

  const expectedExports = [
    "card",
    "badge",
    "progressBar",
    "dataTable",
    "statusDot",
    "sectionTitle",
    "errorBanner",
  ];

  for (const name of expectedExports) {
    it(`exports ${name}`, () => {
      expect(src).toMatch(new RegExp(`export\\s+function\\s+${name}`));
    });
  }
});
