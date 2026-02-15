import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  AlibabaEcsClient,
  APACHE_CLOUD_INIT_SCRIPT,
  type AlibabaConfig,
  type EcsInstanceInfo,
} from "../alibaba-client.js";

// ---------------------------------------------------------------------------
// Mock the @alicloud SDK — we test our wrapper logic, not the SDK itself
// ---------------------------------------------------------------------------

function createMockSdkClient() {
  return {
    runInstances: vi.fn(),
    describeInstances: vi.fn(),
    startInstance: vi.fn(),
    stopInstance: vi.fn(),
    rebootInstance: vi.fn(),
    deleteInstance: vi.fn(),
    createSecurityGroup: vi.fn(),
    authorizeSecurityGroup: vi.fn(),
    createKeyPair: vi.fn(),
    deleteKeyPairs: vi.fn(),
    describeVpcs: vi.fn(),
    describeVSwitches: vi.fn(),
  };
}

const TEST_CONFIG: AlibabaConfig = {
  accessKeyId: "test-key-id",
  accessKeySecret: "test-key-secret",
  regionId: "ap-southeast-1",
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("APACHE_CLOUD_INIT_SCRIPT", () => {
  it("contains httpd installation", () => {
    expect(APACHE_CLOUD_INIT_SCRIPT).toContain("yum install -y httpd");
  });

  it("enables mod_status", () => {
    expect(APACHE_CLOUD_INIT_SCRIPT).toContain("server-status");
    expect(APACHE_CLOUD_INIT_SCRIPT).toContain("ExtendedStatus On");
  });

  it("starts with shebang", () => {
    expect(APACHE_CLOUD_INIT_SCRIPT.startsWith("#!/bin/bash")).toBe(true);
  });
});

describe("AlibabaEcsClient", () => {
  let client: AlibabaEcsClient;
  let mockSdk: ReturnType<typeof createMockSdkClient>;

  beforeEach(() => {
    mockSdk = createMockSdkClient();
    client = new AlibabaEcsClient(TEST_CONFIG);
    // Inject mock SDK client
    (client as unknown as { sdkClient: unknown }).sdkClient = mockSdk;
  });

  // -----------------------------------------------------------------------
  // createApacheInstance
  // -----------------------------------------------------------------------

  describe("createApacheInstance", () => {
    it("calls runInstances and returns instanceId", async () => {
      mockSdk.runInstances.mockResolvedValueOnce({
        body: {
          instanceIdSets: { instanceIdSet: ["i-abc123"] },
          requestId: "req-001",
        },
      });

      const result = await client.createApacheInstance({ instanceName: "test-apache" });
      expect(result.instanceId).toBe("i-abc123");
      expect(result.requestId).toBe("req-001");
      expect(mockSdk.runInstances).toHaveBeenCalledTimes(1);
    });

    it("passes userData as base64-encoded cloud-init script", async () => {
      mockSdk.runInstances.mockResolvedValueOnce({
        body: {
          instanceIdSets: { instanceIdSet: ["i-xyz"] },
          requestId: "req-002",
        },
      });

      await client.createApacheInstance({});
      const callArg = mockSdk.runInstances.mock.calls[0]![0];
      // The userData should be base64-encoded
      expect(callArg.userData).toBeDefined();
      const decoded = Buffer.from(callArg.userData, "base64").toString("utf-8");
      expect(decoded).toContain("httpd");
    });

    it("throws if no instances returned", async () => {
      mockSdk.runInstances.mockResolvedValueOnce({
        body: { instanceIdSets: { instanceIdSet: [] }, requestId: "req-003" },
      });

      await expect(client.createApacheInstance({})).rejects.toThrow("No instance created");
    });

    it("uses custom instance type when provided", async () => {
      mockSdk.runInstances.mockResolvedValueOnce({
        body: {
          instanceIdSets: { instanceIdSet: ["i-custom"] },
          requestId: "req-004",
        },
      });

      await client.createApacheInstance({ instanceType: "ecs.g6.xlarge" });
      const callArg = mockSdk.runInstances.mock.calls[0]![0];
      expect(callArg.instanceType).toBe("ecs.g6.xlarge");
    });
  });

  // -----------------------------------------------------------------------
  // describeInstance
  // -----------------------------------------------------------------------

  describe("describeInstance", () => {
    it("returns parsed instance info", async () => {
      mockSdk.describeInstances.mockResolvedValueOnce({
        body: {
          instances: {
            instance: [
              {
                instanceId: "i-abc123",
                instanceName: "test-apache",
                status: "Running",
                publicIpAddress: { ipAddress: ["1.2.3.4"] },
                vpcAttributes: { privateIpAddress: { ipAddress: ["172.16.0.1"] } },
                instanceType: "ecs.c7.large",
                creationTime: "2026-02-15T10:00:00Z",
                regionId: "ap-southeast-1",
                securityGroupIds: { securityGroupId: ["sg-001"] },
                vpcAttributes2: {},
              },
            ],
          },
        },
      });

      const info = await client.describeInstance("i-abc123");
      expect(info.instanceId).toBe("i-abc123");
      expect(info.status).toBe("Running");
      expect(info.publicIp).toBe("1.2.3.4");
      expect(info.privateIp).toBe("172.16.0.1");
    });

    it("throws if instance not found", async () => {
      mockSdk.describeInstances.mockResolvedValueOnce({
        body: { instances: { instance: [] } },
      });

      await expect(client.describeInstance("i-nonexistent")).rejects.toThrow("not found");
    });
  });

  // -----------------------------------------------------------------------
  // listInstances
  // -----------------------------------------------------------------------

  describe("listInstances", () => {
    it("returns array of instance info", async () => {
      mockSdk.describeInstances.mockResolvedValueOnce({
        body: {
          instances: {
            instance: [
              {
                instanceId: "i-1",
                instanceName: "apache-1",
                status: "Running",
                publicIpAddress: { ipAddress: ["1.1.1.1"] },
                vpcAttributes: { privateIpAddress: { ipAddress: [] } },
                instanceType: "ecs.c7.large",
                creationTime: "2026-02-15T10:00:00Z",
                regionId: "ap-southeast-1",
                securityGroupIds: { securityGroupId: [] },
              },
              {
                instanceId: "i-2",
                instanceName: "apache-2",
                status: "Stopped",
                publicIpAddress: { ipAddress: [] },
                vpcAttributes: { privateIpAddress: { ipAddress: [] } },
                instanceType: "ecs.c7.large",
                creationTime: "2026-02-15T11:00:00Z",
                regionId: "ap-southeast-1",
                securityGroupIds: { securityGroupId: [] },
              },
            ],
          },
        },
      });

      const list = await client.listInstances();
      expect(list).toHaveLength(2);
      expect(list[0]!.instanceId).toBe("i-1");
      expect(list[1]!.status).toBe("Stopped");
    });

    it("returns empty array when no instances", async () => {
      mockSdk.describeInstances.mockResolvedValueOnce({
        body: { instances: { instance: [] } },
      });

      const list = await client.listInstances();
      expect(list).toEqual([]);
    });
  });

  // -----------------------------------------------------------------------
  // Instance lifecycle
  // -----------------------------------------------------------------------

  describe("startInstance", () => {
    it("calls SDK startInstance", async () => {
      mockSdk.startInstance.mockResolvedValueOnce({});
      await client.startInstance("i-abc");
      expect(mockSdk.startInstance).toHaveBeenCalledTimes(1);
    });
  });

  describe("stopInstance", () => {
    it("calls SDK stopInstance", async () => {
      mockSdk.stopInstance.mockResolvedValueOnce({});
      await client.stopInstance("i-abc");
      expect(mockSdk.stopInstance).toHaveBeenCalledTimes(1);
    });
  });

  describe("rebootInstance", () => {
    it("calls SDK rebootInstance", async () => {
      mockSdk.rebootInstance.mockResolvedValueOnce({});
      await client.rebootInstance("i-abc");
      expect(mockSdk.rebootInstance).toHaveBeenCalledTimes(1);
    });
  });

  describe("deleteInstance", () => {
    it("calls SDK deleteInstance", async () => {
      mockSdk.deleteInstance.mockResolvedValueOnce({});
      await client.deleteInstance("i-abc");
      expect(mockSdk.deleteInstance).toHaveBeenCalledTimes(1);
    });
  });

  // -----------------------------------------------------------------------
  // Security groups
  // -----------------------------------------------------------------------

  describe("createSecurityGroup", () => {
    it("returns security group ID", async () => {
      mockSdk.createSecurityGroup.mockResolvedValueOnce({
        body: { securityGroupId: "sg-new-001" },
      });

      const sgId = await client.createSecurityGroup({ vpcId: "vpc-abc" });
      expect(sgId).toBe("sg-new-001");
    });
  });

  describe("addSecurityRule", () => {
    it("calls authorizeSecurityGroup with correct params", async () => {
      mockSdk.authorizeSecurityGroup.mockResolvedValueOnce({});

      await client.addSecurityRule({
        securityGroupId: "sg-001",
        protocol: "tcp",
        portRange: "80/80",
        sourceCidr: "0.0.0.0/0",
      });

      expect(mockSdk.authorizeSecurityGroup).toHaveBeenCalledTimes(1);
      const arg = mockSdk.authorizeSecurityGroup.mock.calls[0]![0];
      expect(arg.securityGroupId).toBe("sg-001");
      expect(arg.ipProtocol).toBe("tcp");
      expect(arg.portRange).toBe("80/80");
    });
  });

  // -----------------------------------------------------------------------
  // Key pairs
  // -----------------------------------------------------------------------

  describe("createKeyPair", () => {
    it("calls SDK createKeyPair and returns key name + private key", async () => {
      mockSdk.createKeyPair.mockResolvedValueOnce({
        body: {
          keyPairName: "openclaw-ecs-key",
          privateKeyBody: "-----BEGIN RSA PRIVATE KEY-----\nMOCK\n-----END RSA PRIVATE KEY-----",
        },
      });

      const result = await client.createKeyPair("openclaw-ecs-key");
      expect(result.keyPairName).toBe("openclaw-ecs-key");
      expect(result.privateKey).toContain("BEGIN RSA PRIVATE KEY");
    });

    it("passes key pair name to SDK", async () => {
      mockSdk.createKeyPair.mockResolvedValueOnce({
        body: {
          keyPairName: "my-key",
          privateKeyBody: "---MOCK---",
        },
      });

      await client.createKeyPair("my-key");
      const arg = mockSdk.createKeyPair.mock.calls[0]![0];
      expect(arg.keyPairName).toBe("my-key");
      expect(arg.regionId).toBe("ap-southeast-1");
    });
  });

  describe("deleteKeyPair", () => {
    it("calls SDK deleteKeyPairs", async () => {
      mockSdk.deleteKeyPairs.mockResolvedValueOnce({});

      await client.deleteKeyPair("openclaw-ecs-key");
      expect(mockSdk.deleteKeyPairs).toHaveBeenCalledTimes(1);
      const arg = mockSdk.deleteKeyPairs.mock.calls[0]![0];
      expect(arg.keyPairNames).toBe(JSON.stringify(["openclaw-ecs-key"]));
    });
  });

  // -----------------------------------------------------------------------
  // VPC discovery
  // -----------------------------------------------------------------------

  describe("describeVpcs", () => {
    it("returns VPC list with isDefault flag", async () => {
      mockSdk.describeVpcs.mockResolvedValueOnce({
        body: {
          vpcs: {
            vpc: [
              { vpcId: "vpc-001", cidrBlock: "172.16.0.0/12", isDefault: true },
              { vpcId: "vpc-002", cidrBlock: "10.0.0.0/8", isDefault: false },
            ],
          },
        },
      });

      const vpcs = await client.describeVpcs();
      expect(vpcs).toHaveLength(2);
      expect(vpcs[0]!.vpcId).toBe("vpc-001");
      expect(vpcs[0]!.isDefault).toBe(true);
      expect(vpcs[1]!.isDefault).toBe(false);
    });

    it("returns empty array when no VPCs", async () => {
      mockSdk.describeVpcs.mockResolvedValueOnce({
        body: { vpcs: { vpc: [] } },
      });

      const vpcs = await client.describeVpcs();
      expect(vpcs).toEqual([]);
    });
  });

  describe("describeVSwitches", () => {
    it("returns VSwitches for given VPC", async () => {
      mockSdk.describeVSwitches.mockResolvedValueOnce({
        body: {
          vSwitches: {
            vSwitch: [
              { vSwitchId: "vsw-001", zoneId: "ap-southeast-1a" },
              { vSwitchId: "vsw-002", zoneId: "ap-southeast-1b" },
            ],
          },
        },
      });

      const switches = await client.describeVSwitches("vpc-001");
      expect(switches).toHaveLength(2);
      expect(switches[0]!.vSwitchId).toBe("vsw-001");
      expect(switches[0]!.zoneId).toBe("ap-southeast-1a");
    });

    it("passes VPC ID to SDK call", async () => {
      mockSdk.describeVSwitches.mockResolvedValueOnce({
        body: { vSwitches: { vSwitch: [] } },
      });

      await client.describeVSwitches("vpc-abc");
      const arg = mockSdk.describeVSwitches.mock.calls[0]![0];
      expect(arg.vpcId).toBe("vpc-abc");
      expect(arg.regionId).toBe("ap-southeast-1");
    });

    it("returns empty array when no VSwitches", async () => {
      mockSdk.describeVSwitches.mockResolvedValueOnce({
        body: { vSwitches: { vSwitch: [] } },
      });

      const switches = await client.describeVSwitches("vpc-001");
      expect(switches).toEqual([]);
    });
  });

  // -----------------------------------------------------------------------
  // Default region
  // -----------------------------------------------------------------------

  describe("region defaults", () => {
    it("uses provided region in all SDK calls", async () => {
      const tokyoClient = new AlibabaEcsClient({
        ...TEST_CONFIG,
        regionId: "ap-northeast-1",
      });
      (tokyoClient as unknown as { sdkClient: unknown }).sdkClient = mockSdk;

      mockSdk.describeVpcs.mockResolvedValueOnce({
        body: { vpcs: { vpc: [] } },
      });

      await tokyoClient.describeVpcs();
      const arg = mockSdk.describeVpcs.mock.calls[0]![0];
      expect(arg.regionId).toBe("ap-northeast-1");
    });
  });
});
