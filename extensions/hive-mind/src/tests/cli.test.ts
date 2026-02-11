import { Command } from "commander";
import { describe, it, expect, vi } from "vitest";

vi.mock("../station-identity.js", () => ({
  buildStationIdentity: vi.fn().mockReturnValue({
    station_id: "iot-hub",
    hostname: "test",
    ip_address: "10.1.7.158",
    port: 3001,
    platform: "linux",
    arch: "x64",
    version: "1.0.0",
    uptime_seconds: 100,
    capabilities: ["model_management"],
    layers: { model_manager: { status: "active", tools: [], cli_commands: 0 } },
    models: [],
  }),
}));

vi.mock("../julie-client.js", () => ({
  JulieClient: vi.fn().mockImplementation(function () {
    return {
      isAvailable: vi.fn().mockResolvedValue(false),
      register: vi.fn().mockResolvedValue({ success: true, agent_id: "iot-hub" }),
    };
  }),
}));

vi.mock("../execution-log.js", () => ({
  ExecutionLog: vi.fn().mockImplementation(function () {
    return {
      getRecent: vi.fn().mockReturnValue([]),
      totalEntries: 0,
    };
  }),
}));

import { registerHiveCli } from "../cli/hive-cli.js";

describe("registerHiveCli", () => {
  it("registers hive command with subcommands", () => {
    const program = new Command();
    registerHiveCli(program);

    const hiveCmd = program.commands.find((c) => c.name() === "hive");
    expect(hiveCmd).toBeDefined();

    const subcommands = hiveCmd!.commands.map((c) => c.name());
    expect(subcommands).toContain("status");
    expect(subcommands).toContain("log");
    expect(subcommands).toContain("register");
  });

  it("status command exists with correct description", () => {
    const program = new Command();
    registerHiveCli(program);

    const hiveCmd = program.commands.find((c) => c.name() === "hive");
    const statusCmd = hiveCmd!.commands.find((c) => c.name() === "status");
    expect(statusCmd).toBeDefined();
    expect(statusCmd!.description()).toContain("station identity");
  });

  it("log command accepts --limit option", () => {
    const program = new Command();
    registerHiveCli(program);

    const hiveCmd = program.commands.find((c) => c.name() === "hive");
    const logCmd = hiveCmd!.commands.find((c) => c.name() === "log");
    expect(logCmd).toBeDefined();

    const limitOpt = logCmd!.options.find((o) => o.long === "--limit");
    expect(limitOpt).toBeDefined();
  });
});
