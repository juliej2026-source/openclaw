// ---------------------------------------------------------------------------
// Routes Discord interactions (slash commands + buttons) to dispatchCommand()
// ---------------------------------------------------------------------------

import {
  type Interaction,
  type ChatInputCommandInteraction,
  type ButtonInteraction,
} from "discord.js";
import type { NetworkCommand } from "../types.js";
import type { AiBridge } from "./ai-bridge.js";
import { dispatchCommand } from "../command-dispatch.js";
import { handleAiSlashCommand } from "./ai-message-handler.js";
import { formatCommandResponse, formatHelpResponse, formatAlertAck } from "./response-formatter.js";
import { BUTTON_PREFIX } from "./types.js";

let aiBridge: AiBridge | null = null;

export function setAiBridge(bridge: AiBridge | null): void {
  aiBridge = bridge;
}

/**
 * Top-level interaction handler — dispatches to slash or button handler.
 */
export async function handleInteraction(interaction: Interaction): Promise<void> {
  if (interaction.isChatInputCommand()) {
    await handleSlashCommand(interaction);
  } else if (interaction.isButton()) {
    await handleButtonInteraction(interaction);
  }
}

// ---------------------------------------------------------------------------
// Slash commands
// ---------------------------------------------------------------------------

async function handleSlashCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  if (interaction.commandName !== "hive") return;

  const group = interaction.options.getSubcommandGroup(false);
  const sub = interaction.options.getSubcommand(false);

  // /hive ask — AI free-form question
  if (sub === "ask" && !group) {
    if (!aiBridge) {
      await interaction.reply({ content: "AI bridge is not configured.", ephemeral: true });
      return;
    }
    await interaction.deferReply();
    await handleAiSlashCommand(interaction, aiBridge);
    return;
  }

  // /hive help — no defer needed
  if (sub === "help") {
    const { embeds } = formatHelpResponse();
    await interaction.reply({ embeds });
    return;
  }

  // /hive ping — fast
  if (sub === "ping" && !group) {
    const cmd: NetworkCommand = { command: "ping" };
    await interaction.deferReply();
    const resp = await dispatchCommand(cmd);
    const { embeds, components } = formatCommandResponse("ping", resp);
    await interaction.editReply({ embeds, components });
    return;
  }

  // Map interaction to NetworkCommand
  const networkCmd = mapSlashToCommand(group, sub, interaction);
  if (!networkCmd) {
    await interaction.reply({ content: "Unknown command.", ephemeral: true });
    return;
  }

  // Handle scraper commands via HTTP (not dispatchCommand)
  if (networkCmd.command.startsWith("scraper:")) {
    await interaction.deferReply();
    const resp = await handleScraperCommand(networkCmd);
    const { embeds, components } = formatCommandResponse(networkCmd.command, resp);
    await interaction.editReply({ embeds, components });
    return;
  }

  await interaction.deferReply();
  const resp = await dispatchCommand(networkCmd);
  const { embeds, components } = formatCommandResponse(networkCmd.command, resp);
  await interaction.editReply({ embeds, components });
}

function mapSlashToCommand(
  group: string | null,
  sub: string | null,
  interaction: ChatInputCommandInteraction,
): NetworkCommand | null {
  // Top-level subcommands
  if (!group) {
    if (sub === "status") return { command: "meta:dashboard" };
    if (sub === "models") return { command: "meta:models" };
    return null;
  }

  // Subcommand groups
  switch (group) {
    case "network":
      return mapNetworkCommand(sub, interaction);
    case "alerts":
      return mapAlertsCommand(sub, interaction);
    case "unifi":
      return sub ? { command: `unifi:${sub === "cloud" ? "cloud:discover" : sub}` } : null;
    case "meta":
      return mapMetaCommand(sub, interaction);
    case "neural":
      return mapNeuralCommand(sub, interaction);
    case "scraper":
      return mapScraperCommand(sub, interaction);
    case "hf":
      return mapHfCommand(sub, interaction);
    case "train":
      return mapTrainCommand(sub, interaction);
    default:
      return null;
  }
}

function mapNetworkCommand(
  sub: string | null,
  i: ChatInputCommandInteraction,
): NetworkCommand | null {
  switch (sub) {
    case "scan":
      return { command: "network:scan" };
    case "path":
      return { command: "network:path" };
    case "switch": {
      const target = i.options.getString("target", true);
      return { command: "network:switch", params: { path: target } };
    }
    case "5g":
      return { command: "network:5g" };
    case "failover":
      return { command: "network:failover" };
    default:
      return null;
  }
}

function mapAlertsCommand(
  sub: string | null,
  i: ChatInputCommandInteraction,
): NetworkCommand | null {
  if (sub === "list") {
    const active = i.options.getBoolean("active_only");
    return { command: "network:alerts", params: { active: active ?? false } };
  }
  if (sub === "ack") {
    const id = i.options.getString("id", true);
    return { command: "network:alerts:ack", params: { id } };
  }
  return null;
}

function mapMetaCommand(sub: string | null, i: ChatInputCommandInteraction): NetworkCommand | null {
  switch (sub) {
    case "status":
      return { command: "meta:status" };
    case "dashboard":
      return { command: "meta:dashboard" };
    case "classify":
      return { command: "meta:classify", params: { text: i.options.getString("text", true) } };
    case "recommend":
      return { command: "meta:recommend", params: { text: i.options.getString("text", true) } };
    default:
      return null;
  }
}

function mapNeuralCommand(
  sub: string | null,
  i: ChatInputCommandInteraction,
): NetworkCommand | null {
  switch (sub) {
    case "status":
      return { command: "neural:status" };
    case "topology":
      return { command: "neural:topology" };
    case "evolve":
      return { command: "neural:evolve" };
    case "query":
      return { command: "neural:query", params: { task: i.options.getString("task", true) } };
    default:
      return null;
  }
}

function mapScraperCommand(
  sub: string | null,
  i: ChatInputCommandInteraction,
): NetworkCommand | null {
  switch (sub) {
    case "status":
      return { command: "scraper:status" };
    case "jobs":
      return { command: "scraper:jobs", params: { limit: i.options.getInteger("limit") ?? 10 } };
    case "prices":
      return { command: "scraper:prices" };
    case "run":
      return { command: "scraper:run" };
    default:
      return null;
  }
}

function mapHfCommand(sub: string | null, i: ChatInputCommandInteraction): NetworkCommand | null {
  switch (sub) {
    case "status":
      return { command: "hf:status" };
    case "models":
      return { command: "hf:models", params: { limit: i.options.getInteger("limit") ?? 20 } };
    case "spaces":
      return { command: "hf:spaces", params: { limit: i.options.getInteger("limit") ?? 20 } };
    case "datasets":
      return { command: "hf:datasets", params: { limit: i.options.getInteger("limit") ?? 20 } };
    default:
      return null;
  }
}

function mapTrainCommand(
  sub: string | null,
  i: ChatInputCommandInteraction,
): NetworkCommand | null {
  switch (sub) {
    case "start":
      return {
        command: "meta:train",
        params: {
          dataset: i.options.getString("dataset", true),
          base_model: i.options.getString("base_model", true),
        },
      };
    case "jobs":
      return { command: "meta:train:jobs", params: { status: i.options.getString("status") } };
    case "adapters":
      return { command: "meta:train:adapters" };
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Button interactions
// ---------------------------------------------------------------------------

async function handleButtonInteraction(interaction: ButtonInteraction): Promise<void> {
  const customId = interaction.customId;
  if (!customId.startsWith(BUTTON_PREFIX + ":")) return;

  const parts = customId.slice(BUTTON_PREFIX.length + 1).split(":");
  const action = parts[0];
  const param = parts[1];

  await interaction.deferReply({ ephemeral: action === "ack" });

  let cmd: NetworkCommand;
  switch (action) {
    case "refresh":
      cmd = mapRefreshButton(param);
      break;
    case "ack":
      cmd = { command: "network:alerts:ack", params: { id: param } };
      break;
    case "scan":
      cmd = { command: "network:scan" };
      break;
    case "switch":
      cmd = { command: "network:switch", params: { path: param } };
      break;
    case "scrape": {
      const resp = await handleScraperCommand({ command: "scraper:run" });
      const { embeds, components } = formatCommandResponse("scraper:run", resp);
      await interaction.editReply({ embeds, components });
      return;
    }
    case "evolve":
      cmd = { command: "neural:evolve" };
      break;
    case "topology":
      cmd = { command: "neural:topology" };
      break;
    default:
      await interaction.editReply({ content: "Unknown action." });
      return;
  }

  if (action === "ack") {
    const resp = await dispatchCommand(cmd);
    const { embeds } = formatAlertAck(param, resp.success);
    await interaction.editReply({ embeds });
    return;
  }

  const resp = await dispatchCommand(cmd);
  const { embeds, components } = formatCommandResponse(cmd.command, resp);
  await interaction.editReply({ embeds, components });
}

function mapRefreshButton(context: string | undefined): NetworkCommand {
  switch (context) {
    case "dashboard":
      return { command: "meta:dashboard" };
    case "models":
      return { command: "meta:models" };
    case "alerts":
      return { command: "network:alerts", params: { active: true } };
    case "status":
      return { command: "meta:status" };
    default:
      return { command: "meta:dashboard" };
  }
}

// ---------------------------------------------------------------------------
// Hotel scraper HTTP bridge (not in dispatchCommand)
// ---------------------------------------------------------------------------

async function handleScraperCommand(cmd: NetworkCommand): Promise<{
  success: boolean;
  command: string;
  data?: unknown;
  error?: string;
  latency_ms: number;
}> {
  const start = Date.now();
  const base = "http://127.0.0.1:3001/api/hotel-scraper";
  try {
    let url: string;
    let method = "GET";
    switch (cmd.command) {
      case "scraper:status":
        url = `${base}/status`;
        break;
      case "scraper:jobs":
        url = `${base}/jobs?limit=${(cmd.params?.limit as number) ?? 10}`;
        break;
      case "scraper:prices":
        url = `${base}/prices`;
        break;
      case "scraper:run":
        url = `${base}/scrape`;
        method = "POST";
        break;
      default:
        url = `${base}/status`;
    }
    const res = await fetch(url, {
      method,
      headers: method === "POST" ? { "Content-Type": "application/json" } : undefined,
      body: method === "POST" ? JSON.stringify(cmd.params ?? {}) : undefined,
      signal: AbortSignal.timeout(15_000),
    });
    const data = await res.json();
    return { success: res.ok, command: cmd.command, data, latency_ms: Date.now() - start };
  } catch (err) {
    return {
      success: false,
      command: cmd.command,
      error: err instanceof Error ? err.message : String(err),
      latency_ms: Date.now() - start,
    };
  }
}
