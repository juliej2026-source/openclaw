import {
  handleNeuralStatus,
  handleNeuralTopology,
  handleNeuralQuery,
  handleNeuralGenesis,
  handleNeuralEvolve,
  handleNeuralApprove,
  handleNeuralReject,
  handleNeuralPending,
  handleNeuralEvents,
  handleNeuralExecutions,
} from "./src/api-handlers.js";
import { runNeuralCli } from "./src/cli/neural-cli.js";
import { seedGenesis, runEvolutionCycle } from "./src/maturation/lifecycle.js";
import { renderNeuralMetrics } from "./src/metrics/neural-metrics.js";
import { isConvexHealthy } from "./src/persistence/convex-client.js";
import { EVOLUTION_INTERVAL_MS } from "./src/types.js";

// ---------------------------------------------------------------------------
// Neural Graph Extension — Plugin entry point
// Registers HTTP routes, background service, CLI, and event hooks.
// ---------------------------------------------------------------------------

const STATION_ID = "iot-hub";
let evolutionTimer: ReturnType<typeof setInterval> | null = null;

export default function neuralGraphPlugin(api: {
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
  // ---- HTTP Routes (/api/neural/*) ----

  api.registerHttpRoute({
    method: "GET",
    path: "/api/neural/status",
    handler: async (_req, res) => {
      const data = await handleNeuralStatus(STATION_ID);
      res.json(data);
    },
  });

  api.registerHttpRoute({
    method: "GET",
    path: "/api/neural/topology",
    handler: async (_req, res) => {
      const data = await handleNeuralTopology(STATION_ID);
      res.json(data);
    },
  });

  api.registerHttpRoute({
    method: "POST",
    path: "/api/neural/query",
    handler: async (req, res) => {
      const body = req.body ?? {};
      const data = await handleNeuralQuery({
        task: body.task ?? "",
        taskType: body.taskType,
        complexity: body.complexity,
        stationId: STATION_ID,
      });
      res.json(data);
    },
  });

  api.registerHttpRoute({
    method: "POST",
    path: "/api/neural/genesis",
    handler: async (_req, res) => {
      const data = await handleNeuralGenesis(STATION_ID);
      res.json(data);
    },
  });

  api.registerHttpRoute({
    method: "POST",
    path: "/api/neural/evolve",
    handler: async (_req, res) => {
      const data = await handleNeuralEvolve(STATION_ID);
      res.json(data);
    },
  });

  api.registerHttpRoute({
    method: "POST",
    path: "/api/neural/approve",
    handler: async (req, res) => {
      const { eventId } = req.body ?? {};
      const data = await handleNeuralApprove(eventId);
      res.json(data);
    },
  });

  api.registerHttpRoute({
    method: "POST",
    path: "/api/neural/reject",
    handler: async (req, res) => {
      const { eventId } = req.body ?? {};
      const data = await handleNeuralReject(eventId);
      res.json(data);
    },
  });

  api.registerHttpRoute({
    method: "GET",
    path: "/api/neural/pending",
    handler: async (_req, res) => {
      const data = await handleNeuralPending();
      res.json(data);
    },
  });

  api.registerHttpRoute({
    method: "GET",
    path: "/api/neural/events",
    handler: async (_req, res) => {
      const data = await handleNeuralEvents(STATION_ID);
      res.json(data);
    },
  });

  api.registerHttpRoute({
    method: "GET",
    path: "/api/neural/executions",
    handler: async (_req, res) => {
      const data = await handleNeuralExecutions(STATION_ID);
      res.json(data);
    },
  });

  api.registerHttpRoute({
    method: "GET",
    path: "/api/neural/metrics",
    handler: async (_req, res) => {
      const metrics = await renderNeuralMetrics(STATION_ID);
      res.setHeader?.("Content-Type", "text/plain; version=0.0.4");
      res.end?.(metrics) ?? res.text?.(metrics);
    },
  });

  // ---- Background Service (evolution cycle) ----

  api.registerService({
    id: "neural-graph-evolution",
    start: async () => {
      // Check Convex connectivity and seed genesis if needed
      const healthy = await isConvexHealthy();
      if (healthy) {
        try {
          await seedGenesis(STATION_ID);
          console.log("[neural-graph] Genesis seeded");
        } catch {
          // Already seeded — ignore
        }
      }

      // Start periodic evolution cycle
      evolutionTimer = setInterval(async () => {
        try {
          const result = await runEvolutionCycle(STATION_ID);
          if (result.phaseTransition) {
            console.log(
              `[neural-graph] Phase transition: → ${result.phase} (${result.totalExecutions} executions)`,
            );
          }
        } catch (err) {
          console.error("[neural-graph] Evolution cycle failed:", err);
        }
      }, EVOLUTION_INTERVAL_MS);

      console.log("[neural-graph] Evolution service started (15m interval)");
    },
    stop: async () => {
      if (evolutionTimer) {
        clearInterval(evolutionTimer);
        evolutionTimer = null;
      }
      console.log("[neural-graph] Evolution service stopped");
    },
  });

  // ---- Event Hooks ----

  api.on?.("gateway_start", async () => {
    const healthy = await isConvexHealthy();
    if (healthy) {
      try {
        await seedGenesis(STATION_ID);
      } catch {
        // Already seeded
      }
    }
  });

  api.on?.(
    "agent_end",
    async (event: { task_type?: string; success?: boolean; latency_ms?: number }) => {
      // Record execution for the learning loop
      try {
        const { getConvexClient } = await import("./src/persistence/convex-client.js");
        const { api: convexApi } = await import("./convex/_generated/api.js");
        const client = getConvexClient();
        await client.mutation(convexApi.execution_records.record, {
          threadId: `agent-${Date.now()}`,
          taskType: event.task_type ?? "unknown",
          taskDescription: "",
          nodesVisited: [],
          edgesTraversed: [],
          success: event.success ?? true,
          totalLatencyMs: event.latency_ms ?? 0,
          nodeLatencies: {},
          stationId: STATION_ID,
          createdAt: new Date().toISOString(),
        });
      } catch {
        // Non-critical — don't break the agent
      }
    },
  );
}
