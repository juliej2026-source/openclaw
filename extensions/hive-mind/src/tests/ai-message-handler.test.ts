import { ChannelType } from "discord.js";
import { describe, it, expect, vi } from "vitest";
import {
  shouldHandleAsAi,
  buildDiscordSessionKey,
  extractQuestion,
  chunkAiResponse,
  handleAiMessage,
  handleAiSlashCommand,
} from "../discord/ai-message-handler.js";

// ---------------------------------------------------------------------------
// Helpers — minimal Discord.js mocks
// ---------------------------------------------------------------------------

function mockMessage(
  overrides: {
    content?: string;
    channelId?: string;
    channelType?: ChannelType;
    guildId?: string | null;
    authorId?: string;
    mentionsBot?: boolean;
    isThread?: boolean;
  } = {},
): any {
  const {
    content = "hello",
    channelId = "ch-1",
    channelType = ChannelType.GuildText,
    guildId = "guild-1",
    authorId = "user-1",
    mentionsBot = false,
    isThread = false,
  } = overrides;

  return {
    content,
    channelId,
    guildId,
    author: { id: authorId },
    channel: {
      type: channelType,
      sendTyping: vi.fn().mockResolvedValue(undefined),
      send: vi.fn().mockResolvedValue(undefined),
      isThread: () => isThread,
    },
    mentions: {
      users: {
        has: (id: string) => mentionsBot && id === "bot-1",
      },
    },
    reply: vi.fn().mockResolvedValue(undefined),
  };
}

// ---------------------------------------------------------------------------
// shouldHandleAsAi
// ---------------------------------------------------------------------------

describe("shouldHandleAsAi", () => {
  const botUserId = "bot-1";
  const hiveChannelIds = new Set(["ch-hive-1", "ch-hive-2"]);
  const aiChannelId = "ch-ai";

  it("returns true for DMs", () => {
    const message = mockMessage({ channelType: ChannelType.DM, guildId: null });
    expect(shouldHandleAsAi({ message, botUserId, hiveChannelIds, aiChannelId })).toBe(true);
  });

  it("returns true for messages in #hive-ai channel", () => {
    const message = mockMessage({ channelId: "ch-ai" });
    expect(shouldHandleAsAi({ message, botUserId, hiveChannelIds, aiChannelId })).toBe(true);
  });

  it("returns true for bot @mention", () => {
    const message = mockMessage({ mentionsBot: true });
    expect(shouldHandleAsAi({ message, botUserId, hiveChannelIds, aiChannelId })).toBe(true);
  });

  it("returns true for !ask in hive channel", () => {
    const message = mockMessage({ content: "!ask what is the weather?", channelId: "ch-hive-1" });
    expect(shouldHandleAsAi({ message, botUserId, hiveChannelIds, aiChannelId })).toBe(true);
  });

  it("returns false for !ask in non-hive channel", () => {
    const message = mockMessage({ content: "!ask something", channelId: "ch-random" });
    expect(shouldHandleAsAi({ message, botUserId, hiveChannelIds, aiChannelId })).toBe(false);
  });

  it("returns false for regular message in hive channel", () => {
    const message = mockMessage({ content: "hello", channelId: "ch-hive-1" });
    expect(shouldHandleAsAi({ message, botUserId, hiveChannelIds, aiChannelId })).toBe(false);
  });

  it("returns false for !status in hive channel (not !ask)", () => {
    const message = mockMessage({ content: "!status", channelId: "ch-hive-1" });
    expect(shouldHandleAsAi({ message, botUserId, hiveChannelIds, aiChannelId })).toBe(false);
  });

  it("handles null aiChannelId", () => {
    const message = mockMessage({ channelId: "ch-ai" });
    expect(shouldHandleAsAi({ message, botUserId, hiveChannelIds, aiChannelId: null })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// buildDiscordSessionKey
// ---------------------------------------------------------------------------

describe("buildDiscordSessionKey", () => {
  it("builds DM session key (no guildId)", () => {
    const key = buildDiscordSessionKey({ userId: "u1", channelId: "ch1", guildId: null });
    expect(key).toBe("agent:main:discord:direct:u1");
  });

  it("builds thread session key", () => {
    const key = buildDiscordSessionKey({
      userId: "u1",
      channelId: "ch1",
      threadId: "th1",
      guildId: "g1",
    });
    expect(key).toBe("agent:main:discord:thread:th1");
  });

  it("builds guild channel session key", () => {
    const key = buildDiscordSessionKey({ userId: "u1", channelId: "ch1", guildId: "g1" });
    expect(key).toBe("agent:main:discord:channel:ch1:u1");
  });
});

// ---------------------------------------------------------------------------
// extractQuestion
// ---------------------------------------------------------------------------

describe("extractQuestion", () => {
  const botUserId = "bot-1";

  it("strips !ask prefix", () => {
    expect(extractQuestion("!ask what is the weather?", botUserId)).toBe("what is the weather?");
  });

  it("strips bot @mention", () => {
    expect(extractQuestion("<@bot-1> what time is it?", botUserId)).toBe("what time is it?");
  });

  it("strips bot @! mention", () => {
    expect(extractQuestion("<@!bot-1> hello", botUserId)).toBe("hello");
  });

  it("strips both !ask and @mention", () => {
    expect(extractQuestion("!ask <@bot-1> help me", botUserId)).toBe("help me");
  });

  it("returns trimmed text for plain input", () => {
    expect(extractQuestion("  just a question  ", botUserId)).toBe("just a question");
  });
});

// ---------------------------------------------------------------------------
// chunkAiResponse
// ---------------------------------------------------------------------------

describe("chunkAiResponse", () => {
  it("returns single chunk for short text", () => {
    expect(chunkAiResponse("short")).toEqual(["short"]);
  });

  it("returns single chunk at exactly maxChars", () => {
    const text = "a".repeat(2000);
    expect(chunkAiResponse(text, 2000)).toEqual([text]);
  });

  it("splits long text at paragraph boundary", () => {
    const para1 = "a".repeat(100);
    const para2 = "b".repeat(100);
    const text = `${para1}\n\n${para2}`;
    const chunks = chunkAiResponse(text, 150);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toBe(para1);
    expect(chunks[1]).toBe(para2);
  });

  it("splits at line boundary when no paragraph break", () => {
    const line1 = "a".repeat(100);
    const line2 = "b".repeat(100);
    const text = `${line1}\n${line2}`;
    const chunks = chunkAiResponse(text, 150);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toBe(line1);
    expect(chunks[1]).toBe(line2);
  });

  it("hard-splits when no good boundary exists", () => {
    const text = "a".repeat(3000);
    const chunks = chunkAiResponse(text, 2000);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toHaveLength(2000);
    expect(chunks[1]).toHaveLength(1000);
  });
});

// ---------------------------------------------------------------------------
// handleAiMessage integration
// ---------------------------------------------------------------------------

describe("handleAiMessage", () => {
  it("sends AI response as embed for short content", async () => {
    const mockBridge = {
      chat: vi.fn().mockResolvedValue({
        content: "The answer is 42.",
        model: "main",
        finishReason: "stop",
        latencyMs: 150,
      }),
      isAvailable: vi.fn().mockResolvedValue(true),
    };

    const message = mockMessage({
      content: "!ask what is the meaning of life?",
      channelId: "ch-1",
      guildId: "g1",
    });
    await handleAiMessage(message, {
      bridge: mockBridge,
      botUserId: "bot-1",
      hiveChannelIds: new Set(["ch-1"]),
    });

    expect(mockBridge.chat).toHaveBeenCalledOnce();
    expect(message.reply).toHaveBeenCalledOnce();
    const replyArg = message.reply.mock.calls[0][0];
    expect(replyArg.embeds).toHaveLength(1);
  });

  it("sends error embed when bridge throws", async () => {
    const mockBridge = {
      chat: vi.fn().mockRejectedValue(new Error("gateway timeout")),
      isAvailable: vi.fn().mockResolvedValue(false),
    };

    const message = mockMessage({ content: "!ask test", channelId: "ch-1", guildId: "g1" });
    await handleAiMessage(message, {
      bridge: mockBridge,
      botUserId: "bot-1",
      hiveChannelIds: new Set(["ch-1"]),
    });

    expect(message.reply).toHaveBeenCalledOnce();
    const replyArg = message.reply.mock.calls[0][0];
    expect(replyArg.embeds[0].data.title).toBe("AI Unavailable");
  });

  it("replies with prompt when question is empty after extraction", async () => {
    const mockBridge = {
      chat: vi.fn(),
      isAvailable: vi.fn().mockResolvedValue(true),
    };

    const message = mockMessage({
      content: "<@bot-1>",
      channelId: "ch-1",
      guildId: "g1",
      mentionsBot: true,
    });
    await handleAiMessage(message, {
      bridge: mockBridge,
      botUserId: "bot-1",
      hiveChannelIds: new Set(["ch-1"]),
    });

    expect(mockBridge.chat).not.toHaveBeenCalled();
    expect(message.reply).toHaveBeenCalledWith(
      "Please include a question after `!ask` or your mention.",
    );
  });

  it("sends chunked text for long responses", async () => {
    const longContent = "a".repeat(5000);
    const mockBridge = {
      chat: vi.fn().mockResolvedValue({
        content: longContent,
        model: "main",
        finishReason: "stop",
        latencyMs: 200,
      }),
      isAvailable: vi.fn().mockResolvedValue(true),
    };

    const message = mockMessage({
      content: "!ask long question",
      channelId: "ch-1",
      guildId: "g1",
    });
    await handleAiMessage(message, {
      bridge: mockBridge,
      botUserId: "bot-1",
      hiveChannelIds: new Set(["ch-1"]),
    });

    // Long responses go through channel.send, not message.reply
    expect(message.channel.send).toHaveBeenCalled();
    expect(message.channel.send.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// handleAiSlashCommand
// ---------------------------------------------------------------------------

describe("handleAiSlashCommand", () => {
  function mockInteraction(question: string): any {
    return {
      options: { getString: (_name: string) => question },
      user: { id: "user-1" },
      channelId: "ch-1",
      guildId: "guild-1",
      editReply: vi.fn().mockResolvedValue(undefined),
      followUp: vi.fn().mockResolvedValue(undefined),
    };
  }

  it("sends embed reply for short response", async () => {
    const bridge = {
      chat: vi.fn().mockResolvedValue({
        content: "Short answer",
        model: "main",
        finishReason: "stop",
        latencyMs: 100,
      }),
      isAvailable: vi.fn().mockResolvedValue(true),
    };

    const interaction = mockInteraction("test question");
    await handleAiSlashCommand(interaction, bridge);

    expect(bridge.chat).toHaveBeenCalledOnce();
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({ embeds: expect.any(Array) }),
    );
  });

  it("sends error embed when bridge throws", async () => {
    const bridge = {
      chat: vi.fn().mockRejectedValue(new Error("timeout")),
      isAvailable: vi.fn(),
    };

    const interaction = mockInteraction("fail question");
    await handleAiSlashCommand(interaction, bridge);

    expect(interaction.editReply).toHaveBeenCalledOnce();
    const editArg = interaction.editReply.mock.calls[0][0];
    expect(editArg.embeds[0].data.title).toBe("AI Unavailable");
  });
});
