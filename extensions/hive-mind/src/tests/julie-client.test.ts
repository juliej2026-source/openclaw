import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StationIdentity, ExecutionRecord } from "../types.js";
import { JulieClient } from "../julie-client.js";

const mockFetch = vi.fn();
const originalFetch = globalThis.fetch;

beforeEach(() => {
  globalThis.fetch = mockFetch;
  mockFetch.mockReset();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function okJson(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function errorResponse(status: number, text: string): Response {
  return new Response(text, { status, statusText: text });
}

const mockIdentity: StationIdentity = {
  station_id: "iot-hub",
  hostname: "test-host",
  ip_address: "10.1.8.158",
  port: 3001,
  platform: "linux",
  arch: "x64",
  version: "1.0.0",
  uptime_seconds: 1000,
  capabilities: [],
  layers: {},
  models: [],
};

const mockExecution: ExecutionRecord = {
  station_id: "iot-hub",
  task_type: "coding",
  success: true,
  latency_ms: 100,
  capabilities_used: ["task_classification"],
  timestamp: new Date().toISOString(),
};

describe("JulieClient", () => {
  it("uses default base URL when none provided", () => {
    const client = new JulieClient();
    // Verify by making a call
    mockFetch.mockResolvedValueOnce(okJson({ success: true, agent_id: "iot-hub" }));
    client.register(mockIdentity);
    expect(mockFetch.mock.calls[0]?.[0]).toContain("10.1.8.143:8000");
  });

  it("uses custom base URL when provided", () => {
    const client = new JulieClient({ baseUrl: "http://custom:9000" });
    mockFetch.mockResolvedValueOnce(okJson({ success: true, agent_id: "iot-hub" }));
    client.register(mockIdentity);
    expect(mockFetch.mock.calls[0]?.[0]).toContain("custom:9000");
  });

  describe("register", () => {
    it("sends POST to hive/register endpoint", async () => {
      mockFetch.mockResolvedValueOnce(
        okJson({ success: true, agent_id: "iot-hub", dynamic: true }),
      );
      const client = new JulieClient({ baseUrl: "http://mock:8000" });

      const result = await client.register(mockIdentity);

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        "http://mock:8000/api/v1/orchestration/hive/register",
        expect.objectContaining({ method: "POST" }),
      );
    });

    it("includes identity data in request body", async () => {
      mockFetch.mockResolvedValueOnce(okJson({ success: true, agent_id: "iot-hub" }));
      const client = new JulieClient({ baseUrl: "http://mock:8000" });

      await client.register(mockIdentity);

      const body = JSON.parse(mockFetch.mock.calls[0]?.[1]?.body as string);
      expect(body.agent_id).toBe("iot-hub");
      expect(body.identity_data).toBeDefined();
      expect(body.identity_data.capabilities).toBeDefined();
    });

    it("throws on non-ok response", async () => {
      mockFetch.mockResolvedValueOnce(errorResponse(500, "Internal Server Error"));
      const client = new JulieClient({ baseUrl: "http://mock:8000" });

      await expect(client.register(mockIdentity)).rejects.toThrow(/registration failed: 500/);
    });

    it("throws on network error", async () => {
      mockFetch.mockRejectedValueOnce(new Error("ECONNREFUSED"));
      const client = new JulieClient({ baseUrl: "http://mock:8000" });

      await expect(client.register(mockIdentity)).rejects.toThrow(/ECONNREFUSED/);
    });
  });

  describe("reportExecution", () => {
    it("sends POST to hive/record endpoint", async () => {
      mockFetch.mockResolvedValueOnce(okJson({ received: true }));
      const client = new JulieClient({ baseUrl: "http://mock:8000" });

      const result = await client.reportExecution(mockExecution);

      expect(result.received).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        "http://mock:8000/api/v1/orchestration/hive/record",
        expect.objectContaining({ method: "POST" }),
      );
    });

    it("includes execution record in request body", async () => {
      mockFetch.mockResolvedValueOnce(okJson({ received: true }));
      const client = new JulieClient({ baseUrl: "http://mock:8000" });

      await client.reportExecution(mockExecution);

      const body = JSON.parse(mockFetch.mock.calls[0]?.[1]?.body as string);
      expect(body.station_id).toBe("iot-hub");
      expect(body.task_type).toBe("coding");
      expect(body.success).toBe(true);
    });

    it("throws on non-ok response", async () => {
      mockFetch.mockResolvedValueOnce(errorResponse(503, "Service Unavailable"));
      const client = new JulieClient({ baseUrl: "http://mock:8000" });

      await expect(client.reportExecution(mockExecution)).rejects.toThrow(/report failed: 503/);
    });
  });

  describe("isAvailable", () => {
    it("returns true when Julie responds ok", async () => {
      mockFetch.mockResolvedValueOnce(okJson({ status: "ok" }));
      const client = new JulieClient({ baseUrl: "http://mock:8000" });

      expect(await client.isAvailable()).toBe(true);
      expect(mockFetch.mock.calls[0]?.[0]).toBe("http://mock:8000/api/v1/health");
    });

    it("returns false on network error", async () => {
      mockFetch.mockRejectedValueOnce(new Error("ECONNREFUSED"));
      const client = new JulieClient({ baseUrl: "http://mock:8000" });

      expect(await client.isAvailable()).toBe(false);
    });

    it("returns false on non-ok response", async () => {
      mockFetch.mockResolvedValueOnce(errorResponse(502, "Bad Gateway"));
      const client = new JulieClient({ baseUrl: "http://mock:8000" });

      expect(await client.isAvailable()).toBe(false);
    });
  });
});
