import type { Command } from "commander";
import { ExecutionLog } from "../execution-log.js";
import { JuliaClient } from "../julia-client.js";
import { buildStationIdentity } from "../station-identity.js";

export function registerHiveCli(program: Command): void {
  const cmd = program
    .command("hive")
    .description("Hive mind network: station status, registration, and execution log");

  cmd
    .command("status")
    .description("Show station identity and hive mind status")
    .action(async () => {
      const identity = buildStationIdentity();
      const client = new JuliaClient();
      const juliaUp = await client.isAvailable();

      console.log(`Station: ${identity.station_id}`);
      console.log(`Host:    ${identity.hostname}`);
      console.log(`IP:      ${identity.ip_address}:${identity.port}`);
      console.log(`Platform: ${identity.platform}/${identity.arch}`);
      console.log(`Uptime:  ${identity.uptime_seconds}s`);
      console.log(`Version: ${identity.version}`);
      console.log(`Models:  ${identity.models.length} installed`);
      console.log(`Capabilities: ${identity.capabilities.length}`);
      console.log();
      console.log("Layers:");
      for (const [key, layer] of Object.entries(identity.layers)) {
        console.log(
          `  ${key}: ${layer.status} (${layer.tools.length} tools, ${layer.cli_commands} CLI)`,
        );
      }
      console.log();
      console.log(`JULIA (10.1.7.87): ${juliaUp ? "reachable" : "unreachable"}`);
    });

  cmd
    .command("log")
    .description("Show recent execution log entries")
    .option("-n, --limit <count>", "Number of entries to show", "20")
    .action(async (opts: { limit: string }) => {
      const log = new ExecutionLog();
      const entries = log.getRecent(Number(opts.limit));

      if (entries.length === 0) {
        console.log("No execution log entries yet.");
        return;
      }

      console.log(`Showing ${entries.length} of ${log.totalEntries} entries:\n`);
      for (const entry of entries) {
        const status = entry.success ? "OK" : "FAIL";
        const julia = entry.reported_to_julia ? "reported" : "local-only";
        console.log(
          `  ${entry.timestamp}  ${status}  ${entry.task_type}  ${entry.latency_ms}ms  [${julia}]`,
        );
      }
    });

  cmd
    .command("register")
    .description("Force immediate re-registration with JULIA")
    .action(async () => {
      const identity = buildStationIdentity();
      const client = new JuliaClient();

      try {
        const result = await client.register(identity);
        console.log(`Registration: ${result.success ? "success" : "failed"}`);
        console.log(`Agent ID: ${result.agent_id}`);
        if (result.dynamic) {
          console.log("Dynamic: true (live self-report)");
        }
      } catch (err) {
        console.error(`Registration failed: ${err instanceof Error ? err.message : String(err)}`);
        process.exitCode = 1;
      }
    });
}
