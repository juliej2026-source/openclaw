// Data Mine — Stakeholder Intelligence Dashboard
// Auto-runs all analyses and presents plain-English insights with visual indicators.

import {
  card,
  cardGrid,
  badge,
  dataTable,
  sectionTitle,
  errorBanner,
  emptyState,
  cols2,
  cols3,
} from "../components.js";

// ---- Thresholds ----

const TH = {
  neuralLatency: { good: 300, warn: 500 },
  neuralSuccess: { good: 0.95, warn: 0.85 },
  metaLatency: { good: 100, warn: 200 },
  metaSuccess: { good: 0.85, warn: 0.75 },
  networkLatency: { good: 20, warn: 50 },
  priceVolatility: { good: 10, warn: 20 },
  anomalyRate: { good: 0.05, warn: 0.15 },
  graphDensity: { good: 0.3, warn: 0.15 },
};

const SOURCE_LABELS = {
  neural_graph: "AI System",
  hotel_scraper: "Hotel Pricing",
  meta_engine: "Model Selection",
  network: "Network",
};

const ENGINE_METHODS = {
  statistics: [
    "descriptiveStats",
    "correlationMatrix",
    "linearRegression",
    "polynomialRegression",
    "distributionTest",
  ],
  timeseries: [
    "trendDetection",
    "movingAverage",
    "seasonalityDecomposition",
    "changePointDetection",
    "forecast",
  ],
  clustering: ["kMeansClustering", "anomalyDetection", "pcaAnalysis", "elbowMethod"],
  graph_analytics: ["graphMetrics", "centralityAnalysis", "communityDetection", "pathAnalysis"],
  experiments: [],
};

const SOURCE_OPTIONS = [
  { value: "neural_graph", label: "Neural Graph" },
  { value: "hotel_scraper", label: "Hotel Scraper" },
  { value: "meta_engine", label: "Meta Engine" },
  { value: "network", label: "Network" },
];

// ---- Utility ----

function esc(s) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

function fmt(n, decimals = 0) {
  if (n == null || isNaN(n)) return "--";
  return Number(n).toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function pct(n) {
  if (n == null || isNaN(n)) return "--";
  return (n * 100).toFixed(1) + "%";
}

function assessHealth(value, threshold, lowerIsBetter = true) {
  if (value == null || isNaN(value)) return "ok";
  if (lowerIsBetter) {
    if (value <= threshold.good) return "ok";
    if (value <= threshold.warn) return "warn";
    return "crit";
  }
  if (value >= threshold.good) return "ok";
  if (value >= threshold.warn) return "warn";
  return "crit";
}

function worstSeverity(...severities) {
  if (severities.includes("crit")) return "crit";
  if (severities.includes("warn")) return "warn";
  return "ok";
}

const SEV_LABELS = { ok: "Healthy", warn: "Needs Attention", crit: "Critical" };

// ---- Fetch All Insights ----

async function fetchJSON(url) {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    return r.json();
  } catch {
    return null;
  }
}

async function fetchAllInsights() {
  const keys = [
    "status",
    "datasets",
    "experiments",
    "hotelStats",
    "hotelTrend",
    "hotelCorr",
    "hotelAnom",
    "hotelForecast",
    "neuralStats",
    "neuralTrend",
    "neuralAnom",
    "metaStats",
    "metaTrend",
    "metaAnom",
    "netStats",
    "netTrend",
    "netAnom",
    "graph",
    "hotelSpark",
    "neuralSpark",
    "metaSpark",
    "netSpark",
  ];
  const urls = [
    "/api/data-mine/status",
    "/api/data-mine/datasets",
    "/api/data-mine/experiments",
    "/api/data-mine/stats?source=hotel_scraper",
    "/api/data-mine/timeseries?source=hotel_scraper",
    "/api/data-mine/correlations?source=hotel_scraper",
    "/api/data-mine/anomalies?source=hotel_scraper",
    "/api/data-mine/timeseries?source=hotel_scraper&method=forecast&horizon=7",
    "/api/data-mine/stats?source=neural_graph",
    "/api/data-mine/timeseries?source=neural_graph",
    "/api/data-mine/anomalies?source=neural_graph",
    "/api/data-mine/stats?source=meta_engine",
    "/api/data-mine/timeseries?source=meta_engine",
    "/api/data-mine/anomalies?source=meta_engine",
    "/api/data-mine/stats?source=network",
    "/api/data-mine/timeseries?source=network",
    "/api/data-mine/anomalies?source=network",
    "/api/data-mine/graph",
    "/api/data-mine/timeseries?source=hotel_scraper&method=movingAverage",
    "/api/data-mine/timeseries?source=neural_graph&method=movingAverage",
    "/api/data-mine/timeseries?source=meta_engine&method=movingAverage",
    "/api/data-mine/timeseries?source=network&method=movingAverage",
  ];

  const results = await Promise.allSettled(urls.map(fetchJSON));
  const data = {};
  keys.forEach((k, i) => {
    const r = results[i];
    data[k] = r.status === "fulfilled" ? r.value : null;
  });
  return data;
}

function cleanSpark(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.filter((v) => v != null && !isNaN(v));
}

// ---- Visual Components ----

function sparkline(values, { width = 140, height = 36, color = "#58a6ff", showArea = true } = {}) {
  const valid = (values || []).filter((v) => v != null && !isNaN(v));
  if (valid.length < 2) {
    const el = document.createElement("div");
    el.style.cssText = `display:inline-block;width:${width}px;height:${height}px`;
    return el;
  }

  const min = Math.min(...valid);
  const max = Math.max(...valid);
  const range = max - min || 1;
  const pad = 3;

  const pts = valid.map((v, i) => {
    const x = (i / (valid.length - 1)) * (width - pad * 2) + pad;
    const y = height - pad - ((v - min) / range) * (height - pad * 2);
    return [x.toFixed(1), y.toFixed(1)];
  });

  const polyline = pts.map((p) => p.join(",")).join(" ");
  const lastPt = pts[pts.length - 1];
  const area = showArea
    ? `<polygon points="${pad},${height - pad} ${polyline} ${pts[pts.length - 1][0]},${height - pad}" fill="${color}" opacity="0.12"/>`
    : "";

  const el = document.createElement("div");
  el.style.cssText = "display:inline-block;vertical-align:middle;flex-shrink:0";
  el.innerHTML = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    ${area}
    <polyline points="${polyline}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="${lastPt[0]}" cy="${lastPt[1]}" r="2.5" fill="${color}"/>
  </svg>`;
  return el;
}

function healthDot(severity) {
  const colors = { ok: "#3fb950", warn: "#d29922", crit: "#f85149" };
  const c = colors[severity] || colors.ok;
  const el = document.createElement("span");
  el.style.cssText = `display:inline-block;width:10px;height:10px;border-radius:50%;background:${c};box-shadow:0 0 6px ${c}55;margin-right:8px;vertical-align:middle;flex-shrink:0`;
  return el;
}

function trendArrow(direction, contextGood = "down") {
  const arrows = { up: "\u25B2", down: "\u25BC", flat: "\u25B6" };
  let color;
  if (direction === "flat") color = "#d29922";
  else if (direction === contextGood) color = "#3fb950";
  else color = "#f85149";

  const el = document.createElement("span");
  el.textContent = arrows[direction] || arrows.flat;
  el.style.cssText = `color:${color};font-size:13px;margin-right:6px;vertical-align:middle`;
  return el;
}

function insightCard({ title, severity, lines, sparkData, sparkColor }) {
  const borderColors = { ok: "#3fb950", warn: "#d29922", crit: "#f85149" };
  const el = document.createElement("div");
  el.style.cssText = `background:#161b22;border:1px solid #30363d;border-left:3px solid ${borderColors[severity] || borderColors.ok};border-radius:8px;padding:16px;margin-bottom:12px`;

  const header = document.createElement("div");
  header.style.cssText =
    "display:flex;align-items:center;justify-content:space-between;margin-bottom:10px";

  const titleWrap = document.createElement("div");
  titleWrap.style.cssText = "display:flex;align-items:center";
  titleWrap.appendChild(healthDot(severity));
  const t = document.createElement("span");
  t.style.cssText = "font-size:14px;font-weight:600;color:#f0f6fc";
  t.textContent = title;
  titleWrap.appendChild(t);
  header.appendChild(titleWrap);

  if (sparkData && sparkData.length > 1) {
    header.appendChild(sparkline(sparkData, { color: sparkColor || "#58a6ff" }));
  }
  el.appendChild(header);

  for (const line of lines) {
    const p = document.createElement("div");
    p.style.cssText = "font-size:13px;color:#e6edf3;line-height:1.7;margin-bottom:2px";
    p.innerHTML = line;
    el.appendChild(p);
  }
  return el;
}

function recommendationBox(text) {
  const el = document.createElement("div");
  el.style.cssText =
    "background:#161b2288;border:1px solid #58a6ff33;border-radius:8px;padding:12px 16px;margin-bottom:16px;font-size:13px;color:#58a6ff;line-height:1.6";
  el.innerHTML = `<strong style="color:#79c0ff">Recommendation:</strong> ${text}`;
  return el;
}

function summaryBanner(text) {
  const el = document.createElement("div");
  el.style.cssText =
    "font-size:15px;color:#e6edf3;line-height:1.7;margin-bottom:24px;padding:12px 0";
  el.innerHTML = text;
  return el;
}

// ---- Interpretation Functions ----

function interpretTrendDirection(trend) {
  if (!trend) return { direction: "flat", slope: 0, rSq: 0 };
  return {
    direction: trend.direction || "flat",
    slope: trend.slope || 0,
    rSq: trend.rSquared || 0,
  };
}

function trendConfidence(rSq) {
  if (rSq > 0.7) return "strong and consistent";
  if (rSq > 0.3) return "moderate";
  return "weak (noisy data)";
}

function trendText(dir) {
  if (dir === "up") return "trending <strong>upward</strong>";
  if (dir === "down") return "trending <strong>downward</strong>";
  return "<strong>stable</strong>";
}

function anomalyCount(anom) {
  if (!anom || !anom.anomalies) return 0;
  return anom.anomalies.length;
}

function anomalySeverity(anom) {
  const count = anomalyCount(anom);
  if (count === 0) return "ok";
  if (count <= 3) return "warn";
  return "crit";
}

function volatilityText(cv) {
  if (cv < 10) return "Prices are <strong>stable</strong> this period.";
  if (cv < 20) return "Prices show <strong>moderate swings</strong>.";
  return "Prices are <strong>highly volatile</strong> \u2014 expect large fluctuations.";
}

// ---- Section Builders ----

function buildExecutiveSummary(d) {
  const frag = document.createDocumentFragment();

  // Compute severities per domain
  const hotelSev = anomalySeverity(d.hotelAnom);
  const neuralSev = d.neuralStats
    ? worstSeverity(
        assessHealth(d.neuralStats.mean, TH.neuralLatency, true),
        anomalySeverity(d.neuralAnom),
      )
    : "ok";
  const metaSev = d.metaStats
    ? worstSeverity(
        assessHealth(d.metaStats.mean, TH.metaLatency, true),
        anomalySeverity(d.metaAnom),
      )
    : "ok";
  const netSev = d.netStats
    ? worstSeverity(
        assessHealth(d.netStats.mean, TH.networkLatency, true),
        anomalySeverity(d.netAnom),
      )
    : "ok";

  const overall = worstSeverity(hotelSev, neuralSev, metaSev, netSev);

  // Trend outlook
  const badTrends = [d.hotelTrend, d.neuralTrend, d.metaTrend, d.netTrend].filter((t) => {
    if (!t) return false;
    // For latency sources, "up" is bad; for hotel, "up" is also bad (cost)
    return t.direction === "up";
  }).length;
  const trendOutlook = badTrends === 0 ? "Stable" : badTrends <= 2 ? "Mixed" : "Declining";
  const trendSev = badTrends === 0 ? "ok" : badTrends <= 2 ? "warn" : "crit";

  const totalAnomalies =
    anomalyCount(d.hotelAnom) +
    anomalyCount(d.neuralAnom) +
    anomalyCount(d.metaAnom) +
    anomalyCount(d.netAnom);
  const anomSev = totalAnomalies === 0 ? "ok" : totalAnomalies <= 5 ? "warn" : "crit";

  const cards = cardGrid([
    card({
      label: "Overall Health",
      value: SEV_LABELS[overall],
      sub: "across all systems",
      status: overall,
    }),
    card({
      label: "Data Sources",
      value: `${d.datasets?.total ?? 0} Active`,
      sub: "datasets available",
      status: "info",
    }),
    card({ label: "Anomalies", value: totalAnomalies, sub: "across all sources", status: anomSev }),
    card({
      label: "Trend Outlook",
      value: trendOutlook,
      sub: `${badTrends} adverse trend${badTrends !== 1 ? "s" : ""}`,
      status: trendSev,
    }),
  ]);
  frag.appendChild(cards);

  // Executive summary sentence
  const parts = [];
  if (overall === "ok") parts.push("All systems are operating normally.");
  else if (overall === "warn") parts.push("Some areas need attention \u2014 see details below.");
  else parts.push("<strong>Critical issues detected</strong> \u2014 immediate review recommended.");

  if (d.hotelTrend?.direction === "up") parts.push("Hotel prices are trending upward in Niseko.");
  if (totalAnomalies === 0) parts.push("No anomalies detected across any data source.");
  else
    parts.push(
      `${totalAnomalies} anomal${totalAnomalies === 1 ? "y" : "ies"} detected \u2014 review the alerts section.`,
    );

  frag.appendChild(summaryBanner(parts.join(" ")));
  return frag;
}

function buildHotelIntelligence(d) {
  const frag = document.createDocumentFragment();
  frag.appendChild(sectionTitle("Hotel Pricing Intelligence"));

  const stats = d.hotelStats;
  const trend = interpretTrendDirection(d.hotelTrend);
  const anom = d.hotelAnom;
  const forecast = d.hotelForecast;
  const corr = d.hotelCorr;

  if (!stats) {
    frag.appendChild(
      insightCard({
        title: "Price Data",
        severity: "warn",
        lines: ["Hotel pricing data is currently unavailable."],
      }),
    );
    return frag;
  }

  const cv = stats.stdDev && stats.mean ? (stats.stdDev / stats.mean) * 100 : 0;
  const volSev = cv < 10 ? "ok" : cv < 20 ? "warn" : "crit";
  const priceSev = worstSeverity(volSev, anomalySeverity(anom));

  const hotelSpark = cleanSpark(d.hotelSpark);

  const priceLines = [
    `Average nightly rate: <strong>\u00A5${fmt(stats.mean)}</strong> across ${stats.count || "--"} data points`,
    `Price range: <strong>\u00A5${fmt(stats.min)}</strong> \u2014 <strong>\u00A5${fmt(stats.max)}</strong> (spread: \u00A5${fmt(stats.max - stats.min)})`,
    `Typical corridor: \u00A5${fmt(stats.q1)} \u2014 \u00A5${fmt(stats.q3)} (middle 50% of rates)`,
    volatilityText(cv),
  ];

  const trendLines = [];
  const tEl = document.createElement("span");
  tEl.appendChild(trendArrow(trend.direction, "down"));
  const tText = document.createElement("span");
  tText.innerHTML = `Prices are ${trendText(trend.direction)}`;
  tEl.appendChild(tText);

  trendLines.push(tEl.innerHTML);
  trendLines.push(
    `Trend confidence: <strong>${trendConfidence(trend.rSq)}</strong> (R\u00B2 = ${trend.rSq.toFixed(2)})`,
  );

  if (forecast && Array.isArray(forecast)) {
    const avgForecast = forecast.reduce((s, v) => s + v, 0) / forecast.length;
    const changePct = stats.mean ? ((avgForecast - stats.mean) / stats.mean) * 100 : 0;
    const dir = changePct > 1 ? "increase" : changePct < -1 ? "decrease" : "remain stable";
    trendLines.push(
      `7-day forecast: prices expected to <strong>${dir}</strong> to approximately <strong>\u00A5${fmt(avgForecast)}/night</strong>`,
    );
  }

  const trendSev = trend.direction === "up" ? "warn" : "ok";

  const left = insightCard({
    title: "Price Overview",
    severity: priceSev,
    lines: priceLines,
    sparkData: hotelSpark,
    sparkColor: "#d29922",
  });
  const right = insightCard({ title: "Trend & Forecast", severity: trendSev, lines: trendLines });
  frag.appendChild(cols2(left, right));

  // Correlation insight
  if (corr && corr.variables && corr.matrix && corr.variables.length >= 2) {
    const vars = corr.variables;
    const mat = corr.matrix;
    let strongest = { pair: "", val: -2 };
    let weakest = { pair: "", val: 2 };
    for (let i = 0; i < vars.length; i++) {
      for (let j = i + 1; j < vars.length; j++) {
        const r = mat[i][j];
        if (Math.abs(r) > Math.abs(strongest.val))
          strongest = { pair: `${vars[i]} and ${vars[j]}`, val: r };
        if (Math.abs(r) < Math.abs(weakest.val))
          weakest = { pair: `${vars[i]} and ${vars[j]}`, val: r };
      }
    }
    const corrText = [];
    if (strongest.pair)
      corrText.push(
        `<strong>${strongest.pair}</strong> prices move together (correlation: ${strongest.val.toFixed(2)}) \u2014 when one rises, the other follows.`,
      );
    if (weakest.pair && weakest.pair !== strongest.pair)
      corrText.push(
        `<strong>${weakest.pair}</strong> are less correlated (${weakest.val.toFixed(2)}) \u2014 may offer better deals when others are expensive.`,
      );

    if (corrText.length > 0) {
      frag.appendChild(recommendationBox(corrText.join(" ")));
    }
  }

  return frag;
}

function buildSystemPerformance(d) {
  const frag = document.createDocumentFragment();
  frag.appendChild(sectionTitle("System Performance"));

  // Neural graph
  const nStats = d.neuralStats;
  const nTrend = interpretTrendDirection(d.neuralTrend);
  const nAnom = d.neuralAnom;

  const neuralSev = nStats
    ? worstSeverity(assessHealth(nStats.mean, TH.neuralLatency, true), anomalySeverity(nAnom))
    : "warn";

  const neuralLines = [];
  if (nStats) {
    const label =
      nStats.mean < TH.neuralLatency.good
        ? "excellent"
        : nStats.mean < TH.neuralLatency.warn
          ? "acceptable"
          : "slow";
    neuralLines.push(`Average latency: <strong>${fmt(nStats.mean)}ms</strong> (${label})`);

    const tEl = document.createElement("span");
    tEl.appendChild(trendArrow(nTrend.direction, "down"));
    const tText = document.createElement("span");
    tText.innerHTML = `Response times are ${trendText(nTrend.direction)}`;
    tEl.appendChild(tText);
    neuralLines.push(tEl.innerHTML);

    neuralLines.push(
      `Range: ${fmt(nStats.min)}ms \u2014 ${fmt(nStats.max)}ms across ${nStats.count} samples`,
    );
    if (anomalyCount(nAnom) > 0) {
      neuralLines.push(
        `<span style="color:#d29922">${anomalyCount(nAnom)} unusual reading${anomalyCount(nAnom) > 1 ? "s" : ""} detected</span>`,
      );
    } else {
      neuralLines.push(
        `<span style="color:#3fb950">No anomalies detected \u2014 running smoothly</span>`,
      );
    }
  } else {
    neuralLines.push("AI execution data is currently unavailable.");
  }

  // Meta engine
  const mStats = d.metaStats;
  const mTrend = interpretTrendDirection(d.metaTrend);
  const mAnom = d.metaAnom;

  const metaSev = mStats
    ? worstSeverity(assessHealth(mStats.mean, TH.metaLatency, true), anomalySeverity(mAnom))
    : "warn";

  const metaLines = [];
  if (mStats) {
    const label =
      mStats.mean < TH.metaLatency.good
        ? "fast"
        : mStats.mean < TH.metaLatency.warn
          ? "acceptable"
          : "slow";
    metaLines.push(`Average selection time: <strong>${fmt(mStats.mean)}ms</strong> (${label})`);

    const tEl = document.createElement("span");
    tEl.appendChild(trendArrow(mTrend.direction, "down"));
    const tText = document.createElement("span");
    tText.innerHTML = `Selection speed is ${trendText(mTrend.direction)}`;
    tEl.appendChild(tText);
    metaLines.push(tEl.innerHTML);

    metaLines.push(
      `Range: ${fmt(mStats.min)}ms \u2014 ${fmt(mStats.max)}ms across ${mStats.count} samples`,
    );
    if (anomalyCount(mAnom) > 0) {
      metaLines.push(
        `<span style="color:#d29922">${anomalyCount(mAnom)} unusual reading${anomalyCount(mAnom) > 1 ? "s" : ""} detected</span>`,
      );
    } else {
      metaLines.push(
        `<span style="color:#3fb950">No anomalies \u2014 model selection running well</span>`,
      );
    }
  } else {
    metaLines.push("Model selection data is currently unavailable.");
  }

  const left = insightCard({
    title: "AI Execution (Neural Graph)",
    severity: neuralSev,
    lines: neuralLines,
    sparkData: cleanSpark(d.neuralSpark),
    sparkColor: "#3fb950",
  });
  const right = insightCard({
    title: "Model Selection (Meta Engine)",
    severity: metaSev,
    lines: metaLines,
    sparkData: cleanSpark(d.metaSpark),
    sparkColor: "#58a6ff",
  });
  frag.appendChild(cols2(left, right));

  // Recommendation
  const allOk = neuralSev === "ok" && metaSev === "ok";
  if (allOk) {
    frag.appendChild(
      recommendationBox("AI systems are performing within all targets. No action needed."),
    );
  } else if (nTrend.direction === "up") {
    frag.appendChild(
      recommendationBox(
        "Execution latency is increasing \u2014 consider investigating resource utilization and recent deployment changes.",
      ),
    );
  } else if (mTrend.direction === "up") {
    frag.appendChild(
      recommendationBox(
        "Model selection is slowing down \u2014 review model registry and routing configuration.",
      ),
    );
  }

  return frag;
}

function buildNetworkHealth(d) {
  const frag = document.createDocumentFragment();
  frag.appendChild(sectionTitle("Network Health"));

  const stats = d.netStats;
  const trend = interpretTrendDirection(d.netTrend);
  const anom = d.netAnom;

  if (!stats) {
    frag.appendChild(
      insightCard({
        title: "Network",
        severity: "warn",
        lines: ["Network telemetry data is currently unavailable."],
      }),
    );
    return frag;
  }

  const sev = worstSeverity(
    assessHealth(stats.mean, TH.networkLatency, true),
    anomalySeverity(anom),
  );

  const label =
    stats.mean < TH.networkLatency.good
      ? "excellent"
      : stats.mean < TH.networkLatency.warn
        ? "acceptable"
        : "degraded";
  const lines = [];
  lines.push(`Average latency: <strong>${fmt(stats.mean, 1)}ms</strong> (${label})`);

  const tEl = document.createElement("span");
  tEl.appendChild(trendArrow(trend.direction, "down"));
  const tText = document.createElement("span");
  tText.innerHTML = `Network latency is ${trendText(trend.direction)}`;
  tEl.appendChild(tText);
  lines.push(tEl.innerHTML);

  lines.push(
    `Range: ${fmt(stats.min, 1)}ms \u2014 ${fmt(stats.max, 1)}ms across ${stats.count} samples`,
  );

  if (anomalyCount(anom) > 0) {
    lines.push(
      `<span style="color:#d29922">${anomalyCount(anom)} unusual reading${anomalyCount(anom) > 1 ? "s" : ""} detected \u2014 may indicate connectivity blips</span>`,
    );
  } else {
    lines.push(`<span style="color:#3fb950">No unusual network behavior detected</span>`);
  }

  frag.appendChild(
    insightCard({
      title: "Network Infrastructure",
      severity: sev,
      lines,
      sparkData: cleanSpark(d.netSpark),
      sparkColor: "#79c0ff",
    }),
  );
  return frag;
}

function buildGraphTopology(d) {
  const frag = document.createDocumentFragment();
  frag.appendChild(sectionTitle("AI System Topology"));

  const g = d.graph;
  if (!g || !g.metrics) {
    frag.appendChild(
      insightCard({
        title: "Topology",
        severity: "warn",
        lines: ["Graph topology data is currently unavailable."],
      }),
    );
    return frag;
  }

  const m = g.metrics;
  const densitySev =
    m.density >= 0.5 ? "ok" : m.density >= 0.3 ? "ok" : m.density >= 0.15 ? "warn" : "crit";

  // Mini stat cards
  const miniCards = cardGrid([
    card({ label: "Components", value: m.nodeCount ?? "--", sub: "AI nodes", status: "info" }),
    card({ label: "Connections", value: m.edgeCount ?? "--", sub: "data paths", status: "info" }),
    card({
      label: "Density",
      value: m.density != null ? m.density.toFixed(3) : "--",
      sub: densitySev === "ok" ? "well connected" : "sparse",
      status: densitySev,
    }),
    card({
      label: "Diameter",
      value: m.diameter ?? "--",
      sub: "max hops",
      status: m.diameter <= 4 ? "ok" : "warn",
    }),
  ]);
  frag.appendChild(miniCards);

  const lines = [];

  // Connectivity
  const connected = m.connectedComponents === 1;
  if (connected) {
    lines.push(
      `<span style="color:#3fb950">All ${m.nodeCount} components are connected and reachable from any node.</span>`,
    );
  } else {
    lines.push(
      `<span style="color:#f85149"><strong>WARNING:</strong> ${m.connectedComponents} isolated groups detected \u2014 some nodes cannot communicate.</span>`,
    );
  }

  // Density interpretation
  if (m.density >= 0.5)
    lines.push("Highly interconnected \u2014 good resilience against individual failures.");
  else if (m.density >= 0.3)
    lines.push("Moderately connected \u2014 adequate redundancy for most scenarios.");
  else lines.push("Sparse connections \u2014 consider adding redundant paths for resilience.");

  // Centrality — find most critical node
  if (g.centrality && Array.isArray(g.centrality) && g.centrality.length > 0) {
    const sorted = [...g.centrality].sort((a, b) => (b.pageRank || 0) - (a.pageRank || 0));
    const top = sorted[0];
    if (top) {
      lines.push(
        `Most critical node: <strong>${esc(top.nodeId)}</strong> (highest centrality) \u2014 if it fails, other components are most affected.`,
      );
    }
    if (sorted.length > 1) {
      const second = sorted[1];
      lines.push(
        `Second most important: <strong>${esc(second.nodeId)}</strong> \u2014 key hub connecting subsystems.`,
      );
    }
  }

  // Communities
  if (g.communities && g.communities.communities) {
    const count = g.communities.communities.length;
    const mod = g.communities.modularity;
    if (count > 1) {
      lines.push(
        `System divides into <strong>${count} natural clusters</strong> (modularity: ${mod != null ? mod.toFixed(2) : "--"}).`,
      );
      if (mod > 0.4)
        lines.push("Strong modular structure \u2014 each cluster operates fairly independently.");
    } else {
      lines.push("The system operates as a single tightly-coupled unit.");
    }
  }

  frag.appendChild(
    insightCard({ title: "Topology Analysis", severity: connected ? densitySev : "crit", lines }),
  );
  return frag;
}

function buildAnomalyAlerts(d) {
  const frag = document.createDocumentFragment();
  frag.appendChild(sectionTitle("Anomaly Alerts"));

  // Aggregate from all sources
  const allAnomalies = [];
  const sources = [
    { key: "hotelAnom", label: "Hotel Pricing", color: "orange" },
    { key: "neuralAnom", label: "AI System", color: "purple" },
    { key: "metaAnom", label: "Model Selection", color: "blue" },
    { key: "netAnom", label: "Network", color: "cyan" },
  ];

  for (const src of sources) {
    const anom = d[src.key];
    if (anom && anom.anomalies) {
      for (const a of anom.anomalies) {
        allAnomalies.push({ ...a, sourceLabel: src.label, sourceColor: src.color });
      }
    }
  }

  if (allAnomalies.length === 0) {
    const ok = document.createElement("div");
    ok.style.cssText =
      "background:#161b22;border:1px solid #3fb95033;border-radius:8px;padding:20px;text-align:center;color:#3fb950;font-size:14px";
    ok.innerHTML = "\u2714 No anomalies detected across any data source. All systems normal.";
    frag.appendChild(ok);
    return frag;
  }

  // Sort by score descending
  allAnomalies.sort((a, b) => (b.score || 0) - (a.score || 0));

  const list = document.createElement("div");
  list.style.cssText = "display:flex;flex-direction:column;gap:8px";

  for (const a of allAnomalies.slice(0, 10)) {
    const row = document.createElement("div");
    row.style.cssText =
      "background:#161b22;border:1px solid #30363d;border-radius:8px;padding:12px 16px;display:flex;align-items:center;gap:12px";

    row.appendChild(healthDot(a.score > 3 ? "crit" : "warn"));

    const b = badge(a.sourceLabel, a.sourceColor);
    row.appendChild(b);

    const text = document.createElement("span");
    text.style.cssText = "font-size:13px;color:#e6edf3;flex:1";
    text.innerHTML = `Unusual reading at data point <strong>#${a.index ?? "--"}</strong>: value <strong>${a.value != null ? a.value.toFixed(1) : "--"}</strong> (confidence score: ${a.score != null ? a.score.toFixed(2) : "--"})`;
    row.appendChild(text);

    list.appendChild(row);
  }

  frag.appendChild(list);
  return frag;
}

function buildExperiments(d) {
  if (!d.experiments || !d.experiments.experiments || d.experiments.experiments.length === 0) {
    return null; // Don't render section at all
  }

  const frag = document.createDocumentFragment();
  frag.appendChild(sectionTitle("Active Experiments"));

  const rows = d.experiments.experiments.map((e) => ({
    name: e.name,
    groups: e.groups?.join(", ") ?? "--",
    metric: e.metric ?? "--",
    status: e.status ?? "running",
    created: e.createdAt ? new Date(e.createdAt).toLocaleDateString() : "--",
  }));

  frag.appendChild(
    dataTable({
      columns: [
        { key: "name", label: "Name", sortable: true },
        { key: "groups", label: "Groups" },
        { key: "metric", label: "Metric" },
        { key: "status", label: "Status" },
        { key: "created", label: "Created" },
      ],
      rows,
    }),
  );

  return frag;
}

// ---- Technical Tools (collapsed) ----

function buildTechnicalTools(container) {
  const section = document.createElement("div");
  section.style.cssText = "margin-top:32px;border-top:1px solid #30363d;padding-top:16px";

  const header = document.createElement("div");
  header.className = "collapsible-header";
  header.textContent = "Technical Analysis Tools";

  const body = document.createElement("div");
  body.className = "collapsible-body";

  header.addEventListener("click", () => {
    header.classList.toggle("open");
    body.classList.toggle("open");
  });

  section.appendChild(header);
  section.appendChild(body);
  renderAnalysisPanel(body);
  container.appendChild(section);
}

function renderAnalysisPanel(container) {
  const panel = document.createElement("div");
  panel.style.marginTop = "12px";

  const form = document.createElement("div");
  form.style.cssText =
    "display:grid;grid-template-columns:1fr 1fr 1fr auto;gap:12px;align-items:end;margin-bottom:16px";

  const engineGroup = document.createElement("div");
  engineGroup.innerHTML =
    '<label style="display:block;font-size:12px;color:#8b949e;margin-bottom:4px">Engine</label>';
  const engineSelect = document.createElement("select");
  engineSelect.style.cssText =
    "width:100%;padding:8px;background:#161b22;color:#c9d1d9;border:1px solid #30363d;border-radius:6px;font-size:13px";
  for (const eng of Object.keys(ENGINE_METHODS)) {
    const opt = document.createElement("option");
    opt.value = eng;
    opt.textContent = eng.replace(/_/g, " ");
    engineSelect.appendChild(opt);
  }
  engineGroup.appendChild(engineSelect);
  form.appendChild(engineGroup);

  const sourceGroup = document.createElement("div");
  sourceGroup.innerHTML =
    '<label style="display:block;font-size:12px;color:#8b949e;margin-bottom:4px">Data Source</label>';
  const sourceSelect = document.createElement("select");
  sourceSelect.style.cssText =
    "width:100%;padding:8px;background:#161b22;color:#c9d1d9;border:1px solid #30363d;border-radius:6px;font-size:13px";
  for (const src of SOURCE_OPTIONS) {
    const opt = document.createElement("option");
    opt.value = src.value;
    opt.textContent = src.label;
    sourceSelect.appendChild(opt);
  }
  sourceGroup.appendChild(sourceSelect);
  form.appendChild(sourceGroup);

  const methodGroup = document.createElement("div");
  methodGroup.innerHTML =
    '<label style="display:block;font-size:12px;color:#8b949e;margin-bottom:4px">Method</label>';
  const methodSelect = document.createElement("select");
  methodSelect.style.cssText =
    "width:100%;padding:8px;background:#161b22;color:#c9d1d9;border:1px solid #30363d;border-radius:6px;font-size:13px";

  function updateMethods() {
    const methods = ENGINE_METHODS[engineSelect.value] || [];
    methodSelect.innerHTML = "";
    for (const m of methods) {
      const opt = document.createElement("option");
      opt.value = m;
      opt.textContent = m.replace(/([A-Z])/g, " $1").trim();
      methodSelect.appendChild(opt);
    }
  }
  engineSelect.addEventListener("change", updateMethods);
  updateMethods();
  methodGroup.appendChild(methodSelect);
  form.appendChild(methodGroup);

  const btnGroup = document.createElement("div");
  const runBtn = document.createElement("button");
  runBtn.textContent = "Run";
  runBtn.style.cssText =
    "padding:8px 20px;background:#238636;color:#fff;border:none;border-radius:6px;font-size:13px;font-weight:600;cursor:pointer";
  runBtn.addEventListener("mouseenter", () => (runBtn.style.background = "#2ea043"));
  runBtn.addEventListener("mouseleave", () => (runBtn.style.background = "#238636"));
  btnGroup.appendChild(runBtn);
  form.appendChild(btnGroup);
  panel.appendChild(form);

  const resultArea = document.createElement("div");
  resultArea.style.cssText =
    "min-height:60px;background:#0d1117;border:1px solid #30363d;border-radius:8px;padding:16px;font-family:monospace;font-size:12px;color:#8b949e;overflow-x:auto;white-space:pre-wrap";
  resultArea.textContent = "Select an engine, source, and method, then click Run.";
  panel.appendChild(resultArea);

  runBtn.addEventListener("click", async () => {
    resultArea.textContent = "Running analysis...";
    resultArea.style.color = "#f0883e";
    runBtn.disabled = true;
    runBtn.textContent = "Running...";
    try {
      const resp = await fetch("/api/data-mine/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          engine: engineSelect.value,
          source: sourceSelect.value,
          method: methodSelect.value,
          params: {},
        }),
      });
      const result = await resp.json();
      if (result.success) {
        resultArea.style.color = "#3fb950";
        resultArea.textContent = JSON.stringify(result.result, null, 2);
      } else {
        resultArea.style.color = "#f85149";
        resultArea.textContent = `Error: ${result.error}`;
      }
    } catch (err) {
      resultArea.style.color = "#f85149";
      resultArea.textContent = `Error: ${err.message}`;
    } finally {
      runBtn.disabled = false;
      runBtn.textContent = "Run";
    }
  });

  container.appendChild(panel);
}

// ---- Section Wrapper (per-section error handling) ----

function buildSection(title, buildFn, data) {
  try {
    const result = buildFn(data);
    return result;
  } catch (err) {
    const frag = document.createDocumentFragment();
    frag.appendChild(sectionTitle(title));
    const note = document.createElement("div");
    note.style.cssText = "color:#8b949e;font-size:13px;padding:12px 0";
    note.textContent = `Unable to load this section: ${err.message}`;
    frag.appendChild(note);
    return frag;
  }
}

// ---- Main Render ----

export async function render(app) {
  app.innerHTML = '<div class="loading">Analyzing data sources\u2026</div>';

  const d = await fetchAllInsights();

  app.innerHTML = "";

  if (!d.status) {
    app.appendChild(errorBanner("Failed to connect to Data Mine. Is the extension running?"));
    return;
  }

  // Executive Summary
  app.appendChild(buildSection("Executive Summary", buildExecutiveSummary, d));

  // Hotel Pricing Intelligence
  app.appendChild(buildSection("Hotel Pricing", buildHotelIntelligence, d));

  // System Performance
  app.appendChild(buildSection("System Performance", buildSystemPerformance, d));

  // Network Health
  app.appendChild(buildSection("Network Health", buildNetworkHealth, d));

  // Graph Topology
  app.appendChild(buildSection("Graph Topology", buildGraphTopology, d));

  // Anomaly Alerts
  app.appendChild(buildSection("Anomaly Alerts", buildAnomalyAlerts, d));

  // Experiments (only if any exist)
  const expSection = buildSection("Experiments", buildExperiments, d);
  if (expSection) app.appendChild(expSection);

  // Technical Tools (collapsed)
  buildTechnicalTools(app);
}

// ---- Refresh ----

export async function refresh(app) {
  await render(app);
}

// ---- Destroy ----

export function destroy() {
  // No cleanup needed
}
