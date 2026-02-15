// ---------------------------------------------------------------------------
// Data Mine Extension — Plugin entry point
// Registers HTTP routes, background service, and event hooks.
// ---------------------------------------------------------------------------

import {
  handleDataMineStatus,
  handleAnalyze,
  handleGetResult,
  handleListResults,
  handleListDatasets,
  handleImportDataset,
  handleStats,
  handleCorrelations,
  handleTimeseries,
  handleClusters,
  handleAnomalies,
  handleGraph,
  handleCreateExperiment,
  handleListExperiments,
  handleGetExperiment,
  handleDataMineMetrics,
} from "./src/api-handlers.js";
import { startScheduler, stopScheduler } from "./src/pipeline/scheduler.js";

export default function dataMinePlugin(api: {
  registerHttpRoute: (opts: {
    method?: string;
    path: string;
    handler: (req: any, res: any) => void | Promise<void>;
  }) => void;
  registerService: (opts: {
    id: string;
    start: () => Promise<void>;
    stop: () => Promise<void>;
  }) => void;
  registerCli?: (registrar: any, opts: { commands: string[] }) => void;
  on?: (event: string, handler: (...args: any[]) => void) => void;
}) {
  // ---- GET /api/data-mine/status ----
  api.registerHttpRoute({
    method: "GET",
    path: "/api/data-mine/status",
    handler: async (_req, res) => {
      res.json(await handleDataMineStatus());
    },
  });

  // ---- POST /api/data-mine/analyze ----
  api.registerHttpRoute({
    method: "POST",
    path: "/api/data-mine/analyze",
    handler: async (req, res) => {
      const result = await handleAnalyze(req.body);
      if ((result as any).status) {
        res.status((result as any).status).json(result);
      } else {
        res.json(result);
      }
    },
  });

  // ---- GET /api/data-mine/results/:id ----
  api.registerHttpRoute({
    method: "GET",
    path: "/api/data-mine/results/:id",
    handler: async (req, res) => {
      const result = await handleGetResult(req.params.id);
      if ((result as any).status) {
        res.status((result as any).status).json(result);
      } else {
        res.json(result);
      }
    },
  });

  // ---- GET /api/data-mine/results ----
  api.registerHttpRoute({
    method: "GET",
    path: "/api/data-mine/results",
    handler: async (req, res) => {
      res.json(await handleListResults(req.query));
    },
  });

  // ---- GET /api/data-mine/datasets ----
  api.registerHttpRoute({
    method: "GET",
    path: "/api/data-mine/datasets",
    handler: async (_req, res) => {
      res.json(await handleListDatasets());
    },
  });

  // ---- POST /api/data-mine/datasets/import ----
  api.registerHttpRoute({
    method: "POST",
    path: "/api/data-mine/datasets/import",
    handler: async (req, res) => {
      const result = await handleImportDataset(req.body);
      if ((result as any).status) {
        res.status((result as any).status).json(result);
      } else {
        res.json(result);
      }
    },
  });

  // ---- GET /api/data-mine/stats ----
  api.registerHttpRoute({
    method: "GET",
    path: "/api/data-mine/stats",
    handler: async (req, res) => {
      res.json(await handleStats(req.query));
    },
  });

  // ---- GET /api/data-mine/correlations ----
  api.registerHttpRoute({
    method: "GET",
    path: "/api/data-mine/correlations",
    handler: async (req, res) => {
      res.json(await handleCorrelations(req.query));
    },
  });

  // ---- GET /api/data-mine/timeseries ----
  api.registerHttpRoute({
    method: "GET",
    path: "/api/data-mine/timeseries",
    handler: async (req, res) => {
      res.json(await handleTimeseries(req.query));
    },
  });

  // ---- GET /api/data-mine/clusters ----
  api.registerHttpRoute({
    method: "GET",
    path: "/api/data-mine/clusters",
    handler: async (req, res) => {
      res.json(await handleClusters(req.query));
    },
  });

  // ---- GET /api/data-mine/anomalies ----
  api.registerHttpRoute({
    method: "GET",
    path: "/api/data-mine/anomalies",
    handler: async (req, res) => {
      res.json(await handleAnomalies(req.query));
    },
  });

  // ---- GET /api/data-mine/graph ----
  api.registerHttpRoute({
    method: "GET",
    path: "/api/data-mine/graph",
    handler: async (req, res) => {
      res.json(await handleGraph(req.query));
    },
  });

  // ---- POST /api/data-mine/experiments ----
  api.registerHttpRoute({
    method: "POST",
    path: "/api/data-mine/experiments",
    handler: async (req, res) => {
      const result = await handleCreateExperiment(req.body);
      if ((result as any).status) {
        res.status((result as any).status).json(result);
      } else {
        res.json(result);
      }
    },
  });

  // ---- GET /api/data-mine/experiments ----
  api.registerHttpRoute({
    method: "GET",
    path: "/api/data-mine/experiments",
    handler: async (_req, res) => {
      res.json(await handleListExperiments());
    },
  });

  // ---- GET /api/data-mine/experiments/:id ----
  api.registerHttpRoute({
    method: "GET",
    path: "/api/data-mine/experiments/:id",
    handler: async (req, res) => {
      const result = await handleGetExperiment(req.params.id);
      if ((result as any).status) {
        res.status((result as any).status).json(result);
      } else {
        res.json(result);
      }
    },
  });

  // ---- GET /api/data-mine/metrics ----
  api.registerHttpRoute({
    method: "GET",
    path: "/api/data-mine/metrics",
    handler: async (_req, res) => {
      const result = await handleDataMineMetrics();
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.end(result);
    },
  });

  // ---- Background Service: Scheduled analyses ----
  api.registerService({
    id: "data-mine-scheduler",
    start: async () => {
      startScheduler();
    },
    stop: async () => {
      stopScheduler();
    },
  });
}
