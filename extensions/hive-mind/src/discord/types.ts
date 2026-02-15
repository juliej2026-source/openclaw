// ---------------------------------------------------------------------------
// Discord integration types and constants
// ---------------------------------------------------------------------------

export type DiscordConfig = {
  token: string;
  guildId: string;
  categoryName?: string;
  enabled?: boolean;
};

export type ChannelName =
  | "hive-alerts"
  | "hive-status"
  | "hive-network"
  | "hive-scraper"
  | "hive-neural"
  | "hive-models"
  | "hive-execution"
  | "hive-ai";

export type ChannelConfig = {
  topic: string;
  position: number;
};

export const CHANNEL_CONFIGS: Record<ChannelName, ChannelConfig> = {
  "hive-alerts": {
    topic: "Real-time infrastructure alerts (station offline, failover, degraded)",
    position: 0,
  },
  "hive-status": {
    topic: "Periodic health summaries and dashboard reports",
    position: 1,
  },
  "hive-network": {
    topic: "Network topology changes and station state diffs",
    position: 2,
  },
  "hive-scraper": {
    topic: "Hotel scraper activity: job completions, price summaries",
    position: 3,
  },
  "hive-neural": {
    topic: "Neural graph evolution: phase changes, node/edge counts",
    position: 4,
  },
  "hive-models": {
    topic: "Model inventory changes: installed/running model diffs",
    position: 5,
  },
  "hive-execution": {
    topic: "Command execution log: recent commands, success rates",
    position: 6,
  },
  "hive-ai": {
    topic: "Free-form AI chat — ask anything, powered by OpenClaw agent runtime",
    position: 7,
  },
};

export const ALL_CHANNEL_NAMES = Object.keys(CHANNEL_CONFIGS) as ChannelName[];

export const DEFAULT_CATEGORY_NAME = "Hive Infrastructure";

// Discord embed colors by severity
export const SEVERITY_COLORS = {
  critical: 0xed4245,
  warning: 0xfee75c,
  info: 0x57f287,
} as const;

// Discord embed colors for specific contexts
export const CONTEXT_COLORS = {
  network: 0x58a6ff,
  scraper: 0xf0883e,
  neural: 0xbc8cff,
  models: 0x39d2c0,
  execution: 0x3fb950,
  dashboard: 0x5865f2,
  ai: 0x7289da,
} as const;

// Discord API channel type constants
export const CHANNEL_TYPE_GUILD_TEXT = 0;
export const CHANNEL_TYPE_GUILD_CATEGORY = 4;

// ---------------------------------------------------------------------------
// Gateway (bidirectional control) types and constants
// ---------------------------------------------------------------------------

export type DiscordGatewayConfig = DiscordConfig & {
  applicationId?: string;
  gatewayEnabled?: boolean;
  gatewayUrl?: string;
  gatewayToken?: string;
  aiAgentId?: string;
};

// Button custom ID prefix — all hive button IDs start with this
export const BUTTON_PREFIX = "hive";

// Button action constants
export const BUTTON_ACTIONS = {
  refresh: "refresh",
  ack: "ack",
  scan: "scan",
  switch: "switch",
  scrape: "scrape",
  evolve: "evolve",
  topology: "topology",
} as const;
