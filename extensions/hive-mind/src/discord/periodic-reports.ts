// ---------------------------------------------------------------------------
// Scheduled status summaries to Discord
// ---------------------------------------------------------------------------

import type { AlertManager } from "../alert-manager.js";
import type { DualNetworkState } from "../dual-network.js";
import type { NetworkScanResult } from "../network-scanner.js";
import type { ChannelManager } from "./channel-manager.js";
import {
  buildStationStatusEmbed,
  buildDashboardEmbed,
  buildScraperJobEmbed,
  buildNeuralStatusEmbed,
  type DashboardData,
  type NeuralStatusData,
} from "./embed-builders.js";

export type PeriodicReportsServices = {
  alertManager: AlertManager;
  getScan: () => NetworkScanResult | null;
  getDualNetwork: () => DualNetworkState;
  startTime: number;
};

const THIRTY_MIN = 30 * 60 * 1000;
const ONE_HOUR = 60 * 60 * 1000;
const SIX_HOURS = 6 * 60 * 60 * 1000;

export class PeriodicReports {
  private readonly channelManager: ChannelManager;
  private readonly services: PeriodicReportsServices;
  private intervals: Array<ReturnType<typeof setInterval>> = [];

  constructor(channelManager: ChannelManager, services: PeriodicReportsServices) {
    this.channelManager = channelManager;
    this.services = services;
  }

  /** Start all periodic report schedules. Sends initial report immediately. */
  async start(): Promise<void> {
    // Initial station health report
    await this.sendStationReport();

    // 30-minute station health
    this.intervals.push(setInterval(() => this.sendStationReport(), THIRTY_MIN));

    // 1-hour full dashboard
    this.intervals.push(setInterval(() => this.sendDashboardReport(), ONE_HOUR));

    // 6-hour combined deep report
    this.intervals.push(setInterval(() => this.sendDeepReport(), SIX_HOURS));
  }

  /** Stop all intervals. */
  stop(): void {
    for (const id of this.intervals) {
      clearInterval(id);
    }
    this.intervals = [];
  }

  private async sendStationReport(): Promise<void> {
    const scan = this.services.getScan();
    if (!scan) return;
    await this.channelManager
      .send("hive-status", { embeds: [buildStationStatusEmbed(scan.stations)] })
      .catch(() => {});
  }

  private async sendDashboardReport(): Promise<void> {
    const scan = this.services.getScan();
    const dualNet = this.services.getDualNetwork();
    const activeAlerts = this.services.alertManager.getActive().length;
    const uptimeS = Math.floor((Date.now() - this.services.startTime) / 1000);

    const data: DashboardData = {
      stations: scan?.stations,
      activeAlerts,
      wanStatus: dualNet.failover_active ? "Failover" : dualNet.active_path,
      uptime: uptimeS,
    };

    // Try to fetch scraper + neural status from local APIs (non-fatal)
    try {
      const scraperRes = await fetch("http://127.0.0.1:3001/api/hotel-scraper/status", {
        signal: AbortSignal.timeout(3_000),
      });
      if (scraperRes.ok) {
        const s = (await scraperRes.json()) as { scheduler?: { running?: boolean } };
        data.scraperStatus = s.scheduler?.running ? "Running" : "Stopped";
      }
    } catch {
      /* non-critical */
    }

    try {
      const neuralRes = await fetch("http://127.0.0.1:3001/api/neural/status", {
        signal: AbortSignal.timeout(3_000),
      });
      if (neuralRes.ok) {
        const n = (await neuralRes.json()) as { phase?: string };
        data.neuralPhase = n.phase;
      }
    } catch {
      /* non-critical */
    }

    await this.channelManager
      .send("hive-status", { embeds: [buildDashboardEmbed(data)] })
      .catch(() => {});
  }

  private async sendDeepReport(): Promise<void> {
    // Send scraper status
    try {
      const jobsRes = await fetch("http://127.0.0.1:3001/api/hotel-scraper/jobs?limit=5", {
        signal: AbortSignal.timeout(3_000),
      });
      if (jobsRes.ok) {
        const result = (await jobsRes.json()) as {
          jobs: Array<{ id: string; status: string; pricesFound: number; duration_ms?: number }>;
        };
        for (const job of result.jobs.slice(0, 3)) {
          await this.channelManager
            .send("hive-scraper", {
              embeds: [
                buildScraperJobEmbed({
                  jobId: job.id,
                  status: job.status,
                  pricesFound: job.pricesFound,
                  durationMs: job.duration_ms,
                }),
              ],
            })
            .catch(() => {});
        }
      }
    } catch {
      /* non-critical */
    }

    // Send neural status
    try {
      const neuralRes = await fetch("http://127.0.0.1:3001/api/neural/status", {
        signal: AbortSignal.timeout(3_000),
      });
      if (neuralRes.ok) {
        const n = (await neuralRes.json()) as NeuralStatusData;
        await this.channelManager
          .send("hive-neural", { embeds: [buildNeuralStatusEmbed(n)] })
          .catch(() => {});
      }
    } catch {
      /* non-critical */
    }
  }
}
