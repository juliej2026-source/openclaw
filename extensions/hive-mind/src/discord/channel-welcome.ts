// ---------------------------------------------------------------------------
// Welcome / conversation-starter embeds for each hive channel — sent once & pinned
// ---------------------------------------------------------------------------

import type { ChannelManager } from "./channel-manager.js";
import type { ChannelName } from "./types.js";
import { SEVERITY_COLORS, CONTEXT_COLORS } from "./types.js";

type WelcomeEmbed = {
  title: string;
  description: string;
  color: number;
  fields: Array<{ name: string; value: string; inline?: boolean }>;
  footer: { text: string };
};

const WELCOME_EMBEDS: Record<ChannelName, WelcomeEmbed> = {
  "hive-alerts": {
    title: "\u{1f6a8} Hive Alerts — Real-Time Infrastructure Notifications",
    description:
      "This channel receives **live alerts** whenever something changes in the infrastructure. " +
      "Station goes offline? Failover triggered? You'll see it here instantly.\n\n" +
      "Each alert has an **[Acknowledge]** button to mark it as handled.",
    color: SEVERITY_COLORS.critical,
    fields: [
      {
        name: "\u{1f534} Alert Types",
        value:
          "**Station Offline** — a station stopped responding\n" +
          "**Station Online** — a station came back\n" +
          "**Failover Triggered** — WAN switched to backup\n" +
          "**Failover Recovered** — WAN back to primary\n" +
          "**Internet Degraded** — high latency or packet loss\n" +
          "**Internet Restored** — connectivity recovered",
      },
      {
        name: "\u{2328}\u{fe0f} Commands",
        value:
          "`/hive alerts list` — show active alerts\n" +
          "`/hive alerts ack <id>` — acknowledge an alert\n" +
          "`!alerts` — quick active alerts view\n" +
          "`!ack <id>` — quick acknowledge",
        inline: true,
      },
      {
        name: "\u{1f4a1} Tips",
        value:
          "Click **[Acknowledge]** on any alert to dismiss it.\n" +
          "Unacknowledged alerts appear in dashboard summaries.",
        inline: true,
      },
    ],
    footer: { text: "Alerts are generated automatically — no setup needed" },
  },

  "hive-status": {
    title: "\u{1f4ca} Hive Status — Health Summaries & Dashboards",
    description:
      "This channel receives **periodic health reports** about the entire infrastructure.\n\n" +
      "\u{23f0} **Every 30 minutes** — Station health (online/offline + latency)\n" +
      "\u{23f0} **Every 1 hour** — Full dashboard (hardware, models, WAN, alerts)\n" +
      "\u{23f0} **Every 6 hours** — Deep report (scraper + neural + models combined)",
    color: CONTEXT_COLORS.dashboard,
    fields: [
      {
        name: "\u{2328}\u{fe0f} Commands",
        value:
          "`/hive status` — full system dashboard on-demand\n" +
          "`/hive models` — AI model inventory\n" +
          "`/hive ping` — quick connectivity check\n" +
          "`!status` — quick dashboard\n" +
          "`!models` — quick model list\n" +
          "`!ping` — quick pong",
        inline: true,
      },
      {
        name: "\u{1f4a1} What You'll See",
        value:
          "**Station Health** — which stations are online\n" +
          "**System Info** — CPU, RAM, uptime\n" +
          "**Model Count** — installed vs running\n" +
          "**Alert Summary** — unresolved count\n" +
          "**WAN Status** — primary or failover",
        inline: true,
      },
    ],
    footer: { text: "Reports are automatic — use commands for on-demand info" },
  },

  "hive-network": {
    title: "\u{1f310} Hive Network — Topology & Connectivity",
    description:
      "This channel tracks **network topology changes** — when stations go online/offline, " +
      "switch ports change, or the network layout shifts.\n\n" +
      "The network scanner checks all stations every **30 seconds** and posts changes here.",
    color: CONTEXT_COLORS.network,
    fields: [
      {
        name: "\u{1f5a5}\u{fe0f} Monitored Stations",
        value:
          "**Julie** `10.1.8.143` — orchestrator\n" +
          "**Caesar** `10.1.8.82` — peer station\n" +
          "**IOT-HUB** `10.1.8.158` — this server\n" +
          "**BRAVIA TV** `10.1.8.194` — Sony BRAVIA 7 (K-65XR70)",
      },
      {
        name: "\u{2328}\u{fe0f} Commands",
        value:
          "`/hive network scan` — run topology scan\n" +
          "`/hive network path` — show dual-WAN state\n" +
          "`/hive network switch primary` — switch to UDM\n" +
          "`/hive network switch 5g` — switch to HR02 5G\n" +
          "`/hive network 5g` — 5G modem status\n" +
          "`/hive network failover` — failover state\n" +
          "`!scan` `!path` `!switch primary` `!switch 5g`",
        inline: true,
      },
      {
        name: "\u{1f517} Dual-WAN Paths",
        value:
          "**Primary** — The 1898 Moiwa (UDM Pro)\n" +
          "**HR02 5G** — NTT Docomo 5G Modem\n" +
          "Auto-failover after 3 consecutive failures",
        inline: true,
      },
    ],
    footer: { text: "State changes appear automatically — scan manually with /hive network scan" },
  },

  "hive-scraper": {
    title: "\u{1f3e8} Hive Scraper — Hotel Price Intelligence",
    description:
      "This channel reports on **scraper station** activity — a dedicated intelligence node " +
      "for price monitoring, anomaly detection, family travel reports, " +
      "and bilateral tandem tasks with IOT-HUB and Julie.",
    color: CONTEXT_COLORS.scraper,
    fields: [
      {
        name: "\u{2328}\u{fe0f} Commands",
        value:
          "`/hive scraper status` — scraper health + LLM status\n" +
          "`/hive scraper jobs` — list recent jobs\n" +
          "`/hive scraper prices` — latest prices\n" +
          "`/hive scraper run` — start a new scrape\n" +
          "`!scraper` — quick status",
        inline: true,
      },
      {
        name: "\u{1f4b0} Intelligence Capabilities",
        value:
          "**Price monitoring** — multi-source tracking\n" +
          "**Anomaly detection** — price spike alerting\n" +
          "**Family reports** — LLM-generated deal analysis\n" +
          "**Tandem tasks** — bilateral peer execution",
        inline: true,
      },
      {
        name: "\u{1f30d} Coverage Areas",
        value: "Hirafu, Niseko Village, Annupuri, Hanazono, Moiwa, Kutchan",
      },
    ],
    footer: {
      text: "Job results appear automatically — trigger manual scrapes with /hive scraper run",
    },
  },

  "hive-neural": {
    title: "\u{1f9e0} Hive Neural — Graph Evolution & Maturation",
    description:
      "This channel tracks the **neural graph** — the AI capability network that maps " +
      "how stations, models, and capabilities connect and evolve.\n\n" +
      "The graph goes through maturation phases: **Genesis** \u{2192} **Growth** \u{2192} **Maturation** \u{2192} **Stable**.",
    color: CONTEXT_COLORS.neural,
    fields: [
      {
        name: "\u{1f9ec} Graph Components",
        value:
          "**Nodes** — capabilities (meta-engine, model-manager, etc.) and stations (iot-hub, julie)\n" +
          "**Edges** — data flows, dependencies, and activation links\n" +
          "**Weights** — connection strength (myelination)\n" +
          "**Fitness** — overall graph health score",
      },
      {
        name: "\u{2328}\u{fe0f} Commands",
        value:
          "`/hive neural status` — phase, nodes, edges, fitness\n" +
          "`/hive neural topology` — full graph structure\n" +
          "`/hive neural evolve` — trigger evolution\n" +
          "`/hive neural query <task>` — route a task\n" +
          "`!neural` — quick status",
        inline: true,
      },
      {
        name: "\u{1f4a1} Tips",
        value:
          "Use **[Evolve]** button to trigger evolution.\n" +
          "Use **[Topology]** to see the full graph.\n" +
          "Phase changes are posted automatically.",
        inline: true,
      },
    ],
    footer: { text: "Neural events appear automatically — interact with /hive neural commands" },
  },

  "hive-models": {
    title: "\u{1f916} Hive Models — AI Model Inventory",
    description:
      "This channel tracks **AI model changes** — when models are installed, removed, " +
      "started, or stopped on the Ollama instance.\n\n" +
      "The system monitors models via the local Ollama API and reports diffs here.",
    color: CONTEXT_COLORS.models,
    fields: [
      {
        name: "\u{2328}\u{fe0f} Commands",
        value:
          "`/hive models` — list all installed/running models\n" +
          "`/hive meta status` — meta-engine + hardware info\n" +
          "`/hive meta classify <text>` — classify a task\n" +
          "`/hive meta recommend <text>` — recommend best model\n" +
          "`!models` — quick model list",
        inline: true,
      },
      {
        name: "\u{1f4e6} Model Operations",
        value:
          "**Installed** — models downloaded to disk\n" +
          "**Running** — models loaded in VRAM\n" +
          "**Scoring** — performance ranking by task\n" +
          "**Classification** — auto-route tasks to best model",
        inline: true,
      },
      {
        name: "\u{1f52c} Training",
        value:
          "`/hive train start <dataset> <model>` — start fine-tuning\n" +
          "`/hive train jobs` — list training jobs\n" +
          "`/hive train adapters` — list LoRA adapters",
      },
    ],
    footer: { text: "Model inventory diffs appear automatically — query with /hive models" },
  },

  "hive-ai": {
    title: "\u{1f916} Hive AI — Free-Form Conversation",
    description:
      "This channel is connected to the **OpenClaw AI agent runtime**. " +
      "Ask anything — infrastructure questions, code help, data analysis, or general knowledge.\n\n" +
      "Every message in this channel is sent to the AI. No prefix needed.",
    color: CONTEXT_COLORS.ai,
    fields: [
      {
        name: "\u{1f4ac} How to Interact",
        value:
          "**In this channel** — just type your question\n" +
          "**In other channels** — `!ask <question>` or @mention the bot\n" +
          "**Slash command** — `/hive ask <question>`\n" +
          "**DMs** — message the bot directly",
      },
      {
        name: "\u{1f9e0} Capabilities",
        value:
          "Access to 61+ tools including infrastructure control, " +
          "code analysis, web search, and data processing.\n" +
          "Conversations are session-aware — the AI remembers context.",
        inline: true,
      },
      {
        name: "\u{1f511} Sessions",
        value:
          "Each user gets an isolated conversation.\n" +
          "Thread conversations share a single session.\n" +
          "DMs are per-user.",
        inline: true,
      },
    ],
    footer: { text: "Powered by OpenClaw agent runtime" },
  },

  "hive-execution": {
    title: "\u{26a1} Hive Execution — Command Log & Performance",
    description:
      "This channel logs **command executions** across the hive — what was run, " +
      "whether it succeeded, how long it took, and which capabilities were used.\n\n" +
      "Execution data feeds the meta-engine's performance database for model optimization.",
    color: CONTEXT_COLORS.execution,
    fields: [
      {
        name: "\u{1f4cb} What Gets Logged",
        value:
          "**Command** — what was dispatched\n" +
          "**Task Type** — analysis, reasoning, coding, tool-use, chat\n" +
          "**Success/Failure** — result status\n" +
          "**Latency** — execution time in ms\n" +
          "**Capabilities Used** — which subsystems were involved",
      },
      {
        name: "\u{2328}\u{fe0f} Commands",
        value:
          "`/hive status` — includes execution summary\n" +
          "`/hive meta dashboard` — full performance view\n" +
          "`!status` — quick overview with exec stats",
        inline: true,
      },
      {
        name: "\u{1f4a1} How It Works",
        value:
          "Every command dispatched through the hive API " +
          "is recorded and reported to Julie for " +
          "cross-station performance optimization.",
        inline: true,
      },
    ],
    footer: {
      text: "Execution summaries appear periodically — see /hive status for current stats",
    },
  },
};

/**
 * Send welcome embeds to all channels and pin them.
 * Skips channels that already have a pinned message (idempotent).
 */
export async function sendChannelWelcomes(cm: ChannelManager): Promise<void> {
  const client = cm.getRestClient();
  if (!client) return;

  for (const [channelName, embed] of Object.entries(WELCOME_EMBEDS) as Array<
    [ChannelName, WelcomeEmbed]
  >) {
    const channelId = cm.getChannelId(channelName);
    if (!channelId) continue;

    // Check if there's already a pinned message — skip if so
    const pinned = await client.getPinnedMessages(channelId);
    if (pinned && pinned.length > 0) continue;

    // Send and pin the welcome embed
    const msg = await client.sendMessage(channelId, {
      embeds: [
        {
          ...embed,
          timestamp: new Date().toISOString(),
        },
      ],
    });

    if (msg?.id) {
      await client.pinMessage(channelId, msg.id);
      console.log(`[discord] Pinned welcome message in #${channelName}`);
    }
  }
}
