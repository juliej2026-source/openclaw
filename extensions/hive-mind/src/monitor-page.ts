// ---------------------------------------------------------------------------
// Self-contained HTML monitoring dashboard
// Fetches /metrics (Prometheus text) and renders a live overview.
// No external dependencies — pure HTML/CSS/JS served as a single page.
// ---------------------------------------------------------------------------

export function generateMonitorHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>OpenClaw Hive Monitor</title>
<style>
  :root {
    --bg: #0d1117; --surface: #161b22; --border: #30363d;
    --text: #e6edf3; --text-dim: #8b949e; --text-bright: #f0f6fc;
    --green: #3fb950; --red: #f85149; --yellow: #d29922;
    --blue: #58a6ff; --purple: #bc8cff; --orange: #f0883e;
    --cyan: #39d2c0;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
    background: var(--bg); color: var(--text); line-height: 1.5;
    padding: 16px; min-height: 100vh;
  }
  header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 12px 0; margin-bottom: 16px; border-bottom: 1px solid var(--border);
  }
  header h1 { font-size: 20px; font-weight: 600; color: var(--text-bright); }
  header h1 span { color: var(--cyan); }
  .meta { font-size: 12px; color: var(--text-dim); }
  .meta .live { color: var(--green); }

  .row-title {
    font-size: 13px; font-weight: 600; text-transform: uppercase;
    letter-spacing: 0.5px; color: var(--text-dim); margin: 20px 0 8px;
    padding: 4px 0; border-bottom: 1px solid var(--border);
  }
  .grid { display: grid; gap: 12px; }
  .grid-6 { grid-template-columns: repeat(6, 1fr); }
  .grid-3 { grid-template-columns: repeat(3, 1fr); }
  .grid-4 { grid-template-columns: repeat(4, 1fr); }
  .grid-2 { grid-template-columns: 2fr 1fr; }
  .grid-1 { grid-template-columns: 1fr; }

  .card {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 8px; padding: 14px; position: relative; overflow: hidden;
  }
  .card .label {
    font-size: 11px; font-weight: 500; text-transform: uppercase;
    letter-spacing: 0.3px; color: var(--text-dim); margin-bottom: 6px;
  }
  .card .value {
    font-size: 28px; font-weight: 700; line-height: 1.1;
    font-variant-numeric: tabular-nums;
  }
  .card .sub { font-size: 12px; color: var(--text-dim); margin-top: 4px; }
  .card.ok { border-left: 3px solid var(--green); }
  .card.warn { border-left: 3px solid var(--yellow); }
  .card.crit { border-left: 3px solid var(--red); }
  .card.info { border-left: 3px solid var(--blue); }

  .v-green { color: var(--green); }
  .v-red { color: var(--red); }
  .v-yellow { color: var(--yellow); }
  .v-blue { color: var(--blue); }
  .v-purple { color: var(--purple); }
  .v-orange { color: var(--orange); }
  .v-cyan { color: var(--cyan); }

  .station-grid { display: grid; gap: 8px; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); }
  .station {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 6px; padding: 10px 12px;
    display: flex; align-items: center; gap: 10px;
  }
  .station .dot {
    width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0;
  }
  .station .dot.up { background: var(--green); box-shadow: 0 0 6px var(--green); }
  .station .dot.down { background: var(--red); box-shadow: 0 0 6px var(--red); }
  .station .name { font-size: 13px; font-weight: 600; }
  .station .latency { font-size: 11px; color: var(--text-dim); margin-left: auto; }

  .perf-table { width: 100%; border-collapse: collapse; font-size: 13px; }
  .perf-table th {
    text-align: left; padding: 6px 10px; font-weight: 600;
    color: var(--text-dim); border-bottom: 1px solid var(--border);
    font-size: 11px; text-transform: uppercase; letter-spacing: 0.3px;
  }
  .perf-table td {
    padding: 6px 10px; border-bottom: 1px solid var(--border);
  }
  .perf-table tr:last-child td { border-bottom: none; }

  .bar-container { display: flex; align-items: center; gap: 8px; }
  .bar {
    height: 6px; border-radius: 3px; flex: 1; background: var(--border);
    overflow: hidden;
  }
  .bar .fill { height: 100%; border-radius: 3px; transition: width 0.5s; }
  .bar-val { font-size: 12px; min-width: 42px; text-align: right; font-variant-numeric: tabular-nums; }

  .alert-list { max-height: 200px; overflow-y: auto; }
  .alert-row {
    display: flex; align-items: center; gap: 8px; padding: 4px 0;
    font-size: 12px; border-bottom: 1px solid var(--border);
  }
  .alert-badge {
    font-size: 10px; font-weight: 700; padding: 1px 6px; border-radius: 3px;
    text-transform: uppercase; letter-spacing: 0.3px;
  }
  .alert-badge.warning { background: rgba(210,153,34,0.2); color: var(--yellow); }
  .alert-badge.critical { background: rgba(248,81,73,0.2); color: var(--red); }
  .alert-badge.info { background: rgba(88,166,255,0.2); color: var(--blue); }

  .wan-path {
    display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px;
    border-radius: 4px; font-size: 13px; font-weight: 600;
  }
  .wan-path.active { background: rgba(63,185,80,0.15); color: var(--green); }
  .wan-path.standby { background: rgba(88,166,255,0.1); color: var(--text-dim); }

  #error-banner {
    display: none; background: rgba(248,81,73,0.15); border: 1px solid var(--red);
    border-radius: 6px; padding: 10px 14px; margin-bottom: 12px;
    font-size: 13px; color: var(--red);
  }

  .footer {
    margin-top: 24px; padding-top: 12px; border-top: 1px solid var(--border);
    font-size: 11px; color: var(--text-dim); text-align: center;
  }
  .footer a { color: var(--blue); text-decoration: none; }
  .footer a:hover { text-decoration: underline; }

  @media (max-width: 900px) {
    .grid-6 { grid-template-columns: repeat(3, 1fr); }
    .grid-3 { grid-template-columns: 1fr; }
    .grid-4 { grid-template-columns: repeat(2, 1fr); }
    .grid-2 { grid-template-columns: 1fr; }
  }
  @media (max-width: 600px) {
    .grid-6 { grid-template-columns: repeat(2, 1fr); }
  }
</style>
</head>
<body>
<header>
  <h1><span>&#9670;</span> OpenClaw Hive Monitor</h1>
  <div class="meta">
    <span class="live" id="status-dot">&#9679;</span>
    <span id="last-update">Loading...</span>
    &middot; Refresh: 30s
  </div>
</header>

<div id="error-banner"></div>

<!-- System Status -->
<div class="row-title">System Status</div>
<div class="grid grid-6" id="system-status">
  <div class="card ok"><div class="label">Uptime</div><div class="value v-green" id="m-uptime">--</div></div>
  <div class="card ok"><div class="label">Stations Online</div><div class="value v-green" id="m-stations-online">--</div></div>
  <div class="card ok" id="card-wan"><div class="label">WAN Status</div><div class="value" id="m-wan-status">--</div></div>
  <div class="card ok" id="card-alerts"><div class="label">Active Alerts</div><div class="value" id="m-alerts">--</div></div>
  <div class="card ok" id="card-julia"><div class="label">JULIA</div><div class="value" id="m-julia">--</div></div>
  <div class="card info"><div class="label">Models Running</div><div class="value v-blue" id="m-models">--</div><div class="sub" id="m-models-sub"></div></div>
</div>

<!-- Stations -->
<div class="row-title">Station Health</div>
<div class="station-grid" id="station-list"></div>

<!-- WAN Paths -->
<div class="row-title">Dual-WAN</div>
<div class="grid grid-4" id="wan-section">
  <div class="card info"><div class="label">Active Path</div><div id="wan-paths"></div></div>
  <div class="card"><div class="label">WAN Latency</div><div id="wan-latency" class="sub">--</div></div>
  <div class="card"><div class="label">Packet Loss</div><div id="wan-loss" class="sub">--</div></div>
  <div class="card"><div class="label">Path Switches</div><div class="value v-blue" id="m-switches">--</div></div>
</div>

<!-- AI Model Performance -->
<div class="row-title">AI Model Performance</div>
<div class="grid grid-2">
  <div class="card">
    <div class="label">Performance by Model &amp; Task</div>
    <table class="perf-table" id="perf-table">
      <thead><tr><th>Model</th><th>Task</th><th>Success Rate</th><th>Avg Latency</th></tr></thead>
      <tbody id="perf-body"></tbody>
    </table>
  </div>
  <div>
    <div class="grid grid-1" style="gap:12px">
      <div class="card"><div class="label">Perf DB Records</div><div class="value v-purple" id="m-perf-total">--</div></div>
      <div class="card"><div class="label">Total Executions</div><div class="value v-orange" id="m-exec-total">--</div></div>
      <div class="card" id="card-exec-rate"><div class="label">Execution Success Rate</div>
        <div class="bar-container"><div class="bar"><div class="fill" id="exec-bar" style="width:0;background:var(--green)"></div></div><div class="bar-val" id="m-exec-rate">--%</div></div>
      </div>
    </div>
  </div>
</div>

<!-- Alerts -->
<div class="row-title">Alerts</div>
<div class="card">
  <div class="alert-list" id="alert-list"><span class="sub">No alerts</span></div>
</div>

<!-- Grafana Link -->
<div class="row-title">Grafana Dashboards</div>
<div class="grid grid-3">
  <div class="card info"><a class="label" href="/grafana" target="_blank" style="color:var(--blue);text-decoration:none">Total Overview</a><div class="sub">Unified view of all monitors</div></div>
  <div class="card info"><a class="label" href="/grafana" target="_blank" style="color:var(--blue);text-decoration:none">AI Intelligence</a><div class="sub">Model fleet, performance matrix, traces</div></div>
  <div class="card info"><a class="label" href="/grafana" target="_blank" style="color:var(--blue);text-decoration:none">Network Health</a><div class="sub">Reachability, latency, dual-WAN quality</div></div>
</div>

<div class="footer">
  OpenClaw Hive Monitor &middot; Station: IOT-HUB &middot;
  <a href="/metrics">Raw Metrics</a> &middot;
  <a href="/api/network/dashboard">JSON Dashboard</a>
</div>

<script>
const REFRESH_MS = 30000;

function esc(s) {
  if (s == null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function parsePrometheus(text) {
  const metrics = {};
  for (const line of text.split('\\n')) {
    if (!line || line.startsWith('#')) continue;
    // metric_name{labels} value  OR  metric_name value
    const m = line.match(/^([a-z_]+)(\\{([^}]*)\\})?\\s+([-\\d.e+]+)$/);
    if (!m) continue;
    const name = m[1];
    const labelsStr = m[3] || '';
    const value = parseFloat(m[4]);
    const labels = {};
    if (labelsStr) {
      for (const pair of labelsStr.match(/([a-z_]+)="([^"]*)"/g) || []) {
        const eq = pair.indexOf('=');
        labels[pair.slice(0, eq)] = pair.slice(eq + 2, -1);
      }
    }
    if (!metrics[name]) metrics[name] = [];
    metrics[name].push({ labels, value });
  }
  return metrics;
}

function getScalar(metrics, name) {
  const arr = metrics[name];
  if (!arr || !arr.length) return null;
  return arr[0].value;
}

function getAll(metrics, name) {
  return metrics[name] || [];
}

function fmtDuration(seconds) {
  if (seconds == null) return '--';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return d + 'd ' + h + 'h';
  if (h > 0) return h + 'h ' + m + 'm';
  return m + 'm';
}

function setCard(id, className) {
  const el = document.getElementById(id);
  if (el) { el.className = 'card ' + className; }
}

function render(metrics) {
  // Uptime
  const uptime = getScalar(metrics, 'hivemind_uptime_seconds');
  document.getElementById('m-uptime').textContent = fmtDuration(uptime);

  // Stations
  const stations = getAll(metrics, 'hivemind_station_reachable');
  const latencies = getAll(metrics, 'hivemind_station_latency_ms');
  const latencyMap = {};
  for (const l of latencies) latencyMap[l.labels.station] = l.value;

  const online = stations.filter(s => s.value === 1).length;
  const total = stations.length;
  document.getElementById('m-stations-online').textContent = online + '/' + total;
  setCard('m-stations-online', online === total ? 'card ok' : 'card crit');

  const stationList = document.getElementById('station-list');
  stationList.innerHTML = stations.map(s => {
    const up = s.value === 1;
    const lat = latencyMap[s.labels.station];
    return '<div class="station">' +
      '<div class="dot ' + (up ? 'up' : 'down') + '"></div>' +
      '<div class="name">' + esc(s.labels.station) + '</div>' +
      (lat != null ? '<div class="latency">' + lat.toFixed(1) + ' ms</div>' : '') +
      '</div>';
  }).join('');

  // WAN
  const wanPaths = getAll(metrics, 'hivemind_wan_active_path');
  const failover = getScalar(metrics, 'hivemind_wan_failover_active');
  const switches = getScalar(metrics, 'hivemind_wan_switch_count_total');

  if (failover === 1) {
    document.getElementById('m-wan-status').textContent = 'FAILOVER';
    document.getElementById('m-wan-status').className = 'value v-red';
    setCard('card-wan', 'card crit');
  } else if (failover === 0) {
    document.getElementById('m-wan-status').textContent = 'NORMAL';
    document.getElementById('m-wan-status').className = 'value v-green';
    setCard('card-wan', 'card ok');
  }

  document.getElementById('m-switches').textContent = switches != null ? switches : '--';

  const wanPathsEl = document.getElementById('wan-paths');
  wanPathsEl.innerHTML = wanPaths.map(p => {
    const active = p.value === 1;
    return '<span class="wan-path ' + (active ? 'active' : 'standby') + '">' +
      (active ? '&#9679; ' : '&#9675; ') + esc(p.labels.path_id) + '</span> ';
  }).join('');

  // WAN quality
  const wanLat = getAll(metrics, 'hivemind_wan_quality_latency_ms');
  const wanLoss = getAll(metrics, 'hivemind_wan_quality_packet_loss_pct');
  document.getElementById('wan-latency').innerHTML = wanLat.map(l =>
    '<div>' + esc(l.labels.path_id) + ': <strong>' + l.value.toFixed(1) + ' ms</strong></div>'
  ).join('') || '--';
  document.getElementById('wan-loss').innerHTML = wanLoss.map(l =>
    '<div>' + esc(l.labels.path_id) + ': <strong>' + l.value.toFixed(2) + '%</strong></div>'
  ).join('') || '--';

  // Alerts
  const alertCount = getScalar(metrics, 'hivemind_alert_active_count');
  document.getElementById('m-alerts').textContent = alertCount != null ? alertCount : '--';
  if (alertCount > 0) {
    document.getElementById('m-alerts').className = alertCount >= 5 ? 'value v-red' : 'value v-yellow';
    setCard('card-alerts', alertCount >= 5 ? 'card crit' : 'card warn');
  } else {
    document.getElementById('m-alerts').className = 'value v-green';
    setCard('card-alerts', 'card ok');
  }

  const alerts = getAll(metrics, 'hivemind_alert_count');
  const alertListEl = document.getElementById('alert-list');
  if (alerts.length > 0) {
    alertListEl.innerHTML = alerts.map(a => {
      const sev = a.labels.severity || 'info';
      return '<div class="alert-row">' +
        '<span class="alert-badge ' + esc(sev) + '">' + esc(sev) + '</span>' +
        '<span>' + esc(a.labels.type) + '</span>' +
        '<span style="margin-left:auto;color:var(--text-dim)">' + a.value + '</span>' +
        '</div>';
    }).join('');
  } else {
    alertListEl.innerHTML = '<span class="sub">No alerts</span>';
  }

  // JULIA
  const julia = getScalar(metrics, 'hivemind_julia_registered');
  const heartbeat = getScalar(metrics, 'hivemind_julia_last_heartbeat_age_seconds');
  if (julia === 1) {
    document.getElementById('m-julia').textContent = 'REGISTERED';
    document.getElementById('m-julia').className = 'value v-green';
    setCard('card-julia', 'card ok');
  } else if (julia === 0) {
    document.getElementById('m-julia').textContent = 'UNREGISTERED';
    document.getElementById('m-julia').className = 'value v-red';
    setCard('card-julia', 'card crit');
  }

  // Models
  const installed = getScalar(metrics, 'hivemind_model_installed_count');
  const running = getScalar(metrics, 'hivemind_model_running_count');
  document.getElementById('m-models').textContent = running != null ? running : '--';
  document.getElementById('m-models-sub').textContent = installed != null ? installed + ' installed' : '';

  // Performance
  const perfRate = getAll(metrics, 'hivemind_perf_success_rate');
  const perfLat = getAll(metrics, 'hivemind_perf_avg_latency_ms');
  const perfTotal = getScalar(metrics, 'hivemind_perf_total_records');

  const latMap = {};
  for (const l of perfLat) latMap[l.labels.model_id + '|' + l.labels.task_type] = l.value;

  const perfBody = document.getElementById('perf-body');
  if (perfRate.length > 0) {
    perfBody.innerHTML = perfRate.map(p => {
      const rate = (p.value * 100).toFixed(1);
      const lat = latMap[p.labels.model_id + '|' + p.labels.task_type];
      const color = p.value >= 0.95 ? 'var(--green)' : p.value >= 0.8 ? 'var(--yellow)' : 'var(--red)';
      return '<tr>' +
        '<td>' + esc(p.labels.model_id) + '</td>' +
        '<td>' + esc(p.labels.task_type) + '</td>' +
        '<td><div class="bar-container"><div class="bar"><div class="fill" style="width:' + rate + '%;background:' + color + '"></div></div><div class="bar-val" style="color:' + color + '">' + rate + '%</div></div></td>' +
        '<td>' + (lat != null ? lat.toFixed(0) + ' ms' : '--') + '</td>' +
        '</tr>';
    }).join('');
  } else {
    perfBody.innerHTML = '<tr><td colspan="4" class="sub">No performance data yet</td></tr>';
  }

  document.getElementById('m-perf-total').textContent = perfTotal != null ? perfTotal : '--';

  // Execution
  const execTotal = getScalar(metrics, 'hivemind_exec_total');
  const execRate = getScalar(metrics, 'hivemind_exec_success_rate');
  document.getElementById('m-exec-total').textContent = execTotal != null ? execTotal : '--';
  if (execRate != null) {
    const pct = (execRate * 100).toFixed(1);
    document.getElementById('m-exec-rate').textContent = pct + '%';
    document.getElementById('exec-bar').style.width = pct + '%';
    const color = execRate >= 0.95 ? 'var(--green)' : execRate >= 0.8 ? 'var(--yellow)' : 'var(--red)';
    document.getElementById('exec-bar').style.background = color;
    document.getElementById('m-exec-rate').style.color = color;
  }
}

async function refresh() {
  try {
    const res = await fetch('/metrics');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const text = await res.text();
    const metrics = parsePrometheus(text);
    render(metrics);
    document.getElementById('error-banner').style.display = 'none';
    document.getElementById('last-update').textContent =
      'Updated ' + new Date().toLocaleTimeString();
    document.getElementById('status-dot').style.color = 'var(--green)';
  } catch (e) {
    document.getElementById('error-banner').textContent =
      'Failed to fetch metrics: ' + e.message;
    document.getElementById('error-banner').style.display = 'block';
    document.getElementById('status-dot').style.color = 'var(--red)';
  }
}

refresh();
setInterval(refresh, REFRESH_MS);
</script>
</body>
</html>`;
}
