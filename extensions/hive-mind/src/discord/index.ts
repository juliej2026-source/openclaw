// ---------------------------------------------------------------------------
// Discord integration orchestrator — single entry point
// ---------------------------------------------------------------------------

import type { AlertManager } from "../alert-manager.js";
import type { DualNetworkState } from "../dual-network.js";
import type { NetworkScanResult } from "../network-scanner.js";
import type { DiscordConfig } from "./types.js";
import { ChannelManager } from "./channel-manager.js";
import { createDiscordRestClient } from "./discord-client.js";
import { NotificationBridge } from "./notification-bridge.js";
import { PeriodicReports } from "./periodic-reports.js";

export type DiscordServices = {
  alertManager: AlertManager;
  getScan: () => NetworkScanResult | null;
  getDualNetwork: () => DualNetworkState;
  startTime?: number;
};

let channelManager: ChannelManager | null = null;
let notificationBridge: NotificationBridge | null = null;
let periodicReports: PeriodicReports | null = null;

/**
 * Initialize the full Discord integration:
 * 1. Create REST client
 * 2. Auto-provision category + channels
 * 3. Wire alert notifications
 * 4. Start periodic reports
 *
 * Non-fatal — logs warnings on failure.
 */
export async function initDiscord(config: DiscordConfig, services: DiscordServices): Promise<void> {
  if (config.enabled === false) {
    console.log("[discord] Integration disabled via config");
    return;
  }

  const client = createDiscordRestClient(config.token);

  // Verify bot has access to guild
  const guild = await client.getGuild(config.guildId);
  if (!guild) {
    console.warn("[discord] Cannot access guild — check bot token and guild ID");
    return;
  }
  console.log(`[discord] Connected to guild: ${guild.name}`);

  // Provision channels
  channelManager = new ChannelManager(client, config);
  await channelManager.initialize();

  // Wire alert notifications
  notificationBridge = new NotificationBridge(channelManager);
  notificationBridge.wireAlertManager(services.alertManager);
  notificationBridge.wireNetworkScanner(services.getScan);

  // Start periodic reports
  periodicReports = new PeriodicReports(channelManager, {
    alertManager: services.alertManager,
    getScan: services.getScan,
    getDualNetwork: services.getDualNetwork,
    startTime: services.startTime ?? Date.now(),
  });
  await periodicReports.start();
}

/** Graceful shutdown — stop reports, unsubscribe bridge. */
export function shutdownDiscord(): void {
  periodicReports?.stop();
  notificationBridge?.shutdown();
  channelManager = null;
  notificationBridge = null;
  periodicReports = null;
}

/** Expose channel manager for ad-hoc messages from other modules. */
export function getDiscordChannelManager(): ChannelManager | null {
  return channelManager;
}
