// ---------------------------------------------------------------------------
// Alibaba Cloud ECS client — wraps @alicloud/ecs20140526 SDK
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AlibabaConfig = {
  accessKeyId: string;
  accessKeySecret: string;
  regionId: string;
  endpoint?: string;
};

export type EcsInstanceInfo = {
  instanceId: string;
  instanceName: string;
  status: "Running" | "Stopped" | "Starting" | "Stopping" | "Pending";
  publicIp: string | null;
  privateIp: string | null;
  instanceType: string;
  creationTime: string;
  regionId: string;
  securityGroupIds: string[];
  vpcId: string;
};

export type CreateInstanceOptions = {
  instanceName?: string;
  instanceType?: string;
  imageId?: string;
  diskSizeGb?: number;
  bandwidthOut?: number;
  keyPairName?: string;
  password?: string;
  userData?: string;
  securityGroupId?: string;
  vSwitchId?: string;
};

// ---------------------------------------------------------------------------
// Cloud-init script for Apache httpd
// ---------------------------------------------------------------------------

export const APACHE_CLOUD_INIT_SCRIPT = `#!/bin/bash
set -e

# Install Apache httpd + SSL module
yum install -y httpd mod_ssl

# Enable and start
systemctl enable httpd
systemctl start httpd

# Configure mod_status for remote monitoring
cat > /etc/httpd/conf.d/server-status.conf << 'EOF'
ExtendedStatus On
<Location "/server-status">
    SetHandler server-status
    Require all granted
</Location>
EOF

# Default index page
HOSTNAME=\$(hostname)
cat > /var/www/html/index.html << HTMLEOF
<!DOCTYPE html>
<html>
<head><title>OpenClaw Hive Apache</title></head>
<body>
<h1>OpenClaw Hive Apache - \$HOSTNAME</h1>
<p>Deployed by IOT-HUB at $(date -u +%Y-%m-%dT%H:%M:%SZ)</p>
</body>
</html>
HTMLEOF

# Restart to pick up mod_status config
systemctl restart httpd
`;

// ---------------------------------------------------------------------------
// SDK interface (for testability)
// ---------------------------------------------------------------------------

interface SdkClient {
  runInstances(req: Record<string, unknown>): Promise<{ body: Record<string, unknown> }>;
  describeInstances(req: Record<string, unknown>): Promise<{ body: Record<string, unknown> }>;
  startInstance(req: Record<string, unknown>): Promise<unknown>;
  stopInstance(req: Record<string, unknown>): Promise<unknown>;
  rebootInstance(req: Record<string, unknown>): Promise<unknown>;
  deleteInstance(req: Record<string, unknown>): Promise<unknown>;
  createSecurityGroup(req: Record<string, unknown>): Promise<{ body: Record<string, unknown> }>;
  authorizeSecurityGroup(req: Record<string, unknown>): Promise<unknown>;
  createKeyPair(req: Record<string, unknown>): Promise<{ body: Record<string, unknown> }>;
  deleteKeyPairs(req: Record<string, unknown>): Promise<unknown>;
  describeVpcs(req: Record<string, unknown>): Promise<{ body: Record<string, unknown> }>;
  describeVSwitches(req: Record<string, unknown>): Promise<{ body: Record<string, unknown> }>;
}

// ---------------------------------------------------------------------------
// AlibabaEcsClient
// ---------------------------------------------------------------------------

export class AlibabaEcsClient {
  private sdkClient: SdkClient;
  private readonly config: AlibabaConfig;

  constructor(config: AlibabaConfig) {
    this.config = config;
    // Lazy-initialize the real SDK client
    this.sdkClient = null as unknown as SdkClient;
  }

  private async ensureSdk(): Promise<SdkClient> {
    if (this.sdkClient) return this.sdkClient;

    const { default: ECS } = await import("@alicloud/ecs20140526");
    const OpenApi = await import("@alicloud/openapi-client");

    const sdkConfig = new OpenApi.default.Config({
      accessKeyId: this.config.accessKeyId,
      accessKeySecret: this.config.accessKeySecret,
      endpoint: this.config.endpoint ?? `ecs.${this.config.regionId}.aliyuncs.com`,
    });

    this.sdkClient = new ECS(sdkConfig) as unknown as SdkClient;
    return this.sdkClient;
  }

  // -----------------------------------------------------------------------
  // Instance lifecycle
  // -----------------------------------------------------------------------

  async createApacheInstance(opts: CreateInstanceOptions = {}): Promise<{
    instanceId: string;
    requestId: string;
  }> {
    const sdk = await this.ensureSdk();

    const userData = Buffer.from(opts.userData ?? APACHE_CLOUD_INIT_SCRIPT).toString("base64");

    const response = await sdk.runInstances({
      regionId: this.config.regionId,
      instanceName: opts.instanceName ?? "openclaw-apache",
      instanceType: opts.instanceType ?? "ecs.c7.large",
      imageId: opts.imageId ?? "aliyun_3_x64_20G_alibase_20240528.vhd",
      instanceChargeType: "PostPaid",
      internetMaxBandwidthOut: opts.bandwidthOut ?? 5,
      systemDisk: {
        category: "cloud_essd",
        size: String(opts.diskSizeGb ?? 40),
      },
      userData,
      amount: 1,
      ...(opts.securityGroupId ? { securityGroupId: opts.securityGroupId } : {}),
      ...(opts.vSwitchId ? { vSwitchId: opts.vSwitchId } : {}),
      ...(opts.password ? { password: opts.password } : {}),
      ...(opts.keyPairName ? { keyPairName: opts.keyPairName } : {}),
    });

    const ids = (response.body.instanceIdSets as { instanceIdSet: string[] })?.instanceIdSet;
    if (!ids || ids.length === 0) {
      throw new Error("No instance created");
    }

    return {
      instanceId: ids[0]!,
      requestId: (response.body.requestId as string) ?? "",
    };
  }

  async describeInstance(instanceId: string): Promise<EcsInstanceInfo> {
    const sdk = await this.ensureSdk();

    const response = await sdk.describeInstances({
      regionId: this.config.regionId,
      instanceIds: JSON.stringify([instanceId]),
    });

    const instances = (response.body.instances as { instance: Array<Record<string, unknown>> })
      ?.instance;
    if (!instances || instances.length === 0) {
      throw new Error(`Instance ${instanceId} not found`);
    }

    return this.parseInstance(instances[0]!);
  }

  async listInstances(tag?: string): Promise<EcsInstanceInfo[]> {
    const sdk = await this.ensureSdk();

    const req: Record<string, unknown> = {
      regionId: this.config.regionId,
      pageSize: 100,
    };
    if (tag) {
      req.tag = [{ key: "openclaw", value: tag }];
    }

    const response = await sdk.describeInstances(req);
    const instances =
      (response.body.instances as { instance: Array<Record<string, unknown>> })?.instance ?? [];

    return instances.map((i) => this.parseInstance(i));
  }

  async startInstance(instanceId: string): Promise<void> {
    const sdk = await this.ensureSdk();
    await sdk.startInstance({ instanceId });
  }

  async stopInstance(instanceId: string): Promise<void> {
    const sdk = await this.ensureSdk();
    await sdk.stopInstance({ instanceId });
  }

  async rebootInstance(instanceId: string): Promise<void> {
    const sdk = await this.ensureSdk();
    await sdk.rebootInstance({ instanceId });
  }

  async deleteInstance(instanceId: string): Promise<void> {
    const sdk = await this.ensureSdk();
    await sdk.deleteInstance({ instanceId });
  }

  // -----------------------------------------------------------------------
  // Security groups
  // -----------------------------------------------------------------------

  async createSecurityGroup(opts: { vpcId: string; name?: string }): Promise<string> {
    const sdk = await this.ensureSdk();
    const response = await sdk.createSecurityGroup({
      regionId: this.config.regionId,
      vpcId: opts.vpcId,
      securityGroupName: opts.name ?? "openclaw-apache-sg",
      description: "Security group for OpenClaw Apache instances",
    });
    return response.body.securityGroupId as string;
  }

  async addSecurityRule(opts: {
    securityGroupId: string;
    protocol: "tcp" | "udp";
    portRange: string;
    sourceCidr: string;
  }): Promise<void> {
    const sdk = await this.ensureSdk();
    await sdk.authorizeSecurityGroup({
      regionId: this.config.regionId,
      securityGroupId: opts.securityGroupId,
      ipProtocol: opts.protocol,
      portRange: opts.portRange,
      sourceCidrIp: opts.sourceCidr,
      policy: "accept",
      priority: "1",
    });
  }

  // -----------------------------------------------------------------------
  // Key pairs
  // -----------------------------------------------------------------------

  async createKeyPair(name: string): Promise<{ keyPairName: string; privateKey: string }> {
    const sdk = await this.ensureSdk();
    const response = await sdk.createKeyPair({
      regionId: this.config.regionId,
      keyPairName: name,
    });
    return {
      keyPairName: (response.body.keyPairName as string) ?? name,
      privateKey: (response.body.privateKeyBody as string) ?? "",
    };
  }

  async deleteKeyPair(name: string): Promise<void> {
    const sdk = await this.ensureSdk();
    await sdk.deleteKeyPairs({
      regionId: this.config.regionId,
      keyPairNames: JSON.stringify([name]),
    });
  }

  // -----------------------------------------------------------------------
  // VPC discovery
  // -----------------------------------------------------------------------

  async describeVpcs(): Promise<Array<{ vpcId: string; cidrBlock: string; isDefault: boolean }>> {
    const sdk = await this.ensureSdk();
    const response = await sdk.describeVpcs({
      regionId: this.config.regionId,
      pageSize: 50,
    });
    const vpcs = (response.body.vpcs as { vpc: Array<Record<string, unknown>> })?.vpc ?? [];
    return vpcs.map((v) => ({
      vpcId: (v.vpcId as string) ?? "",
      cidrBlock: (v.cidrBlock as string) ?? "",
      isDefault: (v.isDefault as boolean) ?? false,
    }));
  }

  async describeVSwitches(vpcId: string): Promise<Array<{ vSwitchId: string; zoneId: string }>> {
    const sdk = await this.ensureSdk();
    const response = await sdk.describeVSwitches({
      regionId: this.config.regionId,
      vpcId,
      pageSize: 50,
    });
    const switches =
      (response.body.vSwitches as { vSwitch: Array<Record<string, unknown>> })?.vSwitch ?? [];
    return switches.map((s) => ({
      vSwitchId: (s.vSwitchId as string) ?? "",
      zoneId: (s.zoneId as string) ?? "",
    }));
  }

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  private parseInstance(raw: Record<string, unknown>): EcsInstanceInfo {
    const publicIps = (raw.publicIpAddress as { ipAddress?: string[] })?.ipAddress;
    const privateIps = (raw.vpcAttributes as { privateIpAddress?: { ipAddress?: string[] } })
      ?.privateIpAddress?.ipAddress;
    const sgIds = (raw.securityGroupIds as { securityGroupId?: string[] })?.securityGroupId;

    return {
      instanceId: (raw.instanceId as string) ?? "",
      instanceName: (raw.instanceName as string) ?? "",
      status: (raw.status as EcsInstanceInfo["status"]) ?? "Pending",
      publicIp: publicIps?.[0] ?? null,
      privateIp: privateIps?.[0] ?? null,
      instanceType: (raw.instanceType as string) ?? "",
      creationTime: (raw.creationTime as string) ?? "",
      regionId: (raw.regionId as string) ?? this.config.regionId,
      securityGroupIds: sgIds ?? [],
      vpcId: "",
    };
  }
}
