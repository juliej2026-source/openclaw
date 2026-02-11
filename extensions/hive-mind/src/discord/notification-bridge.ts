// ---------------------------------------------------------------------------
// Bridges AlertManager events + station diffs to Discord channels
// ---------------------------------------------------------------------------

import type { AlertManager, HiveAlert } from "../alert-manager.js";
import type { NetworkScanResult, StationPingResult } from "../network-scanner.js";
import type { ChannelManager } from "./channel-manager.js";
import { buildAlertEmbed, buildStationStatusEmbed } from "./embed-builders.js";

export class NotificationBridge {
  private readonly channelManager: ChannelManager;
  private unsubscribers: Array<() => void> = [];
  private scanIntervalId: ReturnType<typeof setInterval> | undefined;
  private previousStationStates = new Map<string, boolean>();

  constructor(channelManager: ChannelManager) {
    this.channelManager = channelManager;
  }

  /** Subscribe to AlertManager events and forward to #hive-alerts. */
  wireAlertManager(alertManager: AlertManager): void {
    const unsub = alertManager.addListener((alert: HiveAlert) => {
      this.channelManager.send("hive-alerts", { embeds: [buildAlertEmbed(alert)] }).catch(() => {});
    });
    this.unsubscribers.push(unsub);
  }

  /**
   * Poll network scanner every 30s and send station state changes to #hive-network.
   * Only sends when a station's reachability changes (not every poll).
   */
  wireNetworkScanner(getScan: () => NetworkScanResult | null): void {
    const check = () => {
      const scan = getScan();
      if (!scan) return;

      const changes: StationPingResult[] = [];
      for (const station of scan.stations) {
        const wasReachable = this.previousStationStates.get(station.ip);
        if (wasReachable !== undefined && wasReachable !== station.reachable) {
          changes.push(station);
        }
        this.previousStationStates.set(station.ip, station.reachable);
      }

      if (changes.length > 0) {
        // Send full station status on any change
        this.channelManager
          .send("hive-network", { embeds: [buildStationStatusEmbed(scan.stations)] })
          .catch(() => {});
      }
    };

    // Check immediately and then every 30s
    check();
    this.scanIntervalId = setInterval(check, 30_000);
  }

  /** Unsubscribe all listeners and stop polling. */
  shutdown(): void {
    for (const unsub of this.unsubscribers) {
      unsub();
    }
    this.unsubscribers = [];
    if (this.scanIntervalId) {
      clearInterval(this.scanIntervalId);
      this.scanIntervalId = undefined;
    }
  }
}
