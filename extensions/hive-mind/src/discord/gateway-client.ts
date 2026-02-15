// ---------------------------------------------------------------------------
// Discord Gateway client using discord.js — handles WebSocket connection
// ---------------------------------------------------------------------------

import { Client, GatewayIntentBits, Events, type Interaction, type Message } from "discord.js";

export type GatewayEventHandlers = {
  onInteraction: (interaction: Interaction) => void;
  onMessage: (message: Message) => void;
};

export type GatewayClient = {
  client: Client;
  login(): Promise<void>;
  destroy(): Promise<void>;
  isReady(): boolean;
};

/**
 * Create a discord.js Gateway client with minimal intents.
 * Non-fatal — callers should catch login errors.
 */
export function createGatewayClient(token: string, handlers: GatewayEventHandlers): GatewayClient {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.DirectMessages,
    ],
  });

  let ready = false;

  client.once(Events.ClientReady, (c) => {
    ready = true;
    console.log(`[discord-gw] Gateway connected as ${c.user.tag}`);
  });

  client.on(Events.InteractionCreate, (interaction) => {
    try {
      handlers.onInteraction(interaction);
    } catch (err) {
      console.warn(
        `[discord-gw] Interaction handler error: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  });

  client.on(Events.MessageCreate, (message) => {
    // Ignore own messages
    if (message.author.id === client.user?.id) return;
    // Ignore bot messages
    if (message.author.bot) return;
    try {
      handlers.onMessage(message);
    } catch (err) {
      console.warn(
        `[discord-gw] Message handler error: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  });

  client.on(Events.Error, (err) => {
    console.warn(`[discord-gw] Client error: ${err.message}`);
  });

  client.on(Events.Warn, (msg) => {
    console.warn(`[discord-gw] Warning: ${msg}`);
  });

  return {
    client,
    async login() {
      await client.login(token);
    },
    async destroy() {
      ready = false;
      await client.destroy();
      console.log("[discord-gw] Gateway disconnected");
    },
    isReady() {
      return ready;
    },
  };
}
