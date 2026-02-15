// ---------------------------------------------------------------------------
// Prefix-based message commands (! prefix) in hive channels only
// ---------------------------------------------------------------------------

import type { Message } from "discord.js";
import type { NetworkCommand } from "../types.js";
import { dispatchCommand } from "../command-dispatch.js";
import { formatCommandResponse, formatHelpResponse } from "./response-formatter.js";

const PREFIX = "!";

type CommandMapping = {
  command: string;
  params?: Record<string, unknown>;
  parseArgs?: (args: string[]) => Record<string, unknown>;
};

const COMMAND_MAP: Record<string, CommandMapping | ((args: string[]) => CommandMapping | null)> = {
  status: { command: "meta:dashboard" },
  scan: { command: "network:scan" },
  path: { command: "network:path" },
  switch: (args) => {
    const target = args[0];
    if (target === "primary" || target === "5g" || target === "hr02_5g") {
      return { command: "network:switch", params: { path: target === "5g" ? "hr02_5g" : target } };
    }
    return null;
  },
  "5g": { command: "network:5g" },
  alerts: { command: "network:alerts", params: { active: true } },
  ack: (args) => {
    if (!args[0]) return null;
    return { command: "network:alerts:ack", params: { id: args[0] } };
  },
  unifi: { command: "unifi:health" },
  devices: { command: "unifi:devices" },
  clients: { command: "unifi:clients" },
  models: { command: "meta:models" },
  neural: { command: "neural:status" },
  scraper: { command: "meta:dashboard" }, // fallback; scraper uses HTTP
  ping: { command: "ping" },
  hf: { command: "hf:status" },
};

/**
 * Handle a message-based command. Only processes messages in hive channels.
 */
export async function handleMessageCommand(
  message: Message,
  hiveChannelIds: Set<string>,
): Promise<void> {
  // Only respond in hive channels
  if (!hiveChannelIds.has(message.channelId)) return;

  const content = message.content.trim();
  if (!content.startsWith(PREFIX)) return;

  const parts = content.slice(PREFIX.length).trim().split(/\s+/);
  const cmdName = parts[0]?.toLowerCase();
  if (!cmdName) return;

  // Help is special — no dispatch needed
  if (cmdName === "help") {
    const { embeds } = formatHelpResponse();
    await message.reply({ embeds });
    return;
  }

  const mapping = COMMAND_MAP[cmdName];
  if (!mapping) {
    await message.reply({ content: `Unknown command: \`!${cmdName}\`. Try \`!help\` for a list.` });
    return;
  }

  const args = parts.slice(1);
  const resolved = typeof mapping === "function" ? mapping(args) : mapping;
  if (!resolved) {
    await message.reply({ content: `Invalid arguments for \`!${cmdName}\`. Try \`!help\`.` });
    return;
  }

  const cmd: NetworkCommand = {
    command: resolved.command,
    params: resolved.params,
  };

  // Handle scraper commands via HTTP
  if (cmd.command.startsWith("scraper:")) {
    const base = "http://127.0.0.1:3001/api/hotel-scraper";
    try {
      const res = await fetch(`${base}/status`, { signal: AbortSignal.timeout(10_000) });
      const data = await res.json();
      const { embeds, components } = formatCommandResponse("scraper:status", {
        success: true,
        command: "scraper:status",
        data,
        latency_ms: 0,
      });
      await message.reply({ embeds, components });
    } catch {
      await message.reply({ content: "Scraper unavailable." });
    }
    return;
  }

  try {
    const resp = await dispatchCommand(cmd);
    const { embeds, components } = formatCommandResponse(cmd.command, resp);
    await message.reply({ embeds, components });
  } catch (err) {
    await message.reply({
      content: `Command failed: ${err instanceof Error ? err.message : String(err)}`,
    });
  }
}
