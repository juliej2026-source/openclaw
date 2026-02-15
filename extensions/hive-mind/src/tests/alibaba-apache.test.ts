import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { AlibabaEcsClient, EcsInstanceInfo } from "../alibaba-client.js";
import type { ApacheStatus } from "../apache-status.js";
import { createCloudApacheManager, type CloudApacheState } from "../alibaba-apache.js";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

function mockEcsClient(overrides?: Partial<AlibabaEcsClient>): AlibabaEcsClient {
  return {
    createApacheInstance: vi
      .fn()
      .mockResolvedValue({ instanceId: "i-mock-001", requestId: "req-1" }),
    describeInstance: vi.fn().mockResolvedValue({
      instanceId: "i-mock-001",
      instanceName: "openclaw-apache",
      status: "Running",
      publicIp: "47.88.1.100",
      privateIp: "172.16.0.10",
      instanceType: "ecs.c7.large",
      creationTime: "2026-02-15T10:00:00Z",
      regionId: "ap-northeast-1",
      securityGroupIds: ["sg-001"],
      vpcId: "vpc-001",
    } satisfies EcsInstanceInfo),
    listInstances: vi.fn().mockResolvedValue([]),
    startInstance: vi.fn().mockResolvedValue(undefined),
    stopInstance: vi.fn().mockResolvedValue(undefined),
    rebootInstance: vi.fn().mockResolvedValue(undefined),
    deleteInstance: vi.fn().mockResolvedValue(undefined),
    createSecurityGroup: vi.fn().mockResolvedValue("sg-new"),
    addSecurityRule: vi.fn().mockResolvedValue(undefined),
    createKeyPair: vi.fn().mockResolvedValue({
      keyPairName: "openclaw-ecs-key",
      privateKey: "-----BEGIN RSA PRIVATE KEY-----\nMOCK_KEY\n-----END RSA PRIVATE KEY-----",
    }),
    deleteKeyPair: vi.fn().mockResolvedValue(undefined),
    describeVpcs: vi
      .fn()
      .mockResolvedValue([{ vpcId: "vpc-default", cidrBlock: "172.16.0.0/12", isDefault: true }]),
    describeVSwitches: vi
      .fn()
      .mockResolvedValue([{ vSwitchId: "vsw-001", zoneId: "ap-northeast-1a" }]),
    ...overrides,
  } as unknown as AlibabaEcsClient;
}

// Mock SSH client
function mockSshClient() {
  return {
    exec: vi.fn().mockResolvedValue({ stdout: "", stderr: "", code: 0 }),
    pushFile: vi.fn().mockResolvedValue(undefined),
    pushContent: vi.fn().mockResolvedValue(undefined),
    pullFile: vi.fn().mockResolvedValue(undefined),
    isReachable: vi.fn().mockResolvedValue(true),
  };
}

const originalFetch = globalThis.fetch;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  globalThis.fetch = fetchMock;
  vi.useFakeTimers();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Tests — existing functionality
// ---------------------------------------------------------------------------

describe("createCloudApacheManager", () => {
  it("returns manager with correct id", () => {
    const manager = createCloudApacheManager({ ecsClient: mockEcsClient() });
    expect(manager.id).toBe("cloud-apache-manager");
  });

  it("initial state is not_deployed", () => {
    const manager = createCloudApacheManager({ ecsClient: mockEcsClient() });
    const state = manager.getState();
    expect(state.status).toBe("not_deployed");
    expect(state.deployed).toBe(false);
    expect(state.instanceId).toBeNull();
    expect(state.publicIp).toBeNull();
  });

  it("deploy creates instance and updates state", async () => {
    const ecsClient = mockEcsClient();
    const manager = createCloudApacheManager({ ecsClient });

    const result = await manager.deploy();
    expect(result.instanceId).toBe("i-mock-001");
    expect(result.publicIp).toBe("47.88.1.100");

    const state = manager.getState();
    expect(state.deployed).toBe(true);
    expect(state.status).toBe("running");
    expect(state.instanceId).toBe("i-mock-001");
    expect(state.publicIp).toBe("47.88.1.100");

    expect(ecsClient.createApacheInstance).toHaveBeenCalledTimes(1);
    expect(ecsClient.describeInstance).toHaveBeenCalledTimes(1);
  });

  it("deploy sets error state on failure", async () => {
    const ecsClient = mockEcsClient({
      createApacheInstance: vi.fn().mockRejectedValue(new Error("quota exceeded")),
    } as Partial<AlibabaEcsClient>);

    const manager = createCloudApacheManager({ ecsClient });
    await expect(manager.deploy()).rejects.toThrow("quota exceeded");

    const state = manager.getState();
    expect(state.status).toBe("error");
    expect(state.error).toContain("quota exceeded");
  });

  it("destroy deletes instance and resets state", async () => {
    const ecsClient = mockEcsClient();
    const manager = createCloudApacheManager({ ecsClient });

    await manager.deploy();
    expect(manager.getState().deployed).toBe(true);

    await manager.destroy();
    const state = manager.getState();
    expect(state.deployed).toBe(false);
    expect(state.status).toBe("not_deployed");
    expect(state.instanceId).toBeNull();
    expect(state.publicIp).toBeNull();

    expect(ecsClient.deleteInstance).toHaveBeenCalledWith("i-mock-001");
  });

  it("destroy is safe when not deployed", async () => {
    const ecsClient = mockEcsClient();
    const manager = createCloudApacheManager({ ecsClient });
    await manager.destroy(); // Should not throw
    expect(ecsClient.deleteInstance).not.toHaveBeenCalled();
  });

  it("fetchApacheStatus fetches from cloud instance public IP", async () => {
    const statusText = [
      "Total Accesses: 100",
      "Total kBytes: 500",
      "Uptime: 3600",
      "ReqPerSec: .0278",
      "BytesPerSec: 142.222",
      "BytesPerReq: 5120",
      "BusyWorkers: 2",
      "IdleWorkers: 8",
      "Scoreboard: __W_R.....",
    ].join("\n");

    fetchMock.mockResolvedValueOnce({
      ok: true,
      text: async () => statusText,
    } as Response);

    const ecsClient = mockEcsClient();
    const manager = createCloudApacheManager({ ecsClient });
    await manager.deploy();

    const status = await manager.fetchApacheStatus();
    expect(status.totalAccesses).toBe(100);
    expect(status.busyWorkers).toBe(2);
    expect(status.idleWorkers).toBe(8);

    expect(fetchMock).toHaveBeenCalledWith(
      "http://47.88.1.100/server-status?auto",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("fetchApacheStatus throws when not deployed", async () => {
    const manager = createCloudApacheManager({ ecsClient: mockEcsClient() });
    await expect(manager.fetchApacheStatus()).rejects.toThrow("not deployed");
  });

  it("start begins monitoring loop", async () => {
    const statusText =
      "Total Accesses: 50\nUptime: 100\nBusyWorkers: 1\nIdleWorkers: 5\nScoreboard: _W....\n";
    fetchMock.mockResolvedValue({
      ok: true,
      text: async () => statusText,
    } as Response);

    const ecsClient = mockEcsClient();
    const manager = createCloudApacheManager({ ecsClient, monitorIntervalMs: 10_000 });

    await manager.deploy();
    await manager.start();

    // Initial check
    expect(manager.getState().apache).not.toBeNull();
    expect(manager.getState().apache!.busyWorkers).toBe(1);

    manager.stop();
  });

  it("start does nothing when not deployed", async () => {
    const manager = createCloudApacheManager({
      ecsClient: mockEcsClient(),
      monitorIntervalMs: 5_000,
    });
    await manager.start();
    expect(manager.getState().apache).toBeNull();
    manager.stop();
  });

  it("stop clears the monitoring interval", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      text: async () =>
        "Total Accesses: 10\nUptime: 50\nBusyWorkers: 0\nIdleWorkers: 5\nScoreboard: .....\n",
    } as Response);

    const ecsClient = mockEcsClient();
    const manager = createCloudApacheManager({ ecsClient, monitorIntervalMs: 5_000 });
    await manager.deploy();
    await manager.start();

    manager.stop();
    manager.stop(); // safe to call twice

    const callCount = fetchMock.mock.calls.length;
    await vi.advanceTimersByTimeAsync(15_000);
    // No new fetch calls after stop
    expect(fetchMock.mock.calls.length).toBe(callCount);
  });

  it("keeps last good apache status on fetch error", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          "Total Accesses: 99\nUptime: 100\nBusyWorkers: 3\nIdleWorkers: 7\nScoreboard: WWW.......\n",
      } as Response)
      .mockRejectedValueOnce(new Error("network error"));

    const ecsClient = mockEcsClient();
    const manager = createCloudApacheManager({ ecsClient, monitorIntervalMs: 5_000 });
    await manager.deploy();
    await manager.start();

    expect(manager.getState().apache!.busyWorkers).toBe(3);

    await vi.advanceTimersByTimeAsync(5_000);

    // Should still have the old status
    expect(manager.getState().apache!.busyWorkers).toBe(3);
    manager.stop();
  });

  // -----------------------------------------------------------------------
  // SSH-integrated operations
  // -----------------------------------------------------------------------

  describe("SSH operations", () => {
    it("execCommand delegates to SSH client", async () => {
      const ssh = mockSshClient();
      ssh.exec.mockResolvedValueOnce({
        stdout: "Apache/2.4.57\n",
        stderr: "",
        code: 0,
      });

      const ecsClient = mockEcsClient();
      const manager = createCloudApacheManager({ ecsClient });
      await manager.deploy();
      manager.setSshClient(ssh);

      const result = await manager.execCommand("httpd -v");
      expect(result.stdout).toBe("Apache/2.4.57\n");
      expect(ssh.exec).toHaveBeenCalledWith("httpd -v");
    });

    it("execCommand throws when not deployed", async () => {
      const manager = createCloudApacheManager({ ecsClient: mockEcsClient() });
      await expect(manager.execCommand("ls")).rejects.toThrow("not deployed");
    });

    it("pushFile delegates to SSH client", async () => {
      const ssh = mockSshClient();
      const ecsClient = mockEcsClient();
      const manager = createCloudApacheManager({ ecsClient });
      await manager.deploy();
      manager.setSshClient(ssh);

      await manager.pushFile("/tmp/local.html", "/var/www/html/index.html");
      expect(ssh.pushFile).toHaveBeenCalledWith("/tmp/local.html", "/var/www/html/index.html");
    });

    it("pushContent delegates to SSH client", async () => {
      const ssh = mockSshClient();
      const ecsClient = mockEcsClient();
      const manager = createCloudApacheManager({ ecsClient });
      await manager.deploy();
      manager.setSshClient(ssh);

      await manager.pushContent("<h1>Test</h1>", "/var/www/html/index.html");
      expect(ssh.pushContent).toHaveBeenCalledWith("<h1>Test</h1>", "/var/www/html/index.html");
    });

    it("fetchLogs calls exec with tail command for error log", async () => {
      const ssh = mockSshClient();
      ssh.exec.mockResolvedValueOnce({
        stdout: "[error] some error\n",
        stderr: "",
        code: 0,
      });

      const ecsClient = mockEcsClient();
      const manager = createCloudApacheManager({ ecsClient });
      await manager.deploy();
      manager.setSshClient(ssh);

      const logs = await manager.fetchLogs(50, "error");
      expect(logs).toBe("[error] some error\n");
      expect(ssh.exec).toHaveBeenCalledWith("tail -n 50 /var/log/httpd/error_log");
    });

    it("fetchLogs defaults to 100 lines and access log", async () => {
      const ssh = mockSshClient();
      ssh.exec.mockResolvedValueOnce({
        stdout: "GET /index.html 200\n",
        stderr: "",
        code: 0,
      });

      const ecsClient = mockEcsClient();
      const manager = createCloudApacheManager({ ecsClient });
      await manager.deploy();
      manager.setSshClient(ssh);

      await manager.fetchLogs();
      expect(ssh.exec).toHaveBeenCalledWith("tail -n 100 /var/log/httpd/access_log");
    });

    it("getSshConfig returns null before deploy", () => {
      const manager = createCloudApacheManager({ ecsClient: mockEcsClient() });
      expect(manager.getSshConfig()).toBeNull();
    });

    it("getSshConfig returns config after setSshClient", async () => {
      const ssh = mockSshClient();
      const ecsClient = mockEcsClient();
      const manager = createCloudApacheManager({ ecsClient });
      await manager.deploy();
      manager.setSshClient(ssh, {
        host: "47.88.1.100",
        keyPath: "/home/admin/.ssh/openclaw-ecs.pem",
      });

      const config = manager.getSshConfig();
      expect(config).not.toBeNull();
      expect(config!.host).toBe("47.88.1.100");
      expect(config!.keyPath).toBe("/home/admin/.ssh/openclaw-ecs.pem");
    });

    it("deploySite pushes all files from directory", async () => {
      const ssh = mockSshClient();
      const ecsClient = mockEcsClient();
      const manager = createCloudApacheManager({ ecsClient });
      await manager.deploy();
      manager.setSshClient(ssh);

      // deploySite uses exec to rsync/scp recursively
      await manager.deploySite("/tmp/site");
      expect(ssh.exec).toHaveBeenCalled();
      const callArg = ssh.exec.mock.calls[0]![0];
      expect(callArg).toContain("mkdir");
    });

    it("deploySite uses custom remote path", async () => {
      const ssh = mockSshClient();
      const ecsClient = mockEcsClient();
      const manager = createCloudApacheManager({ ecsClient });
      await manager.deploy();
      manager.setSshClient(ssh);

      await manager.deploySite("/tmp/site", "/opt/myapp/public");
      const callArg = ssh.exec.mock.calls[0]![0];
      expect(callArg).toContain("/opt/myapp/public");
    });

    it("destroy cleans up key pair name from state", async () => {
      const ecsClient = mockEcsClient();
      const manager = createCloudApacheManager({ ecsClient });
      await manager.deploy();

      // Set key pair name in state
      manager.setKeyPairName("openclaw-ecs-key");

      await manager.destroy();

      const state = manager.getState();
      expect(state.deployed).toBe(false);
      expect(ecsClient.deleteKeyPair).toHaveBeenCalledWith("openclaw-ecs-key");
    });

    it("destroy skips key pair cleanup when no key pair set", async () => {
      const ecsClient = mockEcsClient();
      const manager = createCloudApacheManager({ ecsClient });
      await manager.deploy();

      await manager.destroy();
      expect(ecsClient.deleteKeyPair).not.toHaveBeenCalled();
    });
  });
});
