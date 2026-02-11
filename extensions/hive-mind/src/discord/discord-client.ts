// ---------------------------------------------------------------------------
// Thin Discord REST client using fetch() — zero runtime deps
// ---------------------------------------------------------------------------

const API_BASE = "https://discord.com/api/v10";

type DiscordEmbed = {
  title?: string;
  description?: string;
  color?: number;
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
  timestamp?: string;
  footer?: { text: string };
  thumbnail?: { url: string };
};

export type DiscordMessage = {
  content?: string;
  embeds?: DiscordEmbed[];
};

type DiscordChannel = {
  id: string;
  name: string;
  type: number;
  parent_id?: string | null;
  position?: number;
  topic?: string | null;
};

type DiscordGuild = {
  id: string;
  name: string;
};

export type DiscordRestClient = ReturnType<typeof createDiscordRestClient>;

export function createDiscordRestClient(token: string) {
  const headers = {
    Authorization: `Bot ${token}`,
    "Content-Type": "application/json",
  };

  async function request<T>(method: string, path: string, body?: unknown): Promise<T | null> {
    const url = `${API_BASE}${path}`;
    try {
      const res = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(15_000),
      });

      // Rate limited — wait and retry once
      if (res.status === 429) {
        const data = (await res.json()) as { retry_after?: number };
        const wait = (data.retry_after ?? 1) * 1000;
        console.warn(`[discord] Rate limited, retrying in ${wait}ms`);
        await new Promise((r) => setTimeout(r, wait));
        const retry = await fetch(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
          signal: AbortSignal.timeout(15_000),
        });
        if (!retry.ok) return null;
        return (await retry.json()) as T;
      }

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.warn(`[discord] ${method} ${path} → ${res.status}: ${text.slice(0, 200)}`);
        return null;
      }

      // 204 No Content
      if (res.status === 204) return {} as T;

      return (await res.json()) as T;
    } catch (err) {
      console.warn(
        `[discord] ${method} ${path} failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }

  return {
    getGuild(guildId: string) {
      return request<DiscordGuild>("GET", `/guilds/${guildId}`);
    },

    getGuildChannels(guildId: string) {
      return request<DiscordChannel[]>("GET", `/guilds/${guildId}/channels`);
    },

    createChannel(
      guildId: string,
      body: {
        name: string;
        type: number;
        topic?: string;
        parent_id?: string;
        position?: number;
      },
    ) {
      return request<DiscordChannel>("POST", `/guilds/${guildId}/channels`, body);
    },

    modifyChannel(channelId: string, body: { name?: string; topic?: string; position?: number }) {
      return request<DiscordChannel>("PATCH", `/channels/${channelId}`, body);
    },

    sendMessage(channelId: string, body: DiscordMessage) {
      return request<{ id: string }>("POST", `/channels/${channelId}/messages`, body);
    },

    editMessage(channelId: string, messageId: string, body: DiscordMessage) {
      return request<{ id: string }>("PATCH", `/channels/${channelId}/messages/${messageId}`, body);
    },
  };
}
