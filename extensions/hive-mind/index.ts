import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk";
import { AlertManager } from "./src/alert-manager.js";
import { registerHiveCli } from "./src/cli/hive-cli.js";
import { setAlertManagerInstance, setExecutionTracker } from "./src/command-dispatch.js";
import { ExecutionLog } from "./src/execution-log.js";
import { createExecutionReporter, recordCommandExecution } from "./src/execution-reporter.js";
import { JulieClient } from "./src/julie-client.js";
import { setMetricsContext } from "./src/metrics-exporter.js";
import {
  handlePing,
  handleIdentity,
  handleCommand,
  handleDashboard,
  handleMetrics,
  handleMonitor,
} from "./src/network-api.js";
import { createRegistrationService } from "./src/registration-service.js";

const hiveMindPlugin = {
  id: "hive-mind",
  name: "Hive Mind",
  description:
    "Network integration for Julie orchestrator hive mind: station API, " +
    "self-registration, and execution reporting.",
  configSchema: emptyPluginConfigSchema(),

  register(api: OpenClawPluginApi) {
    const julieClient = new JulieClient();
    const executionLog = new ExecutionLog();
    const alertManager = new AlertManager({
      onAlert: (alert) => {
        // Best-effort push to Julie
        julieClient
          .reportExecution({
            station_id: "iot-hub",
            task_type: "tool-use",
            success: alert.severity !== "critical",
            latency_ms: 0,
            capabilities_used: ["alerting", alert.type],
            timestamp: alert.timestamp,
          })
          .catch(() => {});
      },
    });

    // Wire alert manager for network:alerts commands
    setAlertManagerInstance(alertManager);

    // Network API routes
    api.registerHttpRoute({ path: "/api/network/ping", handler: handlePing });
    api.registerHttpRoute({
      path: "/api/network/identity",
      handler: handleIdentity,
    });
    api.registerHttpRoute({
      path: "/api/network/command",
      handler: handleCommand,
    });
    api.registerHttpRoute({
      path: "/api/network/dashboard",
      handler: handleDashboard,
    });
    api.registerHttpRoute({ path: "/metrics", handler: handleMetrics });
    api.registerHttpRoute({ path: "/monitor", handler: handleMonitor });

    // Wire Prometheus metrics context
    setMetricsContext({
      alertManager,
      executionLog,
      startTime: Date.now(),
    });

    // Wire execution tracking for the learning loop (UC-4)
    setExecutionTracker(({ command, success, latencyMs }) => {
      // Fire-and-forget: don't block command response
      recordCommandExecution({
        command,
        success,
        latencyMs,
        executionLog,
        julieClient,
      }).catch(() => {});
    });

    // Background registration service (5-min heartbeat)
    api.registerService(createRegistrationService(julieClient));

    // Execution reporting hook
    api.on("agent_end", createExecutionReporter(julieClient, executionLog));

    // CLI commands
    api.registerCli(
      ({ program }) => {
        registerHiveCli(program);
      },
      { commands: ["hive"] },
    );

    api.logger.info(
      "Hive-Mind: registered network API, registration service, and execution reporter",
    );
  },
};

export default hiveMindPlugin;
