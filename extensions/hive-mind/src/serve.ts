import http from "node:http";
import { AlertManager } from "./alert-manager.js";
import { createCloudApacheManager } from "./alibaba-apache.js";
import { AlibabaEcsClient } from "./alibaba-client.js";
import { handleApacheStatus } from "./apache-status.js";
import { createBraviaClient } from "./bravia-client.js";
import { createBraviaPoller } from "./bravia-poller.js";
import {
  setNetworkScannerInstance,
  setDualNetworkInstance,
  setAlertManagerInstance,
  setBraviaInstance,
  setCloudApacheInstance,
  getAvailableCommands,
} from "./command-dispatch.js";
import { initDiscord, initDiscordGateway, shutdownDiscord } from "./discord/index.js";
import { ALL_CHANNEL_NAMES } from "./discord/types.js";
import { createDualNetworkManager } from "./dual-network.js";
import { ExecutionLog } from "./execution-log.js";
import { JulieClient } from "./julie-client.js";
import { setMetricsContext } from "./metrics-exporter.js";
import {
  handlePing,
  handleIdentity,
  handleCommand,
  handleDashboard,
  handleNetworkScan,
  handleNetworkPath,
  handleBraviaStatus,
  setBraviaGetter,
  handleCloudApacheStatus,
  setCloudApacheGetter,
  handleMetrics,
  handleMonitor,
  handleTandemInbound,
  handleTandemCallback,
  handleDelegationInbound,
  handleDelegationCallback,
  setNetworkScanGetter,
  setDualNetworkGetter,
  handleTunnelStatus,
} from "./network-api.js";
import { createNetworkScanner } from "./network-scanner.js";
import {
  handleNeuralStatus,
  handleNeuralTopology,
  handleNeuralEvents,
  handleNeuralPending,
} from "./neural-api.js";
import { buildStationIdentity } from "./station-identity.js";
import { STATION_PORT, STATION_ID } from "./types.js";
import {
  handleUnifiSnapshot,
  handleUnifiDevices,
  handleUnifiClients,
  handleUnifiHealth,
  handleUnifiStations,
  handleUnifiAlerts,
} from "./unifi-api.js";
import { UnifiClient, loadUnifiConfig } from "./unifi-client.js";
import { UnifiCloudClient, loadCloudApiKey } from "./unifi-cloud-client.js";
import { createUnifiCloudPoller } from "./unifi-cloud-poller.js";
import { createUnifiPoller } from "./unifi-poller.js";

const ROUTES: Record<
  string,
  (req: http.IncomingMessage, res: http.ServerResponse) => Promise<void>
> = {
  "/api/network/ping": handlePing,
  "/api/network/identity": handleIdentity,
  "/api/network/command": handleCommand,
  "/api/network/scan": handleNetworkScan,
  "/api/network/path": handleNetworkPath,
  "/api/network/dashboard": handleDashboard,
  "/api/apache/status": handleApacheStatus,
  "/api/bravia/status": handleBraviaStatus,
  "/api/cloud/apache": handleCloudApacheStatus,
  "/api/tunnel/status": handleTunnelStatus,
  "/api/unifi/snapshot": handleUnifiSnapshot,
  "/api/unifi/devices": handleUnifiDevices,
  "/api/unifi/clients": handleUnifiClients,
  "/api/unifi/health": handleUnifiHealth,
  "/api/unifi/stations": handleUnifiStations,
  "/api/unifi/alerts": handleUnifiAlerts,
  "/api/neural/status": handleNeuralStatus,
  "/api/neural/topology": handleNeuralTopology,
  "/api/neural/events": handleNeuralEvents,
  "/api/neural/pending": handleNeuralPending,
  "/api/network/tandem": handleTandemInbound,
  "/api/network/tandem/callback": handleTandemCallback,
  "/api/network/delegation/inbound": handleDelegationInbound,
  "/api/network/delegation/callback": handleDelegationCallback,
  "/metrics": handleMetrics,
  "/monitor": handleMonitor,
};

const POST_ENDPOINTS = new Set([
  "/api/network/command",
  "/api/network/tandem",
  "/api/network/tandem/callback",
  "/api/network/delegation/inbound",
  "/api/network/delegation/callback",
]);

function getEndpointMap(): Array<{ path: string; method: string }> {
  return Object.keys(ROUTES).map((p) => ({
    path: p,
    method: POST_ENDPOINTS.has(p) ? "POST" : "GET",
  }));
}

// Track Discord connection state for runtime reporting
let discordConnected = false;
let discordGatewayActive = false;

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
  const handler = ROUTES[url.pathname];

  if (handler) {
    try {
      await handler(req, res);
    } catch {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Internal server error" }));
    }
    return;
  }

  // Health check root
  if (url.pathname === "/" || url.pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        status: "alive",
        station: STATION_ID,
        timestamp: new Date().toISOString(),
        message: "IOT-HUB Meta-Intelligence Node ready",
      }),
    );
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});

const alertManager = new AlertManager({});
const executionLog = new ExecutionLog();
const startTime = Date.now();
setAlertManagerInstance(alertManager);

const BIND_ADDRESS = process.env.BIND_ADDRESS ?? "0.0.0.0";

server.listen(STATION_PORT, BIND_ADDRESS, () => {
  console.log(`[hive-mind] Network API listening on ${BIND_ADDRESS}:${STATION_PORT}`);
  console.log(`[hive-mind] Station: ${STATION_ID}`);
  console.log(`[hive-mind] Routes:`);
  for (const path of Object.keys(ROUTES)) {
    console.log(`  ${path}`);
  }

  // Julie client (registration wired after scanner + dualNet init)
  const julie = new JulieClient();
  let julieRegistered = false;
  let lastHeartbeat = Date.now();

  // Start UniFi poller if credentials are available
  try {
    const unifiConfig = loadUnifiConfig();
    const unifiClient = new UnifiClient({ config: unifiConfig });
    const poller = createUnifiPoller({ client: unifiClient });
    poller
      .start()
      .then(() => {
        console.log(
          `[hive-mind] UniFi poller started (host=${unifiConfig.host}, site=${unifiConfig.site})`,
        );
      })
      .catch((err) => {
        console.warn(`[hive-mind] UniFi poller start failed: ${err.message}`);
      });
  } catch (err) {
    console.warn(
      `[hive-mind] Local UniFi unavailable: ${err instanceof Error ? err.message : String(err)}`,
    );

    // Fallback: try the UniFi Cloud API (api.ui.com) with API key
    try {
      const cloudApiKey = loadCloudApiKey();
      const cloudClient = new UnifiCloudClient({ apiKey: cloudApiKey });
      const cloudPoller = createUnifiCloudPoller({ client: cloudClient });
      cloudPoller
        .start()
        .then(() => {
          console.log("[hive-mind] UniFi Cloud poller started (api.ui.com)");
        })
        .catch((cloudErr) => {
          console.warn(
            `[hive-mind] UniFi Cloud poller failed: ${cloudErr instanceof Error ? cloudErr.message : String(cloudErr)}`,
          );
        });
    } catch (cloudErr) {
      console.warn(
        `[hive-mind] UniFi monitoring disabled: ${cloudErr instanceof Error ? cloudErr.message : String(cloudErr)}`,
      );
    }
  }

  // Always start network scanner (works without UDM Pro credentials)
  const scanner = createNetworkScanner({
    udmHost: process.env.UNIFI_HOST ?? "10.1.8.1",
    stationPort: STATION_PORT,
    intervalMs: 30_000,
  });
  setNetworkScannerInstance(scanner);
  setNetworkScanGetter(() => scanner.getLatestScan());
  scanner
    .start()
    .then(() => {
      console.log("[hive-mind] Network scanner started (UDM + station pings)");
    })
    .catch((err) => {
      console.warn(
        `[hive-mind] Network scanner failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    });

  // Start dual-network manager (WiFi switching + failover)
  const dualNet = createDualNetworkManager({
    qualityIntervalMs: 60_000,
    failoverThreshold: 3,
    failbackThreshold: 2,
  });
  setDualNetworkInstance(dualNet);
  setDualNetworkGetter(() => dualNet.getState());
  dualNet
    .start()
    .then(() => {
      console.log(`[hive-mind] Dual-network manager started (active: ${dualNet.getCurrentPath()})`);
    })
    .catch((err) => {
      console.warn(
        `[hive-mind] Dual-network manager failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    });

  // Start BRAVIA TV poller
  const braviaClient = createBraviaClient();
  const braviaPoller = createBraviaPoller({ client: braviaClient, intervalMs: 30_000 });
  setBraviaInstance({
    getLatestStatus: () => braviaPoller.getLatestStatus(),
    client: braviaClient,
  });
  setBraviaGetter(() => braviaPoller.getLatestStatus());
  braviaPoller
    .start()
    .then(() => {
      const status = braviaPoller.getLatestStatus();
      console.log(
        `[hive-mind] BRAVIA poller started (host=${braviaClient instanceof Object ? (process.env.BRAVIA_HOST ?? "10.1.8.194") : "unknown"}, power=${status?.power ?? "unknown"})`,
      );
    })
    .catch((err) => {
      console.warn(
        `[hive-mind] BRAVIA poller failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    });

  // Initialize Cloud Apache manager if Alibaba credentials are available
  const aliKeyId = process.env.ALIBABA_ACCESS_KEY_ID;
  const aliSecret = process.env.ALIBABA_ACCESS_KEY_SECRET;
  if (aliKeyId && aliSecret) {
    const ecsClient = new AlibabaEcsClient({
      accessKeyId: aliKeyId,
      accessKeySecret: aliSecret,
      regionId: process.env.ALIBABA_REGION ?? "ap-southeast-1",
    });
    const cloudApache = createCloudApacheManager({ ecsClient, monitorIntervalMs: 60_000 });
    setCloudApacheInstance(cloudApache);
    setCloudApacheGetter(() => cloudApache.getState());
    console.log(
      `[hive-mind] Cloud Apache manager initialized (region=${process.env.ALIBABA_REGION ?? "ap-southeast-1"})`,
    );
  } else {
    console.log("[hive-mind] Cloud Apache disabled (ALIBABA_ACCESS_KEY_ID not set)");
  }

  // Wire full metrics context now that all services are created
  setMetricsContext({
    alertManager,
    executionLog,
    startTime,
    getScan: () => scanner.getLatestScan(),
    getDualNetwork: () => dualNet.getState(),
    isJulieRegistered: () => julieRegistered,
    getJulieHeartbeatAge: () => Math.floor((Date.now() - lastHeartbeat) / 1000),
  });

  console.log("[hive-mind] Metrics context wired (scanner + dual-WAN + Julie + alerts)");

  // Build full identity with runtime context, commands, and endpoints
  const buildFullIdentity = () =>
    buildStationIdentity({
      commands: getAvailableCommands(),
      endpoints: getEndpointMap(),
      runtimeContext: {
        discordConnected,
        discordGatewayActive,
        discordGuildId: process.env.DISCORD_GUILD_ID,
        discordChannels: [...ALL_CHANNEL_NAMES],
        discordSlashCommandCount: 10,
        activeWanPath: dualNet.getCurrentPath(),
        failoverActive: dualNet.getState().failover_active,
        scannerRunning: true,
        stationsOnline: scanner.getLatestScan()?.stations.filter((s) => s.reachable).length ?? 0,
        stationsTotal: scanner.getLatestScan()?.stations.length ?? 0,
        activeAlertCount: alertManager.getActive().length,
        totalAlertCount: alertManager.totalAlerts,
      },
    });

  // Register with Julie on startup
  julie
    .register(buildFullIdentity())
    .then((res) => {
      julieRegistered = res.success;
      lastHeartbeat = Date.now();
      console.log(
        `[hive-mind] Registered with Julie: ${res.success ? "OK" : "FAILED"} (dynamic=${res.dynamic})`,
      );
    })
    .catch((err) => {
      console.warn(`[hive-mind] Julie registration failed: ${err.message}`);
    });

  // Re-register every 5 minutes with fresh runtime state
  setInterval(
    () => {
      julie
        .register(buildFullIdentity())
        .then((res) => {
          julieRegistered = res.success;
          lastHeartbeat = Date.now();
        })
        .catch(() => {});
    },
    5 * 60 * 1000,
  );

  // Initialize Discord integration (non-fatal)
  const discordToken = process.env.DISCORD_BOT_TOKEN;
  const discordGuild = process.env.DISCORD_GUILD_ID;
  if (discordToken && discordGuild) {
    const discordConfig = {
      token: discordToken,
      guildId: discordGuild,
      categoryName: process.env.DISCORD_CATEGORY_NAME,
      enabled: process.env.DISCORD_ENABLED !== "false",
    };
    const discordServices = {
      alertManager,
      getScan: () => scanner.getLatestScan(),
      getDualNetwork: () => dualNet.getState(),
      startTime,
    };
    initDiscord(discordConfig, discordServices)
      .then(async (cm) => {
        discordConnected = !!cm;
        console.log("[hive-mind] Discord integration active");
        if (cm) {
          await initDiscordGateway(
            {
              ...discordConfig,
              applicationId: process.env.DISCORD_APPLICATION_ID,
              gatewayEnabled: process.env.DISCORD_GATEWAY_ENABLED !== "false",
              gatewayUrl: process.env.OPENCLAW_GATEWAY_URL ?? "http://127.0.0.1:18789",
              gatewayToken: process.env.OPENCLAW_GATEWAY_TOKEN,
              aiAgentId: process.env.OPENCLAW_AI_AGENT_ID ?? "main",
            },
            cm,
          );
          discordGatewayActive = true;
          console.log("[hive-mind] Discord Gateway active (slash commands + message commands)");
        }
      })
      .catch((err) =>
        console.warn(
          `[hive-mind] Discord integration failed: ${err instanceof Error ? err.message : String(err)}`,
        ),
      );
  }

  // Graceful shutdown
  function shutdown(signal: string) {
    console.log(`[hive-mind] ${signal} received, shutting down...`);
    shutdownDiscord().catch(() => {});
    scanner.stop();
    dualNet.stop();
    braviaPoller.stop();
    server.close(() => {
      console.log("[hive-mind] Server closed");
      process.exit(0);
    });
    // Force exit after 5s if close hangs
    setTimeout(() => process.exit(1), 5000).unref();
  }
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
});
