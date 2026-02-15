import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UnifiCloudClient, loadCloudApiKey } from "../unifi-cloud-client.js";

const mockFetch = vi.fn();
const originalFetch = globalThis.fetch;
const originalEnv = { ...process.env };

beforeEach(() => {
  globalThis.fetch = mockFetch;
  mockFetch.mockReset();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  process.env = { ...originalEnv };
});

function cloudJson(data: unknown): Response {
  return new Response(JSON.stringify({ data }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function errorResponse(status: number, text: string): Response {
  return new Response(text, { status, statusText: text });
}

const TEST_API_KEY = "test-cloud-api-key-12345";

describe("UnifiCloudClient", () => {
  describe("authentication", () => {
    it("sends X-API-Key header with every request", async () => {
      mockFetch.mockResolvedValueOnce(cloudJson([]));
      const client = new UnifiCloudClient({ apiKey: TEST_API_KEY });

      await client.getHosts();

      const [, opts] = mockFetch.mock.calls[0];
      expect(opts.headers["X-API-Key"]).toBe(TEST_API_KEY);
      expect(opts.headers.Accept).toBe("application/json");
    });

    it("throws on 401 unauthorized", async () => {
      mockFetch.mockResolvedValueOnce(errorResponse(401, "Unauthorized"));
      const client = new UnifiCloudClient({ apiKey: "bad-key" });

      await expect(client.getHosts()).rejects.toThrow(/401/);
    });
  });

  describe("getHosts", () => {
    it("returns hosts array", async () => {
      mockFetch.mockResolvedValueOnce(
        cloudJson([
          {
            id: "h1",
            type: "UDM-Pro",
            name: "UDM Pro",
            reportedState: { hostname: "UDM", ip: "10.1.8.1" },
          },
        ]),
      );
      const client = new UnifiCloudClient({ apiKey: TEST_API_KEY });

      const hosts = await client.getHosts();

      expect(hosts).toHaveLength(1);
      expect(hosts[0].id).toBe("h1");
      expect(hosts[0].reportedState?.ip).toBe("10.1.8.1");
    });

    it("uses correct API URL", async () => {
      mockFetch.mockResolvedValueOnce(cloudJson([]));
      const client = new UnifiCloudClient({ apiKey: TEST_API_KEY });

      await client.getHosts();

      const [url] = mockFetch.mock.calls[0];
      expect(url).toBe("https://api.ui.com/ea/hosts");
    });
  });

  describe("getSites", () => {
    it("returns sites array", async () => {
      mockFetch.mockResolvedValueOnce(
        cloudJson([
          {
            siteId: "s1",
            meta: { name: "Default", timezone: "America/New_York" },
            statistics: { counts: { totalDevice: 3, uap: 1, usw: 1, ugw: 1 } },
          },
        ]),
      );
      const client = new UnifiCloudClient({ apiKey: TEST_API_KEY });

      const sites = await client.getSites();

      expect(sites).toHaveLength(1);
      expect(sites[0].siteId).toBe("s1");
    });

    it("uses correct API URL", async () => {
      mockFetch.mockResolvedValueOnce(cloudJson([]));
      const client = new UnifiCloudClient({ apiKey: TEST_API_KEY });

      await client.getSites();

      const [url] = mockFetch.mock.calls[0];
      expect(url).toBe("https://api.ui.com/ea/sites");
    });
  });

  describe("getDevices", () => {
    it("returns devices array", async () => {
      mockFetch.mockResolvedValueOnce(
        cloudJson([
          {
            mac: "aa:bb:cc:dd:ee:ff",
            name: "USW-Flex",
            model: "USW-Flex-2.5G-8-PoE",
            type: "usw",
            state: "ONLINE",
          },
          {
            mac: "11:22:33:44:55:66",
            name: "U7 Pro",
            model: "U7-Pro",
            type: "uap",
            state: "ONLINE",
          },
        ]),
      );
      const client = new UnifiCloudClient({ apiKey: TEST_API_KEY });

      const devices = await client.getDevices();

      expect(devices).toHaveLength(2);
      expect(devices[0].name).toBe("USW-Flex");
    });

    it("passes hostId as query param when specified", async () => {
      mockFetch.mockResolvedValueOnce(cloudJson([]));
      const client = new UnifiCloudClient({ apiKey: TEST_API_KEY });

      await client.getDevices("host-123");

      const [url] = mockFetch.mock.calls[0];
      expect(url).toBe("https://api.ui.com/ea/devices?hostIds=host-123");
    });

    it("omits query param when no hostId", async () => {
      mockFetch.mockResolvedValueOnce(cloudJson([]));
      const client = new UnifiCloudClient({ apiKey: TEST_API_KEY });

      await client.getDevices();

      const [url] = mockFetch.mock.calls[0];
      expect(url).toBe("https://api.ui.com/ea/devices");
    });
  });

  describe("isAvailable", () => {
    it("returns true when API responds", async () => {
      mockFetch.mockResolvedValueOnce(cloudJson([]));
      const client = new UnifiCloudClient({ apiKey: TEST_API_KEY });

      expect(await client.isAvailable()).toBe(true);
    });

    it("returns false on error", async () => {
      mockFetch.mockRejectedValueOnce(new Error("network error"));
      const client = new UnifiCloudClient({ apiKey: TEST_API_KEY });

      expect(await client.isAvailable()).toBe(false);
    });
  });

  describe("mapToLocalDevices", () => {
    it("converts cloud devices to local format", () => {
      const client = new UnifiCloudClient({ apiKey: TEST_API_KEY });
      const cloudDevices = [
        {
          id: "d1",
          mac: "aa:bb",
          ip: "10.1.8.2",
          name: "Switch",
          model: "USW",
          type: "usw",
          firmwareVersion: "7.1",
          state: "ONLINE",
        },
        { id: "d2", mac: "cc:dd", name: "AP", model: "UAP", type: "uap", state: "OFFLINE" },
      ];

      const local = client.mapToLocalDevices(cloudDevices);

      expect(local).toHaveLength(2);
      expect(local[0]._id).toBe("d1");
      expect(local[0].state).toBe(1);
      expect(local[1].state).toBe(0);
      expect(local[1].ip).toBe("");
    });
  });

  describe("mapToLocalHealth", () => {
    it("builds health from host data", () => {
      const client = new UnifiCloudClient({ apiKey: TEST_API_KEY });
      const host = {
        id: "h1",
        isBlocked: false,
        reportedState: { uptime: 86400 },
      };

      const health = client.mapToLocalHealth(host);

      expect(health).toHaveLength(1);
      expect(health[0].subsystem).toBe("wan");
      expect(health[0].status).toBe("ok");
      expect(health[0].uptime).toBe(86400);
    });
  });
});

describe("loadCloudApiKey", () => {
  it("returns key from environment", () => {
    process.env.UNIFI_CLOUD_API_KEY = "my-cloud-key";
    expect(loadCloudApiKey()).toBe("my-cloud-key");
  });

  it("throws when env var is missing", () => {
    delete process.env.UNIFI_CLOUD_API_KEY;
    expect(() => loadCloudApiKey()).toThrow(/UNIFI_CLOUD_API_KEY/);
  });
});
