// ---------------------------------------------------------------------------
// Self-contained HTML monitoring dashboard
// Fetches /metrics (Prometheus text) + JSON API endpoints and renders a
// comprehensive live overview of the entire hive network.
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
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&family=JetBrains+Mono:wght@400;500;600&display=swap');

  :root {
    --bg: #f6f6f9;
    --bg-subtle: #eeeef2;
    --surface: rgba(255,255,255,0.72);
    --surface-solid: #fff;
    --border: rgba(0,0,0,0.06);
    --border-strong: rgba(0,0,0,0.10);
    --text: #1a1a2e;
    --text-dim: #6b7084;
    --text-bright: #0f0f1a;
    --green: #22c55e;
    --green-soft: rgba(34,197,94,0.12);
    --red: #ef4444;
    --red-soft: rgba(239,68,68,0.10);
    --yellow: #f59e0b;
    --yellow-soft: rgba(245,158,11,0.10);
    --blue: #3b82f6;
    --blue-soft: rgba(59,130,246,0.10);
    --purple: #a855f7;
    --purple-soft: rgba(168,85,247,0.10);
    --orange: #f97316;
    --orange-soft: rgba(249,115,22,0.10);
    --cyan: #06b6d4;
    --cyan-soft: rgba(6,182,212,0.10);
    --shadow-sm: 0 1px 2px rgba(0,0,0,0.04), 0 1px 3px rgba(0,0,0,0.03);
    --shadow-md: 0 4px 12px rgba(0,0,0,0.05), 0 1px 3px rgba(0,0,0,0.04);
    --shadow-lg: 0 8px 30px rgba(0,0,0,0.06), 0 2px 6px rgba(0,0,0,0.03);
    --radius: 14px;
    --radius-sm: 8px;
    --font: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    --font-mono: 'JetBrains Mono', 'SF Mono', 'Fira Code', monospace;
    --transition: 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    --glass-blur: blur(16px);

    /* Topology node colors */
    --node-gateway: #3b82f6;
    --node-modem: #f97316;
    --node-ai: #a855f7;
    --node-hub: #06b6d4;
    --node-worker: #22c55e;
    --node-intel: #eab308;
    --node-device: #94a3b8;
    --node-decom: #9ca3af;
  }

  [data-theme="dark"] {
    --bg: #0c0c14;
    --bg-subtle: #131320;
    --surface: rgba(22,22,38,0.80);
    --surface-solid: #16162a;
    --border: rgba(255,255,255,0.06);
    --border-strong: rgba(255,255,255,0.10);
    --text: #e2e4ed;
    --text-dim: #8b8fa8;
    --text-bright: #f5f5fa;
    --green: #4ade80;
    --green-soft: rgba(74,222,128,0.12);
    --red: #f87171;
    --red-soft: rgba(248,113,113,0.10);
    --yellow: #fbbf24;
    --yellow-soft: rgba(251,191,36,0.10);
    --blue: #60a5fa;
    --blue-soft: rgba(96,165,250,0.10);
    --purple: #c084fc;
    --purple-soft: rgba(192,132,252,0.10);
    --orange: #fb923c;
    --orange-soft: rgba(251,146,60,0.10);
    --cyan: #22d3ee;
    --cyan-soft: rgba(34,211,238,0.10);
    --shadow-sm: 0 1px 3px rgba(0,0,0,0.3);
    --shadow-md: 0 4px 12px rgba(0,0,0,0.3);
    --shadow-lg: 0 8px 30px rgba(0,0,0,0.4);
    --node-gateway: #60a5fa;
    --node-modem: #fb923c;
    --node-ai: #c084fc;
    --node-hub: #22d3ee;
    --node-worker: #4ade80;
    --node-intel: #facc15;
    --node-device: #94a3b8;
    --node-decom: #6b7280;
  }

  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: var(--font);
    background: var(--bg);
    color: var(--text);
    line-height: 1.55;
    min-height: 100vh;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  /* Animated mesh background */
  body::before {
    content: '';
    position: fixed; inset: 0; z-index: 0;
    background:
      radial-gradient(ellipse 70% 50% at 20% 0%, var(--blue-soft) 0%, transparent 70%),
      radial-gradient(ellipse 50% 60% at 80% 20%, var(--purple-soft) 0%, transparent 70%),
      radial-gradient(ellipse 60% 40% at 50% 100%, var(--cyan-soft) 0%, transparent 60%);
    pointer-events: none;
  }

  .container {
    max-width: 1280px;
    margin: 0 auto;
    padding: 20px 24px;
    position: relative;
    z-index: 1;
  }

  /* Header */
  header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 16px 0 20px; margin-bottom: 8px;
  }
  .brand {
    display: flex; align-items: center; gap: 12px;
  }
  .brand-icon {
    width: 36px; height: 36px; border-radius: 10px;
    background: linear-gradient(135deg, var(--cyan), var(--blue));
    display: flex; align-items: center; justify-content: center;
    color: #fff; font-size: 16px; font-weight: 700;
    box-shadow: 0 2px 8px rgba(6,182,212,0.3);
  }
  .brand h1 {
    font-size: 19px; font-weight: 600; color: var(--text-bright);
    letter-spacing: -0.3px;
  }
  .brand h1 span { color: var(--cyan); font-weight: 700; }
  .header-right {
    display: flex; align-items: center; gap: 16px;
  }
  .live-badge {
    display: flex; align-items: center; gap: 6px;
    font-size: 12px; font-weight: 500; color: var(--text-dim);
  }
  #status-dot {
    width: 8px; height: 8px; border-radius: 50%;
    background: var(--green);
    animation: pulse-dot 2s ease-in-out infinite;
  }
  @keyframes pulse-dot {
    0%, 100% { box-shadow: 0 0 0 0 rgba(34,197,94,0.4); }
    50% { box-shadow: 0 0 0 6px rgba(34,197,94,0); }
  }
  .theme-toggle {
    width: 34px; height: 34px; border-radius: 9px; border: 1px solid var(--border-strong);
    background: var(--surface); backdrop-filter: var(--glass-blur);
    cursor: pointer; display: flex; align-items: center; justify-content: center;
    font-size: 15px; color: var(--text-dim); transition: all var(--transition);
  }
  .theme-toggle:hover { background: var(--bg-subtle); color: var(--text); }

  /* Error banner */
  #error-banner {
    display: none;
    background: var(--red-soft); border: 1px solid var(--red);
    border-radius: var(--radius-sm); padding: 10px 16px; margin-bottom: 16px;
    font-size: 13px; color: var(--red); font-weight: 500;
    animation: fade-in 0.3s ease;
  }

  /* Section titles */
  .section-title {
    font-size: 12px; font-weight: 600; text-transform: uppercase;
    letter-spacing: 0.8px; color: var(--text-dim); margin: 28px 0 12px;
    display: flex; align-items: center; gap: 8px;
  }
  .section-title::after {
    content: ''; flex: 1; height: 1px; background: var(--border-strong);
  }

  /* Grid layouts */
  .grid { display: grid; gap: 12px; }
  .g6 { grid-template-columns: repeat(6, 1fr); }
  .g4 { grid-template-columns: repeat(4, 1fr); }
  .g3 { grid-template-columns: repeat(3, 1fr); }
  .g2 { grid-template-columns: 1fr 1fr; }
  .g2w { grid-template-columns: 2fr 1fr; }

  /* Glass cards */
  .card {
    background: var(--surface);
    backdrop-filter: var(--glass-blur);
    -webkit-backdrop-filter: var(--glass-blur);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 18px 20px;
    position: relative; overflow: hidden;
    box-shadow: var(--shadow-sm);
    transition: all var(--transition);
    animation: card-in 0.5s ease both;
  }
  .card:hover {
    box-shadow: var(--shadow-md);
    border-color: var(--border-strong);
    transform: translateY(-1px);
  }
  @keyframes card-in {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .card:nth-child(1) { animation-delay: 0s; }
  .card:nth-child(2) { animation-delay: 0.04s; }
  .card:nth-child(3) { animation-delay: 0.08s; }
  .card:nth-child(4) { animation-delay: 0.12s; }
  .card:nth-child(5) { animation-delay: 0.16s; }
  .card:nth-child(6) { animation-delay: 0.20s; }

  .card .label {
    font-size: 11px; font-weight: 600; text-transform: uppercase;
    letter-spacing: 0.6px; color: var(--text-dim); margin-bottom: 8px;
  }
  .card .value {
    font-size: 28px; font-weight: 700; line-height: 1.1;
    font-variant-numeric: tabular-nums; letter-spacing: -0.5px;
    font-family: var(--font);
  }
  .card .sub {
    font-size: 12px; color: var(--text-dim); margin-top: 6px;
    font-weight: 400;
  }
  .card .accent-line {
    position: absolute; left: 0; top: 0; bottom: 0; width: 3px; border-radius: 0 2px 2px 0;
  }

  /* Value colors */
  .v-green { color: var(--green); }
  .v-red { color: var(--red); }
  .v-yellow { color: var(--yellow); }
  .v-blue { color: var(--blue); }
  .v-purple { color: var(--purple); }
  .v-orange { color: var(--orange); }
  .v-cyan { color: var(--cyan); }

  /* Station health grid */
  .station-grid {
    display: grid; gap: 8px;
    grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
  }
  .station {
    background: var(--surface);
    backdrop-filter: var(--glass-blur);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm); padding: 10px 14px;
    display: flex; align-items: center; gap: 10px;
    transition: all var(--transition);
    animation: fade-in 0.4s ease both;
  }
  .station:hover { box-shadow: var(--shadow-sm); transform: translateY(-1px); }
  .station .dot {
    width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
    transition: all 0.3s ease;
  }
  .station .dot.up {
    background: var(--green);
    box-shadow: 0 0 8px rgba(34,197,94,0.5);
    animation: pulse-dot 2s ease-in-out infinite;
  }
  .station .dot.down {
    background: var(--red);
    box-shadow: 0 0 8px rgba(239,68,68,0.5);
  }
  .station .name { font-size: 13px; font-weight: 600; color: var(--text); }
  .station .latency {
    font-size: 11px; color: var(--text-dim); margin-left: auto;
    font-family: var(--font-mono); font-weight: 500;
  }

  /* Tables */
  table.mini { width: 100%; border-collapse: collapse; font-size: 12px; }
  table.mini th {
    text-align: left; padding: 8px 10px; font-weight: 600;
    color: var(--text-dim); border-bottom: 1px solid var(--border-strong);
    font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px;
    background: var(--bg-subtle);
  }
  table.mini th:first-child { border-radius: var(--radius-sm) 0 0 0; }
  table.mini th:last-child { border-radius: 0 var(--radius-sm) 0 0; }
  table.mini td {
    padding: 8px 10px; border-bottom: 1px solid var(--border);
    transition: background var(--transition);
  }
  table.mini tr:hover td { background: var(--bg-subtle); }
  table.mini tr:last-child td { border-bottom: none; }

  .perf-table { width: 100%; border-collapse: collapse; font-size: 13px; }
  .perf-table th {
    text-align: left; padding: 8px 12px; font-weight: 600;
    color: var(--text-dim); border-bottom: 1px solid var(--border-strong);
    font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px;
    background: var(--bg-subtle);
  }
  .perf-table th:first-child { border-radius: var(--radius-sm) 0 0 0; }
  .perf-table th:last-child { border-radius: 0 var(--radius-sm) 0 0; }
  .perf-table td {
    padding: 8px 12px; border-bottom: 1px solid var(--border);
    transition: background var(--transition);
  }
  .perf-table tr:hover td { background: var(--bg-subtle); }
  .perf-table tr:last-child td { border-bottom: none; }

  /* Progress bars */
  .bar-container { display: flex; align-items: center; gap: 10px; }
  .bar {
    height: 6px; border-radius: 3px; flex: 1;
    background: var(--bg-subtle); overflow: hidden;
  }
  .bar .fill {
    height: 100%; border-radius: 3px;
    transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .bar-val {
    font-size: 12px; min-width: 42px; text-align: right;
    font-variant-numeric: tabular-nums; font-weight: 600;
    font-family: var(--font-mono);
  }

  /* Alerts */
  .alert-list { max-height: 220px; overflow-y: auto; }
  .alert-row {
    display: flex; align-items: center; gap: 10px; padding: 8px 0;
    font-size: 12px; border-bottom: 1px solid var(--border);
    transition: background var(--transition);
  }
  .alert-row:hover { background: var(--bg-subtle); }
  .alert-badge {
    font-size: 9px; font-weight: 700; padding: 2px 8px;
    border-radius: 4px; text-transform: uppercase; letter-spacing: 0.5px;
  }
  .alert-badge.warning { background: var(--yellow-soft); color: var(--yellow); }
  .alert-badge.critical { background: var(--red-soft); color: var(--red); }
  .alert-badge.info { background: var(--blue-soft); color: var(--blue); }

  /* WAN path badges */
  .wan-path {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 5px 12px; border-radius: 6px;
    font-size: 12px; font-weight: 600;
  }
  .wan-path.active { background: var(--green-soft); color: var(--green); }
  .wan-path.standby { background: var(--bg-subtle); color: var(--text-dim); }

  /* Badges */
  .badge {
    display: inline-block; font-size: 10px; font-weight: 600;
    padding: 2px 8px; border-radius: 5px;
    text-transform: uppercase; letter-spacing: 0.3px;
  }
  .badge.ok { background: var(--green-soft); color: var(--green); }
  .badge.err { background: var(--red-soft); color: var(--red); }
  .badge.run { background: var(--cyan-soft); color: var(--cyan); }
  .badge.stop { background: var(--bg-subtle); color: var(--text-dim); }
  .badge.wifi { background: var(--purple-soft); color: var(--purple); }
  .badge.wired { background: var(--blue-soft); color: var(--blue); }

  /* Topology */
  .topo-section { position: relative; }
  .topo-header {
    display: flex; align-items: center; justify-content: space-between;
    margin-bottom: 12px;
  }
  .topo-header .section-title { margin: 0; flex: 1; }
  .flow-btn {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 6px 16px; border-radius: 20px; border: 1px solid var(--border-strong);
    background: var(--surface); backdrop-filter: var(--glass-blur);
    color: var(--text-dim); font-size: 11px; font-weight: 600;
    letter-spacing: 0.4px; text-transform: uppercase;
    cursor: pointer; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    font-family: var(--font);
  }
  .flow-btn:hover {
    background: var(--cyan-soft); color: var(--cyan); border-color: var(--cyan);
    box-shadow: 0 0 16px rgba(6,182,212,0.15);
  }
  .flow-btn.active {
    background: linear-gradient(135deg, var(--cyan-soft), var(--blue-soft));
    color: var(--cyan); border-color: var(--cyan);
    box-shadow: 0 0 20px rgba(6,182,212,0.2);
  }
  .flow-btn .flow-icon {
    display: inline-block; width: 8px; height: 8px; border-radius: 50%;
    background: var(--text-dim); transition: all 0.3s ease;
  }
  .flow-btn.active .flow-icon {
    background: var(--cyan);
    box-shadow: 0 0 8px var(--cyan);
    animation: pulse-dot 1.5s ease-in-out infinite;
  }

  .topo-body {
    display: grid; grid-template-columns: 1fr 1fr; gap: 12px;
    transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .topo-body.expanded {
    grid-template-columns: 1fr;
  }

  /* Neural graph fullscreen overlay */
  .neural-fs-overlay {
    position: fixed; inset: 0; z-index: 2000;
    background: var(--bg); display: flex; flex-direction: column;
    animation: fadeInOverlay 0.2s ease;
  }
  @keyframes fadeInOverlay { from { opacity: 0; } to { opacity: 1; } }
  .neural-fs-header {
    display: flex; align-items: center; gap: 16px;
    padding: 12px 20px; background: var(--bg-card);
    border-bottom: 1px solid var(--border); flex-shrink: 0;
  }
  .neural-fs-title { font-size: 16px; font-weight: 600; color: var(--fg); }
  .neural-fs-stats {
    display: flex; gap: 16px; margin-left: auto;
    font-family: var(--mono); font-size: 11px; color: var(--dim);
  }
  .neural-fs-stats .val { color: var(--cyan); font-weight: 700; }
  .neural-fs-close {
    display: inline-flex; align-items: center; gap: 4px;
    padding: 6px 14px; margin-left: 16px; font-size: 11px; font-weight: 600;
    border: 1px solid var(--border-strong); border-radius: 20px;
    background: var(--surface); color: var(--text-dim);
    cursor: pointer; transition: all 0.2s ease; font-family: var(--font);
  }
  .neural-fs-close:hover { border-color: var(--red); color: var(--red); }
  .neural-fs-body { flex: 1; overflow: hidden; }
  .neural-fs-body canvas { width: 100%; height: 100%; }
  .neural-fs-legend {
    padding: 8px 20px; border-top: 1px solid var(--border);
    background: var(--bg-card); font-size: 10px; color: var(--dim);
    display: flex; gap: 16px; align-items: center; flex-shrink: 0;
  }
  .neural-fs-legend .leg-item { display: inline-flex; align-items: center; gap: 4px; }
  .neural-fs-legend .leg-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }

  .topo-wrap {
    background: var(--surface);
    backdrop-filter: var(--glass-blur);
    border: 1px solid var(--border);
    border-radius: var(--radius); padding: 20px;
    box-shadow: var(--shadow-sm);
    overflow: hidden;
    animation: card-in 0.5s ease both;
    transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .topo-body.expanded .topo-wrap {
    border-color: var(--cyan);
    box-shadow: var(--shadow-lg), 0 0 40px rgba(6,182,212,0.08), inset 0 0 60px rgba(6,182,212,0.03);
  }
  .topo-wrap svg { width: 100%; display: block; transition: all 0.5s ease; }
  .topo-wrap svg text { text-anchor: middle; font-family: var(--font); }

  .topo-stations {
    transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
    overflow: hidden;
  }
  .topo-body.expanded .topo-stations {
    max-height: 0; opacity: 0; padding: 0; margin: 0; pointer-events: none;
  }

  .topo-legend {
    display: flex; justify-content: center; gap: 20px;
    margin-top: 14px; font-size: 11px; color: var(--text-dim); font-weight: 500;
  }
  .topo-legend .leg-item {
    display: flex; align-items: center; gap: 6px;
  }
  .topo-legend .leg-line {
    width: 22px; height: 3px; border-radius: 2px;
  }

  /* Expanded flow stats bar */
  .flow-stats {
    display: flex; justify-content: center; gap: 28px; margin-top: 12px;
    font-size: 11px; color: var(--text-dim); opacity: 0;
    max-height: 0; overflow: hidden;
    transition: all 0.4s ease 0.2s;
  }
  .topo-body.expanded .flow-stats {
    opacity: 1; max-height: 40px;
  }
  .flow-stat {
    display: flex; align-items: center; gap: 6px;
  }
  .flow-stat .fs-dot {
    width: 6px; height: 6px; border-radius: 50%;
  }
  .flow-stat .fs-val {
    font-family: var(--font-mono); font-weight: 600; font-size: 12px;
    color: var(--text);
  }

  /* Quick links */
  .link-card {
    text-decoration: none; color: inherit;
    display: block;
  }
  .link-card .card:hover {
    border-color: var(--blue);
    box-shadow: var(--shadow-md), 0 0 0 1px var(--blue-soft);
  }

  /* Footer */
  .footer {
    margin-top: 32px; padding: 16px 0 8px;
    border-top: 1px solid var(--border);
    font-size: 11px; color: var(--text-dim); text-align: center;
    font-weight: 400;
  }
  .footer a { color: var(--blue); text-decoration: none; font-weight: 500; }
  .footer a:hover { text-decoration: underline; }

  /* Animations */
  @keyframes fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  @keyframes count-up {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes shimmer {
    0% { background-position: -200% center; }
    100% { background-position: 200% center; }
  }
  .value-update {
    animation: count-up 0.3s ease;
  }

  /* Responsive */
  @media (max-width: 1024px) {
    .g6 { grid-template-columns: repeat(3, 1fr); }
    .g4 { grid-template-columns: repeat(2, 1fr); }
  }
  @media (max-width: 768px) {
    .container { padding: 12px 16px; }
    .g6 { grid-template-columns: repeat(2, 1fr); }
    .g3, .g2, .g2w { grid-template-columns: 1fr; }
    header { flex-direction: column; gap: 12px; align-items: flex-start; }
    .header-right { width: 100%; justify-content: space-between; }
    .card .value { font-size: 22px; }
  }
  @media (max-width: 480px) {
    .g6 { grid-template-columns: 1fr; }
    .g4 { grid-template-columns: 1fr; }
  }
</style>
</head>
<body>
<div class="container">

<header>
  <div class="brand">
    <div class="brand-icon">&#9670;</div>
    <h1><span>OpenClaw</span> Hive Monitor</h1>
  </div>
  <div class="header-right">
    <div class="live-badge">
      <div id="status-dot"></div>
      <span id="last-update">Connecting...</span>
    </div>
    <button class="theme-toggle" id="theme-toggle" title="Toggle theme">&#9790;</button>
  </div>
</header>

<div id="error-banner"></div>

<!-- System Status -->
<div class="section-title">System Status</div>
<div class="grid g6" id="system-status">
  <div class="card"><div class="accent-line" style="background:var(--green)"></div><div class="label">Uptime</div><div class="value v-green" id="m-uptime">--</div></div>
  <div class="card"><div class="accent-line" style="background:var(--green)"></div><div class="label">Stations Online</div><div class="value v-green" id="m-stations-online">--</div></div>
  <div class="card" id="card-wan"><div class="accent-line" style="background:var(--blue)"></div><div class="label">WAN Status</div><div class="value" id="m-wan-status">--</div></div>
  <div class="card" id="card-alerts"><div class="accent-line" style="background:var(--green)"></div><div class="label">Active Alerts</div><div class="value" id="m-alerts">--</div></div>
  <div class="card" id="card-julie"><div class="accent-line" style="background:var(--purple)"></div><div class="label">Julie</div><div class="value" id="m-julie">--</div><div class="sub" id="m-julie-sub"></div></div>
  <div class="card"><div class="accent-line" style="background:var(--blue)"></div><div class="label">Models Running</div><div class="value v-blue" id="m-models">--</div><div class="sub" id="m-models-sub"></div></div>
</div>

<!-- Network Topology -->
<div class="topo-section">
  <div class="topo-header">
    <div class="section-title">Network Topology</div>
    <button class="flow-btn" id="flow-toggle"><span class="flow-icon"></span> Flow</button>
  </div>
  <div class="topo-body" id="topo-body">
    <div class="topo-wrap" id="topology-container"></div>
    <div class="topo-stations">
      <div style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.6px;color:var(--text-dim);margin-bottom:10px">Station Health</div>
      <div class="station-grid" id="station-list"></div>
    </div>
  </div>
</div>

<!-- Network Health -->
<div class="section-title">Network Health</div>
<div class="grid g3" id="unifi-health">
  <div class="card"><div class="accent-line" style="background:var(--blue)"></div><div class="label">WAN</div><div class="sub" id="uf-wan">Fetching...</div></div>
  <div class="card"><div class="accent-line" style="background:var(--green)"></div><div class="label">LAN</div><div class="sub" id="uf-lan">Fetching...</div></div>
  <div class="card"><div class="accent-line" style="background:var(--purple)"></div><div class="label">WLAN</div><div class="sub" id="uf-wlan">Fetching...</div></div>
</div>
<div class="card" style="margin-top:12px">
  <div class="label">Connected Clients (top 10 by traffic)</div>
  <table class="mini" id="clients-table">
    <thead><tr><th>Host</th><th>IP</th><th>Type</th><th>RX</th><th>TX</th></tr></thead>
    <tbody id="clients-body"><tr><td colspan="5" class="sub">Loading...</td></tr></tbody>
  </table>
</div>

<!-- Dual-WAN -->
<div class="section-title">Dual-WAN</div>
<div class="grid g4" id="wan-section">
  <div class="card"><div class="accent-line" style="background:var(--blue)"></div><div class="label">Active Path</div><div id="wan-paths"></div></div>
  <div class="card"><div class="label">WAN Latency</div><div id="wan-latency" class="sub">--</div></div>
  <div class="card"><div class="label">Packet Loss</div><div id="wan-loss" class="sub">--</div></div>
  <div class="card"><div class="accent-line" style="background:var(--blue)"></div><div class="label">Path Switches</div><div class="value v-blue" id="m-switches">--</div></div>
</div>

<!-- Hotel Scraper -->
<div class="section-title">Hotel Scraper</div>
<div class="grid g6" id="scraper-section">
  <div class="card"><div class="accent-line" style="background:var(--cyan)"></div><div class="label">Sources</div><div class="value v-cyan" id="hs-sources">--</div></div>
  <div class="card"><div class="accent-line" style="background:var(--blue)"></div><div class="label">Areas</div><div class="value v-blue" id="hs-areas">--</div></div>
  <div class="card" id="card-hs-sched"><div class="accent-line" style="background:var(--green)"></div><div class="label">Scheduler</div><div class="value" id="hs-scheduler">--</div><div class="sub" id="hs-sched-sub"></div></div>
  <div class="card"><div class="accent-line" style="background:var(--purple)"></div><div class="label">Active Timers</div><div class="value v-purple" id="hs-timers">--</div></div>
  <div class="card"><div class="accent-line" style="background:var(--orange)"></div><div class="label">Jobs</div><div class="value v-orange" id="hs-jobs">--</div></div>
  <div class="card" id="card-hs-pw"><div class="accent-line" style="background:var(--green)"></div><div class="label">Playwright</div><div class="value" id="hs-playwright">--</div></div>
</div>
<div class="card" style="margin-top:12px">
  <div class="label">Recent Jobs</div>
  <table class="mini" id="hs-jobs-table">
    <thead><tr><th>ID</th><th>Status</th><th>Sources</th><th>Prices</th><th>Duration</th></tr></thead>
    <tbody id="hs-jobs-body"><tr><td colspan="5" class="sub">Loading...</td></tr></tbody>
  </table>
</div>

<!-- Activity -->
<div class="section-title">Activity &amp; Executions</div>
<div class="grid g3">
  <div class="card"><div class="accent-line" style="background:var(--orange)"></div><div class="label">Total Executions</div><div class="value v-orange" id="m-exec-total">--</div></div>
  <div class="card" id="card-exec-rate"><div class="label">Success Rate</div>
    <div class="bar-container"><div class="bar"><div class="fill" id="exec-bar" style="width:0;background:var(--green)"></div></div><div class="bar-val" id="m-exec-rate">--%</div></div>
  </div>
  <div class="card"><div class="accent-line" style="background:var(--blue)"></div><div class="label">Recent Commands</div><div class="value v-blue" id="m-recent-cmds">--</div></div>
</div>
<div class="card" style="margin-top:12px">
  <div class="label">Recent Executions</div>
  <table class="mini" id="exec-table">
    <thead><tr><th>Command</th><th>Result</th><th>Latency</th></tr></thead>
    <tbody id="exec-body"><tr><td colspan="3" class="sub">Loading...</td></tr></tbody>
  </table>
</div>

<!-- Neural Graph -->
<div class="section-title">Neural Graph</div>
<div class="grid g2w" id="neural-section">
  <div class="card" style="min-height:340px">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
      <div class="label" style="margin:0">Graph Topology</div>
      <button class="flow-btn" id="neural-fs-toggle">\u26F6 Full Screen</button>
    </div>
    <div id="neural-graph-container" style="width:100%;height:280px;position:relative;overflow:hidden;border-radius:var(--radius-sm);background:var(--bg-subtle)">
      <canvas id="neural-canvas" style="width:100%;height:100%"></canvas>
    </div>
  </div>
  <div>
    <div class="grid" style="gap:12px">
      <div class="card"><div class="accent-line" style="background:var(--purple)"></div><div class="label">Maturation Phase</div><div class="value v-purple" id="ng-phase">--</div></div>
      <div class="card"><div class="accent-line" style="background:var(--cyan)"></div><div class="label">Graph Nodes</div><div class="value v-cyan" id="ng-nodes">--</div><div class="sub" id="ng-nodes-sub"></div></div>
      <div class="card"><div class="accent-line" style="background:var(--blue)"></div><div class="label">Graph Edges</div><div class="value v-blue" id="ng-edges">--</div><div class="sub" id="ng-edges-sub"></div></div>
      <div class="card"><div class="accent-line" style="background:var(--orange)"></div><div class="label">Executions</div><div class="value v-orange" id="ng-executions">--</div></div>
      <div class="card"><div class="accent-line" style="background:var(--green)"></div><div class="label">Avg Fitness</div>
        <div class="bar-container"><div class="bar"><div class="fill" id="ng-fitness-bar" style="width:0;background:var(--green)"></div></div><div class="bar-val" id="ng-fitness">--</div></div>
      </div>
      <div class="card" id="card-ng-convex"><div class="accent-line" style="background:var(--green)"></div><div class="label">Convex Backend</div><div class="value" id="ng-convex">--</div></div>
    </div>
  </div>
</div>

<!-- AI Performance -->
<div class="section-title">AI Model Performance</div>
<div class="grid g2w">
  <div class="card">
    <div class="label">Performance by Model &amp; Task</div>
    <table class="perf-table" id="perf-table">
      <thead><tr><th>Model</th><th>Task</th><th>Success Rate</th><th>Avg Latency</th></tr></thead>
      <tbody id="perf-body"></tbody>
    </table>
  </div>
  <div class="card"><div class="accent-line" style="background:var(--purple)"></div><div class="label">Perf DB Records</div><div class="value v-purple" id="m-perf-total">--</div></div>
</div>

<!-- Alerts -->
<div class="section-title">Alerts</div>
<div class="card">
  <div class="alert-list" id="alert-list"><span class="sub">No alerts</span></div>
</div>

<!-- Quick Links -->
<div class="section-title">Quick Links</div>
<div class="grid g4">
  <a class="link-card" href="/grafana" target="_blank"><div class="card"><div class="label" style="color:var(--orange)">&#9733; Grafana</div><div class="sub">Unified dashboards</div></div></a>
  <a class="link-card" href="/#/topology"><div class="card"><div class="label" style="color:var(--blue)">&#9672; Portal Topology</div><div class="sub">Full interactive map</div></div></a>
  <a class="link-card" href="/#/hotel-scraper"><div class="card"><div class="label" style="color:var(--cyan)">&#9881; Hotel Scraper</div><div class="sub">Scraper dashboard</div></div></a>
  <a class="link-card" href="/#/network"><div class="card"><div class="label" style="color:var(--green)">&#9635; Network</div><div class="sub">UniFi devices &amp; clients</div></div></a>
  <a class="link-card" href="/#/neural-graph"><div class="card"><div class="label" style="color:var(--purple)">&#10038; Neural Graph</div><div class="sub">AI evolution &amp; topology</div></div></a>
</div>

<div class="footer">
  OpenClaw Hive Monitor &middot; Station: IOT-HUB &middot;
  <a href="/metrics">Raw Metrics</a> &middot;
  <a href="/api/network/dashboard">JSON Dashboard</a>
</div>

</div><!-- .container -->

<script>
const REFRESH_MS = 30000;

// ---------------------------------------------------------------------------
// Theme handling
// ---------------------------------------------------------------------------
(function initTheme() {
  const saved = localStorage.getItem('hive-theme');
  if (saved === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
  document.getElementById('theme-toggle').addEventListener('click', () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    if (isDark) {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('hive-theme', 'light');
      document.getElementById('theme-toggle').textContent = '\\u263E';
    } else {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('hive-theme', 'dark');
      document.getElementById('theme-toggle').textContent = '\\u2600';
    }
  });
  if (saved === 'dark') document.getElementById('theme-toggle').textContent = '\\u2600';
})();

// ---------------------------------------------------------------------------
// Topology definitions
// ---------------------------------------------------------------------------
const TOPO_NODES = [
  { id: "UDM-Pro", label: "UDM Pro", ip: "10.1.8.1", role: "gateway", x: 400, y: 50, icon: "\\u25C6" },
  { id: "HR02-5G", label: "HR02 5G", ip: "192.168.128.1", role: "modem", x: 150, y: 50, icon: "\\u25B2" },
  { id: "Julie", label: "Julie", ip: "10.1.8.143", role: "ai", x: 150, y: 180, icon: "\\u2605" },
  { id: "Caesar", label: "Caesar", ip: "10.1.8.82", role: "intel", x: 500, y: 180, icon: "\\u25CF" },
  { id: "IOT-HUB", label: "IOT-HUB", ip: "10.1.8.158", role: "hub", x: 350, y: 180, icon: "\\u2B22" },
  { id: "BRAVIA", label: "BRAVIA TV", ip: "10.1.8.194", role: "device", x: 550, y: 300, icon: "\\u25A0" },
];

const TOPO_LINKS = [
  { from: "UDM-Pro", to: "IOT-HUB", type: "wired" },
  { from: "UDM-Pro", to: "Julie", type: "wired" },
  { from: "UDM-Pro", to: "Caesar", type: "wired" },
  { from: "UDM-Pro", to: "BRAVIA", type: "wired" },
  { from: "HR02-5G", to: "IOT-HUB", type: "wireless" },
  { from: "Julie", to: "IOT-HUB", type: "api" },
  { from: "IOT-HUB", to: "Caesar", type: "api" },
  { from: "IOT-HUB", to: "BRAVIA", type: "api" },
];

const ROLE_COLORS = {
  gateway: "var(--node-gateway)", modem: "var(--node-modem)", ai: "var(--node-ai)",
  hub: "var(--node-hub)", worker: "var(--node-worker)", intel: "var(--node-intel)",
  device: "var(--node-device)", decommissioned: "var(--node-decom)",
};

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------
function esc(s) {
  if (s == null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function fmtBytes(b) {
  if (b == null || isNaN(b)) return '--';
  if (b < 1024) return b + ' B';
  if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
  if (b < 1073741824) return (b / 1048576).toFixed(1) + ' MB';
  return (b / 1073741824).toFixed(2) + ' GB';
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

function setVal(id, text) {
  const el = document.getElementById(id);
  if (!el) return;
  if (el.textContent !== String(text)) {
    el.textContent = text;
    el.classList.remove('value-update');
    void el.offsetWidth;
    el.classList.add('value-update');
  }
}

function setAccent(cardId, color) {
  const el = document.getElementById(cardId);
  if (!el) return;
  const line = el.querySelector('.accent-line');
  if (line) line.style.background = color;
}

// ---------------------------------------------------------------------------
// Prometheus parser
// ---------------------------------------------------------------------------
function parsePrometheus(text) {
  const metrics = {};
  for (const line of text.split('\\n')) {
    if (!line || line.startsWith('#')) continue;
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

// ---------------------------------------------------------------------------
// Topology SVG renderer with animated data-flow particles
// ---------------------------------------------------------------------------
let topoAnimFrame = null;
const particles = [];
let flowExpanded = false;
let lastNodeMap = null;
let lastReachableMap = {};
let lastLatencyMap = {};

// Flow toggle
document.getElementById('flow-toggle').addEventListener('click', () => {
  flowExpanded = !flowExpanded;
  const btn = document.getElementById('flow-toggle');
  const body = document.getElementById('topo-body');
  btn.classList.toggle('active', flowExpanded);
  body.classList.toggle('expanded', flowExpanded);
  // Re-render topology with new dimensions
  renderTopology(lastReachableMap, lastLatencyMap);
});

function renderTopology(reachableMap, latencyMap) {
  const container = document.getElementById('topology-container');
  if (!container) return;

  lastReachableMap = reachableMap;
  lastLatencyMap = latencyMap;

  const expanded = flowExpanded;
  const W = expanded ? 1100 : 800;
  const H = expanded ? 520 : 370;
  const pad = expanded ? 60 : 25;
  const nodeR = expanded ? 34 : 26;

  const nodes = TOPO_NODES.map(n => ({
    ...n,
    sx: n.x * (W - 2 * pad) / 700 + pad,
    sy: n.y * (H - 2 * pad) / 340 + pad,
    up: reachableMap[n.ip] !== false && reachableMap[n.ip] !== 0,
    lat: latencyMap[n.ip],
  }));

  const nodeMap = {};
  for (const n of nodes) nodeMap[n.id] = n;
  lastNodeMap = nodeMap;

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const textFill = isDark ? '#f5f5fa' : '#1a1a2e';
  const dimFill = isDark ? '#8b8fa8' : '#6b7084';

  let svg = '<svg id="topo-svg" viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg">';

  // Defs
  svg += '<defs>';
  svg += '<filter id="glow-up" x="-50%" y="-50%" width="200%" height="200%">';
  svg += '<feGaussianBlur stdDeviation="' + (expanded ? 6 : 4) + '" result="b"/><feComposite in="SourceGraphic" in2="b" operator="over"/></filter>';
  svg += '<filter id="glow-down" x="-50%" y="-50%" width="200%" height="200%">';
  svg += '<feGaussianBlur stdDeviation="3" result="b"/><feComposite in="SourceGraphic" in2="b" operator="over"/></filter>';
  // Link glow for expanded mode
  if (expanded) {
    svg += '<filter id="link-glow" x="-20%" y="-20%" width="140%" height="140%">';
    svg += '<feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>';
    svg += '<linearGradient id="flow-grad-green" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="' + (isDark ? '#4ade80' : '#22c55e') + '" stop-opacity="0"/><stop offset="50%" stop-color="' + (isDark ? '#4ade80' : '#22c55e') + '" stop-opacity="0.6"/><stop offset="100%" stop-color="' + (isDark ? '#4ade80' : '#22c55e') + '" stop-opacity="0"/></linearGradient>';
    svg += '<linearGradient id="flow-grad-blue" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="' + (isDark ? '#60a5fa' : '#3b82f6') + '" stop-opacity="0"/><stop offset="50%" stop-color="' + (isDark ? '#60a5fa' : '#3b82f6') + '" stop-opacity="0.6"/><stop offset="100%" stop-color="' + (isDark ? '#60a5fa' : '#3b82f6') + '" stop-opacity="0"/></linearGradient>';
    svg += '<linearGradient id="flow-grad-purple" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="' + (isDark ? '#c084fc' : '#a855f7') + '" stop-opacity="0"/><stop offset="50%" stop-color="' + (isDark ? '#c084fc' : '#a855f7') + '" stop-opacity="0.6"/><stop offset="100%" stop-color="' + (isDark ? '#c084fc' : '#a855f7') + '" stop-opacity="0"/></linearGradient>';
  }
  svg += '</defs>';

  // Background grid in expanded mode
  if (expanded) {
    const gridColor = isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)';
    for (let gx = 0; gx <= W; gx += 40) {
      svg += '<line x1="' + gx + '" y1="0" x2="' + gx + '" y2="' + H + '" stroke="' + gridColor + '" stroke-width="1"/>';
    }
    for (let gy = 0; gy <= H; gy += 40) {
      svg += '<line x1="0" y1="' + gy + '" x2="' + W + '" y2="' + gy + '" stroke="' + gridColor + '" stroke-width="1"/>';
    }
  }

  // Links
  for (const link of TOPO_LINKS) {
    const f = nodeMap[link.from];
    const t = nodeMap[link.to];
    if (!f || !t) continue;
    const bothUp = f.up && t.up;

    if (expanded && bothUp) {
      // Glowing animated link in expanded mode
      const gradId = link.type === 'api' ? 'flow-grad-purple' : link.type === 'wireless' ? 'flow-grad-blue' : 'flow-grad-green';
      svg += '<line x1="' + f.sx + '" y1="' + f.sy + '" x2="' + t.sx + '" y2="' + t.sy + '" stroke="url(#' + gradId + ')" stroke-width="6" opacity="0.4" filter="url(#link-glow)">';
      svg += '<animate attributeName="opacity" values="0.2;0.5;0.2" dur="' + (2 + Math.random()) + 's" repeatCount="indefinite"/>';
      svg += '</line>';
    }

    const linkColor = bothUp ? (isDark ? 'rgba(74,222,128,0.35)' : 'rgba(34,197,94,0.3)') : (isDark ? 'rgba(248,113,113,0.3)' : 'rgba(239,68,68,0.2)');
    let dash = '';
    if (link.type === 'wireless') dash = ' stroke-dasharray="8 5"';
    if (link.type === 'api') dash = ' stroke-dasharray="3 5"';
    const lw = expanded ? 2.5 : 2;
    svg += '<line class="topo-link" data-from="' + link.from + '" data-to="' + link.to + '" data-type="' + link.type + '" ';
    svg += 'x1="' + f.sx + '" y1="' + f.sy + '" x2="' + t.sx + '" y2="' + t.sy + '" ';
    svg += 'stroke="' + linkColor + '" stroke-width="' + lw + '"' + dash + '/>';

    // Data throughput label on link midpoint in expanded mode
    if (expanded && bothUp) {
      const mx = (f.sx + t.sx) / 2;
      const my = (f.sy + t.sy) / 2 - 8;
      const typeLabel = link.type === 'wired' ? '1G' : link.type === 'wireless' ? '5G' : 'REST';
      svg += '<text x="' + mx + '" y="' + my + '" font-size="8" fill="' + dimFill + '" text-anchor="middle" font-weight="500" opacity="0.7">' + typeLabel + '</text>';
    }
  }

  // Particle + trail layer
  svg += '<g id="topo-trails"></g>';
  svg += '<g id="topo-particles"></g>';

  // Nodes
  for (const node of nodes) {
    const r = nodeR;
    const roleColor = ROLE_COLORS[node.role] || 'var(--node-worker)';
    const fillOpacity = node.up ? (expanded ? 0.15 : 0.12) : 0.08;
    const strokeOpacity = node.up ? 0.8 : 0.4;
    const filter = node.up ? 'url(#glow-up)' : 'url(#glow-down)';
    const nodeFill = node.up ? roleColor : 'var(--red)';

    // Pulse rings
    if (node.up && node.role !== 'decommissioned') {
      const ringCount = expanded ? 2 : 1;
      for (let ri = 0; ri < ringCount; ri++) {
        const delay = ri * 1.5;
        svg += '<circle cx="' + node.sx + '" cy="' + node.sy + '" r="' + (r + 4) + '" fill="none" stroke="' + roleColor + '" stroke-width="' + (expanded ? 1.5 : 1) + '" opacity="0.3">';
        svg += '<animate attributeName="r" values="' + (r + 2) + ';' + (r + (expanded ? 18 : 10)) + ';' + (r + 2) + '" dur="' + (expanded ? '2.5' : '3') + 's" begin="' + delay + 's" repeatCount="indefinite"/>';
        svg += '<animate attributeName="opacity" values="0.35;0;0.35" dur="' + (expanded ? '2.5' : '3') + 's" begin="' + delay + 's" repeatCount="indefinite"/>';
        svg += '</circle>';
      }
    }

    svg += '<g filter="' + filter + '">';
    svg += '<circle cx="' + node.sx + '" cy="' + node.sy + '" r="' + r + '" ';
    svg += 'fill="' + nodeFill + '" fill-opacity="' + fillOpacity + '" ';
    svg += 'stroke="' + nodeFill + '" stroke-width="' + (expanded ? 2 : 1.5) + '" stroke-opacity="' + strokeOpacity + '"/>';
    svg += '<text x="' + node.sx + '" y="' + (node.sy + 1) + '" dominant-baseline="central" ';
    svg += 'fill="' + nodeFill + '" font-size="' + (expanded ? 18 : 15) + '" font-weight="600">' + node.icon + '</text>';
    svg += '</g>';

    // Labels
    const ly = node.sy + r + (expanded ? 20 : 16);
    svg += '<text x="' + node.sx + '" y="' + ly + '" font-size="' + (expanded ? 13 : 11) + '" font-weight="600" fill="' + textFill + '">' + esc(node.label) + '</text>';
    svg += '<text x="' + node.sx + '" y="' + (ly + (expanded ? 16 : 14)) + '" font-size="' + (expanded ? 10 : 9) + '" fill="' + dimFill + '">' + esc(node.ip) + '</text>';

    // Status badge in expanded mode
    if (expanded) {
      const badgeY = ly + 30;
      const status = node.up ? 'ONLINE' : 'OFFLINE';
      const badgeColor = node.up ? (isDark ? '#4ade80' : '#22c55e') : (isDark ? '#f87171' : '#ef4444');
      svg += '<rect x="' + (node.sx - 22) + '" y="' + (badgeY - 8) + '" width="44" height="16" rx="4" fill="' + badgeColor + '" fill-opacity="0.15"/>';
      svg += '<text x="' + node.sx + '" y="' + (badgeY + 2) + '" font-size="7" font-weight="700" fill="' + badgeColor + '" text-anchor="middle" letter-spacing="0.5">' + status + '</text>';
    }

    // Latency
    if (node.lat != null) {
      svg += '<text x="' + node.sx + '" y="' + (node.sy - r - (expanded ? 12 : 8)) + '" font-size="' + (expanded ? 11 : 9) + '" fill="' + (isDark ? '#22d3ee' : '#06b6d4') + '" font-weight="600">' + node.lat.toFixed(0) + 'ms</text>';
    }
  }

  svg += '</svg>';

  // Legend
  svg += '<div class="topo-legend">';
  svg += '<div class="leg-item"><div class="leg-line" style="background:var(--green)"></div>Wired</div>';
  svg += '<div class="leg-item"><div class="leg-line" style="background:none;border-top:2px dashed var(--green)"></div>Wireless</div>';
  svg += '<div class="leg-item"><div class="leg-line" style="background:none;border-top:2px dotted var(--purple)"></div>API</div>';
  svg += '</div>';

  // Flow stats (visible only in expanded)
  const onlineCount = nodes.filter(n => n.up).length;
  const activeLinks = TOPO_LINKS.filter(l => {
    const a = nodeMap[l.from]; const b = nodeMap[l.to];
    return a && b && a.up && b.up;
  }).length;
  svg += '<div class="flow-stats" id="flow-stats">';
  svg += '<div class="flow-stat"><div class="fs-dot" style="background:var(--green)"></div>Nodes Online: <span class="fs-val">' + onlineCount + '/' + nodes.length + '</span></div>';
  svg += '<div class="flow-stat"><div class="fs-dot" style="background:var(--cyan)"></div>Active Links: <span class="fs-val">' + activeLinks + '/' + TOPO_LINKS.length + '</span></div>';
  svg += '<div class="flow-stat"><div class="fs-dot" style="background:var(--purple)"></div>Particles: <span class="fs-val" id="particle-count">0</span></div>';
  svg += '</div>';

  container.innerHTML = svg;

  initParticles(nodeMap);
}

function initParticles(nodeMap) {
  if (topoAnimFrame) cancelAnimationFrame(topoAnimFrame);
  particles.length = 0;

  const expanded = flowExpanded;
  const basePer = expanded ? 6 : 3;
  const apiPer = expanded ? 4 : 2;

  for (const link of TOPO_LINKS) {
    const f = nodeMap[link.from];
    const t = nodeMap[link.to];
    if (!f || !t || !f.up || !t.up) continue;

    const count = link.type === 'api' ? apiPer : basePer;
    for (let i = 0; i < count; i++) {
      particles.push({
        fx: f.sx, fy: f.sy,
        tx: t.sx, ty: t.sy,
        progress: i / count,
        speed: expanded ? (0.002 + Math.random() * 0.003) : (0.003 + Math.random() * 0.002),
        size: expanded ? (link.type === 'api' ? 4 : 4.5) : (link.type === 'api' ? 2.5 : 3),
        type: link.type,
        trail: expanded ? [] : null,
      });
    }
  }

  const pc = document.getElementById('particle-count');
  if (pc) pc.textContent = particles.length;

  animateParticles();
}

function animateParticles() {
  const g = document.getElementById('topo-particles');
  if (!g) return;

  const trailG = document.getElementById('topo-trails');
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const expanded = flowExpanded;
  let circles = '';
  let trails = '';

  for (const p of particles) {
    p.progress += p.speed;
    if (p.progress > 1) p.progress -= 1;

    const x = p.fx + (p.tx - p.fx) * p.progress;
    const y = p.fy + (p.ty - p.fy) * p.progress;
    const alpha = Math.sin(p.progress * Math.PI);
    const color = p.type === 'api'
      ? (isDark ? '192,132,252' : '168,85,247')
      : p.type === 'wireless'
        ? (isDark ? '96,165,250' : '59,130,246')
        : (isDark ? '74,222,128' : '34,197,94');

    // Particle glow in expanded mode
    if (expanded) {
      circles += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="' + (p.size * 2.5) + '" fill="rgba(' + color + ',' + (alpha * 0.12).toFixed(2) + ')"/>';
    }

    circles += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="' + p.size + '" fill="rgba(' + color + ',' + (alpha * 0.85).toFixed(2) + ')"/>';

    // Trail in expanded mode
    if (expanded && p.trail) {
      p.trail.push({ x, y });
      if (p.trail.length > 8) p.trail.shift();
      if (p.trail.length >= 2) {
        for (let ti = 0; ti < p.trail.length - 1; ti++) {
          const ta = (ti / p.trail.length) * alpha * 0.3;
          const tw = (ti / p.trail.length) * p.size * 0.6;
          trails += '<circle cx="' + p.trail[ti].x.toFixed(1) + '" cy="' + p.trail[ti].y.toFixed(1) + '" r="' + tw.toFixed(1) + '" fill="rgba(' + color + ',' + ta.toFixed(2) + ')"/>';
        }
      }
    }
  }

  if (trailG) trailG.innerHTML = trails;
  g.innerHTML = circles;

  topoAnimFrame = requestAnimationFrame(animateParticles);
}

// ---------------------------------------------------------------------------
// Render Prometheus metrics
// ---------------------------------------------------------------------------
function renderMetrics(metrics) {
  // Uptime
  const uptime = getScalar(metrics, 'hivemind_uptime_seconds');
  setVal('m-uptime', fmtDuration(uptime));

  // Stations
  const stations = getAll(metrics, 'hivemind_station_reachable');
  const latencies = getAll(metrics, 'hivemind_station_latency_ms');
  const latencyMap = {};
  for (const l of latencies) latencyMap[l.labels.ip || l.labels.station] = l.value;
  const reachableMap = {};
  for (const s of stations) reachableMap[s.labels.ip || s.labels.station] = s.value;

  const online = stations.filter(s => s.value === 1).length;
  const total = stations.length;
  setVal('m-stations-online', online + '/' + total);

  const stationList = document.getElementById('station-list');
  stationList.innerHTML = stations.map((s, i) => {
    const up = s.value === 1;
    const lat = latencyMap[s.labels.ip];
    return '<div class="station" style="animation-delay:' + (i * 0.05) + 's">' +
      '<div class="dot ' + (up ? 'up' : 'down') + '"></div>' +
      '<div class="name">' + esc(s.labels.station) + '</div>' +
      (lat != null ? '<div class="latency">' + lat.toFixed(0) + 'ms</div>' : '') +
      '</div>';
  }).join('');

  // Topology
  renderTopology(reachableMap, latencyMap);

  // WAN
  const wanPaths = getAll(metrics, 'hivemind_wan_active_path');
  const failover = getScalar(metrics, 'hivemind_wan_failover_active');
  const switches = getScalar(metrics, 'hivemind_wan_switch_count_total');

  if (failover === 1) {
    setVal('m-wan-status', 'FAILOVER');
    document.getElementById('m-wan-status').className = 'value v-red';
    setAccent('card-wan', 'var(--red)');
  } else if (failover === 0) {
    setVal('m-wan-status', 'NORMAL');
    document.getElementById('m-wan-status').className = 'value v-green';
    setAccent('card-wan', 'var(--green)');
  }

  setVal('m-switches', switches != null ? switches : '--');

  const wanPathsEl = document.getElementById('wan-paths');
  wanPathsEl.innerHTML = wanPaths.map(p => {
    const active = p.value === 1;
    return '<span class="wan-path ' + (active ? 'active' : 'standby') + '">' +
      (active ? '\\u25CF ' : '\\u25CB ') + esc(p.labels.path_id) + '</span> ';
  }).join('');

  // WAN quality
  const wanLat = getAll(metrics, 'hivemind_wan_quality_latency_ms');
  const wanLoss = getAll(metrics, 'hivemind_wan_quality_packet_loss_pct');
  document.getElementById('wan-latency').innerHTML = wanLat.map(l =>
    '<div style="margin:2px 0">' + esc(l.labels.path_id) + ': <strong>' + l.value.toFixed(1) + ' ms</strong></div>'
  ).join('') || '--';
  document.getElementById('wan-loss').innerHTML = wanLoss.map(l =>
    '<div style="margin:2px 0">' + esc(l.labels.path_id) + ': <strong>' + l.value.toFixed(2) + '%</strong></div>'
  ).join('') || '--';

  // Alerts
  const alertCount = getScalar(metrics, 'hivemind_alert_active_count');
  setVal('m-alerts', alertCount != null ? alertCount : '--');
  if (alertCount > 0) {
    document.getElementById('m-alerts').className = alertCount >= 5 ? 'value v-red' : 'value v-yellow';
    setAccent('card-alerts', alertCount >= 5 ? 'var(--red)' : 'var(--yellow)');
  } else {
    document.getElementById('m-alerts').className = 'value v-green';
    setAccent('card-alerts', 'var(--green)');
  }

  const alerts = getAll(metrics, 'hivemind_alert_count');
  const alertListEl = document.getElementById('alert-list');
  if (alerts.length > 0) {
    alertListEl.innerHTML = alerts.map(a => {
      const sev = a.labels.severity || 'info';
      return '<div class="alert-row">' +
        '<span class="alert-badge ' + esc(sev) + '">' + esc(sev) + '</span>' +
        '<span>' + esc(a.labels.type) + '</span>' +
        '<span style="margin-left:auto;color:var(--text-dim);font-family:var(--font-mono);font-size:11px">' + a.value + '</span>' +
        '</div>';
    }).join('');
  } else {
    alertListEl.innerHTML = '<span class="sub">No alerts</span>';
  }

  // Julie
  const julie = getScalar(metrics, 'hivemind_julie_registered');
  const heartbeat = getScalar(metrics, 'hivemind_julie_last_heartbeat_age_seconds');
  if (julie === 1) {
    setVal('m-julie', 'REGISTERED');
    document.getElementById('m-julie').className = 'value v-green';
    setAccent('card-julie', 'var(--green)');
  } else if (julie === 0) {
    setVal('m-julie', 'UNREGISTERED');
    document.getElementById('m-julie').className = 'value v-red';
    setAccent('card-julie', 'var(--red)');
  }
  if (heartbeat != null) {
    document.getElementById('m-julie-sub').textContent = 'Heartbeat: ' + fmtDuration(heartbeat) + ' ago';
  }

  // Models
  const installed = getScalar(metrics, 'hivemind_model_installed_count');
  const running = getScalar(metrics, 'hivemind_model_running_count');
  setVal('m-models', running != null ? running : '--');
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
        '<td style="font-weight:500">' + esc(p.labels.model_id) + '</td>' +
        '<td>' + esc(p.labels.task_type) + '</td>' +
        '<td><div class="bar-container"><div class="bar"><div class="fill" style="width:' + rate + '%;background:' + color + '"></div></div><div class="bar-val" style="color:' + color + '">' + rate + '%</div></div></td>' +
        '<td style="font-family:var(--font-mono);font-size:11px">' + (lat != null ? lat.toFixed(0) + 'ms' : '--') + '</td>' +
        '</tr>';
    }).join('');
  } else {
    perfBody.innerHTML = '<tr><td colspan="4" class="sub">No performance data yet</td></tr>';
  }

  setVal('m-perf-total', perfTotal != null ? perfTotal : '--');

  // Execution
  const execTotal = getScalar(metrics, 'hivemind_exec_total');
  const execRate = getScalar(metrics, 'hivemind_exec_success_rate');
  setVal('m-exec-total', execTotal != null ? execTotal : '--');
  if (execRate != null) {
    const pct = (execRate * 100).toFixed(1);
    setVal('m-exec-rate', pct + '%');
    document.getElementById('exec-bar').style.width = pct + '%';
    const color = execRate >= 0.95 ? 'var(--green)' : execRate >= 0.8 ? 'var(--yellow)' : 'var(--red)';
    document.getElementById('exec-bar').style.background = color;
    document.getElementById('m-exec-rate').style.color = color;
  }
}

// ---------------------------------------------------------------------------
// JSON API renderers
// ---------------------------------------------------------------------------
function renderUnifiHealth(data) {
  if (!data || !data.data) return;
  for (const sub of data.data) {
    const el = document.getElementById('uf-' + sub.subsystem);
    if (!el) continue;
    const ok = sub.status === 'ok';
    let html = '<strong style="color:' + (ok ? 'var(--green)' : 'var(--red)') + '">' + esc(sub.status).toUpperCase() + '</strong>';
    if (sub.wan_ip) html += '<br>IP: <span style="font-family:var(--font-mono);font-size:11px">' + esc(sub.wan_ip) + '</span>';
    if (sub.num_sw != null) html += '<br>Switches: ' + sub.num_sw;
    if (sub.num_ap != null) html += '<br>APs: ' + sub.num_ap;
    if (sub.num_sta != null) html += '<br>Clients: ' + sub.num_sta;
    if (sub.gw_version) html += '<br>GW: ' + esc(sub.gw_version);
    el.innerHTML = html;
  }
}

function renderUnifiClients(data) {
  const body = document.getElementById('clients-body');
  if (!body) return;
  if (!data || !data.data || data.data.length === 0) {
    body.innerHTML = '<tr><td colspan="5" class="sub">No client data</td></tr>';
    return;
  }
  const clients = data.data
    .sort((a, b) => ((b.rx_bytes || 0) + (b.tx_bytes || 0)) - ((a.rx_bytes || 0) + (a.tx_bytes || 0)))
    .slice(0, 10);
  body.innerHTML = clients.map(c => {
    const isWifi = !c.is_wired;
    const type = isWifi ? '<span class="badge wifi">WiFi</span>' : '<span class="badge wired">Wired</span>';
    return '<tr>' +
      '<td style="font-weight:500">' + esc(c.hostname || c.name || c.mac) + '</td>' +
      '<td style="font-family:var(--font-mono);font-size:11px">' + esc(c.ip || '--') + '</td>' +
      '<td>' + type + '</td>' +
      '<td style="font-family:var(--font-mono);font-size:11px">' + fmtBytes(c.rx_bytes) + '</td>' +
      '<td style="font-family:var(--font-mono);font-size:11px">' + fmtBytes(c.tx_bytes) + '</td>' +
      '</tr>';
  }).join('');
}

function renderHotelScraper(data) {
  if (!data) return;
  setVal('hs-sources', data.sources != null ? data.sources : '--');
  setVal('hs-areas', data.areas != null ? data.areas : '--');

  const sched = data.scheduler;
  if (sched) {
    setVal('hs-scheduler', sched.running ? 'RUNNING' : 'STOPPED');
    document.getElementById('hs-scheduler').className = 'value ' + (sched.running ? 'v-green' : 'v-red');
    setAccent('card-hs-sched', sched.running ? 'var(--green)' : 'var(--red)');
    if (sched.uptime != null) {
      document.getElementById('hs-sched-sub').textContent = fmtDuration(sched.uptime);
    }
    setVal('hs-timers', sched.activeTimers != null ? sched.activeTimers : '--');
  }

  setVal('hs-jobs', data.jobCount != null ? data.jobCount : '--');

  if (data.playwright != null) {
    const pw = data.playwright;
    setVal('hs-playwright', pw ? 'ONLINE' : 'OFFLINE');
    document.getElementById('hs-playwright').className = 'value ' + (pw ? 'v-green' : 'v-red');
    setAccent('card-hs-pw', pw ? 'var(--green)' : 'var(--red)');
  }
}

function renderHotelJobs(data) {
  const body = document.getElementById('hs-jobs-body');
  if (!body) return;
  if (!data || !data.jobs || data.jobs.length === 0) {
    body.innerHTML = '<tr><td colspan="5" class="sub">No jobs</td></tr>';
    return;
  }
  body.innerHTML = data.jobs.slice(0, 5).map(j => {
    const status = j.status || '--';
    const badgeCls = status === 'completed' ? 'ok' : status === 'failed' ? 'err' : 'run';
    const dur = j.durationMs != null ? (j.durationMs / 1000).toFixed(1) + 's' : '--';
    return '<tr>' +
      '<td style="font-family:var(--font-mono);font-size:11px">' + esc(j.id?.slice(0, 8)) + '</td>' +
      '<td><span class="badge ' + badgeCls + '">' + esc(status) + '</span></td>' +
      '<td>' + (j.sourcesFound || 0) + '</td>' +
      '<td>' + (j.pricesFound || 0) + '</td>' +
      '<td style="font-family:var(--font-mono);font-size:11px">' + dur + '</td>' +
      '</tr>';
  }).join('');
}

function renderDashboardExec(data) {
  if (!data || !data.executions) return;
  const exec = data.executions;
  setVal('m-recent-cmds', exec.recent ? exec.recent.length : '--');

  const body = document.getElementById('exec-body');
  if (!body) return;
  if (!exec.recent || exec.recent.length === 0) {
    body.innerHTML = '<tr><td colspan="3" class="sub">No recent executions</td></tr>';
    return;
  }
  body.innerHTML = exec.recent.slice(0, 10).map(e => {
    const ok = e.success !== false;
    return '<tr>' +
      '<td style="font-family:var(--font-mono);font-size:11px">' + esc(e.command) + '</td>' +
      '<td><span class="badge ' + (ok ? 'ok' : 'err') + '">' + (ok ? 'OK' : 'FAIL') + '</span></td>' +
      '<td style="font-family:var(--font-mono);font-size:11px">' + (e.latencyMs != null ? e.latencyMs + 'ms' : '--') + '</td>' +
      '</tr>';
  }).join('');
}

// ---------------------------------------------------------------------------
// Neural Graph renderer
// ---------------------------------------------------------------------------
let neuralAnimFrame = null;
let neuralNodes = [];
let neuralEdges = [];
let neuralParticles = [];

function renderNeuralStatus(data) {
  if (!data) return;
  const phaseNames = { genesis: 'Genesis', differentiation: 'Differentiation', synaptogenesis: 'Synaptogenesis', pruning: 'Pruning', myelination: 'Myelination' };
  setVal('ng-phase', phaseNames[data.phase] || data.phase || '--');

  setVal('ng-nodes', data.totalNodes != null ? data.totalNodes : '--');
  setVal('ng-edges', data.totalEdges != null ? data.totalEdges : '--');
  setVal('ng-executions', data.totalExecutions != null ? data.totalExecutions : '--');

  if (data.myelinatedEdges != null) {
    document.getElementById('ng-edges-sub').textContent = data.myelinatedEdges + ' myelinated';
  }

  if (data.avgFitness != null) {
    const pct = Math.min(100, data.avgFitness).toFixed(1);
    setVal('ng-fitness', pct);
    document.getElementById('ng-fitness-bar').style.width = pct + '%';
    const color = data.avgFitness >= 70 ? 'var(--green)' : data.avgFitness >= 40 ? 'var(--yellow)' : 'var(--red)';
    document.getElementById('ng-fitness-bar').style.background = color;
    document.getElementById('ng-fitness').style.color = color;
  }

  const connected = data.convexConnected;
  setVal('ng-convex', connected ? 'CONNECTED' : 'OFFLINE');
  document.getElementById('ng-convex').className = 'value ' + (connected ? 'v-green' : 'v-red');
  setAccent('card-ng-convex', connected ? 'var(--green)' : 'var(--red)');
}

function renderNeuralTopology(data) {
  if (!data || !data.nodes || !data.edges) return;
  neuralNodes = data.nodes;
  neuralEdges = data.edges;

  if (data.nodes.length > 0) {
    const typeMap = {};
    for (const n of data.nodes) typeMap[n.nodeType] = (typeMap[n.nodeType] || 0) + 1;
    const parts = Object.entries(typeMap).map(function(e) { return e[1] + ' ' + e[0]; });
    document.getElementById('ng-nodes-sub').textContent = parts.join(', ');
  }

  layoutNeuralGraph();
}

function layoutNeuralGraph(canvasId) {
  const canvas = document.getElementById(canvasId || 'neural-canvas');
  if (!canvas || neuralNodes.length === 0) return;

  const rect = canvas.parentElement.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  const W = rect.width;
  const H = rect.height;

  // Force-layout positions (simple circular for now)
  const cx = W / 2;
  const cy = H / 2;
  const radius = Math.min(W, H) * 0.35;

  const nodePositions = {};
  neuralNodes.forEach(function(n, i) {
    const angle = (i / neuralNodes.length) * Math.PI * 2 - Math.PI / 2;
    nodePositions[n.nodeId] = {
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius,
      node: n,
    };
  });

  // Init neural particles
  neuralParticles = [];
  for (const e of neuralEdges) {
    const src = nodePositions[e.sourceNodeId];
    const tgt = nodePositions[e.targetNodeId];
    if (!src || !tgt) continue;
    const count = e.myelinated ? 4 : 2;
    for (let i = 0; i < count; i++) {
      neuralParticles.push({
        sx: src.x, sy: src.y,
        tx: tgt.x, ty: tgt.y,
        progress: i / count,
        speed: 0.003 + Math.random() * 0.004,
        weight: e.weight || 0.5,
        myelinated: e.myelinated,
        edgeType: e.edgeType,
      });
    }
  }

  if (neuralAnimFrame) cancelAnimationFrame(neuralAnimFrame);
  animateNeuralGraph(canvas, nodePositions, dpr, W, H);
}

function animateNeuralGraph(canvas, nodePositions, dpr, W, H) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);

  // Draw edges
  for (const e of neuralEdges) {
    const src = nodePositions[e.sourceNodeId];
    const tgt = nodePositions[e.targetNodeId];
    if (!src || !tgt) continue;

    const w = Math.max(0.5, (e.weight || 0.5) * 3);
    ctx.beginPath();
    ctx.moveTo(src.x, src.y);
    ctx.lineTo(tgt.x, tgt.y);

    if (e.myelinated) {
      ctx.strokeStyle = isDark ? 'rgba(192,132,252,0.4)' : 'rgba(168,85,247,0.35)';
      ctx.lineWidth = w + 1;
      ctx.setLineDash([]);
    } else if (e.edgeType === 'activation') {
      ctx.strokeStyle = isDark ? 'rgba(74,222,128,0.25)' : 'rgba(34,197,94,0.2)';
      ctx.lineWidth = w;
      ctx.setLineDash([4, 4]);
    } else if (e.edgeType === 'data_flow') {
      ctx.strokeStyle = isDark ? 'rgba(96,165,250,0.3)' : 'rgba(59,130,246,0.25)';
      ctx.lineWidth = w;
      ctx.setLineDash([]);
    } else {
      ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';
      ctx.lineWidth = w;
      ctx.setLineDash([2, 3]);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Animate particles along edges
  for (const p of neuralParticles) {
    p.progress += p.speed;
    if (p.progress > 1) p.progress -= 1;

    const x = p.sx + (p.tx - p.sx) * p.progress;
    const y = p.sy + (p.ty - p.sy) * p.progress;
    const alpha = Math.sin(p.progress * Math.PI) * 0.9;
    const r = p.myelinated ? 3.5 : 2.5;

    // Glow
    ctx.beginPath();
    ctx.arc(x, y, r * 3, 0, Math.PI * 2);
    if (p.myelinated) {
      ctx.fillStyle = isDark ? 'rgba(192,132,252,' + (alpha * 0.15).toFixed(2) + ')' : 'rgba(168,85,247,' + (alpha * 0.12).toFixed(2) + ')';
    } else if (p.edgeType === 'activation') {
      ctx.fillStyle = isDark ? 'rgba(74,222,128,' + (alpha * 0.12).toFixed(2) + ')' : 'rgba(34,197,94,' + (alpha * 0.1).toFixed(2) + ')';
    } else {
      ctx.fillStyle = isDark ? 'rgba(96,165,250,' + (alpha * 0.12).toFixed(2) + ')' : 'rgba(59,130,246,' + (alpha * 0.1).toFixed(2) + ')';
    }
    ctx.fill();

    // Core
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    if (p.myelinated) {
      ctx.fillStyle = isDark ? 'rgba(192,132,252,' + (alpha * 0.85).toFixed(2) + ')' : 'rgba(168,85,247,' + (alpha * 0.8).toFixed(2) + ')';
    } else if (p.edgeType === 'activation') {
      ctx.fillStyle = isDark ? 'rgba(74,222,128,' + (alpha * 0.8).toFixed(2) + ')' : 'rgba(34,197,94,' + (alpha * 0.75).toFixed(2) + ')';
    } else {
      ctx.fillStyle = isDark ? 'rgba(96,165,250,' + (alpha * 0.8).toFixed(2) + ')' : 'rgba(59,130,246,' + (alpha * 0.75).toFixed(2) + ')';
    }
    ctx.fill();
  }

  // Draw nodes
  const nodeArr = Object.values(nodePositions);
  for (const np of nodeArr) {
    const n = np.node;
    const fitness = n.fitnessScore || 50;
    const r = 16 + (fitness / 100) * 8;

    // Node type colors
    let color;
    if (n.nodeType === 'station') color = isDark ? '#22d3ee' : '#06b6d4';
    else if (n.nodeType === 'capability') color = isDark ? '#c084fc' : '#a855f7';
    else color = isDark ? '#4ade80' : '#22c55e';

    // Pulse ring
    const pulseR = r + 4 + Math.sin(Date.now() / 800 + np.x) * 3;
    ctx.beginPath();
    ctx.arc(np.x, np.y, pulseR, 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.15;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Node fill
    ctx.beginPath();
    ctx.arc(np.x, np.y, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.12;
    ctx.fill();
    ctx.globalAlpha = 1;

    // Node stroke
    ctx.beginPath();
    ctx.arc(np.x, np.y, r, 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.7;
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Node label
    ctx.font = '500 10px ' + (getComputedStyle(document.body).fontFamily);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.9;
    const icon = n.nodeType === 'station' ? '\\u2B22' : n.nodeType === 'capability' ? '\\u2605' : '\\u25CF';
    ctx.font = '14px sans-serif';
    ctx.fillText(icon, np.x, np.y);
    ctx.globalAlpha = 1;

    // Name below
    ctx.font = '600 9px ' + (getComputedStyle(document.body).fontFamily);
    ctx.fillStyle = isDark ? '#e2e4ed' : '#1a1a2e';
    ctx.fillText(n.name || n.nodeId, np.x, np.y + r + 12);

    // Fitness score
    ctx.font = '500 8px ' + (getComputedStyle(document.body).fontFamily);
    ctx.fillStyle = isDark ? '#8b8fa8' : '#6b7084';
    ctx.fillText(fitness.toFixed(0), np.x, np.y + r + 22);
  }

  neuralAnimFrame = requestAnimationFrame(function() {
    animateNeuralGraph(canvas, nodePositions, dpr, W, H);
  });
}

// ---------------------------------------------------------------------------
// Neural graph fullscreen
// ---------------------------------------------------------------------------
let neuralFsOverlay = null;
let neuralFsEscHandler = null;

function openNeuralFullscreen() {
  closeNeuralFullscreen();

  const overlay = document.createElement('div');
  overlay.className = 'neural-fs-overlay';

  // Header
  const header = document.createElement('div');
  header.className = 'neural-fs-header';
  const title = document.createElement('span');
  title.className = 'neural-fs-title';
  title.textContent = 'Neural Graph \\u2014 Full Screen';
  header.appendChild(title);

  const stats = document.createElement('span');
  stats.className = 'neural-fs-stats';
  const myelinated = neuralEdges.filter(function(e) { return e.myelinated; }).length;
  stats.innerHTML = '<span><span class="val">' + neuralNodes.length + '</span> nodes</span>'
    + '<span><span class="val">' + neuralEdges.length + '</span> edges</span>'
    + '<span><span class="val">' + myelinated + '</span> myelinated</span>';
  header.appendChild(stats);

  const closeBtn = document.createElement('button');
  closeBtn.className = 'neural-fs-close';
  closeBtn.textContent = '\\u2715 Close';
  closeBtn.addEventListener('click', closeNeuralFullscreen);
  header.appendChild(closeBtn);
  overlay.appendChild(header);

  // Canvas body
  const body = document.createElement('div');
  body.className = 'neural-fs-body';
  const canvas = document.createElement('canvas');
  canvas.id = 'neural-fs-canvas';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  body.appendChild(canvas);
  overlay.appendChild(body);

  // Legend
  const legend = document.createElement('div');
  legend.className = 'neural-fs-legend';
  const items = [
    ['Station', '#22d3ee'],
    ['Capability', '#c084fc'],
    ['Model', '#4ade80'],
    ['data flow', '#60a5fa'],
    ['activation', '#4ade80'],
    ['myelinated', '#c084fc'],
  ];
  items.forEach(function(item) {
    const span = document.createElement('span');
    span.className = 'leg-item';
    span.innerHTML = '<span class="leg-dot" style="background:' + item[1] + '"></span> ' + item[0];
    legend.appendChild(span);
  });
  overlay.appendChild(legend);

  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';
  neuralFsOverlay = overlay;

  // Render at full size after DOM insertion
  requestAnimationFrame(function() {
    layoutNeuralGraph('neural-fs-canvas');
  });

  // Escape key
  neuralFsEscHandler = function(e) { if (e.key === 'Escape') closeNeuralFullscreen(); };
  document.addEventListener('keydown', neuralFsEscHandler);
}

function closeNeuralFullscreen() {
  if (neuralFsOverlay) {
    neuralFsOverlay.remove();
    neuralFsOverlay = null;
    document.body.style.overflow = '';
  }
  if (neuralFsEscHandler) {
    document.removeEventListener('keydown', neuralFsEscHandler);
    neuralFsEscHandler = null;
  }
  // Restart animation on original canvas
  if (neuralNodes.length > 0) {
    layoutNeuralGraph('neural-canvas');
  }
}

document.getElementById('neural-fs-toggle').addEventListener('click', openNeuralFullscreen);

// ---------------------------------------------------------------------------
// JSON API fetch helper
// ---------------------------------------------------------------------------
async function fetchJson(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Main refresh loop
// ---------------------------------------------------------------------------
async function refresh() {
  try {
    const [metricsRes, dashboardData, unifiHealth, unifiClients, scraperStatus, scraperJobs, neuralStatus, neuralTopology] =
      await Promise.allSettled([
        fetch('/metrics'),
        fetchJson('/api/network/dashboard'),
        fetchJson('/api/unifi/health'),
        fetchJson('/api/unifi/clients'),
        fetchJson('/api/hotel-scraper/status'),
        fetchJson('/api/hotel-scraper/jobs?limit=5'),
        fetchJson('/api/neural/status'),
        fetchJson('/api/neural/topology'),
      ]);

    if (metricsRes.status === 'fulfilled' && metricsRes.value.ok) {
      const text = await metricsRes.value.text();
      const metrics = parsePrometheus(text);
      renderMetrics(metrics);
    }

    if (unifiHealth.status === 'fulfilled' && unifiHealth.value) {
      renderUnifiHealth(unifiHealth.value);
    }
    if (unifiClients.status === 'fulfilled' && unifiClients.value) {
      renderUnifiClients(unifiClients.value);
    }
    if (scraperStatus.status === 'fulfilled' && scraperStatus.value) {
      renderHotelScraper(scraperStatus.value);
    }
    if (scraperJobs.status === 'fulfilled' && scraperJobs.value) {
      renderHotelJobs(scraperJobs.value);
    }
    if (dashboardData.status === 'fulfilled' && dashboardData.value) {
      renderDashboardExec(dashboardData.value);
    }
    if (neuralStatus.status === 'fulfilled' && neuralStatus.value) {
      renderNeuralStatus(neuralStatus.value);
    }
    if (neuralTopology.status === 'fulfilled' && neuralTopology.value) {
      renderNeuralTopology(neuralTopology.value);
    }

    document.getElementById('error-banner').style.display = 'none';
    document.getElementById('last-update').textContent =
      'Updated ' + new Date().toLocaleTimeString();
    document.getElementById('status-dot').style.background = 'var(--green)';
  } catch (e) {
    document.getElementById('error-banner').textContent =
      'Failed to fetch metrics: ' + e.message;
    document.getElementById('error-banner').style.display = 'block';
    document.getElementById('status-dot').style.background = 'var(--red)';
  }
}

refresh();
setInterval(refresh, REFRESH_MS);
</script>
</body>
</html>`;
}
