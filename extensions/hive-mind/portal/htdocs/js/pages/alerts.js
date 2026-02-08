// Alert center page — #/alerts
// Displays active and historical alerts with filtering, severity badges, and acknowledge actions.

import { sendCommand } from "../api.js";
import { card, cardGrid, badge, sectionTitle, errorBanner, emptyState } from "../components.js";
import { timeAgo } from "../utils.js";

// Severity → badge color mapping
const SEVERITY_COLORS = {
  critical: "red",
  warning: "yellow",
  info: "blue",
};

/** Current filter state: "all" | "active" | "acknowledged" */
let currentFilter = "all";

/**
 * Build the summary stat cards row.
 * @param {Array} alerts
 * @returns {HTMLElement}
 */
function buildSummaryCards(alerts) {
  const active = alerts.filter((a) => !a.acknowledged).length;
  const total = alerts.length;
  const critical = alerts.filter((a) => a.severity === "critical" && !a.acknowledged).length;
  const warning = alerts.filter((a) => a.severity === "warning" && !a.acknowledged).length;

  return cardGrid([
    card({ label: "Active", value: active, status: active > 0 ? "crit" : "ok" }),
    card({ label: "Total", value: total, status: "info" }),
    card({ label: "Critical", value: critical, status: critical > 0 ? "crit" : "" }),
    card({ label: "Warning", value: warning, status: warning > 0 ? "warn" : "" }),
  ]);
}

/**
 * Build the filter bar with toggle buttons.
 * @param {Function} onFilterChange — callback(newFilter)
 * @returns {HTMLElement}
 */
function buildFilterBar(onFilterChange) {
  const bar = document.createElement("div");
  bar.className = "filter-bar";

  const filters = [
    { key: "all", label: "All" },
    { key: "active", label: "Active" },
    { key: "acknowledged", label: "Acknowledged" },
  ];

  for (const f of filters) {
    const btn = document.createElement("button");
    btn.className = "filter-btn" + (currentFilter === f.key ? " active" : "");
    btn.textContent = f.label;
    btn.addEventListener("click", () => {
      currentFilter = f.key;
      // Update button active states
      bar.querySelectorAll(".filter-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      onFilterChange(f.key);
    });
    bar.appendChild(btn);
  }

  return bar;
}

/**
 * Filter alerts based on the current filter state.
 * @param {Array} alerts
 * @param {string} filter
 * @returns {Array}
 */
function filterAlerts(alerts, filter) {
  if (filter === "active") return alerts.filter((a) => !a.acknowledged);
  if (filter === "acknowledged") return alerts.filter((a) => a.acknowledged);
  return alerts;
}

/**
 * Build a single alert row element.
 * @param {Object} alert
 * @param {Function} onAck — callback when acknowledge is clicked
 * @returns {HTMLElement}
 */
function buildAlertRow(alert, onAck) {
  const row = document.createElement("div");
  row.className = "alert-row";

  // Severity badge
  const sevWrap = document.createElement("div");
  sevWrap.className = "alert-severity";
  const color = SEVERITY_COLORS[alert.severity] || "dim";
  sevWrap.appendChild(badge(alert.severity, color));
  row.appendChild(sevWrap);

  // Type + message
  const msgWrap = document.createElement("div");
  msgWrap.className = "alert-message";

  const typeSpan = document.createElement("span");
  typeSpan.style.cssText = "font-weight:600;margin-right:8px;color:var(--text-bright)";
  typeSpan.textContent = formatAlertType(alert.type);
  msgWrap.appendChild(typeSpan);

  const msgSpan = document.createElement("span");
  msgSpan.textContent = alert.message;
  msgWrap.appendChild(msgSpan);

  row.appendChild(msgWrap);

  // Timestamp
  const timeEl = document.createElement("div");
  timeEl.className = "alert-time";
  timeEl.textContent = timeAgo(alert.timestamp);
  row.appendChild(timeEl);

  // Action: acknowledge button (only if not yet acknowledged)
  const actionWrap = document.createElement("div");
  actionWrap.className = "alert-action";

  if (alert.acknowledged) {
    const ackBadge = badge("Acked", "dim");
    actionWrap.appendChild(ackBadge);
  } else {
    const ackBtn = document.createElement("button");
    ackBtn.className = "btn btn-sm";
    ackBtn.textContent = "Acknowledge";
    ackBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      ackBtn.disabled = true;
      ackBtn.textContent = "Acking...";
      try {
        await sendCommand("network:alerts:ack", { id: alert.id });
        alert.acknowledged = true;
        if (onAck) onAck();
      } catch (err) {
        ackBtn.disabled = false;
        ackBtn.textContent = "Acknowledge";
        console.error("[alerts] ack failed:", err);
      }
    });
    actionWrap.appendChild(ackBtn);
  }

  row.appendChild(actionWrap);

  return row;
}

/**
 * Format an alert type slug into a readable label.
 * @param {string} type — e.g. "station_offline"
 * @returns {string}
 */
function formatAlertType(type) {
  if (!type) return "--";
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Render the alert list into a container.
 * @param {HTMLElement} listEl
 * @param {Array} alerts
 * @param {Function} onAck — callback to re-render after ack
 */
function renderAlertList(listEl, alerts, onAck) {
  listEl.innerHTML = "";
  const filtered = filterAlerts(alerts, currentFilter);

  if (filtered.length === 0) {
    listEl.appendChild(
      emptyState(
        currentFilter === "all"
          ? "No alerts recorded."
          : currentFilter === "active"
            ? "No active alerts. All clear."
            : "No acknowledged alerts.",
      ),
    );
    return;
  }

  // Sort by timestamp descending (newest first)
  const sorted = [...filtered].sort((a, b) => {
    const ta = typeof a.timestamp === "number" ? a.timestamp : new Date(a.timestamp).getTime();
    const tb = typeof b.timestamp === "number" ? b.timestamp : new Date(b.timestamp).getTime();
    return tb - ta;
  });

  for (const alert of sorted) {
    listEl.appendChild(buildAlertRow(alert, onAck));
  }
}

/**
 * Fetch alert data and render the full page.
 * @param {HTMLElement} container
 * @param {Object} query
 */
async function load(container, query) {
  let allAlerts = [];

  try {
    const allResult = await sendCommand("network:alerts", { limit: 50 });
    allAlerts = allResult.alerts || [];
  } catch (err) {
    container.innerHTML = "";
    container.appendChild(errorBanner("Failed to load alerts: " + err.message));
    return;
  }

  // Build page
  container.innerHTML = "";

  // Page title
  const title = document.createElement("div");
  title.className = "page-title";
  title.textContent = "Alert Center";
  container.appendChild(title);

  // Summary cards
  container.appendChild(buildSummaryCards(allAlerts));

  // Section title
  container.appendChild(sectionTitle("Alerts"));

  // Alert list container
  const listEl = document.createElement("div");
  listEl.className = "alert-list";

  // Re-render callback for acknowledge actions
  const reRender = () => {
    // Update summary cards
    const summaryParent = container.querySelector(".card-grid");
    if (summaryParent) {
      const newSummary = buildSummaryCards(allAlerts);
      summaryParent.replaceWith(newSummary);
    }
    renderAlertList(listEl, allAlerts, reRender);
  };

  // Filter bar — inserted before the alert list
  const filterBar = buildFilterBar(() => {
    renderAlertList(listEl, allAlerts, reRender);
  });
  container.appendChild(filterBar);

  // Render the alert rows
  renderAlertList(listEl, allAlerts, reRender);
  container.appendChild(listEl);
}

/**
 * Initial render of the alerts page.
 * @param {HTMLElement} container
 * @param {Object} query
 */
export async function render(container, query) {
  currentFilter = "all";
  await load(container, query);
}

/**
 * Refresh the page data without full re-mount.
 * Preserves the current filter selection.
 * @param {HTMLElement} container
 * @param {Object} query
 */
export async function refresh(container, query) {
  await load(container, query);
}
