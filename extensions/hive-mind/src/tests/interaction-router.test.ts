import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dispatchCommand before importing the router
vi.mock("../command-dispatch.js", () => ({
  dispatchCommand: vi.fn(),
}));

import { dispatchCommand } from "../command-dispatch.js";
import { handleInteraction } from "../discord/interaction-router.js";

const mockDispatch = vi.mocked(dispatchCommand);

function makeSlashInteraction(opts: {
  group?: string | null;
  subcommand?: string | null;
  options?: Record<string, unknown>;
}) {
  const optionValues = opts.options ?? {};
  return {
    isChatInputCommand: () => true,
    isButton: () => false,
    commandName: "hive",
    options: {
      getSubcommandGroup: (_required?: boolean) => opts.group ?? null,
      getSubcommand: (_required?: boolean) => opts.subcommand ?? null,
      getString: (name: string, _required?: boolean) => (optionValues[name] as string) ?? null,
      getBoolean: (name: string) => (optionValues[name] as boolean) ?? null,
      getInteger: (name: string) => (optionValues[name] as number) ?? null,
    },
    deferReply: vi.fn().mockResolvedValue(undefined),
    editReply: vi.fn().mockResolvedValue(undefined),
    reply: vi.fn().mockResolvedValue(undefined),
  } as unknown;
}

function makeButtonInteraction(customId: string) {
  return {
    isChatInputCommand: () => false,
    isButton: () => true,
    customId,
    deferReply: vi.fn().mockResolvedValue(undefined),
    editReply: vi.fn().mockResolvedValue(undefined),
    reply: vi.fn().mockResolvedValue(undefined),
  } as unknown;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDispatch.mockResolvedValue({
    success: true,
    command: "test",
    latency_ms: 5,
    data: { test: true },
  });
});

describe("interaction-router — slash commands", () => {
  it("routes /hive status to meta:dashboard", async () => {
    const i = makeSlashInteraction({ subcommand: "status" });
    await handleInteraction(i as any);
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({ command: "meta:dashboard" }),
    );
  });

  it("routes /hive models to meta:models", async () => {
    const i = makeSlashInteraction({ subcommand: "models" });
    await handleInteraction(i as any);
    expect(mockDispatch).toHaveBeenCalledWith(expect.objectContaining({ command: "meta:models" }));
  });

  it("routes /hive network scan to network:scan", async () => {
    const i = makeSlashInteraction({ group: "network", subcommand: "scan" });
    await handleInteraction(i as any);
    expect(mockDispatch).toHaveBeenCalledWith(expect.objectContaining({ command: "network:scan" }));
  });

  it("routes /hive network switch with target param", async () => {
    const i = makeSlashInteraction({
      group: "network",
      subcommand: "switch",
      options: { target: "hr02_5g" },
    });
    await handleInteraction(i as any);
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        command: "network:switch",
        params: { path: "hr02_5g" },
      }),
    );
  });

  it("routes /hive alerts ack with id param", async () => {
    const i = makeSlashInteraction({
      group: "alerts",
      subcommand: "ack",
      options: { id: "alert-123" },
    });
    await handleInteraction(i as any);
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        command: "network:alerts:ack",
        params: { id: "alert-123" },
      }),
    );
  });

  it("routes /hive neural evolve to neural:evolve", async () => {
    const i = makeSlashInteraction({ group: "neural", subcommand: "evolve" });
    await handleInteraction(i as any);
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({ command: "neural:evolve" }),
    );
  });

  it("routes /hive meta classify with text param", async () => {
    const i = makeSlashInteraction({
      group: "meta",
      subcommand: "classify",
      options: { text: "summarize this document" },
    });
    await handleInteraction(i as any);
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        command: "meta:classify",
        params: { text: "summarize this document" },
      }),
    );
  });

  it("routes /hive help without dispatching a command", async () => {
    const i = makeSlashInteraction({ subcommand: "help" });
    await handleInteraction(i as any);
    expect(mockDispatch).not.toHaveBeenCalled();
    expect((i as any).reply).toHaveBeenCalled();
  });

  it("defers reply before dispatching", async () => {
    const i = makeSlashInteraction({ group: "network", subcommand: "scan" });
    await handleInteraction(i as any);
    expect((i as any).deferReply).toHaveBeenCalled();
    expect((i as any).editReply).toHaveBeenCalled();
  });

  it("handles failed commands gracefully", async () => {
    mockDispatch.mockResolvedValue({
      success: false,
      command: "network:scan",
      error: "Scanner offline",
      latency_ms: 3,
    });
    const i = makeSlashInteraction({ group: "network", subcommand: "scan" });
    await handleInteraction(i as any);
    const editCall = (i as any).editReply.mock.calls[0][0];
    expect(editCall.embeds[0].data.title).toContain("Failed");
  });
});

describe("interaction-router — button interactions", () => {
  it("handles refresh:dashboard button", async () => {
    const i = makeButtonInteraction("hive:refresh:dashboard");
    await handleInteraction(i as any);
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({ command: "meta:dashboard" }),
    );
  });

  it("handles switch:primary button", async () => {
    const i = makeButtonInteraction("hive:switch:primary");
    await handleInteraction(i as any);
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        command: "network:switch",
        params: { path: "primary" },
      }),
    );
  });

  it("handles ack button with alert ID", async () => {
    const i = makeButtonInteraction("hive:ack:alert-xyz");
    await handleInteraction(i as any);
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        command: "network:alerts:ack",
        params: { id: "alert-xyz" },
      }),
    );
  });

  it("ignores buttons without hive prefix", async () => {
    const i = makeButtonInteraction("other:action");
    await handleInteraction(i as any);
    expect(mockDispatch).not.toHaveBeenCalled();
  });
});
