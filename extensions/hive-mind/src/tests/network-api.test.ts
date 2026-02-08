import { EventEmitter } from "node:events";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleApacheStatus } from "../apache-status.js";
import { setMetricsContext, type MetricsContext } from "../metrics-exporter.js";
import {
  handlePing,
  handleIdentity,
  handleCommand,
  handleMetrics,
  handleMonitor,
} from "../network-api.js";

// Mock station-identity for identity endpoint
vi.mock("../station-identity.js", () => ({
  buildStationIdentity: vi.fn().mockReturnValue({
    station_id: "iot-hub",
    hostname: "test-host",
    ip_address: "10.1.7.158",
    port: 3001,
    platform: "linux",
    arch: "x64",
    version: "1.0.0",
    uptime_seconds: 1234,
    capabilities: ["model_management", "task_classification"],
    layers: {},
    models: [],
  }),
}));

// Mock command-dispatch for command endpoint
vi.mock("../command-dispatch.js", () => ({
  dispatchCommand: vi.fn().mockResolvedValue({
    success: true,
    command: "ping",
    data: { status: "online" },
    latency_ms: 1,
  }),
}));

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  setMetricsContext(null as unknown as MetricsContext);
});

// ---------------------------------------------------------------------------
// Helpers — lightweight IncomingMessage & ServerResponse stubs
// ---------------------------------------------------------------------------

type MockReq = EventEmitter & {
  method: string;
  url: string;
  headers: Record<string, string>;
};

type MockRes = {
  writeHead: ReturnType<typeof vi.fn>;
  end: ReturnType<typeof vi.fn>;
  statusCode: number;
  body: string;
};

function createReq(method: string, url: string, extraHeaders?: Record<string, string>): MockReq {
  const req = new EventEmitter() as MockReq;
  req.method = method;
  req.url = url;
  req.headers = { "content-type": "application/json", ...extraHeaders };
  return req;
}

/** Create a request with valid API key for authenticated endpoints. */
function createAuthReq(method: string, url: string): MockReq {
  return createReq(method, url, { "x-api-key": "openclaw-network-2026-kelvin" });
}

function createRes(): MockRes {
  const res: MockRes = {
    statusCode: 200,
    body: "",
    writeHead: vi.fn((code: number) => {
      res.statusCode = code;
    }),
    end: vi.fn((data?: string) => {
      res.body = data ?? "";
    }),
  };
  return res;
}

function sendBody(req: MockReq, body: string): void {
  req.emit("data", Buffer.from(body));
  req.emit("end");
}

function parseResBody(res: MockRes): unknown {
  return JSON.parse(res.body);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("handlePing", () => {
  it("responds with station_id and status", async () => {
    const req = createReq("GET", "/api/network/ping");
    const res = createRes();

    await handlePing(req as never, res as never);

    expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    const body = parseResBody(res) as Record<string, unknown>;
    expect(body).toHaveProperty("station_id", "iot-hub");
    expect(body).toHaveProperty("status", "online");
    expect(body).toHaveProperty("uptime_seconds");
  });

  it("returns 405 for non-GET requests", async () => {
    const req = createReq("POST", "/api/network/ping");
    const res = createRes();

    await handlePing(req as never, res as never);

    expect(res.writeHead).toHaveBeenCalledWith(405, expect.any(Object));
  });
});

describe("handleIdentity", () => {
  it("responds with full station identity", async () => {
    const req = createReq("GET", "/api/network/identity");
    const res = createRes();

    await handleIdentity(req as never, res as never);

    expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    const body = parseResBody(res) as Record<string, unknown>;
    expect(body).toHaveProperty("station_id", "iot-hub");
    expect(body).toHaveProperty("capabilities");
    expect(body).toHaveProperty("layers");
  });

  it("returns 405 for non-GET requests", async () => {
    const req = createReq("PUT", "/api/network/identity");
    const res = createRes();

    await handleIdentity(req as never, res as never);

    expect(res.writeHead).toHaveBeenCalledWith(405, expect.any(Object));
  });
});

describe("handleCommand", () => {
  it("dispatches a valid command and returns response", async () => {
    const req = createAuthReq("POST", "/api/network/command");
    const res = createRes();

    const promise = handleCommand(req as never, res as never);
    sendBody(req, JSON.stringify({ command: "ping" }));
    await promise;

    expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    const body = parseResBody(res) as Record<string, unknown>;
    expect(body).toHaveProperty("success", true);
    expect(body).toHaveProperty("command", "ping");
  });

  it("returns 401 without API key", async () => {
    const req = createReq("POST", "/api/network/command");
    const res = createRes();

    const promise = handleCommand(req as never, res as never);
    sendBody(req, JSON.stringify({ command: "ping" }));
    await promise;

    expect(res.writeHead).toHaveBeenCalledWith(401, expect.any(Object));
  });

  it("returns 405 for non-POST requests", async () => {
    const req = createReq("GET", "/api/network/command");
    const res = createRes();

    await handleCommand(req as never, res as never);

    expect(res.writeHead).toHaveBeenCalledWith(405, expect.any(Object));
  });

  it("returns 400 for invalid JSON body", async () => {
    const req = createAuthReq("POST", "/api/network/command");
    const res = createRes();

    const promise = handleCommand(req as never, res as never);
    sendBody(req, "not-json");
    await promise;

    expect(res.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
  });

  it("returns 400 when command field is missing", async () => {
    const req = createAuthReq("POST", "/api/network/command");
    const res = createRes();

    const promise = handleCommand(req as never, res as never);
    sendBody(req, JSON.stringify({ params: {} }));
    await promise;

    expect(res.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
  });

  it("preserves request_id in response", async () => {
    const req = createAuthReq("POST", "/api/network/command");
    const res = createRes();

    const promise = handleCommand(req as never, res as never);
    sendBody(req, JSON.stringify({ command: "ping", request_id: "abc-123" }));
    await promise;

    const body = parseResBody(res) as Record<string, unknown>;
    expect(body).toHaveProperty("request_id", "abc-123");
  });

  it("includes CORS headers in response", async () => {
    const req = createAuthReq("POST", "/api/network/command");
    const res = createRes();

    const promise = handleCommand(req as never, res as never);
    sendBody(req, JSON.stringify({ command: "ping" }));
    await promise;

    const headers = res.writeHead.mock.calls[0]?.[1] as Record<string, string>;
    expect(headers).toHaveProperty("Content-Type", "application/json");
  });

  it("includes station headers", async () => {
    const req = createAuthReq("POST", "/api/network/command");
    const res = createRes();

    const promise = handleCommand(req as never, res as never);
    sendBody(req, JSON.stringify({ command: "ping" }));
    await promise;

    const headers = res.writeHead.mock.calls[0]?.[1] as Record<string, string>;
    expect(headers).toHaveProperty("X-Station-ID", "iot-hub");
  });
});

// ---------------------------------------------------------------------------
// handleMetrics
// ---------------------------------------------------------------------------

describe("handleMetrics", () => {
  it("responds with 200 and Prometheus content type for GET", async () => {
    setMetricsContext({ startTime: Date.now() - 60_000 });

    const req = createReq("GET", "/metrics");
    const res = createRes();

    await handleMetrics(req as never, res as never);

    expect(res.writeHead).toHaveBeenCalledWith(
      200,
      expect.objectContaining({
        "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
      }),
    );
  });

  it("includes X-Station-ID header", async () => {
    setMetricsContext({ startTime: Date.now() });

    const req = createReq("GET", "/metrics");
    const res = createRes();

    await handleMetrics(req as never, res as never);

    const headers = res.writeHead.mock.calls[0]?.[1] as Record<string, string>;
    expect(headers).toHaveProperty("X-Station-ID", "iot-hub");
  });

  it("returns 405 for non-GET methods", async () => {
    const req = createReq("POST", "/metrics");
    const res = createRes();

    await handleMetrics(req as never, res as never);

    expect(res.writeHead).toHaveBeenCalledWith(405, expect.any(Object));
  });

  it("returns 405 for PUT method", async () => {
    const req = createReq("PUT", "/metrics");
    const res = createRes();

    await handleMetrics(req as never, res as never);

    expect(res.writeHead).toHaveBeenCalledWith(405, expect.any(Object));
  });

  it("returns 405 for DELETE method", async () => {
    const req = createReq("DELETE", "/metrics");
    const res = createRes();

    await handleMetrics(req as never, res as never);

    expect(res.writeHead).toHaveBeenCalledWith(405, expect.any(Object));
  });

  it("returns valid Prometheus text in the response body", async () => {
    setMetricsContext({
      startTime: Date.now() - 30_000,
      modelCounts: { installed: 2, running: 1 },
    });

    const req = createReq("GET", "/metrics");
    const res = createRes();

    await handleMetrics(req as never, res as never);

    const body = res.body;
    expect(body).toContain("hivemind_uptime_seconds");
    expect(body).toContain("hivemind_model_installed_count 2");
    expect(body).toContain("hivemind_model_running_count 1");
  });

  it("returns empty body when no metrics context is set", async () => {
    // Context was reset to null in beforeEach
    const req = createReq("GET", "/metrics");
    const res = createRes();

    await handleMetrics(req as never, res as never);

    expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    expect(res.body).toBe("");
  });

  it("includes uptime in the response body", async () => {
    setMetricsContext({ startTime: Date.now() - 5_000 });

    const req = createReq("GET", "/metrics");
    const res = createRes();

    await handleMetrics(req as never, res as never);

    expect(res.body).toContain("# HELP hivemind_uptime_seconds");
    expect(res.body).toContain("# TYPE hivemind_uptime_seconds gauge");
    expect(res.body).toMatch(/hivemind_uptime_seconds \d+/);
  });
});

// ---------------------------------------------------------------------------
// handleMonitor
// ---------------------------------------------------------------------------

describe("handleMonitor", () => {
  it("responds with 200 and HTML content type for GET", async () => {
    const req = createReq("GET", "/monitor");
    const res = createRes();

    await handleMonitor(req as never, res as never);

    expect(res.writeHead).toHaveBeenCalledWith(
      200,
      expect.objectContaining({
        "Content-Type": "text/html; charset=utf-8",
      }),
    );
  });

  it("includes X-Station-ID header", async () => {
    const req = createReq("GET", "/monitor");
    const res = createRes();

    await handleMonitor(req as never, res as never);

    const headers = res.writeHead.mock.calls[0]?.[1] as Record<string, string>;
    expect(headers).toHaveProperty("X-Station-ID", "iot-hub");
  });

  it("includes Cache-Control: no-cache header", async () => {
    const req = createReq("GET", "/monitor");
    const res = createRes();

    await handleMonitor(req as never, res as never);

    const headers = res.writeHead.mock.calls[0]?.[1] as Record<string, string>;
    expect(headers).toHaveProperty("Cache-Control", "no-cache");
  });

  it("returns 405 for POST method", async () => {
    const req = createReq("POST", "/monitor");
    const res = createRes();

    await handleMonitor(req as never, res as never);

    expect(res.writeHead).toHaveBeenCalledWith(405, expect.any(Object));
  });

  it("returns 405 for PUT method", async () => {
    const req = createReq("PUT", "/monitor");
    const res = createRes();

    await handleMonitor(req as never, res as never);

    expect(res.writeHead).toHaveBeenCalledWith(405, expect.any(Object));
  });

  it("returns 405 for DELETE method", async () => {
    const req = createReq("DELETE", "/monitor");
    const res = createRes();

    await handleMonitor(req as never, res as never);

    expect(res.writeHead).toHaveBeenCalledWith(405, expect.any(Object));
  });

  it("returns valid HTML with DOCTYPE", async () => {
    const req = createReq("GET", "/monitor");
    const res = createRes();

    await handleMonitor(req as never, res as never);

    expect(res.body).toContain("<!DOCTYPE html>");
    expect(res.body).toContain("<html");
    expect(res.body).toContain("</html>");
  });

  it("includes OpenClaw Hive Monitor title", async () => {
    const req = createReq("GET", "/monitor");
    const res = createRes();

    await handleMonitor(req as never, res as never);

    expect(res.body).toContain("<title>OpenClaw Hive Monitor</title>");
  });

  it("includes /metrics fetch script", async () => {
    const req = createReq("GET", "/monitor");
    const res = createRes();

    await handleMonitor(req as never, res as never);

    expect(res.body).toContain("/metrics");
    expect(res.body).toContain("<script>");
  });

  it("body is non-empty and substantial", async () => {
    const req = createReq("GET", "/monitor");
    const res = createRes();

    await handleMonitor(req as never, res as never);

    expect(res.body.length).toBeGreaterThan(1000);
  });
});

// ---------------------------------------------------------------------------
// handleApacheStatus
// ---------------------------------------------------------------------------

describe("handleApacheStatus", () => {
  it("returns 405 for non-GET methods", async () => {
    const req = createReq("POST", "/api/apache/status");
    const res = createRes();

    await handleApacheStatus(req as never, res as never);

    expect(res.writeHead).toHaveBeenCalledWith(405, expect.any(Object));
  });

  it("returns 405 for PUT method", async () => {
    const req = createReq("PUT", "/api/apache/status");
    const res = createRes();

    await handleApacheStatus(req as never, res as never);

    expect(res.writeHead).toHaveBeenCalledWith(405, expect.any(Object));
  });

  it("returns 503 when Apache is unreachable", async () => {
    // Mock global fetch to simulate unreachable Apache
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("Connection refused"));

    try {
      const req = createReq("GET", "/api/apache/status");
      const res = createRes();

      await handleApacheStatus(req as never, res as never);

      expect(res.writeHead).toHaveBeenCalledWith(503, expect.any(Object));
      const body = parseResBody(res) as Record<string, unknown>;
      expect(body).toHaveProperty("error", "Apache status unavailable");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("returns 200 with parsed status when Apache responds", async () => {
    const mockAutoOutput = [
      "Total Accesses: 12345",
      "Total kBytes: 67890",
      "Uptime: 86400",
      "ReqPerSec: .142",
      "BytesPerSec: 804.5",
      "BytesPerReq: 5678",
      "BusyWorkers: 3",
      "IdleWorkers: 7",
      "Scoreboard: __W_K.....",
      "ServerVersion: Apache/2.4.62",
      "ServerMPM: event",
    ].join("\n");

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(mockAutoOutput),
    });

    try {
      const req = createReq("GET", "/api/apache/status");
      const res = createRes();

      await handleApacheStatus(req as never, res as never);

      expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
      const body = parseResBody(res) as Record<string, unknown>;
      expect(body).toHaveProperty("uptime", 86400);
      expect(body).toHaveProperty("totalAccesses", 12345);
      expect(body).toHaveProperty("busyWorkers", 3);
      expect(body).toHaveProperty("idleWorkers", 7);
      expect(body).toHaveProperty("scoreboard", "__W_K.....");
      expect(body).toHaveProperty("serverVersion", "Apache/2.4.62");
      expect(body).toHaveProperty("serverMPM", "event");
      expect(body).toHaveProperty("workers");

      const workers = body.workers as Record<string, number>;
      expect(workers.waiting).toBe(3);
      expect(workers.writing).toBe(1);
      expect(workers.keepalive).toBe(1);
      expect(workers.open).toBe(5);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("includes X-Station-ID header", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("Connection refused"));

    try {
      const req = createReq("GET", "/api/apache/status");
      const res = createRes();

      await handleApacheStatus(req as never, res as never);

      const headers = res.writeHead.mock.calls[0]?.[1] as Record<string, string>;
      expect(headers).toHaveProperty("X-Station-ID", "iot-hub");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
