// Centralized API client for the Hive Mind backend
// API key is injected server-side by Apache reverse proxy (RequestHeader)

/**
 * GET a JSON endpoint.
 * @param {string} path — e.g. "/api/network/scan"
 */
export async function apiGet(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`GET ${path}: ${res.status} ${res.statusText}`);
  return res.json();
}

/**
 * POST JSON to an endpoint.
 * @param {string} path
 * @param {object} body
 */
export async function apiPost(path, body) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${path}: ${res.status} ${res.statusText}`);
  return res.json();
}

/**
 * Fetch Prometheus metrics as raw text.
 */
export async function fetchMetrics() {
  const res = await fetch("/metrics");
  if (!res.ok) throw new Error(`GET /metrics: ${res.status}`);
  return res.text();
}

/**
 * Send a command to the hive-mind command dispatcher.
 * @param {string} command — e.g. "network:stations", "meta:status"
 * @param {object} [params] — optional command parameters
 */
export async function sendCommand(command, params = {}) {
  return apiPost("/api/network/command", { command, params });
}

/**
 * GET a UniFi API endpoint.
 * Auth header is injected by Apache reverse proxy — no client-side key needed.
 * @param {string} path — e.g. "/api/unifi/health"
 */
export async function apiGetUnifi(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`GET ${path}: ${res.status} ${res.statusText}`);
  return res.json();
}
