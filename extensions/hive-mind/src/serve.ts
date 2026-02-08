import http from "node:http";
import { AlertManager } from "./alert-manager.js";
import { handleApacheStatus } from "./apache-status.js";
import {
  setNetworkScannerInstance,
  setDualNetworkInstance,
  setAlertManagerInstance,
} from "./command-dispatch.js";
import { createDualNetworkManager } from "./dual-network.js";
import { ExecutionLog } from "./execution-log.js";
import { JuliaClient } from "./julia-client.js";
import { setMetricsContext } from "./metrics-exporter.js";
import {
  handlePing,
  handleIdentity,
  handleCommand,
  handleDashboard,
  handleNetworkScan,
  handleNetworkPath,
  handleMetrics,
  handleMonitor,
  setNetworkScanGetter,
  setDualNetworkGetter,
} from "./network-api.js";
import { createNetworkScanner } from "./network-scanner.js";
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
  "/api/unifi/snapshot": handleUnifiSnapshot,
  "/api/unifi/devices": handleUnifiDevices,
  "/api/unifi/clients": handleUnifiClients,
  "/api/unifi/health": handleUnifiHealth,
  "/api/unifi/stations": handleUnifiStations,
  "/api/unifi/alerts": handleUnifiAlerts,
  "/metrics": handleMetrics,
  "/monitor": handleMonitor,
};

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

server.listen(STATION_PORT, "127.0.0.1", () => {
  console.log(`[hive-mind] Network API listening on 127.0.0.1:${STATION_PORT}`);
  console.log(`[hive-mind] Station: ${STATION_ID}`);
  console.log(`[hive-mind] Routes:`);
  for (const path of Object.keys(ROUTES)) {
    console.log(`  ${path}`);
  }

  // Register with JULIA on startup
  const julia = new JuliaClient();
  let juliaRegistered = false;
  let lastHeartbeat = Date.now();

  const identity = buildStationIdentity();
  julia
    .register(identity)
    .then((res) => {
      juliaRegistered = res.success;
      lastHeartbeat = Date.now();
      console.log(
        `[hive-mind] Registered with JULIA: ${res.success ? "OK" : "FAILED"} (dynamic=${res.dynamic})`,
      );
    })
    .catch((err) => {
      console.warn(`[hive-mind] JULIA registration failed: ${err.message}`);
    });

  // Re-register every 5 minutes
  setInterval(
    () => {
      const identity = buildStationIdentity();
      julia
        .register(identity)
        .then((res) => {
          juliaRegistered = res.success;
          lastHeartbeat = Date.now();
        })
        .catch(() => {});
    },
    5 * 60 * 1000,
  );

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
    udmHost: process.env.UNIFI_HOST ?? "10.1.7.1",
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

  // Wire full metrics context now that all services are created
  setMetricsContext({
    alertManager,
    executionLog,
    startTime,
    getScan: () => scanner.getLatestScan(),
    getDualNetwork: () => dualNet.getState(),
    isJuliaRegistered: () => juliaRegistered,
    getJuliaHeartbeatAge: () => Math.floor((Date.now() - lastHeartbeat) / 1000),
  });

  console.log("[hive-mind] Metrics context wired (scanner + dual-WAN + JULIA + alerts)");

  // Graceful shutdown
  function shutdown(signal: string) {
    console.log(`[hive-mind] ${signal} received, shutting down...`);
    scanner.stop();
    dualNet.stop();
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
