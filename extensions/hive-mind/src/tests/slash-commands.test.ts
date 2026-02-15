import { describe, it, expect } from "vitest";
import { buildSlashCommands, applicationIdFromToken } from "../discord/slash-commands.js";

describe("slash-commands", () => {
  const commands = buildSlashCommands();

  it("builds exactly 1 top-level command", () => {
    expect(commands).toHaveLength(1);
    expect(commands[0].name).toBe("hive");
  });

  it("has a description", () => {
    expect(commands[0].description).toBeTruthy();
    expect(commands[0].description.length).toBeLessThanOrEqual(100);
  });

  it("contains expected subcommand groups", () => {
    const options = commands[0].options ?? [];
    const names = options.map((o: { name: string }) => o.name);
    expect(names).toContain("network");
    expect(names).toContain("alerts");
    expect(names).toContain("unifi");
    expect(names).toContain("meta");
    expect(names).toContain("neural");
    expect(names).toContain("scraper");
    expect(names).toContain("hf");
    expect(names).toContain("train");
  });

  it("contains top-level subcommands: status, models, ping, help, ask", () => {
    const options = commands[0].options ?? [];
    const names = options.map((o: { name: string }) => o.name);
    expect(names).toContain("status");
    expect(names).toContain("models");
    expect(names).toContain("ping");
    expect(names).toContain("help");
    expect(names).toContain("ask");
  });

  it("ask subcommand has required question option", () => {
    const options = commands[0].options ?? [];
    const ask = options.find((o: { name: string }) => o.name === "ask");
    expect(ask).toBeTruthy();
    const questionOpt = (ask?.options ?? []).find((o: { name: string }) => o.name === "question");
    expect(questionOpt).toBeTruthy();
    expect(questionOpt?.required).toBe(true);
  });

  it("network group has scan, path, switch, 5g, failover subcommands", () => {
    const options = commands[0].options ?? [];
    const network = options.find((o: { name: string }) => o.name === "network");
    expect(network).toBeTruthy();
    const subNames = (network?.options ?? []).map((o: { name: string }) => o.name);
    expect(subNames).toContain("scan");
    expect(subNames).toContain("path");
    expect(subNames).toContain("switch");
    expect(subNames).toContain("5g");
    expect(subNames).toContain("failover");
  });

  it("switch subcommand has required target option with choices", () => {
    const options = commands[0].options ?? [];
    const network = options.find((o: { name: string }) => o.name === "network");
    const switchCmd = (network?.options ?? []).find((o: { name: string }) => o.name === "switch");
    expect(switchCmd).toBeTruthy();
    const targetOpt = (switchCmd?.options ?? []).find((o: { name: string }) => o.name === "target");
    expect(targetOpt).toBeTruthy();
    expect(targetOpt?.required).toBe(true);
    expect(targetOpt?.choices).toHaveLength(2);
  });

  it("all option names are lowercase and no spaces", () => {
    function checkOptions(opts: Array<{ name: string; options?: unknown[] }>) {
      for (const o of opts) {
        expect(o.name).toMatch(/^[a-z0-9_]+$/);
        if (Array.isArray(o.options)) {
          checkOptions(o.options as Array<{ name: string; options?: unknown[] }>);
        }
      }
    }
    checkOptions(commands[0].options as Array<{ name: string; options?: unknown[] }>);
  });

  it("applicationIdFromToken decodes base64 token prefix", () => {
    // Encode "1234567890" in base64
    const encoded = Buffer.from("1234567890").toString("base64");
    const token = `${encoded}.xxx.yyy`;
    expect(applicationIdFromToken(token)).toBe("1234567890");
  });
});
