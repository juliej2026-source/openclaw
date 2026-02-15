# Data Mine Extension — Ralph Loop Build Prompt

Build the Deep Data Mining Infrastructure as a new OpenClaw extension at extensions/data-mine/. This provides scientific, statistical, algorithmic, and experimental support for AI/ML functionality with 5 analysis engines.

PROGRESS TRACKING: On each iteration, check what files already exist and what phase you're on. Continue from where you left off. The phases are:

=== PHASE 1: SCAFFOLD + TYPES ===
Create the extension skeleton:

- extensions/data-mine/package.json (name: @openclaw/data-mine, deps: simple-statistics ^7.8.7, ml-kmeans ^6.0.0, ml-pca ^4.1.1, ml-regression-simple-linear ^3.0.0, ml-regression-polynomial ^3.0.0, ml-regression-multivariate-linear ^2.0.4, graphology ^0.25.4, graphology-metrics ^2.3.0, graphology-communities-louvain ^2.0.1, graphology-shortest-path ^2.1.0, convex ^1.17.4, csv-parse ^5.6.0)
- extensions/data-mine/openclaw.plugin.json (id: data-mine, empty configSchema)
- extensions/data-mine/index.ts (minimal plugin with GET /api/data-mine/status health route)
- extensions/data-mine/src/types.ts with:
  - ENGINE_IDS tuple: statistics, timeseries, clustering, graph_analytics, experiments
  - EngineId type from tuple
  - DATA_SOURCE_IDS tuple: neural_graph, hotel_scraper, meta_engine, network, custom
  - DataSourceId type from tuple
  - DataPoint: { timestamp: number; value: number; label?: string; metadata?: Record<string, unknown> }
  - DataSeries: { id: string; name: string; source: DataSourceId; points: DataPoint[]; unit?: string; metadata?: Record<string, unknown> }
  - AnalysisRequest: { engine: EngineId; source: DataSourceId; method: string; params: Record<string, unknown>; datasetId?: string; rawData?: DataSeries[] }
  - AnalysisResult: { id: string; engine: EngineId; method: string; source: DataSourceId; result: unknown; metadata: { startedAt: string; completedAt: string; durationMs: number; dataPointCount: number }; success: boolean; error?: string }
  - DescriptiveStats: { count, mean, median, mode, min, max, range, stdDev, variance, skewness, kurtosis, q1, q3, iqr, percentiles: Record<number, number> }
  - CorrelationResult: { variableA: string; variableB: string; pearson: number; spearman: number; pValue: number }
  - CorrelationMatrix: { variables: string[]; matrix: number[][]; method: 'pearson' | 'spearman' }
  - RegressionResult: { type: 'linear' | 'polynomial' | 'multivariate'; coefficients: number[]; intercept: number; rSquared: number; residuals: number[]; predictions: number[] }
  - TimeSeriesResult: { trend: DataPoint[]; seasonal?: DataPoint[]; residual?: DataPoint[]; forecast?: DataPoint[]; changePoints?: number[]; parameters: Record<string, unknown> }
  - MovingAverageType: 'sma' | 'ema' | 'wma'
  - ClusterResult: { k: number; clusters: Array<{ centroid: number[]; points: number[][]; size: number }>; labels: number[]; silhouetteScore: number; inertia: number }
  - PCAResult: { eigenvalues: number[]; eigenvectors: number[][]; explainedVariance: number[]; cumulativeVariance: number[]; projections: number[][] }
  - AnomalyResult: { anomalies: Array<{ index: number; value: number; score: number; method: string }>; threshold: number; method: string; totalPoints: number; anomalyRate: number }
  - AnomalyMethod: 'zscore' | 'iqr' | 'mahalanobis'
  - GraphNode: { id: string; label?: string; weight?: number; metadata?: Record<string, unknown> }
  - GraphEdge: { source: string; target: string; weight?: number; metadata?: Record<string, unknown> }
  - CentralityResult: { nodeId: string; degree: number; betweenness: number; closeness: number; pageRank: number }
  - CommunityResult: { communities: Array<{ id: number; nodes: string[]; size: number }>; modularity: number; algorithm: string }
  - GraphMetrics: { nodeCount: number; edgeCount: number; density: number; diameter: number; avgPathLength: number; clusteringCoefficient: number; connectedComponents: number; isConnected: boolean }
  - ExperimentConfig: { id: string; name: string; description: string; groups: string[]; metric: string; hypothesis: string; alpha: number; minSampleSize: number; createdAt: string }
  - ExperimentObservation: { experimentId: string; group: string; value: number; timestamp: string; metadata?: Record<string, unknown> }
  - ExperimentResult: { experimentId: string; config: ExperimentConfig; groupStats: Record<string, DescriptiveStats>; tTest?: HypothesisTest; mannWhitney?: HypothesisTest; effectSize?: { cohensD: number; interpretation: string }; significant: boolean; recommendation: string }
  - HypothesisTest: { testName: string; statistic: number; pValue: number; degreesOfFreedom?: number; significant: boolean; confidenceInterval?: [number, number]; confidenceLevel: number }
  - Constants: STATION_ID = "iot-hub", ANALYSIS_CACHE_TTL_MS = 300000 (5min), SCHEDULED_INTERVAL_MS = 3600000 (1hr), MAX_DATA_POINTS = 100000
- extensions/data-mine/src/tests/types.test.ts — validate all type constants, tuple lengths, data structure shapes
- Run: cd /home/admin/openclaw && pnpm install && pnpm vitest run extensions/data-mine/src/tests/types.test.ts
  DONE WHEN: package.json, plugin manifest, types, and test all exist and pass.

=== PHASE 2: STATISTICS ENGINE ===
REFERENCE: Read extensions/hotel-scraper/src/processing/data-quality.ts for IQR pattern, extensions/hotel-scraper/src/processing/entity-resolution.ts for scoring patterns.
Create:

- src/engines/statistics.ts — Using simple-statistics + ml-regression-\*:
  - descriptiveStats(data: number[]): DescriptiveStats — mean, median, mode (using simple-statistics), stdDev, variance, skewness (using ss.sampleSkewness), kurtosis (using ss.sampleKurtosis), percentiles (5,10,25,50,75,90,95), IQR, range, count. Handle empty arrays gracefully.
  - correlationMatrix(variables: Record<string, number[]>): CorrelationMatrix — For each pair compute Pearson (ss.sampleCorrelation) and Spearman (rank-transform then Pearson). Return full symmetric matrix.
  - correlationPair(a: number[], b: number[]): CorrelationResult — Single pair Pearson + Spearman + approximate p-value using t-distribution approximation.
  - linearRegression(x: number[], y: number[]): RegressionResult — Using ml-regression-simple-linear: slope, intercept, r-squared, predictions, residuals.
  - polynomialRegression(x: number[], y: number[], degree: number): RegressionResult — Using ml-regression-polynomial: coefficients, r-squared, predictions, residuals.
  - multivariateRegression(features: number[][], target: number[]): RegressionResult — Using ml-regression-multivariate-linear: coefficients, r-squared.
  - distributionTest(data: number[]): { isNormal: boolean; skewnessZ: number; kurtosisZ: number; jarqueBera: { statistic: number; pValue: number } } — Jarque-Bera test for normality using skewness + kurtosis.
  - spearmanCorrelation(a: number[], b: number[]): number — Rank-transform helper.
- src/tests/statistics.test.ts — Test with:
  - Known dataset: [2,4,4,4,5,5,7,9] -> mean=5, median=4.5, mode=4, stdDev known
  - Perfect positive correlation: correlationPair([1,2,3],[2,4,6]) -> pearson ~1.0
  - No correlation: two random orthogonal series -> pearson ~0
  - Linear regression: y = 2x + 1 with noise -> slope ~2, intercept ~1
  - Polynomial: y = x^2 -> degree 2 fits well
  - Normal data -> isNormal = true, uniform data -> isNormal = false
  - Edge cases: empty array, single element, all same values
- Run: pnpm vitest run extensions/data-mine/src/tests/statistics.test.ts
  DONE WHEN: All stats functions return correct values, tests pass.

=== PHASE 3: TIME-SERIES ENGINE ===
Create:

- src/engines/timeseries.ts:
  - movingAverage(values: number[], window: number, type: MovingAverageType): number[] — SMA: simple mean of window. EMA: exponential with alpha=2/(window+1). WMA: weighted (newest=window weight, oldest=1). Returns array same length as input (NaN for insufficient data at start).
  - trendDetection(series: DataPoint[]): { direction: 'up' | 'down' | 'flat'; slope: number; rSquared: number; significance: boolean } — Linear regression on timestamp vs value, direction from slope sign, significance from r-squared > 0.5.
  - seasonalityDecomposition(values: number[], period: number): { trend: number[]; seasonal: number[]; residual: number[] } — Classical decomposition: trend via centered moving average of `period` length, seasonal = average of same-phase deviations, residual = original - trend - seasonal.
  - changePointDetection(values: number[], threshold?: number): number[] — CUSUM algorithm: cumulative sum of deviations from mean, flag points where |CUSUM| exceeds threshold (default: 2 \* stdDev). Returns indices.
  - forecast(values: number[], horizon: number, method?: 'ses' | 'holt'): number[] — Simple Exponential Smoothing (alpha auto from MSE minimization grid search 0.1-0.9) or Holt linear trend method. Returns `horizon` future values.
  - rollingStats(values: number[], window: number): Array<{ mean: number; stdDev: number; min: number; max: number }> — Rolling descriptive stats.
- src/tests/timeseries.test.ts — Test with:
  - SMA of [1,2,3,4,5] window=3 -> [NaN,NaN,2,3,4]
  - EMA converges to mean for constant series
  - Trend detection: linearly increasing series -> direction='up', high r-squared
  - Seasonality: sin wave with period 12 -> seasonal component captures oscillation
  - Change point: series with mean shift at midpoint -> detects change near midpoint
  - Forecast: constant series -> forecast same value
  - Rolling stats: window=3, verify means match expected
- Run: pnpm vitest run extensions/data-mine/src/tests/timeseries.test.ts
  DONE WHEN: All time-series functions work correctly, tests pass.

=== PHASE 4: ML/CLUSTERING ENGINE ===
Create:

- src/engines/clustering.ts — Using ml-kmeans + ml-pca:
  - kMeansClustering(data: number[][], k: number, options?: { maxIterations?: number; seed?: number }): ClusterResult — Run ml-kmeans, compute silhouette score, return clusters with centroids, labels, inertia.
  - pcaAnalysis(data: number[][], components?: number): PCAResult — Run ml-pca, return eigenvalues, eigenvectors, explained variance ratios, cumulative variance, projected data.
  - anomalyDetection(data: number[], method: AnomalyMethod, threshold?: number): AnomalyResult — Three methods:
    - zscore: |z| > threshold (default 3.0)
    - iqr: outside Q1 - 1.5*IQR to Q3 + 1.5*IQR
    - mahalanobis: for multivariate data (number[][]), distance > threshold
  - silhouetteScore(data: number[][], labels: number[]): number — Average silhouette coefficient: for each point compute (b-a)/max(a,b) where a=avg intra-cluster dist, b=avg nearest-cluster dist.
  - elbowMethod(data: number[][], maxK?: number): Array<{ k: number; inertia: number }> — Run K-means for k=1..maxK (default 10), return inertia curve for elbow detection.
  - normalizeData(data: number[][]): { normalized: number[][]; means: number[]; stdDevs: number[] } — Z-score normalization per feature.
- src/tests/clustering.test.ts — Test with:
  - Well-separated 2D clusters (e.g., 3 clusters at (0,0), (10,0), (5,10)) -> k=3 recovers clusters, silhouette > 0.7
  - PCA on correlated 2D data -> first component explains >80% variance
  - Z-score anomaly: [1,1,1,1,100,1,1] -> detects 100 as anomaly
  - IQR anomaly: same pattern
  - Elbow method: returns decreasing inertia curve
  - Silhouette: perfect clusters -> score near 1.0
- Run: pnpm vitest run extensions/data-mine/src/tests/clustering.test.ts
  DONE WHEN: Clustering, PCA, and anomaly detection work, tests pass.

=== PHASE 5: GRAPH ANALYTICS ENGINE ===
Create:

- src/engines/graph-analytics.ts — Using graphology + graphology-metrics + graphology-communities-louvain + graphology-shortest-path:
  - buildGraph(nodes: GraphNode[], edges: GraphEdge[]): Graph — Create graphology UndirectedGraph (or DirectedGraph based on edges), add nodes with attributes, add edges with weights.
  - centralityAnalysis(graph: Graph): CentralityResult[] — For each node: degree centrality (degree/maxDegree), betweenness (graphology-metrics betweennessCentrality), closeness (1/avg shortest path), PageRank (power iteration: damping=0.85, iterations=100, tolerance=1e-6).
  - communityDetection(graph: Graph): CommunityResult — Louvain algorithm via graphology-communities-louvain, compute modularity, group nodes by community.
  - pathAnalysis(graph: Graph, source: string, target: string): { shortestPath: string[]; distance: number; allPaths?: string[][] } — Dijkstra shortest path via graphology-shortest-path. If small graph (<50 nodes), also find all simple paths (BFS with visited set, max depth 10).
  - graphMetrics(graph: Graph): GraphMetrics — nodeCount, edgeCount, density (2*edges/(nodes*(nodes-1))), diameter (longest shortest path), avgPathLength, clusteringCoefficient (graphology-metrics), connectedComponents (BFS/DFS count), isConnected.
  - neuralGraphAnalysis(): Promise<{ centrality: CentralityResult[]; communities: CommunityResult; metrics: GraphMetrics; insights: string[] }> — Specialized: lazy import neural-graph topology data, build graph, run all analyses, generate text insights (e.g., "Node X is a bottleneck with betweenness 0.8", "3 communities detected", "Graph density 0.4 suggests moderate connectivity").
- src/tests/graph-analytics.test.ts — Test with:
  - Triangle graph (A-B, B-C, A-C): density=1.0, clustering coefficient=1.0, diameter=1
  - Star graph (center connected to 4 leaves): center has highest betweenness and degree
  - Two disconnected components: connectedComponents=2, isConnected=false
  - Path graph (A-B-C-D): shortest path A->D = [A,B,C,D], distance=3
  - Community detection on two dense groups with sparse cross-edges -> detects 2 communities
- Run: pnpm vitest run extensions/data-mine/src/tests/graph-analytics.test.ts
  DONE WHEN: Graph analytics functions work correctly, tests pass.

=== PHASE 6: EXPERIMENT ENGINE (A/B TESTING) ===
Create:

- src/engines/experiments.ts — Using simple-statistics for distributions:
  - tTest(groupA: number[], groupB: number[], options?: { paired?: boolean; alpha?: number }): HypothesisTest — Independent two-sample t-test: pooled variance, t-statistic = (meanA - meanB) / sqrt(sp^2 \* (1/nA + 1/nB)), df = nA + nB - 2. Paired: t-statistic on differences. P-value via t-distribution CDF approximation (use regularized incomplete beta function). Confidence interval for mean difference.
  - chiSquaredTest(observed: number[], expected: number[]): HypothesisTest — Chi-squared = sum((O-E)^2/E), df = categories - 1. P-value via chi-squared CDF approximation (use regularized incomplete gamma function).
  - mannWhitneyU(groupA: number[], groupB: number[]): HypothesisTest — Rank all values, U = sum of ranks in smaller group - n\*(n+1)/2. For n>20, approximate with normal distribution. P-value from z-score.
  - effectSize(groupA: number[], groupB: number[]): { cohensD: number; interpretation: 'negligible' | 'small' | 'medium' | 'large' } — Cohen's d = (meanA - meanB) / pooled stdDev. Interpretation: |d| < 0.2 negligible, < 0.5 small, < 0.8 medium, >= 0.8 large.
  - confidenceInterval(data: number[], level?: number): [number, number] — CI for mean using t-distribution. Default level = 0.95.
  - sampleSizeCalculation(effectSize: number, power?: number, alpha?: number): number — Required sample size per group for given effect size, power (default 0.8), alpha (default 0.05). Formula: n = (z_alpha + z_power)^2 \* 2 / effectSize^2.
  - createExperiment(config: Omit<ExperimentConfig, 'id' | 'createdAt'>): ExperimentConfig — Create and store experiment config.
  - recordObservation(observation: ExperimentObservation): void — Append observation to in-memory store.
  - evaluateExperiment(experimentId: string): ExperimentResult — Pull all observations, compute group stats, run t-test + Mann-Whitney + effect size, determine significance, generate recommendation.
  - getExperiments(): ExperimentConfig[] — List all experiments.
  - getExperiment(experimentId: string): ExperimentConfig | undefined — Get single experiment.
    NOTE: Use in-memory stores (Map) for experiments and observations. The regularized incomplete beta/gamma functions should be implemented as numerical approximations (Lanczos for gamma, continued fraction for beta).
- src/tests/experiments.test.ts — Test with:
  - t-test with significantly different groups (mean=10 vs mean=20, stdDev=3, n=30) -> significant=true, pValue < 0.05
  - t-test with same distribution -> significant=false
  - Chi-squared: observed matches expected -> not significant
  - Chi-squared: heavily skewed observed -> significant
  - Mann-Whitney: different medians -> significant
  - Effect size: large difference -> cohensD > 0.8, interpretation='large'
  - Confidence interval: [1,2,3,4,5] at 95% -> interval contains mean=3
  - Sample size: effectSize=0.5, power=0.8, alpha=0.05 -> ~64 per group
  - Full experiment lifecycle: create -> record 50 observations each group -> evaluate -> get result
- Run: pnpm vitest run extensions/data-mine/src/tests/experiments.test.ts
  DONE WHEN: All hypothesis tests work, experiment lifecycle works, tests pass.

=== PHASE 7: DATA CONNECTORS + PIPELINE ===
REFERENCE: Read extensions/hive-mind/src/wellness-api.ts for lazy import pattern. Read extensions/neural-graph/src/types.ts for execution/node types. Read extensions/hotel-scraper/src/types.ts for hotel/price types. Read extensions/meta-engine/src/types.ts for performance types.
Create:

- src/connectors/neural-connector.ts:
  - getNeuralExecutions(): Promise<DataSeries[]> — Lazy import neural-graph execution log, transform to DataSeries (one per metric: latency, success rate, node count). Falls back to mock data if import fails.
  - getNeuralTopology(): Promise<{ nodes: GraphNode[]; edges: GraphEdge[] }> — Lazy import neural-graph graph state, transform nodes/edges to generic GraphNode/GraphEdge format.
- src/connectors/hotel-connector.ts:
  - getHotelPrices(): Promise<DataSeries[]> — Lazy import hotel-scraper data, transform to DataSeries (one per hotel or area: price over time). Falls back to mock data.
  - getHotelAvailability(): Promise<DataSeries[]> — Availability percentage over time.
- src/connectors/meta-connector.ts:
  - getModelPerformance(): Promise<DataSeries[]> — Lazy import meta-engine performance data, transform to DataSeries (latency, success rate per model). Falls back to mock data.
  - getTaskDistribution(): Promise<Record<string, number>> — Task type frequency counts.
- src/connectors/network-connector.ts:
  - getNetworkTelemetry(): Promise<DataSeries[]> — Read from hive-mind station identity/network data. Falls back to mock data.
- src/connectors/csv-connector.ts:
  - parseCSV(content: string, options?: { delimiter?: string; hasHeader?: boolean; timestampColumn?: string; valueColumn?: string }): DataSeries — Using csv-parse/sync. Auto-detect numeric columns.
  - parseJSON(content: string): DataSeries — Parse JSON array of {timestamp, value} or {x, y} objects.
- src/pipeline/pipeline.ts:
  - runAnalysis(request: AnalysisRequest): Promise<AnalysisResult> — 1) Fetch data from connector (based on request.source), 2) Validate data (non-empty, numeric), 3) Route to engine (based on request.engine + request.method), 4) Format result as AnalysisResult, 5) Cache result in memory (TTL 5min). Store results in-memory Map.
  - getResult(id: string): AnalysisResult | undefined
  - getResults(limit?: number, offset?: number): { results: AnalysisResult[]; total: number }
- src/pipeline/scheduler.ts:
  - ScheduledJob type: { id: string; name: string; request: AnalysisRequest; intervalMs: number; lastRun?: string; enabled: boolean }
  - DEFAULT_JOBS: Array of 4 default scheduled jobs (neural health check, hotel price trends, model performance summary, anomaly scan)
  - startScheduler(): void — Start interval timers for each enabled job.
  - stopScheduler(): void — Clear all interval timers.
  - getScheduledJobs(): ScheduledJob[]
- src/tests/connectors.test.ts — Test mock data fallbacks return valid DataSeries
- src/tests/pipeline.test.ts — Test pipeline routes correctly, caches results, handles errors
- Run: pnpm vitest run extensions/data-mine/src/tests/connectors.test.ts extensions/data-mine/src/tests/pipeline.test.ts
  DONE WHEN: Connectors return data, pipeline routes correctly, tests pass.

=== PHASE 8: API HANDLERS + PLUGIN WIRING ===
REFERENCE: Read extensions/wellness-concierge/src/api-handlers.ts for handler pattern. Read extensions/wellness-concierge/index.ts for plugin registration. Read extensions/hive-mind/src/serve.ts for route table pattern.
Create/update:

- src/api-handlers.ts with 16 handlers:
  - handleDataMineStatus(): { status, engines: 5, dataSources: 5, totalAnalyses, cachedResults, uptime }
  - handleAnalyze(body: AnalysisRequest): AnalysisResult — call pipeline.runAnalysis()
  - handleGetResult(id: string): AnalysisResult
  - handleListResults(query?: { limit, offset }): { results, total, limit, offset }
  - handleListDatasets(): { datasets: Array<{ id, name, source, pointCount, lastUpdated }> }
  - handleImportDataset(body: { format, content, name }): { datasetId, pointCount }
  - handleStats(query?: { source, dataset }): DescriptiveStats — run statistics.descriptiveStats on requested data
  - handleCorrelations(query?: { source, variables }): CorrelationMatrix
  - handleTimeseries(query?: { source, method, window, horizon }): TimeSeriesResult
  - handleClusters(query?: { source, k, method }): ClusterResult
  - handleAnomalies(query?: { source, method, threshold }): AnomalyResult
  - handleGraph(query?: { source }): { centrality, communities, metrics }
  - handleCreateExperiment(body: ExperimentConfig): ExperimentConfig
  - handleListExperiments(): { experiments, total }
  - handleGetExperiment(id: string): ExperimentResult
  - handleDataMineMetrics(): string — Prometheus format
- src/metrics/mine-metrics.ts:
  - Counters: analyses_total, datasets_imported, experiments_created, anomalies_detected
  - Gauges: active_analyses, cached_results, avg_analysis_duration_ms
  - formatMetrics(): string — Prometheus exposition format
- index.ts — Full plugin entry point:
  - Register all 16 HTTP routes (GET and POST as specified in API Routes table)
  - Register background service: start scheduler, cleanup expired cache
  - Register agent_end hook: feed execution data to neural connector
- Wire into hive-mind:
  - Create extensions/hive-mind/src/data-mine-api.ts — proxy handlers using lazy import pattern (like wellness-api.ts)
  - Edit extensions/hive-mind/src/serve.ts — add data-mine routes to ROUTES table + POST endpoints
- src/tests/api-handlers.test.ts — Test all 16 handlers return expected shapes
- Run: pnpm vitest run extensions/data-mine/src/tests/api-handlers.test.ts
  DONE WHEN: All 16 handlers work, hive-mind route wiring done, tests pass.

=== PHASE 9: CONVEX PERSISTENCE + PORTAL PAGE ===
REFERENCE: Read extensions/neural-graph/convex/schema.ts for Convex table patterns. Read extensions/hive-mind/portal/htdocs/js/pages/wellness.js for portal page pattern. Read extensions/hive-mind/portal/htdocs/js/router.js for route registration. Read extensions/hive-mind/portal/htdocs/js/components.js for component library.
Create:

- convex/schema.ts — 5 tables:
  - analysis_results: id, engine, method, source, result (JSON string), durationMs, dataPointCount, success, error, createdAt; indexes by engine, source, createdAt
  - datasets: id, name, source, format, pointCount, metadata, createdAt, updatedAt; indexes by name, source
  - experiments: id, name, description, groups, metric, hypothesis, alpha, minSampleSize, status, createdAt; indexes by status
  - experiment_observations: experimentId, group, value, timestamp, metadata; indexes by experimentId
  - analysis_snapshots: id, type (daily_summary | anomaly_report | trend_report), data (JSON string), createdAt; indexes by type, createdAt
- src/persistence/convex-client.ts — getConvexClient() singleton (same pattern as neural-graph)
- Portal page extensions/hive-mind/portal/htdocs/js/pages/data-mine.js:
  - Fetch functions: fetchStatus(), fetchResults(), fetchDatasets(), fetchExperiments()
  - Top: 6 status cards using card() + cardGrid() components:
    - Total Analyses (status.totalAnalyses, status: 'info')
    - Active Datasets (datasets.length, status: 'ok')
    - Experiments (experiments.length, status: 'info')
    - Anomalies (count from recent anomaly results, status: warn if >0)
    - Avg Duration (status.avgDurationMs + 'ms', status: 'ok')
    - Cache Hit Rate (computed from cached/total, status: 'ok')
  - Middle section: "Analysis Engine" panel — 5 engine badges (one per engine, colored), brief description of each
  - Data Sources section: 5 data source badges, each showing last data fetch time
  - Recent Results table using dataTable():
    - Columns: ID (mono), Engine, Method, Source, Duration, Points, Status, Time
    - Rows from recent results
  - Active Experiments table:
    - Columns: ID (mono), Name, Groups, Metric, Status, Created
  - Fullscreen button for SVG charts (placeholder for future D3 charts)
  - export async function render(app) — full page render
  - export async function refresh(app) — re-render on 30s interval
  - export function destroy() — cleanup
- Edit extensions/hive-mind/portal/htdocs/js/router.js — add "/data-mine" route: () => import("./pages/data-mine.js")
- Edit extensions/hive-mind/portal/htdocs/index.html — add Data Mine nav link in sidebar (use chart/graph SVG icon, place after Wellness)
- Deploy: rsync -av extensions/hive-mind/portal/htdocs/ /opt/openclaw-portal/htdocs/
  DONE WHEN: Portal page renders at /#/data-mine with cards + tables, Convex schema compiles.

=== PHASE 10: INTEGRATION TESTING + POLISH ===
Create:

- src/tests/integration.test.ts — End-to-end flows:
  - Statistics flow: create mock hotel price DataSeries -> run pipeline with engine=statistics, method=descriptiveStats -> verify AnalysisResult has correct stats
  - Correlation flow: create two correlated DataSeries -> run correlationMatrix -> verify high correlation
  - Time-Series flow: create trending DataSeries -> run trendDetection -> verify direction='up'
  - Clustering flow: create 3-cluster synthetic data -> run kMeansClustering k=3 -> verify 3 clusters, silhouette > 0.5
  - Graph flow: create small graph -> run centralityAnalysis -> verify centrality values
  - Experiment flow: create experiment -> record 50 observations per group (different means) -> evaluate -> verify significant=true
  - Anomaly flow: create DataSeries with outliers -> run anomalyDetection -> verify outliers detected
  - Pipeline flow: full AnalysisRequest -> pipeline.runAnalysis() -> verify result cached -> getResult() returns same
  - API handler flow: handleAnalyze() -> handleGetResult() -> handleListResults() -> verify consistency
  - Edge cases: empty data -> graceful error, invalid engine -> error, unknown dataset -> error
- Run ALL tests: pnpm vitest run extensions/data-mine/
- Fix any failures
- Restart hive-mind server: kill existing process, start with npx tsx extensions/hive-mind/src/serve.ts
- Verify: curl http://localhost:3001/api/data-mine/status
- Verify portal page in browser at /#/data-mine
- Commit all changes
  DONE WHEN: All tests pass, portal functional, server running clean.

COMPLETION CRITERIA: All 10 phases are complete. All test files pass with vitest. The server starts cleanly with all /api/data-mine/\* routes registered. The portal page at /#/data-mine renders with status cards, engine badges, recent results table, and experiments panel.
