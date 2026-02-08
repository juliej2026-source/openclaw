// Prometheus text exposition format parser
// Extracted from monitor-page.ts for reuse across portal pages

/**
 * Parse Prometheus text format into structured metrics.
 * @param {string} text — raw Prometheus metrics text
 * @returns {Object.<string, Array<{labels: Object, value: number}>>}
 */
export function parsePrometheus(text) {
  const metrics = {};
  for (const line of text.split("\n")) {
    if (!line || line.startsWith("#")) continue;
    const m = line.match(/^([a-zA-Z_:][a-zA-Z0-9_:]*)(\{([^}]*)\})?\s+([-\d.e+]+)$/);
    if (!m) continue;
    const name = m[1];
    const labelsStr = m[3] || "";
    const value = parseFloat(m[4]);
    const labels = {};
    if (labelsStr) {
      for (const pair of labelsStr.match(/([a-zA-Z_][a-zA-Z0-9_]*)="([^"]*)"/g) || []) {
        const eq = pair.indexOf("=");
        labels[pair.slice(0, eq)] = pair.slice(eq + 2, -1);
      }
    }
    if (!metrics[name]) metrics[name] = [];
    metrics[name].push({ labels, value });
  }
  return metrics;
}

/**
 * Get a single scalar value for a metric (first entry).
 * @param {object} metrics — parsed metrics from parsePrometheus
 * @param {string} name — metric name
 * @returns {number|null}
 */
export function getScalar(metrics, name) {
  const arr = metrics[name];
  if (!arr || !arr.length) return null;
  return arr[0].value;
}

/**
 * Get all entries for a metric (with labels).
 * @param {object} metrics — parsed metrics from parsePrometheus
 * @param {string} name — metric name
 * @returns {Array<{labels: Object, value: number}>}
 */
export function getAll(metrics, name) {
  return metrics[name] || [];
}
