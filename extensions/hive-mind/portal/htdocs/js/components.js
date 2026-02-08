// Reusable DOM builder components

/**
 * Create a stat card element.
 * @param {{label: string, value: string|number, sub?: string, status?: string}} opts
 *   status: "ok" | "warn" | "crit" | "info" | ""
 */
export function card({ label, value, sub, status }) {
  const el = document.createElement("div");
  el.className = "card" + (status ? " " + status : "");
  el.innerHTML =
    `<div class="card-label">${esc(label)}</div>` +
    `<div class="card-value">${esc(String(value ?? "--"))}</div>` +
    (sub ? `<div class="card-sub">${esc(sub)}</div>` : "");
  return el;
}

/**
 * Create a colored badge span.
 * @param {string} text
 * @param {string} color — "green"|"red"|"yellow"|"blue"|"purple"|"cyan"|"orange"|"dim"
 */
export function badge(text, color) {
  const el = document.createElement("span");
  el.className = `badge badge-${color}`;
  el.textContent = text;
  return el;
}

/**
 * Create a progress bar.
 * @param {number} value — current value
 * @param {number} max — max value
 * @param {string} color — "green"|"yellow"|"red"|"cyan"|"blue"
 */
export function progressBar(value, max, color) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const container = document.createElement("div");
  container.className = "bar-container";
  container.innerHTML = `<div class="bar-fill ${color}" style="width:${pct.toFixed(1)}%"></div>`;
  return container;
}

/**
 * Create a sortable data table.
 * @param {{columns: Array<{key: string, label: string, sortable?: boolean, mono?: boolean, sortKey?: string}>, rows: Array<Object>}} opts
 */
export function dataTable({ columns, rows }) {
  const table = document.createElement("table");
  table.className = "data-table";

  // Header
  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  let sortKey = null;
  let sortDir = "asc";

  for (const col of columns) {
    const th = document.createElement("th");
    th.textContent = col.label;
    if (col.sortable) {
      th.className = "sortable";
      th.addEventListener("click", () => {
        if (sortKey === col.key) {
          sortDir = sortDir === "asc" ? "desc" : "asc";
        } else {
          sortKey = col.key;
          sortDir = "asc";
        }
        // Update header indicators
        headRow.querySelectorAll("th").forEach((h) => {
          h.classList.remove("sorted-asc", "sorted-desc");
        });
        th.classList.add(sortDir === "asc" ? "sorted-asc" : "sorted-desc");
        renderBody();
      });
    }
    headRow.appendChild(th);
  }
  thead.appendChild(headRow);
  table.appendChild(thead);

  // Body
  const tbody = document.createElement("tbody");
  table.appendChild(tbody);

  function renderBody() {
    let sorted = [...rows];
    if (sortKey) {
      const col = columns.find((c) => c.key === sortKey);
      const resolvedKey = col?.sortKey || sortKey;
      sorted.sort((a, b) => {
        const va = a[resolvedKey] ?? "";
        const vb = b[resolvedKey] ?? "";
        const cmp =
          typeof va === "number" && typeof vb === "number"
            ? va - vb
            : String(va).localeCompare(String(vb));
        return sortDir === "asc" ? cmp : -cmp;
      });
    }

    tbody.innerHTML = "";
    for (const row of sorted) {
      const tr = document.createElement("tr");
      for (const col of columns) {
        const td = document.createElement("td");
        const val = row[col.key];
        if (val instanceof HTMLElement) {
          td.appendChild(val);
        } else {
          td.textContent = val ?? "--";
        }
        if (col.mono) td.className = "mono";
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
  }

  renderBody();
  return table;
}

/**
 * Create a status dot.
 * @param {boolean} isUp
 */
export function statusDot(isUp) {
  const el = document.createElement("span");
  el.className = "dot " + (isUp ? "up" : "down");
  return el;
}

/**
 * Create a section title divider.
 * @param {string} text
 */
export function sectionTitle(text) {
  const el = document.createElement("div");
  el.className = "section-title";
  el.textContent = text;
  return el;
}

/**
 * Create an error banner.
 * @param {string} message
 */
export function errorBanner(message) {
  const el = document.createElement("div");
  el.className = "error-banner";
  el.textContent = message;
  return el;
}

/**
 * Create a loading indicator.
 */
export function loading() {
  const el = document.createElement("div");
  el.className = "loading";
  el.textContent = "Loading\u2026";
  return el;
}

/**
 * Create an empty state message.
 * @param {string} message
 */
export function emptyState(message) {
  const el = document.createElement("div");
  el.className = "empty-state";
  el.textContent = message;
  return el;
}

/**
 * Escape HTML entities for safe interpolation.
 * @param {string} str
 * @returns {string}
 */
export function esc(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Helper to create a card grid container.
 * @param {HTMLElement[]} cards
 */
export function cardGrid(cards) {
  const el = document.createElement("div");
  el.className = "card-grid";
  for (const c of cards) el.appendChild(c);
  return el;
}

/**
 * Helper to create a 2-column layout.
 * @param {HTMLElement} left
 * @param {HTMLElement} right
 */
export function cols2(left, right) {
  const el = document.createElement("div");
  el.className = "cols-2";
  el.appendChild(left);
  el.appendChild(right);
  return el;
}

/**
 * Helper to create a 3-column layout.
 * @param {HTMLElement[]} children
 */
export function cols3(children) {
  const el = document.createElement("div");
  el.className = "cols-3";
  for (const c of children) el.appendChild(c);
  return el;
}

/**
 * Wrap content in a generic container div.
 * @param {string} [className]
 * @param {HTMLElement[]} children
 */
export function div(className, children) {
  const el = document.createElement("div");
  if (className) el.className = className;
  if (children) for (const c of children) el.appendChild(c);
  return el;
}
