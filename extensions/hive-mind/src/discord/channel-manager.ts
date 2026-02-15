// ---------------------------------------------------------------------------
// Auto-provisions "Hive Infrastructure" category + 7 text channels
// ---------------------------------------------------------------------------

import type { DiscordRestClient, DiscordMessage } from "./discord-client.js";
import {
  type ChannelName,
  type DiscordConfig,
  CHANNEL_CONFIGS,
  ALL_CHANNEL_NAMES,
  DEFAULT_CATEGORY_NAME,
  CHANNEL_TYPE_GUILD_TEXT,
  CHANNEL_TYPE_GUILD_CATEGORY,
} from "./types.js";

export class ChannelManager {
  private readonly client: DiscordRestClient;
  private readonly guildId: string;
  private readonly categoryName: string;

  private categoryId: string | null = null;
  private channelIds = new Map<ChannelName, string>();

  constructor(client: DiscordRestClient, config: DiscordConfig) {
    this.client = client;
    this.guildId = config.guildId;
    this.categoryName = config.categoryName ?? DEFAULT_CATEGORY_NAME;
  }

  /** Find-or-create category + all 7 channels. */
  async initialize(): Promise<void> {
    const channels = await this.client.getGuildChannels(this.guildId);
    if (!channels) {
      console.warn("[discord] Could not fetch guild channels");
      return;
    }

    // Find or create category
    let category = channels.find(
      (c) => c.type === CHANNEL_TYPE_GUILD_CATEGORY && c.name === this.categoryName,
    );

    if (!category) {
      category = await this.client.createChannel(this.guildId, {
        name: this.categoryName,
        type: CHANNEL_TYPE_GUILD_CATEGORY,
      });
      if (category) {
        console.log(`[discord] Created category: ${this.categoryName}`);
      }
    }

    this.categoryId = category?.id ?? null;

    // Find or create each channel under the category
    for (const name of ALL_CHANNEL_NAMES) {
      const config = CHANNEL_CONFIGS[name];
      let existing = channels.find(
        (c) =>
          c.type === CHANNEL_TYPE_GUILD_TEXT && c.name === name && c.parent_id === this.categoryId,
      );

      if (!existing) {
        existing = await this.client.createChannel(this.guildId, {
          name,
          type: CHANNEL_TYPE_GUILD_TEXT,
          topic: config.topic,
          parent_id: this.categoryId ?? undefined,
          position: config.position,
        });
        if (existing) {
          console.log(`[discord] Created channel: #${name}`);
        }
      }

      if (existing) {
        this.channelIds.set(name, existing.id);
      }
    }

    console.log(
      `[discord] Channel manager ready (${this.channelIds.size}/${ALL_CHANNEL_NAMES.length} channels)`,
    );
  }

  /** Get cached channel ID by name. */
  getChannelId(name: ChannelName): string | null {
    return this.channelIds.get(name) ?? null;
  }

  /** Get all cached hive channel IDs as a Set (for message command filtering). */
  getHiveChannelIds(): Set<string> {
    return new Set(this.channelIds.values());
  }

  /** Expose REST client for operations that need direct API access. */
  getRestClient(): DiscordRestClient {
    return this.client;
  }

  /** Send a message to a named channel. */
  async send(channel: ChannelName, message: DiscordMessage): Promise<void> {
    const channelId = this.channelIds.get(channel);
    if (!channelId) return;
    await this.client.sendMessage(channelId, message);
  }
}
