import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  BraviaClient,
  createBraviaClient,
  BRAVIA_DEFAULT_HOST,
  type BraviaStatus,
  type BraviaInput,
  type BraviaCastInfo,
} from "../bravia-client.js";

// ---------------------------------------------------------------------------
// Fetch mock helpers
// ---------------------------------------------------------------------------

const originalFetch = globalThis.fetch;
let fetchMock: ReturnType<typeof vi.fn>;

function mockFetchResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
  } as Response;
}

beforeEach(() => {
  fetchMock = vi.fn();
  globalThis.fetch = fetchMock;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Sony JSON-RPC response builders
// ---------------------------------------------------------------------------

function sonyResult(result: unknown, id = 1) {
  return { result: [result], id };
}

function sonyError(code: number, msg: string, id = 1) {
  return { error: [code, msg], id };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe("BRAVIA_DEFAULT_HOST", () => {
  it("defaults to 10.1.8.194", () => {
    expect(BRAVIA_DEFAULT_HOST).toBe("10.1.8.194");
  });
});

// ---------------------------------------------------------------------------
// createBraviaClient factory
// ---------------------------------------------------------------------------

describe("createBraviaClient", () => {
  it("creates client with default host", () => {
    const client = createBraviaClient();
    expect(client).toBeInstanceOf(BraviaClient);
  });

  it("creates client with custom host", () => {
    const client = createBraviaClient({ host: "192.168.1.100" });
    expect(client).toBeInstanceOf(BraviaClient);
  });
});

// ---------------------------------------------------------------------------
// BraviaClient — isReachable
// ---------------------------------------------------------------------------

describe("BraviaClient.isReachable", () => {
  it("returns true when getPowerStatus succeeds", async () => {
    fetchMock.mockResolvedValueOnce(mockFetchResponse(sonyResult({ status: "active" })));
    const client = new BraviaClient({ host: "10.1.8.194" });
    expect(await client.isReachable()).toBe(true);
  });

  it("returns false on fetch error", async () => {
    fetchMock.mockRejectedValueOnce(new Error("timeout"));
    const client = new BraviaClient({ host: "10.1.8.194" });
    expect(await client.isReachable()).toBe(false);
  });

  it("returns false on non-ok response", async () => {
    fetchMock.mockResolvedValueOnce(mockFetchResponse({}, 500));
    const client = new BraviaClient({ host: "10.1.8.194" });
    expect(await client.isReachable()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// BraviaClient — getPowerStatus
// ---------------------------------------------------------------------------

describe("BraviaClient.getPowerStatus", () => {
  it("returns active when TV is on", async () => {
    fetchMock.mockResolvedValueOnce(mockFetchResponse(sonyResult({ status: "active" })));
    const client = new BraviaClient({ host: "10.1.8.194" });
    expect(await client.getPowerStatus()).toBe("active");
  });

  it("returns standby when TV is off", async () => {
    fetchMock.mockResolvedValueOnce(mockFetchResponse(sonyResult({ status: "standby" })));
    const client = new BraviaClient({ host: "10.1.8.194" });
    expect(await client.getPowerStatus()).toBe("standby");
  });

  it("returns unknown on error response", async () => {
    fetchMock.mockResolvedValueOnce(mockFetchResponse(sonyError(403, "Forbidden")));
    const client = new BraviaClient({ host: "10.1.8.194" });
    expect(await client.getPowerStatus()).toBe("unknown");
  });
});

// ---------------------------------------------------------------------------
// BraviaClient — getVolume
// ---------------------------------------------------------------------------

describe("BraviaClient.getVolume", () => {
  it("parses volume info correctly", async () => {
    fetchMock.mockResolvedValueOnce(
      mockFetchResponse(
        sonyResult([{ target: "speaker", volume: 15, mute: false, maxVolume: 100, minVolume: 0 }]),
      ),
    );
    const client = new BraviaClient({ host: "10.1.8.194" });
    const vol = await client.getVolume();
    expect(vol.level).toBe(15);
    expect(vol.muted).toBe(false);
    expect(vol.maxVolume).toBe(100);
  });

  it("defaults to 0/false when no speaker target found", async () => {
    fetchMock.mockResolvedValueOnce(sonyResult([]));
    const client = new BraviaClient({ host: "10.1.8.194" });
    const vol = await client.getVolume();
    expect(vol.level).toBe(0);
    expect(vol.muted).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// BraviaClient — getInputs
// ---------------------------------------------------------------------------

describe("BraviaClient.getInputs", () => {
  it("parses HDMI and CEC inputs", async () => {
    fetchMock.mockResolvedValueOnce(
      mockFetchResponse(
        sonyResult([
          { uri: "extInput:hdmi?port=1", title: "HDMI 1", connection: false, icon: "meta:hdmi" },
          {
            uri: "extInput:cec?port=3&type=player&logicalAddr=4",
            title: "HT-A3000",
            connection: true,
            icon: "meta:playbackdevice",
          },
          {
            uri: "extInput:hdmi?port=3",
            title: "HDMI 3 (eARC/ARC)",
            connection: true,
            icon: "meta:hdmi",
          },
        ]),
      ),
    );
    const client = new BraviaClient({ host: "10.1.8.194" });
    const inputs = await client.getInputs();
    expect(inputs).toHaveLength(3);
    expect(inputs[0]!.connected).toBe(false);
    expect(inputs[1]!.title).toBe("HT-A3000");
    expect(inputs[1]!.connected).toBe(true);
  });

  it("returns empty array on error", async () => {
    fetchMock.mockRejectedValueOnce(new Error("timeout"));
    const client = new BraviaClient({ host: "10.1.8.194" });
    const inputs = await client.getInputs();
    expect(inputs).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// BraviaClient — getCastInfo
// ---------------------------------------------------------------------------

describe("BraviaClient.getCastInfo", () => {
  it("fetches cast info from port 8008", async () => {
    fetchMock.mockResolvedValueOnce(
      mockFetchResponse({
        name: "BRAVIA 7",
        cast_build_revision: "3.72.446070",
        ethernet_connected: true,
        ip_address: "10.1.8.194",
        uptime: 5717.29,
      }),
    );
    const client = new BraviaClient({ host: "10.1.8.194" });
    const cast = await client.getCastInfo();
    expect(cast).not.toBeNull();
    expect(cast!.name).toBe("BRAVIA 7");
    expect(cast!.buildVersion).toBe("3.72.446070");
    expect(cast!.ethernetConnected).toBe(true);
    expect(cast!.uptime).toBeCloseTo(5717.29);
  });

  it("returns null on error", async () => {
    fetchMock.mockRejectedValueOnce(new Error("unreachable"));
    const client = new BraviaClient({ host: "10.1.8.194" });
    const cast = await client.getCastInfo();
    expect(cast).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// BraviaClient — getRemoteCodes
// ---------------------------------------------------------------------------

describe("BraviaClient.getRemoteCodes", () => {
  it("builds name→code map from controller info", async () => {
    fetchMock.mockResolvedValueOnce(
      mockFetchResponse({
        result: [
          { bundled: true, type: "-" },
          [
            { name: "VolumeUp", value: "AAAAAQAAAAEAAAASAw==" },
            { name: "VolumeDown", value: "AAAAAQAAAAEAAAATAw==" },
            { name: "Netflix", value: "AAAAAgAAABoAAAB8Aw==" },
          ],
        ],
        id: 1,
      }),
    );
    const client = new BraviaClient({ host: "10.1.8.194" });
    const codes = await client.getRemoteCodes();
    expect(codes.get("VolumeUp")).toBe("AAAAAQAAAAEAAAASAw==");
    expect(codes.get("Netflix")).toBe("AAAAAgAAABoAAAB8Aw==");
    expect(codes.size).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// BraviaClient — getStatus (aggregated)
// ---------------------------------------------------------------------------

describe("BraviaClient.getStatus", () => {
  it("aggregates all no-auth methods into BraviaStatus", async () => {
    // getPowerStatus
    fetchMock.mockResolvedValueOnce(mockFetchResponse(sonyResult({ status: "active" })));
    // getInterfaceInformation
    fetchMock.mockResolvedValueOnce(
      mockFetchResponse(
        sonyResult({
          productCategory: "tv",
          productName: "BRAVIA",
          modelName: "K-65XR70",
          interfaceVersion: "6.3.0",
        }),
      ),
    );
    // getVolumeInformation
    fetchMock.mockResolvedValueOnce(
      mockFetchResponse(
        sonyResult([{ target: "speaker", volume: 20, mute: true, maxVolume: 100, minVolume: 0 }]),
      ),
    );
    // getCurrentExternalInputsStatus
    fetchMock.mockResolvedValueOnce(
      mockFetchResponse(
        sonyResult([
          { uri: "extInput:hdmi?port=1", title: "HDMI 1", connection: false, icon: "meta:hdmi" },
        ]),
      ),
    );
    // getApplicationStatusList
    fetchMock.mockResolvedValueOnce(
      mockFetchResponse(
        sonyResult([
          { name: "textInput", status: "off" },
          { name: "cursorDisplay", status: "on" },
          { name: "webBrowse", status: "off" },
        ]),
      ),
    );
    // getPowerSavingMode
    fetchMock.mockResolvedValueOnce(mockFetchResponse(sonyResult({ mode: "low" })));
    // getCurrentTime
    fetchMock.mockResolvedValueOnce(
      mockFetchResponse({ result: ["2026-02-15T16:15:38+0900"], id: 1 }),
    );
    // getSystemSupportedFunction
    fetchMock.mockResolvedValueOnce(
      mockFetchResponse(sonyResult([{ option: "WOL", value: "80:99:E7:27:A2:C6" }])),
    );
    // getCastInfo (port 8008)
    fetchMock.mockResolvedValueOnce(
      mockFetchResponse({
        name: "BRAVIA 7",
        cast_build_revision: "3.72.446070",
        ethernet_connected: true,
        ip_address: "10.1.8.194",
        uptime: 1234.5,
      }),
    );

    const client = new BraviaClient({ host: "10.1.8.194" });
    const status = await client.getStatus();

    expect(status.power).toBe("active");
    expect(status.model).toBe("K-65XR70");
    expect(status.apiVersion).toBe("6.3.0");
    expect(status.volume.level).toBe(20);
    expect(status.volume.muted).toBe(true);
    expect(status.inputs).toHaveLength(1);
    expect(status.apps.cursorDisplay).toBe(true);
    expect(status.apps.webBrowse).toBe(false);
    expect(status.powerSaving).toBe("low");
    expect(status.time).toBe("2026-02-15T16:15:38+0900");
    expect(status.wolMac).toBe("80:99:E7:27:A2:C6");
    expect(status.cast).not.toBeNull();
    expect(status.cast!.name).toBe("BRAVIA 7");
    expect(status.fetchedAt).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// BraviaClient — write operations (PSK)
// ---------------------------------------------------------------------------

describe("BraviaClient write operations", () => {
  it("setPower sends setPowerStatus with PSK header", async () => {
    fetchMock.mockResolvedValueOnce(mockFetchResponse(sonyResult(0)));
    const client = new BraviaClient({ host: "10.1.8.194", psk: "1234" });
    await client.setPower(false);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const call = fetchMock.mock.calls[0]!;
    expect(call[0]).toBe("http://10.1.8.194/sony/system");
    const opts = call[1] as RequestInit;
    expect((opts.headers as Record<string, string>)["X-Auth-PSK"]).toBe("1234");
    const body = JSON.parse(opts.body as string);
    expect(body.method).toBe("setPowerStatus");
    expect(body.params).toEqual([{ status: false }]);
  });

  it("setVolume sends setAudioVolume", async () => {
    fetchMock.mockResolvedValueOnce(mockFetchResponse(sonyResult(0)));
    const client = new BraviaClient({ host: "10.1.8.194", psk: "secret" });
    await client.setVolume(25);

    const body = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string);
    expect(body.method).toBe("setAudioVolume");
    expect(body.params).toEqual([{ target: "speaker", volume: "25" }]);
  });

  it("setMute sends setAudioMute", async () => {
    fetchMock.mockResolvedValueOnce(mockFetchResponse(sonyResult(0)));
    const client = new BraviaClient({ host: "10.1.8.194", psk: "x" });
    await client.setMute(true);

    const body = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string);
    expect(body.method).toBe("setAudioMute");
    expect(body.params).toEqual([{ status: true }]);
  });

  it("switchInput sends setPlayContent", async () => {
    fetchMock.mockResolvedValueOnce(mockFetchResponse(sonyResult(0)));
    const client = new BraviaClient({ host: "10.1.8.194", psk: "x" });
    await client.switchInput("extInput:hdmi?port=2");

    const body = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string);
    expect(body.method).toBe("setPlayContent");
    expect(body.params).toEqual([{ uri: "extInput:hdmi?port=2" }]);
  });

  it("launchApp sends setActiveApp", async () => {
    fetchMock.mockResolvedValueOnce(mockFetchResponse(sonyResult(0)));
    const client = new BraviaClient({ host: "10.1.8.194", psk: "x" });
    await client.launchApp("com.sony.dtv.tvx");

    const body = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string);
    expect(body.method).toBe("setActiveApp");
    expect(body.params).toEqual([{ uri: "com.sony.dtv.tvx" }]);
  });

  it("sendIrcc posts SOAP XML to /sony/IRCC", async () => {
    fetchMock.mockResolvedValueOnce(mockFetchResponse("", 200));
    const client = new BraviaClient({ host: "10.1.8.194", psk: "key" });
    await client.sendIrcc("AAAAAQAAAAEAAAASAw==");

    const call = fetchMock.mock.calls[0]!;
    expect(call[0]).toBe("http://10.1.8.194/sony/IRCC");
    const opts = call[1] as RequestInit;
    expect((opts.headers as Record<string, string>)["SOAPACTION"]).toContain("X_SendIRCC");
    expect(opts.body as string).toContain("AAAAAQAAAAEAAAASAw==");
  });

  it("throws on write without PSK if API returns 403", async () => {
    fetchMock.mockResolvedValueOnce(mockFetchResponse(sonyError(403, "Forbidden")));
    const client = new BraviaClient({ host: "10.1.8.194" }); // no PSK
    await expect(client.setPower(true)).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// BraviaClient — sendRemoteKey
// ---------------------------------------------------------------------------

describe("BraviaClient.sendRemoteKey", () => {
  it("fetches codes then sends IRCC for named key", async () => {
    // getRemoteControllerInfo response
    fetchMock.mockResolvedValueOnce(
      mockFetchResponse({
        result: [
          { bundled: true },
          [
            { name: "Home", value: "AAAAAQAAAAEAAABgAw==" },
            { name: "Netflix", value: "AAAAAgAAABoAAAB8Aw==" },
          ],
        ],
        id: 1,
      }),
    );
    // IRCC send
    fetchMock.mockResolvedValueOnce(mockFetchResponse("", 200));

    const client = new BraviaClient({ host: "10.1.8.194", psk: "key" });
    await client.sendRemoteKey("Home");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect((fetchMock.mock.calls[1]![1] as RequestInit).body).toContain("AAAAAQAAAAEAAABgAw==");
  });

  it("throws if key name not found", async () => {
    fetchMock.mockResolvedValueOnce(
      mockFetchResponse({
        result: [{ bundled: true }, [{ name: "Home", value: "xxx" }]],
        id: 1,
      }),
    );
    const client = new BraviaClient({ host: "10.1.8.194", psk: "key" });
    await expect(client.sendRemoteKey("NonExistent")).rejects.toThrow("Unknown remote key");
  });
});
