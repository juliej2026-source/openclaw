// ---------------------------------------------------------------------------
// AI message handler — detection, session keys, typing, chunking, delivery
// ---------------------------------------------------------------------------

import {
  type Message,
  type ChatInputCommandInteraction,
  EmbedBuilder,
  ChannelType,
} from "discord.js";
import type { AiBridge, AiResponse } from "./ai-bridge.js";
import { CONTEXT_COLORS, SEVERITY_COLORS } from "./types.js";

export type AiMessageConfig = {
  bridge: AiBridge;
  botUserId: string;
  hiveChannelIds: Set<string>;
  aiChannelId?: string | null;
};

// ---------------------------------------------------------------------------
// Detection — should this message trigger AI handling?
// ---------------------------------------------------------------------------

export function shouldHandleAsAi(params: {
  message: Message;
  botUserId: string;
  hiveChannelIds: Set<string>;
  aiChannelId?: string | null;
}): boolean {
  const { message, botUserId, hiveChannelIds, aiChannelId } = params;
  const content = message.content.trim();

  // 1. DM to the bot
  if (message.channel.type === ChannelType.DM) return true;

  // 2. Any message in the dedicated #hive-ai channel
  if (aiChannelId && message.channelId === aiChannelId) return true;

  // 3. Bot @mention anywhere
  if (message.mentions.users.has(botUserId)) return true;

  // 4. !ask prefix in any hive channel
  if (hiveChannelIds.has(message.channelId) && /^!ask\s/i.test(content)) return true;

  return false;
}

// ---------------------------------------------------------------------------
// Session key builder
// ---------------------------------------------------------------------------

export function buildDiscordSessionKey(params: {
  userId: string;
  channelId: string;
  threadId?: string | null;
  guildId?: string | null;
}): string {
  const { userId, channelId, threadId, guildId } = params;

  // DM — keyed per-user
  if (!guildId) {
    return `agent:main:discord:direct:${userId}`;
  }

  // Thread — shared context within thread
  if (threadId) {
    return `agent:main:discord:thread:${threadId}`;
  }

  // Guild channel — per-user per-channel
  return `agent:main:discord:channel:${channelId}:${userId}`;
}

// ---------------------------------------------------------------------------
// Question extraction — strip !ask prefix and @mentions
// ---------------------------------------------------------------------------

export function extractQuestion(content: string, botUserId: string): string {
  let text = content;

  // Strip !ask prefix
  text = text.replace(/^!ask\s+/i, "");

  // Strip bot @mentions: <@BOT_ID> or <@!BOT_ID>
  text = text.replace(new RegExp(`<@!?${botUserId}>`, "g"), "");

  return text.trim();
}

// ---------------------------------------------------------------------------
// Response chunking — respect Discord 2000 char limit
// ---------------------------------------------------------------------------

export function chunkAiResponse(text: string, maxChars = 2000): string[] {
  if (text.length <= maxChars) return [text];

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxChars) {
      chunks.push(remaining);
      break;
    }

    // Try to split at paragraph boundary
    let splitIdx = remaining.lastIndexOf("\n\n", maxChars);

    // Fall back to line boundary
    if (splitIdx <= 0) {
      splitIdx = remaining.lastIndexOf("\n", maxChars);
    }

    // Fall back to space
    if (splitIdx <= 0) {
      splitIdx = remaining.lastIndexOf(" ", maxChars);
    }

    // Hard split as last resort
    if (splitIdx <= 0) {
      splitIdx = maxChars;
    }

    chunks.push(remaining.slice(0, splitIdx));
    remaining = remaining.slice(splitIdx).replace(/^\n+/, "");
  }

  return chunks;
}

// ---------------------------------------------------------------------------
// Typing indicator manager
// ---------------------------------------------------------------------------

function startTyping(message: Message): NodeJS.Timeout {
  const ch = message.channel;
  // Send initial typing indicator (guard against PartialGroupDMChannel which lacks sendTyping)
  if ("sendTyping" in ch) (ch as { sendTyping(): Promise<void> }).sendTyping().catch(() => {});
  // Re-send every 8s (Discord typing expires after ~10s)
  return setInterval(() => {
    if ("sendTyping" in ch) (ch as { sendTyping(): Promise<void> }).sendTyping().catch(() => {});
  }, 8_000);
}

// ---------------------------------------------------------------------------
// Response formatting
// ---------------------------------------------------------------------------

function buildAiEmbed(response: AiResponse): EmbedBuilder {
  return new EmbedBuilder()
    .setDescription(response.content.slice(0, 4096))
    .setColor(CONTEXT_COLORS.ai)
    .setFooter({ text: `${response.model} | ${response.latencyMs}ms` })
    .setTimestamp();
}

function buildAiErrorEmbed(error: string): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle("AI Unavailable")
    .setDescription(error)
    .setColor(SEVERITY_COLORS.critical)
    .setTimestamp();
}

// ---------------------------------------------------------------------------
// Main handler — MessageCreate event
// ---------------------------------------------------------------------------

export async function handleAiMessage(message: Message, config: AiMessageConfig): Promise<void> {
  const { bridge, botUserId } = config;
  const question = extractQuestion(message.content, botUserId);

  if (!question) {
    await message.reply("Please include a question after `!ask` or your mention.");
    return;
  }

  const sessionKey = buildDiscordSessionKey({
    userId: message.author.id,
    channelId: message.channelId,
    threadId: message.channel.isThread() ? message.channelId : null,
    guildId: message.guildId,
  });

  const typingInterval = startTyping(message);

  try {
    const response = await bridge.chat({ message: question, sessionKey });
    clearInterval(typingInterval);

    // Short response — embed
    if (response.content.length <= 4096) {
      const embed = buildAiEmbed(response);
      await message.reply({ embeds: [embed] });
      return;
    }

    // Long response — chunked plain text
    const chunks = chunkAiResponse(response.content);
    const ch = message.channel;
    for (const chunk of chunks) {
      if ("send" in ch) await (ch as { send(c: string): Promise<unknown> }).send(chunk);
    }
  } catch (err) {
    clearInterval(typingInterval);
    const errorMsg = err instanceof Error ? err.message : String(err);
    const embed = buildAiErrorEmbed(errorMsg);
    await message.reply({ embeds: [embed] });
  }
}

// ---------------------------------------------------------------------------
// Slash command handler — /hive ask <question>
// ---------------------------------------------------------------------------

export async function handleAiSlashCommand(
  interaction: ChatInputCommandInteraction,
  bridge: AiBridge,
): Promise<void> {
  const question = interaction.options.getString("question", true);

  const sessionKey = buildDiscordSessionKey({
    userId: interaction.user.id,
    channelId: interaction.channelId,
    threadId: null,
    guildId: interaction.guildId,
  });

  try {
    const response = await bridge.chat({ message: question, sessionKey });

    if (response.content.length <= 4096) {
      const embed = buildAiEmbed(response);
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // First chunk as the reply, rest as follow-ups
    const chunks = chunkAiResponse(response.content);
    await interaction.editReply({ content: chunks[0] });
    for (let i = 1; i < chunks.length; i++) {
      await interaction.followUp({ content: chunks[i] });
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const embed = buildAiErrorEmbed(errorMsg);
    await interaction.editReply({ embeds: [embed] });
  }
}
