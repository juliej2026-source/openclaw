// ---------------------------------------------------------------------------
// CLI commands: openclaw hotel {status,scrape,prices,compare,resolve,jobs}
// Pattern: hive-mind/src/cli/hive-cli.ts
// ---------------------------------------------------------------------------

import type { Command } from "commander";

export function registerHotelCli(program: Command): void {
  const cmd = program
    .command("hotel")
    .description("Hotel price scraper: status, scrape, prices, compare, resolve, jobs");

  cmd
    .command("status")
    .description("Show scraper extension status and scheduler state")
    .action(async () => {
      const { handleStatus } = await import("../api-handlers.js");
      const status = await handleStatus();
      const sched = (status.scheduler as Record<string, unknown>) ?? {};

      console.log("Hotel Scraper Extension");
      console.log("=======================");
      console.log(`Version:    ${status.version}`);
      console.log(`Sources:    ${(status.sources as string[]).join(", ")}`);
      console.log(`Areas:      ${(status.areas as string[]).join(", ")}`);
      console.log(`Playwright: ${status.playwrightService}`);
      console.log();
      console.log("Scheduler:");
      console.log(`  Running:  ${sched.running}`);
      console.log(`  Uptime:   ${Math.floor(((sched.uptimeMs as number) || 0) / 60000)}m`);
      console.log(`  Timers:   ${sched.activeTimers}`);
      console.log(`  Enabled:  ${sched.enabledScheduled}`);
      console.log();
      console.log(`Jobs in memory: ${status.jobsInMemory}`);
    });

  cmd
    .command("scrape")
    .description("Trigger a new scrape job")
    .option("--check-in <date>", "Check-in date (YYYY-MM-DD)")
    .option("--check-out <date>", "Check-out date (YYYY-MM-DD)")
    .option("--guests <n>", "Number of guests", "2")
    .option("--sources <list>", "Comma-separated source list")
    .option("--strategy <type>", "Strategy: auto, apify_only, playwright_only, hybrid")
    .action(
      async (opts: {
        checkIn?: string;
        checkOut?: string;
        guests: string;
        sources?: string;
        strategy?: string;
      }) => {
        const { handleScrape } = await import("../api-handlers.js");
        const sources = opts.sources?.split(",").map((s) => s.trim()) as any[];
        const result = await handleScrape({
          checkIn: opts.checkIn,
          checkOut: opts.checkOut,
          guests: Number(opts.guests),
          sources,
          strategy: opts.strategy as any,
        });

        console.log(`Job started: ${result.jobId}`);
        console.log(`Status: ${result.status}`);
        console.log(`Params: ${JSON.stringify(result.params, null, 2)}`);
      },
    );

  cmd
    .command("prices")
    .description("Show latest prices (from completed jobs in memory)")
    .option("--check-in <date>", "Check-in date (YYYY-MM-DD)")
    .option("--check-out <date>", "Check-out date (YYYY-MM-DD)")
    .option("--area <area>", "Filter by area (Hirafu, Village, Annupuri, Hanazono)")
    .action(async (opts: { checkIn?: string; checkOut?: string; area?: string }) => {
      const { handlePrices } = await import("../api-handlers.js");
      const result = await handlePrices(opts);
      const prices = result.prices as Array<{
        name: string;
        source: string;
        priceInYen: number;
        area: string;
      }>;

      if (prices.length === 0) {
        console.log("No prices found. Run `openclaw hotel scrape` first.");
        return;
      }

      console.log(`${prices.length} prices found:\n`);
      for (const p of prices) {
        const yen = `¥${p.priceInYen.toLocaleString("ja-JP")}`;
        console.log(`  ${yen.padEnd(12)} ${p.name.padEnd(30)} ${p.source.padEnd(14)} ${p.area}`);
      }
    });

  cmd
    .command("compare")
    .description("Compare prices for a specific hotel across sources")
    .argument("<hotelId>", "Hotel ID or name fragment")
    .action(async (hotelId: string) => {
      const { handleCompare } = await import("../api-handlers.js");
      const result = await handleCompare({ hotelId });

      if (result.error) {
        console.error(result.error);
        return;
      }

      const prices = result.prices as Array<{
        source: string;
        priceInYen: number;
        checkIn: string;
        checkOut: string;
      }>;
      if (prices.length === 0) {
        console.log(`No prices found for "${hotelId}".`);
        return;
      }

      console.log(`Prices for "${hotelId}" (${result.sourceCount} sources):\n`);
      for (const p of prices) {
        console.log(
          `  ¥${p.priceInYen.toLocaleString("ja-JP").padEnd(10)} ${p.source.padEnd(14)} ${p.checkIn} → ${p.checkOut}`,
        );
      }

      const cheapest = result.cheapest as { source: string; priceInYen: number } | null;
      if (cheapest) {
        console.log(
          `\nCheapest: ¥${cheapest.priceInYen.toLocaleString("ja-JP")} via ${cheapest.source}`,
        );
      }
    });

  cmd
    .command("resolve")
    .description("Run entity resolution on latest scrape results")
    .action(async () => {
      const { jobs } = await import("../api-handlers.js");
      const completedJobs = Array.from(jobs.values()).filter((j) => j.status === "completed");

      if (completedJobs.length === 0) {
        console.log("No completed jobs found. Run `openclaw hotel scrape` first.");
        return;
      }

      // Collect all hotels
      const allHotels = completedJobs.flatMap((j) => j.results.flatMap((r) => r.hotels));

      if (allHotels.length === 0) {
        console.log("No hotels found in completed jobs.");
        return;
      }

      const { batchMatch, calculateMatchStats } =
        await import("../processing/entity-resolution.js");
      const half = Math.ceil(allHotels.length / 2);
      const candidates = allHotels.slice(0, half);
      const existing = allHotels.slice(half);

      const matches = batchMatch(candidates, existing);
      const stats = calculateMatchStats(matches);

      console.log("Entity Resolution Results:");
      console.log(`  Total candidates: ${stats.totalCandidates}`);
      console.log(`  Auto-merges:      ${stats.autoMerges}`);
      console.log(`  Manual review:    ${stats.manualReview}`);
      console.log(`  No match:         ${stats.noMatch}`);
      console.log(`  Avg confidence:   ${(stats.averageConfidence * 100).toFixed(1)}%`);
      console.log(`  High confidence:  ${stats.highConfidenceMatches}`);
    });

  cmd
    .command("jobs")
    .description("List recent scrape jobs")
    .option("--status <status>", "Filter by status: pending, processing, completed, failed")
    .option("-n, --limit <count>", "Number of jobs to show", "10")
    .action(async (opts: { status?: string; limit: string }) => {
      const { handleJobs } = await import("../api-handlers.js");
      const result = await handleJobs({ status: opts.status as any, limit: Number(opts.limit) });
      const jobList = result.jobs as Array<{
        id: string;
        status: string;
        pricesFound: number;
        duration_ms?: number;
        startedAt?: number;
      }>;

      if (jobList.length === 0) {
        console.log("No jobs found.");
        return;
      }

      console.log(`${jobList.length} jobs:\n`);
      for (const j of jobList) {
        const dur = j.duration_ms ? `${(j.duration_ms / 1000).toFixed(1)}s` : "--";
        const time = j.startedAt
          ? new Date(j.startedAt).toISOString().replace("T", " ").slice(0, 19)
          : "--";
        console.log(
          `  ${j.id.padEnd(24)} ${j.status.padEnd(12)} ${String(j.pricesFound).padEnd(6)} prices  ${dur.padEnd(8)} ${time}`,
        );
      }
    });
}
