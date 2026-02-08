import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UnifiClient, loadUnifiConfig } from "../unifi-client.js";

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

function loginResponse(): Response {
  return new Response(JSON.stringify({ unique_id: "abc" }), {
    status: 200,
    headers: { "Set-Cookie": "TOKEN=jwt_test_token_123; Path=/; HttpOnly; Secure" },
  });
}

function unifiJson(data: unknown): Response {
  return new Response(JSON.stringify({ meta: { rc: "ok" }, data }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function errorResponse(status: number, text: string): Response {
  return new Response(text, { status, statusText: text });
}

const testConfig = {
  host: "10.1.7.1",
  username: "testuser",
  password: "testpass",
  site: "default",
};

describe("UnifiClient", () => {
  describe("login", () => {
    it("sends POST to /api/auth/login with credentials", async () => {
      mockFetch.mockResolvedValueOnce(loginResponse());
      const client = new UnifiClient({ config: testConfig });

      await client.login();

      expect(mockFetch).toHaveBeenCalledOnce();
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toBe("https://10.1.7.1/api/auth/login");
      expect(opts.method).toBe("POST");
      const body = JSON.parse(opts.body as string);
      expect(body.username).toBe("testuser");
      expect(body.password).toBe("testpass");
    });

    it("extracts TOKEN from Set-Cookie header", async () => {
      mockFetch.mockResolvedValueOnce(loginResponse());
      const client = new UnifiClient({ config: testConfig });

      await client.login();

      // Verify token is stored by making a subsequent request
      mockFetch.mockResolvedValueOnce(unifiJson([]));
      await client.getDevices();
      const [, opts] = mockFetch.mock.calls[1];
      expect(opts.headers.Cookie).toBe("TOKEN=jwt_test_token_123");
    });

    it("throws on non-ok response", async () => {
      mockFetch.mockResolvedValueOnce(errorResponse(401, "Unauthorized"));
      const client = new UnifiClient({ config: testConfig });

      await expect(client.login()).rejects.toThrow(/login failed/);
    });

    it("throws when no TOKEN cookie in response", async () => {
      mockFetch.mockResolvedValueOnce(new Response("{}", { status: 200, headers: {} }));
      const client = new UnifiClient({ config: testConfig });

      await expect(client.login()).rejects.toThrow(/no TOKEN cookie/);
    });

    it("throws on network error", async () => {
      mockFetch.mockRejectedValueOnce(new Error("ECONNREFUSED"));
      const client = new UnifiClient({ config: testConfig });

      await expect(client.login()).rejects.toThrow(/ECONNREFUSED/);
    });
  });

  describe("auto re-auth", () => {
    it("calls login automatically on first request", async () => {
      mockFetch.mockResolvedValueOnce(loginResponse());
      mockFetch.mockResolvedValueOnce(unifiJson([{ name: "switch" }]));
      const client = new UnifiClient({ config: testConfig });

      const devices = await client.getDevices();

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(devices).toHaveLength(1);
    });

    it("retries with fresh login on 401 response", async () => {
      // First login
      mockFetch.mockResolvedValueOnce(loginResponse());
      // First request -> 401
      mockFetch.mockResolvedValueOnce(errorResponse(401, "Unauthorized"));
      // Re-login
      mockFetch.mockResolvedValueOnce(loginResponse());
      // Retry request -> success
      mockFetch.mockResolvedValueOnce(unifiJson([{ name: "switch" }]));

      const client = new UnifiClient({ config: testConfig });
      const devices = await client.getDevices();

      expect(mockFetch).toHaveBeenCalledTimes(4);
      expect(devices).toHaveLength(1);
    });

    it("throws after re-auth if second request also fails", async () => {
      mockFetch.mockResolvedValueOnce(loginResponse());
      mockFetch.mockResolvedValueOnce(errorResponse(401, "Unauthorized"));
      mockFetch.mockResolvedValueOnce(loginResponse());
      mockFetch.mockResolvedValueOnce(errorResponse(403, "Forbidden"));

      const client = new UnifiClient({ config: testConfig });
      await expect(client.getDevices()).rejects.toThrow(/403/);
    });
  });

  describe("getDevices", () => {
    it("returns devices array from response data", async () => {
      mockFetch.mockResolvedValueOnce(loginResponse());
      mockFetch.mockResolvedValueOnce(
        unifiJson([
          { name: "USW-Flex-2.5G-8-PoE", type: "usw", mac: "aa:bb:cc:dd:ee:ff" },
          { name: "U7 Pro", type: "uap", mac: "11:22:33:44:55:66" },
        ]),
      );
      const client = new UnifiClient({ config: testConfig });

      const devices = await client.getDevices();

      expect(devices).toHaveLength(2);
      expect(devices[0].name).toBe("USW-Flex-2.5G-8-PoE");
    });

    it("uses correct site URL path with /proxy/network prefix", async () => {
      mockFetch.mockResolvedValueOnce(loginResponse());
      mockFetch.mockResolvedValueOnce(unifiJson([]));
      const client = new UnifiClient({ config: testConfig });

      await client.getDevices();

      const [url] = mockFetch.mock.calls[1];
      expect(url).toBe("https://10.1.7.1/proxy/network/api/s/default/stat/device");
    });
  });

  describe("getClients", () => {
    it("returns clients array", async () => {
      mockFetch.mockResolvedValueOnce(loginResponse());
      mockFetch.mockResolvedValueOnce(
        unifiJson([{ hostname: "kelvins-mbp", ip: "10.1.7.180", mac: "aa:bb" }]),
      );
      const client = new UnifiClient({ config: testConfig });

      const clients = await client.getClients();

      expect(clients).toHaveLength(1);
      expect(clients[0].ip).toBe("10.1.7.180");
    });

    it("uses correct site URL path", async () => {
      mockFetch.mockResolvedValueOnce(loginResponse());
      mockFetch.mockResolvedValueOnce(unifiJson([]));
      const client = new UnifiClient({ config: testConfig });

      await client.getClients();

      const [url] = mockFetch.mock.calls[1];
      expect(url).toBe("https://10.1.7.1/proxy/network/api/s/default/stat/sta");
    });
  });

  describe("getHealth", () => {
    it("returns health subsystems", async () => {
      mockFetch.mockResolvedValueOnce(loginResponse());
      mockFetch.mockResolvedValueOnce(
        unifiJson([
          { subsystem: "wan", status: "ok", latency: 5 },
          { subsystem: "lan", status: "ok", num_sw: 1 },
          { subsystem: "wlan", status: "ok", num_ap: 1 },
        ]),
      );
      const client = new UnifiClient({ config: testConfig });

      const health = await client.getHealth();

      expect(health).toHaveLength(3);
      expect(health[0].subsystem).toBe("wan");
      expect(health[0].status).toBe("ok");
    });

    it("uses correct site URL path", async () => {
      mockFetch.mockResolvedValueOnce(loginResponse());
      mockFetch.mockResolvedValueOnce(unifiJson([]));
      const client = new UnifiClient({ config: testConfig });

      await client.getHealth();

      const [url] = mockFetch.mock.calls[1];
      expect(url).toBe("https://10.1.7.1/proxy/network/api/s/default/stat/health");
    });
  });

  describe("getAlerts", () => {
    it("returns alerts array", async () => {
      mockFetch.mockResolvedValueOnce(loginResponse());
      mockFetch.mockResolvedValueOnce(unifiJson([{ _id: "a1", key: "EVT_SW", msg: "Port down" }]));
      const client = new UnifiClient({ config: testConfig });

      const alerts = await client.getAlerts();

      expect(alerts).toHaveLength(1);
      expect(alerts[0].msg).toBe("Port down");
    });

    it("uses correct endpoint", async () => {
      mockFetch.mockResolvedValueOnce(loginResponse());
      mockFetch.mockResolvedValueOnce(unifiJson([]));
      const client = new UnifiClient({ config: testConfig });

      await client.getAlerts();

      const [url] = mockFetch.mock.calls[1];
      expect(url).toBe("https://10.1.7.1/proxy/network/api/s/default/stat/alarm");
    });
  });

  describe("getEvents", () => {
    it("returns events array", async () => {
      mockFetch.mockResolvedValueOnce(loginResponse());
      mockFetch.mockResolvedValueOnce(
        unifiJson([{ _id: "e1", key: "EVT_AP_Connected", msg: "AP connected" }]),
      );
      const client = new UnifiClient({ config: testConfig });

      const events = await client.getEvents(10);

      expect(events).toHaveLength(1);
    });

    it("passes limit parameter", async () => {
      mockFetch.mockResolvedValueOnce(loginResponse());
      mockFetch.mockResolvedValueOnce(unifiJson([]));
      const client = new UnifiClient({ config: testConfig });

      await client.getEvents(25);

      const [url] = mockFetch.mock.calls[1];
      expect(url).toContain("_limit=25");
    });
  });

  describe("isAvailable", () => {
    it("returns true when login succeeds", async () => {
      mockFetch.mockResolvedValueOnce(loginResponse());
      const client = new UnifiClient({ config: testConfig });

      expect(await client.isAvailable()).toBe(true);
    });

    it("returns false on network error", async () => {
      mockFetch.mockRejectedValueOnce(new Error("ECONNREFUSED"));
      const client = new UnifiClient({ config: testConfig });

      expect(await client.isAvailable()).toBe(false);
    });
  });
});

describe("loadUnifiConfig", () => {
  it("returns config from environment variables", () => {
    process.env.UNIFI_HOST = "192.168.1.1";
    process.env.UNIFI_USERNAME = "admin";
    process.env.UNIFI_PASSWORD = "secret";
    process.env.UNIFI_SITE = "mysite";

    const config = loadUnifiConfig();

    expect(config.host).toBe("192.168.1.1");
    expect(config.username).toBe("admin");
    expect(config.password).toBe("secret");
    expect(config.site).toBe("mysite");
  });

  it("uses defaults for host and site", () => {
    process.env.UNIFI_USERNAME = "admin";
    process.env.UNIFI_PASSWORD = "secret";
    delete process.env.UNIFI_HOST;
    delete process.env.UNIFI_SITE;

    const config = loadUnifiConfig();

    expect(config.host).toBe("10.1.7.1");
    expect(config.site).toBe("default");
  });

  it("throws when UNIFI_USERNAME is missing", () => {
    delete process.env.UNIFI_USERNAME;
    process.env.UNIFI_PASSWORD = "secret";

    expect(() => loadUnifiConfig()).toThrow(/UNIFI_USERNAME/);
  });

  it("throws when UNIFI_PASSWORD is missing", () => {
    process.env.UNIFI_USERNAME = "admin";
    delete process.env.UNIFI_PASSWORD;

    expect(() => loadUnifiConfig()).toThrow(/UNIFI_PASSWORD/);
  });
});
