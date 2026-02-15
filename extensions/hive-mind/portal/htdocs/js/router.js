// Hash-based SPA router with auto-refresh
// Routes: #/ #/topology #/stations #/alerts #/models #/training #/wan #/network #/apache #/neural-graph

const ROUTES = {
  "/": () => import("./pages/overview.js"),
  "/topology": () => import("./pages/topology-full.js"),
  "/stations": () => import("./pages/stations.js"),
  "/alerts": () => import("./pages/alerts.js"),
  "/models": () => import("./pages/models.js"),
  "/training": () => import("./pages/training.js"),
  "/wan": () => import("./pages/wan.js"),
  "/network": () => import("./pages/network.js"),
  "/apache": () => import("./pages/apache.js"),
  "/neural-graph": () => import("./pages/neural-graph.js"),
  "/hotel-scraper": () => import("./pages/hotel-scraper.js"),
  "/wellness": () => import("./pages/wellness.js"),
};

const REFRESH_INTERVAL = 30_000; // 30s — matches Prometheus scrape interval

const app = document.getElementById("app");
const liveDot = document.getElementById("live-dot");
const refreshLabel = document.getElementById("refresh-label");
const alertBadge = document.getElementById("alert-badge");
const sidebarToggle = document.getElementById("sidebar-toggle");
const sidebar = document.getElementById("sidebar");
const backdrop = document.getElementById("sidebar-backdrop");

let currentPage = null;
let refreshTimer = null;
let alertTimer = null;
let generation = 0;

// ---- Navigation ----

function getRoute() {
  const hash = location.hash.replace(/^#/, "") || "/";
  // Strip query params for route matching
  return hash.split("?")[0];
}

function getQuery() {
  const hash = location.hash.replace(/^#/, "") || "/";
  const idx = hash.indexOf("?");
  if (idx < 0) return {};
  const params = new URLSearchParams(hash.slice(idx + 1));
  const obj = {};
  for (const [k, v] of params) obj[k] = v;
  return obj;
}

async function navigate() {
  const route = getRoute();
  const loader = ROUTES[route];

  // Update active nav link
  document.querySelectorAll(".nav-link[data-route]").forEach((link) => {
    link.classList.toggle("active", link.dataset.route === route);
  });

  // Close mobile sidebar
  sidebar.classList.remove("open");
  backdrop.classList.remove("visible");

  // Tear down previous page
  generation++;
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
  if (currentPage && currentPage.destroy) {
    try {
      currentPage.destroy();
    } catch (_) {
      /* ignore */
    }
  }
  currentPage = null;

  if (!loader) {
    app.innerHTML = '<div class="error-banner">Page not found</div>';
    return;
  }

  app.innerHTML = '<div class="loading">Loading\u2026</div>';

  try {
    const mod = await loader();
    currentPage = mod;
    await mod.render(app, getQuery());
    updateStatus(true);

    // Start auto-refresh (guarded by generation counter to prevent stale writes)
    const gen = generation;
    refreshTimer = setInterval(async () => {
      if (gen !== generation) return;
      if (currentPage && currentPage.refresh) {
        try {
          await currentPage.refresh(app, getQuery());
          if (gen !== generation) return;
          updateStatus(true);
        } catch (e) {
          if (gen !== generation) return;
          console.error("[refresh]", e);
          updateStatus(false);
        }
      }
    }, REFRESH_INTERVAL);
  } catch (e) {
    console.error("[navigate]", e);
    const banner = document.createElement("div");
    banner.className = "error-banner";
    banner.textContent = "Failed to load page: " + e.message;
    app.innerHTML = "";
    app.appendChild(banner);
    updateStatus(false);
  }
}

// ---- Status indicator ----

function updateStatus(ok) {
  liveDot.classList.toggle("error", !ok);
  const now = new Date();
  refreshLabel.textContent = ok ? `Updated ${now.toLocaleTimeString()}` : "Connection error";
}

// ---- Alert badge (reads /metrics for active alert count) ----

async function updateAlertBadge() {
  try {
    const resp = await fetch("/metrics");
    if (!resp.ok) return;
    const text = await resp.text();
    const match = text.match(/^hivemind_alert_active_count\s+(\d+)/m);
    const count = match ? parseInt(match[1], 10) : 0;
    if (count > 0) {
      alertBadge.textContent = count > 99 ? "99+" : String(count);
      alertBadge.style.display = "";
    } else {
      alertBadge.style.display = "none";
    }
  } catch (_) {
    // Silently ignore — badge stays as-is
  }
}

// ---- Sidebar toggle (mobile) ----

sidebarToggle.addEventListener("click", () => {
  const isOpen = sidebar.classList.toggle("open");
  backdrop.classList.toggle("visible", isOpen);
});

backdrop.addEventListener("click", () => {
  sidebar.classList.remove("open");
  backdrop.classList.remove("visible");
});

// ---- Init ----

window.addEventListener("hashchange", navigate);

// Initial load
navigate();
updateAlertBadge();

// Periodic alert badge update
alertTimer = setInterval(updateAlertBadge, REFRESH_INTERVAL);
