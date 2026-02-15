// ---------------------------------------------------------------------------
// Formats CommandResponse into discord.js EmbedBuilder + ActionRow buttons
// ---------------------------------------------------------------------------

import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import type { CommandResponse } from "../types.js";
import { SEVERITY_COLORS, CONTEXT_COLORS, BUTTON_PREFIX } from "./types.js";

type FormattedResponse = {
  embeds: EmbedBuilder[];
  components: ActionRowBuilder<ButtonBuilder>[];
};

/** Build a button custom ID. */
function btnId(action: string, param?: string): string {
  return param ? `${BUTTON_PREFIX}:${action}:${param}` : `${BUTTON_PREFIX}:${action}`;
}

/** Truncate string to fit Discord limits. */
function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 3) + "..." : s;
}

/** Format any value into a readable string. */
function stringify(data: unknown): string {
  if (typeof data === "string") return data;
  return JSON.stringify(data, null, 2);
}

/**
 * Format a CommandResponse into Discord embeds + buttons based on the command.
 */
export function formatCommandResponse(
  command: string,
  response: CommandResponse,
): FormattedResponse {
  if (!response.success) {
    return formatError(command, response);
  }

  const prefix = command.split(":")[0];
  switch (prefix) {
    case "ping":
      return formatPing(response);
    case "network":
      return formatNetwork(command, response);
    case "meta":
      return formatMeta(command, response);
    case "unifi":
      return formatGeneric(command, response, CONTEXT_COLORS.network);
    case "neural":
      return formatNeural(command, response);
    case "hf":
      return formatGeneric(command, response, CONTEXT_COLORS.models);
    default:
      return formatGeneric(command, response, CONTEXT_COLORS.dashboard);
  }
}

function formatError(command: string, response: CommandResponse): FormattedResponse {
  const embed = new EmbedBuilder()
    .setTitle(`Command Failed: ${command}`)
    .setDescription(truncate(response.error ?? "Unknown error", 4096))
    .setColor(SEVERITY_COLORS.critical)
    .setTimestamp()
    .setFooter({ text: `Latency: ${response.latency_ms}ms` });
  return { embeds: [embed], components: [] };
}

function formatPing(response: CommandResponse): FormattedResponse {
  const data = response.data as Record<string, unknown> | undefined;
  const embed = new EmbedBuilder()
    .setTitle("Pong!")
    .setDescription(
      `Station: **${data?.station_id ?? "unknown"}**\nUptime: ${formatUptime(data?.uptime_seconds as number)}`,
    )
    .setColor(SEVERITY_COLORS.info)
    .setTimestamp()
    .setFooter({ text: `Latency: ${response.latency_ms}ms` });
  return { embeds: [embed], components: [] };
}

function formatNetwork(command: string, response: CommandResponse): FormattedResponse {
  const data = response.data as Record<string, unknown>;
  const embed = new EmbedBuilder().setColor(CONTEXT_COLORS.network).setTimestamp();
  const buttons = new ActionRowBuilder<ButtonBuilder>();

  if (command === "network:scan") {
    embed.setTitle("Network Scan");
    const stations = (data?.stations ?? []) as Array<Record<string, unknown>>;
    const lines = stations.map((s) => {
      const icon = s.reachable ? "\u{1f7e2}" : "\u{1f534}";
      const latency = s.latencyMs ? `${s.latencyMs}ms` : "--";
      return `${icon} **${s.label}** \`${s.ip}\` ${latency}`;
    });
    embed.setDescription(lines.join("\n") || "No stations found");
    buttons.addComponents(
      new ButtonBuilder()
        .setCustomId(btnId("switch", "primary"))
        .setLabel("Switch Primary")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(btnId("switch", "hr02_5g"))
        .setLabel("Switch 5G")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(btnId("scan", "network"))
        .setLabel("Refresh")
        .setStyle(ButtonStyle.Primary),
    );
  } else if (command === "network:path") {
    embed.setTitle("Dual-WAN Path State");
    const active = data?.activePath ?? data?.active_path ?? "unknown";
    const failover = data?.failoverActive ?? data?.failover_active ?? false;
    embed.setDescription(
      `Active: **${active}**\nFailover: ${failover ? "\u{26a0}\u{fe0f} Active" : "\u{2705} Normal"}`,
    );
    if (data?.paths && typeof data.paths === "object") {
      for (const [id, info] of Object.entries(
        data.paths as Record<string, Record<string, unknown>>,
      )) {
        embed.addFields({
          name: String(id),
          value: `Latency: ${info.latency_ms ?? "--"}ms | Loss: ${info.packet_loss_pct ?? 0}%`,
          inline: true,
        });
      }
    }
    buttons.addComponents(
      new ButtonBuilder()
        .setCustomId(btnId("switch", "primary"))
        .setLabel("Switch Primary")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(btnId("switch", "hr02_5g"))
        .setLabel("Switch 5G")
        .setStyle(ButtonStyle.Secondary),
    );
  } else if (command === "network:switch") {
    embed.setTitle("Network Path Switched");
    embed.setDescription(
      `From: **${data?.from ?? "?"}** → To: **${data?.to ?? "?"}**\nDuration: ${data?.duration_ms ?? "?"}ms`,
    );
    embed.setColor(data?.success ? SEVERITY_COLORS.info : SEVERITY_COLORS.warning);
  } else {
    return formatGeneric(command, response, CONTEXT_COLORS.network);
  }

  embed.setFooter({ text: `Latency: ${response.latency_ms}ms` });
  const components = buttons.components.length > 0 ? [buttons] : [];
  return { embeds: [embed], components };
}

function formatMeta(command: string, response: CommandResponse): FormattedResponse {
  const data = response.data as Record<string, unknown>;
  const embed = new EmbedBuilder().setColor(CONTEXT_COLORS.dashboard).setTimestamp();

  if (command === "meta:dashboard" || command === "meta:status") {
    embed.setTitle(command === "meta:dashboard" ? "System Dashboard" : "Meta-Engine Status");
    const hw = data?.hardware as Record<string, unknown> | undefined;
    const models = data?.models as Record<string, unknown> | undefined;
    const desc: string[] = [];
    if (hw) {
      desc.push(
        `CPU: ${hw.cpuCores ?? "?"}c | RAM: ${formatBytes(hw.availableRamBytes as number)}/${formatBytes(hw.totalRamBytes as number)}`,
      );
      desc.push(
        `Platform: ${hw.platform}/${hw.arch} | Ollama: ${hw.ollamaAvailable ? `v${hw.ollamaVersion}` : "unavailable"}`,
      );
    }
    if (models) {
      const installed = Array.isArray(models.installed) ? models.installed : [];
      const running = Array.isArray(models.running) ? models.running : [];
      desc.push(`Models: ${installed.length} installed, ${running.length} running`);
    }
    if (data?.uptime_seconds) desc.push(`Uptime: ${formatUptime(data.uptime_seconds as number)}`);
    embed.setDescription(desc.join("\n") || stringify(data));
    const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(btnId("refresh", "dashboard"))
        .setLabel("Refresh")
        .setStyle(ButtonStyle.Primary),
    );
    embed.setFooter({ text: `Latency: ${response.latency_ms}ms` });
    return { embeds: [embed], components: [buttons] };
  }

  if (command === "meta:models") {
    embed.setTitle("AI Models");
    const installed = (data?.installed ?? data) as Array<Record<string, unknown>>;
    if (Array.isArray(installed)) {
      const lines = installed.slice(0, 15).map((m) => {
        const running = m.running ? "\u{1f7e2}" : "\u{26aa}";
        return `${running} **${m.name ?? m.model}** (${formatBytes(m.size as number)})`;
      });
      embed.setDescription(lines.join("\n") || "No models found");
    } else {
      embed.setDescription(truncate(stringify(data), 4096));
    }
    embed.setColor(CONTEXT_COLORS.models);
    const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(btnId("refresh", "models"))
        .setLabel("Refresh")
        .setStyle(ButtonStyle.Primary),
    );
    embed.setFooter({ text: `Latency: ${response.latency_ms}ms` });
    return { embeds: [embed], components: [buttons] };
  }

  return formatGeneric(command, response, CONTEXT_COLORS.dashboard);
}

function formatNeural(command: string, response: CommandResponse): FormattedResponse {
  const data = response.data as Record<string, unknown>;
  const embed = new EmbedBuilder().setColor(CONTEXT_COLORS.neural).setTimestamp();
  const buttons = new ActionRowBuilder<ButtonBuilder>();

  if (command === "neural:status") {
    embed.setTitle("Neural Graph Status");
    const desc = [
      `Phase: **${data?.phase ?? "unknown"}**`,
      `Nodes: ${data?.nodeCount ?? data?.node_count ?? "?"}`,
      `Edges: ${data?.edgeCount ?? data?.edge_count ?? "?"}`,
    ];
    if (data?.fitness) {
      const f = data.fitness as Record<string, unknown>;
      desc.push(`Fitness: ${f.overall ?? "?"}%`);
    }
    embed.setDescription(desc.join("\n"));
    buttons.addComponents(
      new ButtonBuilder()
        .setCustomId(btnId("evolve"))
        .setLabel("Evolve")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(btnId("topology"))
        .setLabel("Topology")
        .setStyle(ButtonStyle.Secondary),
    );
  } else if (command === "neural:evolve") {
    embed.setTitle("Neural Evolution Triggered");
    embed.setDescription(truncate(stringify(data), 4096));
    embed.setColor(SEVERITY_COLORS.info);
  } else {
    return formatGeneric(command, response, CONTEXT_COLORS.neural);
  }

  embed.setFooter({ text: `Latency: ${response.latency_ms}ms` });
  const components = buttons.components.length > 0 ? [buttons] : [];
  return { embeds: [embed], components };
}

function formatGeneric(
  command: string,
  response: CommandResponse,
  color: number,
): FormattedResponse {
  const embed = new EmbedBuilder()
    .setTitle(commandTitle(command))
    .setColor(color)
    .setTimestamp()
    .setFooter({ text: `Latency: ${response.latency_ms}ms` });

  const text = stringify(response.data);
  if (text.length <= 4096) {
    embed.setDescription(text === "{}" ? "OK" : `\`\`\`json\n${truncate(text, 4090)}\n\`\`\``);
  } else {
    // Chunk into description + fields
    embed.setDescription(`\`\`\`json\n${truncate(text, 4090)}\n\`\`\``);
  }
  return { embeds: [embed], components: [] };
}

/** Build a help embed listing all commands. */
export function formatHelpResponse(): FormattedResponse {
  const embed = new EmbedBuilder()
    .setTitle("Hive-Mind Commands")
    .setColor(CONTEXT_COLORS.dashboard)
    .setDescription("Full infrastructure control via Discord")
    .addFields(
      { name: "/hive status", value: "System dashboard", inline: true },
      { name: "/hive models", value: "AI model list", inline: true },
      { name: "/hive ping", value: "Connectivity check", inline: true },
      { name: "/hive network", value: "scan, path, switch, 5g, failover", inline: false },
      { name: "/hive alerts", value: "list, ack", inline: true },
      { name: "/hive unifi", value: "status, devices, clients, health, cloud", inline: true },
      { name: "/hive meta", value: "status, dashboard, classify, recommend", inline: false },
      { name: "/hive neural", value: "status, topology, evolve, query", inline: true },
      { name: "/hive scraper", value: "status, jobs, prices, run", inline: true },
      { name: "/hive hf", value: "status, models, spaces, datasets", inline: false },
      { name: "/hive train", value: "start, jobs, adapters", inline: true },
      { name: "AI Chat", value: "`!ask`, `/hive ask`, @mention, DMs", inline: true },
      {
        name: "Message Commands",
        value:
          "`!status` `!scan` `!path` `!switch` `!alerts` `!ack` `!models` `!neural` `!scraper` `!ping` `!help`",
        inline: false,
      },
    )
    .setTimestamp();
  return { embeds: [embed], components: [] };
}

/** Build an alert acknowledgement confirmation embed. */
export function formatAlertAck(alertId: string, success: boolean): FormattedResponse {
  const embed = new EmbedBuilder()
    .setTitle(success ? "Alert Acknowledged" : "Acknowledgement Failed")
    .setDescription(
      success ? `Alert \`${alertId}\` acknowledged.` : `Could not acknowledge \`${alertId}\`.`,
    )
    .setColor(success ? SEVERITY_COLORS.info : SEVERITY_COLORS.critical)
    .setTimestamp();
  return { embeds: [embed], components: [] };
}

// -- Helpers --

function commandTitle(command: string): string {
  return command
    .split(":")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" > ");
}

function formatUptime(seconds: unknown): string {
  if (typeof seconds !== "number") return "?";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return d > 0 ? `${d}d ${h}h ${m}m` : h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatBytes(bytes: unknown): string {
  if (typeof bytes !== "number") return "?";
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)}GB`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)}MB`;
  return `${bytes}B`;
}
