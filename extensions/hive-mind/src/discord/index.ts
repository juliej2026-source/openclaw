// ---------------------------------------------------------------------------
// Discord integration orchestrator — single entry point
// ---------------------------------------------------------------------------

import type { AlertManager } from "../alert-manager.js";
import type { DualNetworkState } from "../dual-network.js";
import type { NetworkScanResult } from "../network-scanner.js";
import type { DiscordConfig, DiscordGatewayConfig } from "./types.js";
import { createAiBridge, type AiBridge } from "./ai-bridge.js";
import { shouldHandleAsAi, handleAiMessage } from "./ai-message-handler.js";
import { ChannelManager } from "./channel-manager.js";
import { sendChannelWelcomes } from "./channel-welcome.js";
import { createDiscordRestClient } from "./discord-client.js";
import { createGatewayClient, type GatewayClient } from "./gateway-client.js";
import { handleInteraction, setAiBridge } from "./interaction-router.js";
import { handleMessageCommand } from "./message-commands.js";
import { NotificationBridge } from "./notification-bridge.js";
import { PeriodicReports } from "./periodic-reports.js";
import { registerSlashCommands, applicationIdFromToken } from "./slash-commands.js";

export type DiscordServices = {
  alertManager: AlertManager;
  getScan: () => NetworkScanResult | null;
  getDualNetwork: () => DualNetworkState;
  startTime?: number;
};

let channelManager: ChannelManager | null = null;
let notificationBridge: NotificationBridge | null = null;
let periodicReports: PeriodicReports | null = null;
let gatewayClient: GatewayClient | null = null;

/**
 * Initialize REST-based Discord integration:
 * 1. Create REST client
 * 2. Auto-provision category + channels
 * 3. Wire alert notifications
 * 4. Start periodic reports
 *
 * Returns the ChannelManager for Gateway init, or null on failure.
 * Non-fatal — logs warnings on failure.
 */
export async function initDiscord(
  config: DiscordConfig,
  services: DiscordServices,
): Promise<ChannelManager | null> {
  if (config.enabled === false) {
    console.log("[discord] Integration disabled via config");
    return null;
  }

  const client = createDiscordRestClient(config.token);

  // Verify bot has access to guild
  const guild = await client.getGuild(config.guildId);
  if (!guild) {
    console.warn("[discord] Cannot access guild — check bot token and guild ID");
    return null;
  }
  console.log(`[discord] Connected to guild: ${guild.name}`);

  // Provision channels
  channelManager = new ChannelManager(client, config);
  await channelManager.initialize();

  // Send pinned welcome/conversation-starter embeds (idempotent — skips if already pinned)
  await sendChannelWelcomes(channelManager).catch((err) =>
    console.warn(
      `[discord] Welcome messages failed: ${err instanceof Error ? err.message : String(err)}`,
    ),
  );

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

  return channelManager;
}

/**
 * Initialize Discord Gateway (WebSocket) for bidirectional control:
 * 1. Create discord.js Gateway client
 * 2. Register slash commands
 * 3. Wire interaction + message handlers
 *
 * Non-fatal — logs warnings on failure. REST integration continues.
 */
export async function initDiscordGateway(
  config: DiscordGatewayConfig,
  cm: ChannelManager,
): Promise<void> {
  if (config.gatewayEnabled === false) {
    console.log("[discord-gw] Gateway disabled via config");
    return;
  }

  const appId = config.applicationId || applicationIdFromToken(config.token);
  const hiveChannelIds = cm.getHiveChannelIds();

  // Create AI bridge if gateway URL + token are configured
  let aiBridgeInstance: AiBridge | null = null;
  if (config.gatewayUrl && config.gatewayToken) {
    aiBridgeInstance = createAiBridge({
      gatewayUrl: config.gatewayUrl,
      gatewayToken: config.gatewayToken,
      agentId: config.aiAgentId,
    });
    setAiBridge(aiBridgeInstance);
    console.log(`[discord-gw] AI bridge configured (${config.gatewayUrl})`);
  }

  const aiChannelId = cm.getChannelId("hive-ai");

  // Register slash commands
  try {
    await registerSlashCommands({
      token: config.token,
      applicationId: appId,
      guildId: config.guildId,
    });
  } catch (err) {
    console.warn(
      `[discord-gw] Slash command registration failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // Create and connect Gateway client
  gatewayClient = createGatewayClient(config.token, {
    onInteraction: (interaction) => {
      handleInteraction(interaction).catch((err) => {
        console.warn(
          `[discord-gw] Interaction error: ${err instanceof Error ? err.message : String(err)}`,
        );
      });
    },
    onMessage: (message) => {
      const botUserId = gatewayClient?.client.user?.id ?? "";
      if (
        aiBridgeInstance &&
        shouldHandleAsAi({ message, botUserId, hiveChannelIds, aiChannelId })
      ) {
        handleAiMessage(message, {
          bridge: aiBridgeInstance,
          botUserId,
          hiveChannelIds,
          aiChannelId,
        }).catch((err) => {
          console.warn(
            `[discord-gw] AI message error: ${err instanceof Error ? err.message : String(err)}`,
          );
        });
        return;
      }
      handleMessageCommand(message, hiveChannelIds).catch((err) => {
        console.warn(
          `[discord-gw] Message command error: ${err instanceof Error ? err.message : String(err)}`,
        );
      });
    },
  });

  try {
    await gatewayClient.login();
  } catch (err) {
    console.warn(
      `[discord-gw] Gateway login failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    gatewayClient = null;
  }
}

/** Graceful shutdown — stop reports, unsubscribe bridge, destroy Gateway. */
export async function shutdownDiscord(): Promise<void> {
  periodicReports?.stop();
  notificationBridge?.shutdown();
  if (gatewayClient) {
    await gatewayClient.destroy();
    gatewayClient = null;
  }
  channelManager = null;
  notificationBridge = null;
  periodicReports = null;
}

/** Expose channel manager for ad-hoc messages from other modules. */
export function getDiscordChannelManager(): ChannelManager | null {
  return channelManager;
}
