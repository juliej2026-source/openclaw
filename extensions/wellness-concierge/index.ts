// ---------------------------------------------------------------------------
// Wellness Concierge Extension — Plugin entry point
// Registers HTTP routes, background service, and event hooks.
// ---------------------------------------------------------------------------

import {
  handleWellnessStatus,
  handleWellnessQuery,
  handleWellnessSessions,
  handleWellnessSessionDetail,
  handleWellnessConsent,
  handleWellnessAgents,
  handleWellnessTools,
  handleWellnessAudit,
  handleWellnessCapa,
  handleWellnessEscalate,
  handleWellnessMetrics,
} from "./src/api-handlers.js";

export default function wellnessConciergePlugin(api: {
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
  // ---- GET /api/wellness/status ----
  api.registerHttpRoute({
    method: "GET",
    path: "/api/wellness/status",
    handler: async (_req, res) => {
      const result = await handleWellnessStatus();
      res.json(result);
    },
  });

  // ---- POST /api/wellness/query ----
  api.registerHttpRoute({
    method: "POST",
    path: "/api/wellness/query",
    handler: async (req, res) => {
      const result = await handleWellnessQuery(req.body);
      if (result.status) {
        res.status(result.status).json(result);
      } else {
        res.json(result);
      }
    },
  });

  // ---- GET /api/wellness/sessions ----
  api.registerHttpRoute({
    method: "GET",
    path: "/api/wellness/sessions",
    handler: async (_req, res) => {
      const result = await handleWellnessSessions();
      res.json(result);
    },
  });

  // ---- GET /api/wellness/session/:id ----
  api.registerHttpRoute({
    method: "GET",
    path: "/api/wellness/session/:id",
    handler: async (req, res) => {
      const result = await handleWellnessSessionDetail(req.params.id);
      if (result.status) {
        res.status(result.status).json(result);
      } else {
        res.json(result);
      }
    },
  });

  // ---- POST /api/wellness/consent ----
  api.registerHttpRoute({
    method: "POST",
    path: "/api/wellness/consent",
    handler: async (req, res) => {
      const result = await handleWellnessConsent(req.body);
      if (result.status) {
        res.status(result.status).json(result);
      } else {
        res.json(result);
      }
    },
  });

  // ---- GET /api/wellness/agents ----
  api.registerHttpRoute({
    method: "GET",
    path: "/api/wellness/agents",
    handler: async (_req, res) => {
      const result = await handleWellnessAgents();
      res.json(result);
    },
  });

  // ---- GET /api/wellness/tools ----
  api.registerHttpRoute({
    method: "GET",
    path: "/api/wellness/tools",
    handler: async (_req, res) => {
      const result = await handleWellnessTools();
      res.json(result);
    },
  });

  // ---- GET /api/wellness/audit ----
  api.registerHttpRoute({
    method: "GET",
    path: "/api/wellness/audit",
    handler: async (req, res) => {
      const result = await handleWellnessAudit(req.query);
      res.json(result);
    },
  });

  // ---- GET /api/wellness/capa ----
  api.registerHttpRoute({
    method: "GET",
    path: "/api/wellness/capa",
    handler: async (_req, res) => {
      const result = await handleWellnessCapa();
      res.json(result);
    },
  });

  // ---- POST /api/wellness/escalate ----
  api.registerHttpRoute({
    method: "POST",
    path: "/api/wellness/escalate",
    handler: async (req, res) => {
      const result = await handleWellnessEscalate(req.body);
      if (result.status) {
        res.status(result.status).json(result);
      } else {
        res.json(result);
      }
    },
  });

  // ---- GET /api/wellness/metrics ----
  api.registerHttpRoute({
    method: "GET",
    path: "/api/wellness/metrics",
    handler: async (_req, res) => {
      const result = await handleWellnessMetrics();
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.end(result);
    },
  });

  // ---- Background Service: Session cleanup ----
  let cleanupInterval: ReturnType<typeof setInterval> | null = null;

  api.registerService({
    id: "wellness-session-cleanup",
    start: async () => {
      cleanupInterval = setInterval(
        () => {
          // Clean up stale sessions older than 24h
          const cutoff = Date.now() - 24 * 60 * 60 * 1000;
          // In production: query Convex for stale sessions
        },
        30 * 60 * 1000, // every 30 minutes
      );
    },
    stop: async () => {
      if (cleanupInterval) {
        clearInterval(cleanupInterval);
        cleanupInterval = null;
      }
    },
  });
}
