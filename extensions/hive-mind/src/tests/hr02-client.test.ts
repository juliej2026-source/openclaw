import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Hr02Client, fetchHr02Status, HR02_ADMIN_URL } from "../hr02-client.js";

const mockFetch = vi.fn();
const originalFetch = globalThis.fetch;

beforeEach(() => {
  globalThis.fetch = mockFetch;
  mockFetch.mockReset();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

// ---------------------------------------------------------------------------
// Mock responses
// ---------------------------------------------------------------------------

function adminPageResponse(): Response {
  return new Response("<html><title>HR02</title></html>", {
    status: 200,
    headers: { "Content-Type": "text/html" },
  });
}

function statusApiResponse(overrides: Record<string, unknown> = {}): Response {
  return new Response(
    JSON.stringify({
      signal_strength: 78,
      band: "n78",
      technology: "5G SA",
      download_speed: 320,
      upload_speed: 45,
      ip_address: "153.224.68.100",
      uptime: 86400,
      ...overrides,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

// ---------------------------------------------------------------------------
// Hr02Client.isReachable
// ---------------------------------------------------------------------------

describe("Hr02Client.isReachable", () => {
  it("returns true when admin responds with 200", async () => {
    mockFetch.mockResolvedValueOnce(adminPageResponse());
    const client = new Hr02Client();

    expect(await client.isReachable()).toBe(true);
  });

  it("returns false on network timeout", async () => {
    mockFetch.mockRejectedValueOnce(new Error("ETIMEDOUT"));
    const client = new Hr02Client();

    expect(await client.isReachable()).toBe(false);
  });

  it("returns false on ECONNREFUSED", async () => {
    mockFetch.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    const client = new Hr02Client();

    expect(await client.isReachable()).toBe(false);
  });

  it("calls the correct admin URL", async () => {
    mockFetch.mockResolvedValueOnce(adminPageResponse());
    const client = new Hr02Client();

    await client.isReachable();

    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe("http://192.168.128.1/");
  });
});

// ---------------------------------------------------------------------------
// Hr02Client.getStatus
// ---------------------------------------------------------------------------

describe("Hr02Client.getStatus", () => {
  it("parses signal strength from status response", async () => {
    mockFetch.mockResolvedValueOnce(statusApiResponse());
    const client = new Hr02Client();

    const status = await client.getStatus();

    expect(status.connected).toBe(true);
    expect(status.signal_strength_pct).toBe(78);
  });

  it("parses 5G band and technology", async () => {
    mockFetch.mockResolvedValueOnce(statusApiResponse());
    const client = new Hr02Client();

    const status = await client.getStatus();

    expect(status.band).toBe("n78");
    expect(status.technology).toBe("5G SA");
  });

  it("parses speed data", async () => {
    mockFetch.mockResolvedValueOnce(statusApiResponse());
    const client = new Hr02Client();

    const status = await client.getStatus();

    expect(status.download_speed_mbps).toBe(320);
    expect(status.upload_speed_mbps).toBe(45);
  });

  it("parses IP address", async () => {
    mockFetch.mockResolvedValueOnce(statusApiResponse());
    const client = new Hr02Client();

    const status = await client.getStatus();

    expect(status.ip_address).toBe("153.224.68.100");
  });

  it("parses uptime", async () => {
    mockFetch.mockResolvedValueOnce(statusApiResponse());
    const client = new Hr02Client();

    const status = await client.getStatus();

    expect(status.uptime_seconds).toBe(86400);
  });

  it("handles missing fields gracefully", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({}), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const client = new Hr02Client();

    const status = await client.getStatus();

    expect(status.connected).toBe(true);
    expect(status.signal_strength_pct).toBeNull();
    expect(status.band).toBeNull();
    expect(status.technology).toBeNull();
  });

  it("throws when modem is unreachable", async () => {
    mockFetch.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    const client = new Hr02Client();

    await expect(client.getStatus()).rejects.toThrow();
  });

  it("includes fetched_at timestamp", async () => {
    mockFetch.mockResolvedValueOnce(statusApiResponse());
    const client = new Hr02Client();

    const status = await client.getStatus();

    expect(status.fetched_at).toBeDefined();
    expect(new Date(status.fetched_at).getTime()).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Hr02Client constructor
// ---------------------------------------------------------------------------

describe("Hr02Client constructor", () => {
  it("uses default admin URL", async () => {
    mockFetch.mockResolvedValueOnce(statusApiResponse());
    const client = new Hr02Client();

    await client.getStatus();

    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain("192.168.128.1");
  });

  it("accepts custom admin URL", async () => {
    mockFetch.mockResolvedValueOnce(statusApiResponse());
    const client = new Hr02Client({ adminUrl: "http://10.0.0.1" });

    await client.getStatus();

    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain("10.0.0.1");
  });
});

// ---------------------------------------------------------------------------
// fetchHr02Status
// ---------------------------------------------------------------------------

describe("fetchHr02Status", () => {
  it("returns status on success", async () => {
    mockFetch.mockResolvedValueOnce(statusApiResponse());

    const status = await fetchHr02Status();

    expect(status.connected).toBe(true);
    expect(status.signal_strength_pct).toBe(78);
  });

  it("returns disconnected stub on failure", async () => {
    mockFetch.mockRejectedValueOnce(new Error("ECONNREFUSED"));

    const status = await fetchHr02Status();

    expect(status.connected).toBe(false);
    expect(status.signal_strength_pct).toBeNull();
  });

  it("includes fetched_at timestamp even on failure", async () => {
    mockFetch.mockRejectedValueOnce(new Error("ECONNREFUSED"));

    const status = await fetchHr02Status();

    expect(status.fetched_at).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// HR02_ADMIN_URL constant
// ---------------------------------------------------------------------------

describe("HR02_ADMIN_URL", () => {
  it("points to 192.168.128.1", () => {
    expect(HR02_ADMIN_URL).toBe("http://192.168.128.1");
  });
});
