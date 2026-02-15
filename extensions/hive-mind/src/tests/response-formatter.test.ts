import { describe, it, expect } from "vitest";
import {
  formatCommandResponse,
  formatHelpResponse,
  formatAlertAck,
} from "../discord/response-formatter.js";
import { SEVERITY_COLORS, CONTEXT_COLORS } from "../discord/types.js";

describe("response-formatter", () => {
  describe("formatCommandResponse", () => {
    it("formats error responses with red color", () => {
      const { embeds, components } = formatCommandResponse("network:scan", {
        success: false,
        command: "network:scan",
        error: "Scanner offline",
        latency_ms: 5,
      });
      expect(embeds).toHaveLength(1);
      expect(embeds[0].data.color).toBe(SEVERITY_COLORS.critical);
      expect(embeds[0].data.title).toContain("Failed");
      expect(embeds[0].data.description).toContain("Scanner offline");
      expect(components).toHaveLength(0);
    });

    it("formats ping response", () => {
      const { embeds } = formatCommandResponse("ping", {
        success: true,
        command: "ping",
        latency_ms: 2,
        data: { station_id: "iot-hub", uptime_seconds: 3600 },
      });
      expect(embeds).toHaveLength(1);
      expect(embeds[0].data.title).toBe("Pong!");
      expect(embeds[0].data.description).toContain("iot-hub");
    });

    it("formats network:scan with station list and buttons", () => {
      const { embeds, components } = formatCommandResponse("network:scan", {
        success: true,
        command: "network:scan",
        latency_ms: 30,
        data: {
          stations: [
            { ip: "10.1.8.87", label: "Julie", reachable: true, latencyMs: 20 },
            { ip: "10.1.8.239", label: "CLERK", reachable: false },
          ],
        },
      });
      expect(embeds).toHaveLength(1);
      expect(embeds[0].data.color).toBe(CONTEXT_COLORS.network);
      expect(embeds[0].data.description).toContain("Julie");
      expect(embeds[0].data.description).toContain("CLERK");
      // Should have buttons (Switch Primary, Switch 5G, Refresh)
      expect(components).toHaveLength(1);
      expect(components[0].components).toHaveLength(3);
    });

    it("formats network:path with dual-WAN info", () => {
      const { embeds } = formatCommandResponse("network:path", {
        success: true,
        command: "network:path",
        latency_ms: 5,
        data: { activePath: "primary", failoverActive: false },
      });
      expect(embeds[0].data.title).toBe("Dual-WAN Path State");
      expect(embeds[0].data.description).toContain("primary");
    });

    it("formats meta:dashboard with system info", () => {
      const { embeds, components } = formatCommandResponse("meta:dashboard", {
        success: true,
        command: "meta:dashboard",
        latency_ms: 50,
        data: {
          hardware: {
            cpuCores: 8,
            totalRamBytes: 16e9,
            availableRamBytes: 8e9,
            platform: "linux",
            arch: "x64",
            ollamaAvailable: true,
            ollamaVersion: "0.15.5",
          },
          models: { installed: [1, 2, 3], running: [1] },
          uptime_seconds: 86400,
        },
      });
      expect(embeds[0].data.title).toBe("System Dashboard");
      expect(embeds[0].data.description).toContain("8c");
      expect(embeds[0].data.description).toContain("3 installed");
      // Refresh button
      expect(components).toHaveLength(1);
    });

    it("formats neural:status with phase info and buttons", () => {
      const { embeds, components } = formatCommandResponse("neural:status", {
        success: true,
        command: "neural:status",
        latency_ms: 10,
        data: { phase: "genesis", nodeCount: 6, edgeCount: 10 },
      });
      expect(embeds[0].data.color).toBe(CONTEXT_COLORS.neural);
      expect(embeds[0].data.description).toContain("genesis");
      expect(embeds[0].data.description).toContain("6");
      // Evolve + Topology buttons
      expect(components).toHaveLength(1);
      expect(components[0].components).toHaveLength(2);
    });

    it("formats generic commands as JSON code block", () => {
      const { embeds } = formatCommandResponse("unifi:health", {
        success: true,
        command: "unifi:health",
        latency_ms: 8,
        data: { subsystem: "wan", status: "ok" },
      });
      expect(embeds[0].data.description).toContain("```json");
    });
  });

  describe("formatHelpResponse", () => {
    it("returns help embed with command fields", () => {
      const { embeds, components } = formatHelpResponse();
      expect(embeds).toHaveLength(1);
      expect(embeds[0].data.title).toBe("Hive-Mind Commands");
      const fieldNames = (embeds[0].data.fields ?? []).map((f: { name: string }) => f.name);
      expect(fieldNames).toContain("/hive status");
      expect(fieldNames).toContain("/hive network");
      expect(fieldNames).toContain("Message Commands");
      expect(components).toHaveLength(0);
    });
  });

  describe("formatAlertAck", () => {
    it("returns success embed for acknowledged alert", () => {
      const { embeds } = formatAlertAck("alert-123", true);
      expect(embeds[0].data.title).toBe("Alert Acknowledged");
      expect(embeds[0].data.color).toBe(SEVERITY_COLORS.info);
    });

    it("returns error embed for failed ack", () => {
      const { embeds } = formatAlertAck("alert-123", false);
      expect(embeds[0].data.title).toBe("Acknowledgement Failed");
      expect(embeds[0].data.color).toBe(SEVERITY_COLORS.critical);
    });
  });
});
