import { describe, it, expect } from "vitest";

describe("hotel-cli", () => {
  it("exports registerHotelCli function", async () => {
    const mod = await import("../cli/hotel-cli.js");
    expect(typeof mod.registerHotelCli).toBe("function");
  });

  it("registers 6 subcommands on a Commander program", async () => {
    const { registerHotelCli } = await import("../cli/hotel-cli.js");

    // Mock Commander program
    const commands: string[] = [];
    const mockCmd = {
      command: (name: string) => {
        commands.push(name);
        return mockCmd;
      },
      description: () => mockCmd,
      option: () => mockCmd,
      argument: () => mockCmd,
      action: () => mockCmd,
    };

    const mockProgram = {
      command: (name: string) => {
        commands.push(name);
        return mockCmd;
      },
      description: () => mockProgram,
    };

    registerHotelCli(mockProgram as any);

    // Should register "hotel" parent + 6 subcommands
    expect(commands).toContain("hotel");
    expect(commands).toContain("status");
    expect(commands).toContain("scrape");
    expect(commands).toContain("prices");
    expect(commands).toContain("compare");
    expect(commands).toContain("resolve");
    expect(commands).toContain("jobs");
  });
});

describe("station identity integration", () => {
  it("StationCapability includes hotel_scraping and price_comparison", async () => {
    // Import ALL_CAPABILITIES from hive-mind types
    const types = await import("../../../../extensions/hive-mind/src/types.js");
    const caps: string[] = types.ALL_CAPABILITIES;
    expect(caps).toContain("hotel_scraping");
    expect(caps).toContain("price_comparison");
  });

  it("buildLayers includes hotel_scraper layer", async () => {
    const { buildStationIdentity } =
      await import("../../../../extensions/hive-mind/src/station-identity.js");
    const identity = buildStationIdentity();
    expect(identity.layers.hotel_scraper).toBeDefined();
    expect(identity.layers.hotel_scraper.name).toBe("Hotel Scraper");
    expect(identity.layers.hotel_scraper.cli_commands).toBe(6);
    expect(identity.layers.hotel_scraper.tools).toContain("hotel_scrape");
    expect(identity.layers.hotel_scraper.providers).toContain("ratehawk");
    expect(identity.layers.hotel_scraper.status).toBe("active");
  });
});
