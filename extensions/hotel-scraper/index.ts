// ---------------------------------------------------------------------------
// Hotel Scraper Extension — Plugin entry point
// Registers HTTP routes, background service (scheduler), CLI, and event hooks.
// ---------------------------------------------------------------------------

const STATION_ID = "iot-hub";
let schedulerTimer: ReturnType<typeof setInterval> | null = null;

export default function hotelScraperPlugin(api: {
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
  // ---- HTTP Routes (/api/hotel-scraper/*) ----

  api.registerHttpRoute({
    method: "GET",
    path: "/api/hotel-scraper/status",
    handler: async (_req, res) => {
      const { handleStatus } = await import("./src/api-handlers.js");
      const data = await handleStatus();
      res.json(data);
    },
  });

  api.registerHttpRoute({
    method: "GET",
    path: "/api/hotel-scraper/health",
    handler: async (_req, res) => {
      const { handleHealth } = await import("./src/api-handlers.js");
      const data = await handleHealth();
      res.json(data);
    },
  });

  api.registerHttpRoute({
    method: "GET",
    path: "/api/hotel-scraper/prices",
    handler: async (req, res) => {
      const { handlePrices } = await import("./src/api-handlers.js");
      const query = req.query ?? {};
      const data = await handlePrices({
        checkIn: query.checkIn,
        checkOut: query.checkOut,
        guests: query.guests ? Number(query.guests) : undefined,
        area: query.area,
      });
      res.json(data);
    },
  });

  api.registerHttpRoute({
    method: "GET",
    path: "/api/hotel-scraper/hotels",
    handler: async (req, res) => {
      const { handleHotels } = await import("./src/api-handlers.js");
      const query = req.query ?? {};
      const data = await handleHotels({ area: query.area, enabled: query.enabled });
      res.json(data);
    },
  });

  api.registerHttpRoute({
    method: "POST",
    path: "/api/hotel-scraper/scrape",
    handler: async (req, res) => {
      const { handleScrape } = await import("./src/api-handlers.js");
      const body = req.body ?? {};
      const data = await handleScrape({
        checkIn: body.checkIn,
        checkOut: body.checkOut,
        guests: body.guests ?? 2,
        sources: body.sources,
        strategy: body.strategy,
      });
      res.json(data);
    },
  });

  api.registerHttpRoute({
    method: "GET",
    path: "/api/hotel-scraper/jobs",
    handler: async (req, res) => {
      const { handleJobs } = await import("./src/api-handlers.js");
      const query = req.query ?? {};
      const data = await handleJobs({
        status: query.status,
        limit: query.limit ? Number(query.limit) : undefined,
      });
      res.json(data);
    },
  });

  api.registerHttpRoute({
    method: "GET",
    path: "/api/hotel-scraper/compare",
    handler: async (req, res) => {
      const { handleCompare } = await import("./src/api-handlers.js");
      const query = req.query ?? {};
      const data = await handleCompare({ hotelId: query.hotelId });
      res.json(data);
    },
  });

  api.registerHttpRoute({
    method: "GET",
    path: "/api/hotel-scraper/schedule",
    handler: async (_req, res) => {
      const { handleSchedule } = await import("./src/api-handlers.js");
      const data = handleSchedule();
      res.json(data);
    },
  });

  api.registerHttpRoute({
    method: "GET",
    path: "/api/hotel-scraper/metrics",
    handler: async (_req, res) => {
      const { renderScraperMetrics } = await import("./src/metrics/scraper-metrics.js");
      const metrics = await renderScraperMetrics();
      res.setHeader?.("Content-Type", "text/plain; version=0.0.4");
      res.end?.(metrics) ?? res.text?.(metrics);
    },
  });

  api.registerHttpRoute({
    method: "GET",
    path: "/api/hotel-scraper/areas",
    handler: async (_req, res) => {
      const { NISEKO_SEARCH_AREAS } = await import("./src/config.js");
      res.json({ areas: NISEKO_SEARCH_AREAS });
    },
  });

  // ---- Background Service (scraper scheduler) ----

  api.registerService({
    id: "hotel-scraper-scheduler",
    start: async () => {
      const { startScheduler } = await import("./src/scheduler/scraper-scheduler.js");
      schedulerTimer = await startScheduler();
      console.log("[hotel-scraper] Scheduler service started");
    },
    stop: async () => {
      if (schedulerTimer) {
        const { stopScheduler } = await import("./src/scheduler/scraper-scheduler.js");
        stopScheduler(schedulerTimer);
        schedulerTimer = null;
      }
      console.log("[hotel-scraper] Scheduler service stopped");
    },
  });

  // ---- CLI Commands ----

  api.registerCli?.(
    ({ program }: { program: any }) => {
      import("./src/cli/hotel-cli.js").then(({ registerHotelCli }) => {
        registerHotelCli(program);
      });
    },
    { commands: ["hotel"] },
  );

  // ---- Event Hooks ----

  api.on?.("gateway_start", async () => {
    try {
      const { seedHotelNodes } = await import("./src/neural/seed-nodes.js");
      await seedHotelNodes(STATION_ID);
    } catch {
      // Non-critical — neural graph may not be available
    }
  });
}
