import { describe, it, expect, vi, beforeEach } from "vitest";
import { PeerClient } from "../peer-client.js";

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("PeerClient", () => {
  it("initializes with known peer stations", () => {
    const client = new PeerClient();
    const peers = client.getPeers();
    expect(peers.length).toBeGreaterThanOrEqual(1);
    const julie = client.getPeer("julie");
    expect(julie).toBeDefined();
    expect(julie!.ip).toBe("10.1.8.143");
    expect(julie!.port).toBe(8000);
    expect(julie!.platform).toBe("linux");
  });

  it("returns undefined for unknown peer", () => {
    const client = new PeerClient();
    expect(client.getPeer("nonexistent")).toBeUndefined();
  });

  it("updates reachability", () => {
    const client = new PeerClient();
    expect(client.getPeer("julie")!.reachable).toBe(false);

    client.updateReachability("julie", true);
    const peer = client.getPeer("julie")!;
    expect(peer.reachable).toBe(true);
    expect(peer.last_seen).toBeDefined();
  });

  it("finds peers by capability", () => {
    const client = new PeerClient();
    const social = client.findByCapability("social_monitoring");
    expect(social).toHaveLength(1);
    expect(social[0].station_id).toBe("julie");

    const unknown = client.findByCapability("nonexistent_cap");
    expect(unknown).toHaveLength(0);
  });

  it("returns error for dispatch to unknown peer", async () => {
    const client = new PeerClient();
    const result = await client.dispatchCommand("unknown", {
      command: "ping",
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("Unknown peer station");
  });

  it("returns error for tandem to unknown peer", async () => {
    const client = new PeerClient();
    const result = await client.sendTandemTask("unknown", "test", {});
    expect(result.accepted).toBe(false);
    expect(result.error).toContain("Unknown peer station");
  });

  it("returns error for delegation to unknown peer", async () => {
    const client = new PeerClient();
    const result = await client.delegateTask("unknown", "test");
    expect(result.accepted).toBe(false);
    expect(result.error).toContain("Unknown peer station");
  });

  it("handles network failure on dispatch gracefully", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("ECONNREFUSED"));
    const client = new PeerClient({ timeoutMs: 1000 });
    const result = await client.dispatchCommand("julie", {
      command: "ping",
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("ECONNREFUSED");
  });

  it("handles network failure on tandem gracefully", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("ECONNREFUSED"));
    const client = new PeerClient({ timeoutMs: 1000 });
    const result = await client.sendTandemTask("julie", "test", {});
    expect(result.accepted).toBe(false);
    expect(result.error).toContain("ECONNREFUSED");
  });

  it("handles network failure on delegation gracefully", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("ECONNREFUSED"));
    const client = new PeerClient({ timeoutMs: 1000 });
    const result = await client.delegateTask("julie", "test");
    expect(result.accepted).toBe(false);
    expect(result.error).toContain("ECONNREFUSED");
  });

  it("handles successful dispatch", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          command: "ping",
          data: { station_id: "julie", status: "online" },
          latency_ms: 5,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const client = new PeerClient();
    const result = await client.dispatchCommand("julie", {
      command: "ping",
    });
    expect(result.success).toBe(true);

    // Should update reachability
    expect(client.getPeer("julie")!.reachable).toBe(true);
  });

  it("handles peer health check success", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ status: "alive" }), { status: 200 }),
    );

    const client = new PeerClient();
    const result = await client.checkPeerHealth("julie");
    expect(result).toBe(true);
    expect(client.getPeer("julie")!.reachable).toBe(true);
  });

  it("handles peer health check failure", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("timeout"));

    const client = new PeerClient();
    const result = await client.checkPeerHealth("julie");
    expect(result).toBe(false);
    expect(client.getPeer("julie")!.reachable).toBe(false);
  });

  it("returns false for health check on unknown peer", async () => {
    const client = new PeerClient();
    const result = await client.checkPeerHealth("nonexistent");
    expect(result).toBe(false);
  });

  it("julie peer has correct endpoints", () => {
    const client = new PeerClient();
    const julie = client.getPeer("julie")!;
    const paths = julie.endpoints.map((e) => e.path);
    expect(paths).toContain("/health");
    expect(paths).toContain("/api/network/command");
    expect(paths).toContain("/api/network/tandem");
    expect(paths).toContain("/api/network/delegation/inbound");
    expect(paths).toContain("/api/network/delegation/callback");
    expect(paths).toContain("/api/network/tandem/callback");
  });

  it("julie peer has correct capabilities", () => {
    const client = new PeerClient();
    const julie = client.getPeer("julie")!;
    expect(julie.capabilities).toContain("social_monitoring");
    expect(julie.capabilities).toContain("telegram_integration");
    expect(julie.capabilities).toContain("julie_delegation");
    expect(julie.capabilities).toContain("tandem_tasks");
  });

  it("includes all 2 peer stations", () => {
    const client = new PeerClient();
    const peers = client.getPeers();
    expect(peers).toHaveLength(2);
    const ids = peers.map((p) => p.station_id);
    expect(ids).toContain("julie");
    expect(ids).toContain("caesar");
  });

  it("caesar peer has correct profile", () => {
    const client = new PeerClient();
    const caesar = client.getPeer("caesar")!;
    expect(caesar.ip).toBe("10.1.8.82");
    expect(caesar.port).toBe(3001);
    expect(caesar.capabilities).toContain("tandem_tasks");
    expect(caesar.capabilities).toContain("julie_delegation");
  });

  it("finds peers by telegram_integration capability", () => {
    const client = new PeerClient();
    const telegram = client.findByCapability("telegram_integration");
    expect(telegram).toHaveLength(1);
    expect(telegram[0].station_id).toBe("julie");
  });

  it("finds multiple peers by julie_delegation capability", () => {
    const client = new PeerClient();
    const delegators = client.findByCapability("julie_delegation");
    expect(delegators.length).toBeGreaterThanOrEqual(2);
  });
});
