import http from "node:http";
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  handleTandemInbound,
  handleTandemCallback,
  handleDelegationInbound,
  handleDelegationCallback,
} from "../network-api.js";

function mockReq(
  method: string,
  body?: string,
  headers?: Record<string, string>,
): http.IncomingMessage {
  const chunks: Buffer[] = body ? [Buffer.from(body)] : [];
  const req = {
    method,
    headers: {
      "x-api-key": "openclaw-network-2026-kelvin",
      "content-type": "application/json",
      ...headers,
    },
    on: vi.fn((event: string, cb: (arg?: Buffer) => void) => {
      if (event === "data") {
        for (const chunk of chunks) cb(chunk);
      }
      if (event === "end") cb();
    }),
    destroy: vi.fn(),
  } as unknown as http.IncomingMessage;
  return req;
}

function mockRes(): http.ServerResponse & { _status: number; _body: string } {
  const res = {
    _status: 0,
    _body: "",
    writeHead: vi.fn((status: number) => {
      res._status = status;
    }),
    end: vi.fn((body?: string) => {
      res._body = body ?? "";
    }),
  } as unknown as http.ServerResponse & { _status: number; _body: string };
  return res;
}

describe("handleTandemInbound", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // Mock fetch for callbacks
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ received: true }), { status: 200 }),
    );
  });

  it("rejects non-POST", async () => {
    const req = mockReq("GET");
    const res = mockRes();
    await handleTandemInbound(req, res);
    expect(res._status).toBe(405);
  });

  it("rejects missing API key", async () => {
    const req = mockReq("POST", "{}", { "x-api-key": "wrong" });
    const res = mockRes();
    await handleTandemInbound(req, res);
    expect(res._status).toBe(401);
  });

  it("rejects invalid JSON", async () => {
    const req = mockReq("POST", "not json");
    const res = mockRes();
    await handleTandemInbound(req, res);
    expect(res._status).toBe(400);
  });

  it("rejects missing task_id", async () => {
    const req = mockReq("POST", JSON.stringify({ task_type: "ping" }));
    const res = mockRes();
    await handleTandemInbound(req, res);
    expect(res._status).toBe(400);
  });

  it("accepts valid tandem task", async () => {
    const req = mockReq(
      "POST",
      JSON.stringify({
        task_id: "tandem-test-123",
        from_station: "scraper",
        task_type: "ping",
        payload: {},
        callback_url: "http://10.1.8.180:3001/api/network/tandem/callback",
      }),
    );
    const res = mockRes();
    await handleTandemInbound(req, res);
    expect(res._status).toBe(202);
    const body = JSON.parse(res._body);
    expect(body.accepted).toBe(true);
    expect(body.task_id).toBe("tandem-test-123");
  });
});

describe("handleTandemCallback", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects non-POST", async () => {
    const req = mockReq("GET");
    const res = mockRes();
    await handleTandemCallback(req, res);
    expect(res._status).toBe(405);
  });

  it("accepts valid callback", async () => {
    const req = mockReq(
      "POST",
      JSON.stringify({
        task_id: "tandem-test-456",
        station_id: "scraper",
        success: true,
        result: { status: "done" },
        latency_ms: 100,
      }),
    );
    const res = mockRes();
    await handleTandemCallback(req, res);
    expect(res._status).toBe(200);
    const body = JSON.parse(res._body);
    expect(body.received).toBe(true);
  });
});

describe("handleDelegationInbound", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ received: true }), { status: 200 }),
    );
  });

  it("rejects non-POST", async () => {
    const req = mockReq("GET");
    const res = mockRes();
    await handleDelegationInbound(req, res);
    expect(res._status).toBe(405);
  });

  it("rejects missing command", async () => {
    const req = mockReq("POST", JSON.stringify({ task_id: "deleg-1", from_station: "scraper" }));
    const res = mockRes();
    await handleDelegationInbound(req, res);
    expect(res._status).toBe(400);
  });

  it("accepts valid delegation", async () => {
    const req = mockReq(
      "POST",
      JSON.stringify({
        task_id: "deleg-test-789",
        from_station: "scraper",
        command: "ping",
        params: {},
        callback_url: "http://10.1.8.180:3001/api/network/delegation/callback",
      }),
    );
    const res = mockRes();
    await handleDelegationInbound(req, res);
    expect(res._status).toBe(202);
    const body = JSON.parse(res._body);
    expect(body.accepted).toBe(true);
    expect(body.task_id).toBe("deleg-test-789");
  });
});

describe("handleDelegationCallback", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("accepts valid callback", async () => {
    const req = mockReq(
      "POST",
      JSON.stringify({
        task_id: "deleg-test-callback",
        station_id: "scraper",
        success: true,
        latency_ms: 50,
      }),
    );
    const res = mockRes();
    await handleDelegationCallback(req, res);
    expect(res._status).toBe(200);
    const body = JSON.parse(res._body);
    expect(body.received).toBe(true);
  });
});
