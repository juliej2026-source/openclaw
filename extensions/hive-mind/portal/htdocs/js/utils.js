// Formatting and utility helpers

/**
 * Format seconds into human-readable duration.
 * @param {number|null} seconds
 * @returns {string} e.g. "3d 14h", "2h 30m", "45m"
 */
export function fmtDuration(seconds) {
  if (seconds == null) return "--";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return d + "d " + h + "h";
  if (h > 0) return h + "h " + m + "m";
  return m + "m";
}

/**
 * Format bytes into human-readable size.
 * @param {number|null} bytes
 * @returns {string} e.g. "1.2 GB", "456 MB"
 */
export function fmtBytes(bytes) {
  if (bytes == null) return "--";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  return (bytes / (1024 * 1024 * 1024)).toFixed(1) + " GB";
}

/**
 * Format a ratio (0–1) as a percentage string.
 * @param {number|null} ratio
 * @returns {string} e.g. "94.3%"
 */
export function fmtPercent(ratio) {
  if (ratio == null) return "--";
  return (ratio * 100).toFixed(1) + "%";
}

/**
 * Format an ISO timestamp or epoch into relative time.
 * @param {string|number|null} ts — ISO string or epoch ms
 * @returns {string} e.g. "2m ago", "3h ago", "1d ago"
 */
export function timeAgo(ts) {
  if (!ts) return "--";
  const date = typeof ts === "number" ? ts : new Date(ts).getTime();
  const diff = Math.floor((Date.now() - date) / 1000);
  if (diff < 60) return diff + "s ago";
  if (diff < 3600) return Math.floor(diff / 60) + "m ago";
  if (diff < 86400) return Math.floor(diff / 3600) + "h ago";
  return Math.floor(diff / 86400) + "d ago";
}

/**
 * Format a number with compact notation.
 * @param {number|null} n
 * @returns {string}
 */
export function fmtNumber(n) {
  if (n == null) return "--";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return String(n);
}

/**
 * Clamp a value between min and max.
 */
export function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

/**
 * Get color class based on percentage thresholds.
 * @param {number} pct — 0-100
 * @returns {string} "green" | "yellow" | "red"
 */
export function pctColor(pct) {
  if (pct >= 95) return "green";
  if (pct >= 80) return "yellow";
  return "red";
}

/**
 * Get status class based on a boolean or value.
 * @param {boolean} isUp
 * @returns {string} "ok" | "crit"
 */
export function statusClass(isUp) {
  return isUp ? "ok" : "crit";
}
