import type { Command } from "commander";
import { PerformanceDb } from "../performance-db.js";

/**
 * Register `meta` CLI subcommands.
 */
export function registerMetaCli(program: Command): void {
  const cmd = program
    .command("meta")
    .description("Meta-engine: autonomous model selection status and controls");

  cmd
    .command("status")
    .description("Show meta-engine status and available models")
    .action(() => {
      const perfDb = new PerformanceDb();
      const summary = perfDb.getSummary();

      console.log("\nMeta-Engine Status\n");
      console.log(`Performance records: ${perfDb.totalRecords}`);
      console.log(`Tracked model-task combinations: ${summary.length}`);

      if (summary.length > 0) {
        console.log("\nTop Model-Task Performance:\n");
        const sorted = summary.toSorted((a, b) => b.totalRuns - a.totalRuns);
        for (const s of sorted.slice(0, 15)) {
          const pct = (s.successRate * 100).toFixed(1);
          const latency = Math.round(s.avgLatencyMs);
          console.log(
            `  ${s.modelId.padEnd(25)} ${s.taskType.padEnd(15)} ${String(s.totalRuns).padEnd(6)} runs  ${pct.padStart(6)}% success  ${String(latency).padStart(6)}ms avg`,
          );
        }
      } else {
        console.log(
          "\nNo performance data yet. Use the system and data will be collected automatically.",
        );
      }
    });

  cmd
    .command("stats")
    .description("Show detailed performance statistics")
    .option("--model <id>", "Filter by model ID")
    .option("--task <type>", "Filter by task type")
    .action((opts: { model?: string; task?: string }) => {
      const perfDb = new PerformanceDb();
      let summary = perfDb.getSummary();

      if (opts.model) {
        summary = summary.filter((s) => s.modelId.includes(opts.model!));
      }
      if (opts.task) {
        summary = summary.filter((s) => s.taskType === opts.task);
      }

      if (summary.length === 0) {
        console.log("No matching performance records found.");
        return;
      }

      console.log("\nPerformance Statistics:\n");
      for (const s of summary) {
        console.log(`  Model:    ${s.modelId}`);
        console.log(`  Task:     ${s.taskType}`);
        console.log(`  Runs:     ${s.totalRuns}`);
        console.log(`  Success:  ${(s.successRate * 100).toFixed(1)}%`);
        console.log(`  Latency:  ${Math.round(s.avgLatencyMs)}ms avg`);
        console.log();
      }
    });

  cmd
    .command("reset")
    .description("Clear all performance data")
    .action(() => {
      const perfDb = new PerformanceDb();
      perfDb.reset();
      console.log("Performance data cleared.");
    });
}
