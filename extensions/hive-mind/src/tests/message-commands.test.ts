import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dispatchCommand
vi.mock("../command-dispatch.js", () => ({
  dispatchCommand: vi.fn(),
}));

import { dispatchCommand } from "../command-dispatch.js";
import { handleMessageCommand } from "../discord/message-commands.js";

const mockDispatch = vi.mocked(dispatchCommand);

const HIVE_CHANNEL_IDS = new Set(["ch-1", "ch-2", "ch-3"]);

function makeMessage(content: string, channelId = "ch-1") {
  return {
    content,
    channelId,
    author: { id: "user-1", bot: false },
    reply: vi.fn().mockResolvedValue(undefined),
  } as unknown;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDispatch.mockResolvedValue({
    success: true,
    command: "test",
    latency_ms: 3,
    data: { result: "ok" },
  });
});

describe("message-commands", () => {
  it("ignores messages in non-hive channels", async () => {
    const msg = makeMessage("!status", "random-channel");
    await handleMessageCommand(msg as any, HIVE_CHANNEL_IDS);
    expect(mockDispatch).not.toHaveBeenCalled();
    expect((msg as any).reply).not.toHaveBeenCalled();
  });

  it("ignores messages without ! prefix", async () => {
    const msg = makeMessage("hello world");
    await handleMessageCommand(msg as any, HIVE_CHANNEL_IDS);
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it("dispatches !status as meta:dashboard", async () => {
    const msg = makeMessage("!status");
    await handleMessageCommand(msg as any, HIVE_CHANNEL_IDS);
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({ command: "meta:dashboard" }),
    );
    expect((msg as any).reply).toHaveBeenCalled();
  });

  it("dispatches !scan as network:scan", async () => {
    const msg = makeMessage("!scan");
    await handleMessageCommand(msg as any, HIVE_CHANNEL_IDS);
    expect(mockDispatch).toHaveBeenCalledWith(expect.objectContaining({ command: "network:scan" }));
  });

  it("dispatches !path as network:path", async () => {
    const msg = makeMessage("!path");
    await handleMessageCommand(msg as any, HIVE_CHANNEL_IDS);
    expect(mockDispatch).toHaveBeenCalledWith(expect.objectContaining({ command: "network:path" }));
  });

  it("dispatches !switch primary as network:switch", async () => {
    const msg = makeMessage("!switch primary");
    await handleMessageCommand(msg as any, HIVE_CHANNEL_IDS);
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        command: "network:switch",
        params: { path: "primary" },
      }),
    );
  });

  it("dispatches !switch 5g as network:switch with hr02_5g", async () => {
    const msg = makeMessage("!switch 5g");
    await handleMessageCommand(msg as any, HIVE_CHANNEL_IDS);
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        command: "network:switch",
        params: { path: "hr02_5g" },
      }),
    );
  });

  it("dispatches !alerts as network:alerts", async () => {
    const msg = makeMessage("!alerts");
    await handleMessageCommand(msg as any, HIVE_CHANNEL_IDS);
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({ command: "network:alerts" }),
    );
  });

  it("dispatches !ack with alert ID", async () => {
    const msg = makeMessage("!ack alert-456");
    await handleMessageCommand(msg as any, HIVE_CHANNEL_IDS);
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        command: "network:alerts:ack",
        params: { id: "alert-456" },
      }),
    );
  });

  it("dispatches !models as meta:models", async () => {
    const msg = makeMessage("!models");
    await handleMessageCommand(msg as any, HIVE_CHANNEL_IDS);
    expect(mockDispatch).toHaveBeenCalledWith(expect.objectContaining({ command: "meta:models" }));
  });

  it("dispatches !ping as ping", async () => {
    const msg = makeMessage("!ping");
    await handleMessageCommand(msg as any, HIVE_CHANNEL_IDS);
    expect(mockDispatch).toHaveBeenCalledWith(expect.objectContaining({ command: "ping" }));
  });

  it("handles !help without dispatch", async () => {
    const msg = makeMessage("!help");
    await handleMessageCommand(msg as any, HIVE_CHANNEL_IDS);
    expect(mockDispatch).not.toHaveBeenCalled();
    expect((msg as any).reply).toHaveBeenCalled();
  });

  it("replies with error for unknown command", async () => {
    const msg = makeMessage("!foobar");
    await handleMessageCommand(msg as any, HIVE_CHANNEL_IDS);
    expect(mockDispatch).not.toHaveBeenCalled();
    const reply = (msg as any).reply.mock.calls[0][0];
    expect(reply.content).toContain("Unknown command");
  });

  it("replies with error for invalid switch args", async () => {
    const msg = makeMessage("!switch");
    await handleMessageCommand(msg as any, HIVE_CHANNEL_IDS);
    expect(mockDispatch).not.toHaveBeenCalled();
    const reply = (msg as any).reply.mock.calls[0][0];
    expect(reply.content).toContain("Invalid");
  });

  it("replies with error for !ack without ID", async () => {
    const msg = makeMessage("!ack");
    await handleMessageCommand(msg as any, HIVE_CHANNEL_IDS);
    expect(mockDispatch).not.toHaveBeenCalled();
  });
});
