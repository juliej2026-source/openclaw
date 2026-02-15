// ---------------------------------------------------------------------------
// Slash command definitions — 10 top-level commands under /hive
// ---------------------------------------------------------------------------

import { SlashCommandBuilder, SlashCommandSubcommandBuilder, REST, Routes } from "discord.js";

/** Build all slash command definitions for guild registration. */
export function buildSlashCommands() {
  return [buildHiveCommand().toJSON()];
}

function buildHiveCommand() {
  const cmd = new SlashCommandBuilder()
    .setName("hive")
    .setDescription("Hive-Mind infrastructure control");

  // /hive status
  cmd.addSubcommand((sub) => sub.setName("status").setDescription("Full system dashboard"));

  // /hive models
  cmd.addSubcommand((sub) =>
    sub.setName("models").setDescription("List installed and running AI models"),
  );

  // /hive ping
  cmd.addSubcommand((sub) => sub.setName("ping").setDescription("Check if the hive is alive"));

  // /hive help
  cmd.addSubcommand((sub) => sub.setName("help").setDescription("List all available commands"));

  // /hive ask <question>
  cmd.addSubcommand((sub) =>
    sub
      .setName("ask")
      .setDescription("Ask the AI a free-form question")
      .addStringOption((o) =>
        o.setName("question").setDescription("Your question").setRequired(true),
      ),
  );

  // /hive network <action>
  cmd.addSubcommandGroup((g) =>
    g
      .setName("network")
      .setDescription("Network operations")
      .addSubcommand(sub("scan", "Run a network topology scan"))
      .addSubcommand(sub("path", "Show dual-WAN network path state"))
      .addSubcommand(
        new SlashCommandSubcommandBuilder()
          .setName("switch")
          .setDescription("Switch active network path")
          .addStringOption((o) =>
            o
              .setName("target")
              .setDescription("Network path to switch to")
              .setRequired(true)
              .addChoices(
                { name: "Primary (UDM)", value: "primary" },
                { name: "5G (HR02)", value: "hr02_5g" },
              ),
          ),
      )
      .addSubcommand(sub("5g", "Show 5G modem status"))
      .addSubcommand(sub("failover", "Show failover state")),
  );

  // /hive alerts <action>
  cmd.addSubcommandGroup((g) =>
    g
      .setName("alerts")
      .setDescription("Alert management")
      .addSubcommand(
        new SlashCommandSubcommandBuilder()
          .setName("list")
          .setDescription("List alerts")
          .addBooleanOption((o) =>
            o.setName("active_only").setDescription("Show only unacknowledged alerts"),
          ),
      )
      .addSubcommand(
        new SlashCommandSubcommandBuilder()
          .setName("ack")
          .setDescription("Acknowledge an alert")
          .addStringOption((o) =>
            o.setName("id").setDescription("Alert ID to acknowledge").setRequired(true),
          ),
      ),
  );

  // /hive unifi <action>
  cmd.addSubcommandGroup((g) =>
    g
      .setName("unifi")
      .setDescription("UniFi network controller")
      .addSubcommand(sub("status", "UniFi controller status"))
      .addSubcommand(sub("devices", "List network devices"))
      .addSubcommand(sub("clients", "List connected clients"))
      .addSubcommand(sub("health", "Network health overview"))
      .addSubcommand(sub("cloud", "Discover UniFi Cloud sites")),
  );

  // /hive meta <action>
  cmd.addSubcommandGroup((g) =>
    g
      .setName("meta")
      .setDescription("Meta-engine operations")
      .addSubcommand(sub("status", "Meta-engine status"))
      .addSubcommand(sub("dashboard", "Full meta-engine dashboard"))
      .addSubcommand(
        new SlashCommandSubcommandBuilder()
          .setName("classify")
          .setDescription("Classify a task")
          .addStringOption((o) =>
            o.setName("text").setDescription("Task text to classify").setRequired(true),
          ),
      )
      .addSubcommand(
        new SlashCommandSubcommandBuilder()
          .setName("recommend")
          .setDescription("Recommend a model for a task")
          .addStringOption((o) =>
            o.setName("text").setDescription("Task description").setRequired(true),
          ),
      ),
  );

  // /hive neural <action>
  cmd.addSubcommandGroup((g) =>
    g
      .setName("neural")
      .setDescription("Neural graph operations")
      .addSubcommand(sub("status", "Neural graph maturation status"))
      .addSubcommand(sub("topology", "Neural graph topology"))
      .addSubcommand(sub("evolve", "Trigger neural graph evolution"))
      .addSubcommand(
        new SlashCommandSubcommandBuilder()
          .setName("query")
          .setDescription("Query neural graph for routing")
          .addStringOption((o) =>
            o.setName("task").setDescription("Task to query routing for").setRequired(true),
          ),
      ),
  );

  // /hive scraper <action>
  cmd.addSubcommandGroup((g) =>
    g
      .setName("scraper")
      .setDescription("Hotel scraper operations")
      .addSubcommand(sub("status", "Scraper extension status"))
      .addSubcommand(
        new SlashCommandSubcommandBuilder()
          .setName("jobs")
          .setDescription("List scrape jobs")
          .addIntegerOption((o) =>
            o.setName("limit").setDescription("Max jobs to show").setMinValue(1).setMaxValue(20),
          ),
      )
      .addSubcommand(sub("prices", "Show latest hotel prices"))
      .addSubcommand(sub("run", "Start a new scrape job")),
  );

  // /hive hf <action>
  cmd.addSubcommandGroup((g) =>
    g
      .setName("hf")
      .setDescription("HuggingFace Hub operations")
      .addSubcommand(sub("status", "HuggingFace account status"))
      .addSubcommand(
        new SlashCommandSubcommandBuilder()
          .setName("models")
          .setDescription("List HuggingFace models")
          .addIntegerOption((o) =>
            o.setName("limit").setDescription("Max results").setMinValue(1).setMaxValue(50),
          ),
      )
      .addSubcommand(
        new SlashCommandSubcommandBuilder()
          .setName("spaces")
          .setDescription("List HuggingFace Spaces")
          .addIntegerOption((o) =>
            o.setName("limit").setDescription("Max results").setMinValue(1).setMaxValue(50),
          ),
      )
      .addSubcommand(
        new SlashCommandSubcommandBuilder()
          .setName("datasets")
          .setDescription("List HuggingFace datasets")
          .addIntegerOption((o) =>
            o.setName("limit").setDescription("Max results").setMinValue(1).setMaxValue(50),
          ),
      ),
  );

  // /hive train <action>
  cmd.addSubcommandGroup((g) =>
    g
      .setName("train")
      .setDescription("Model training operations")
      .addSubcommand(
        new SlashCommandSubcommandBuilder()
          .setName("start")
          .setDescription("Start a training job")
          .addStringOption((o) =>
            o.setName("dataset").setDescription("Dataset path").setRequired(true),
          )
          .addStringOption((o) =>
            o.setName("base_model").setDescription("Base model name").setRequired(true),
          ),
      )
      .addSubcommand(
        new SlashCommandSubcommandBuilder()
          .setName("jobs")
          .setDescription("List training jobs")
          .addStringOption((o) =>
            o
              .setName("status")
              .setDescription("Filter by status")
              .addChoices(
                { name: "Pending", value: "pending" },
                { name: "Running", value: "running" },
                { name: "Completed", value: "completed" },
                { name: "Failed", value: "failed" },
              ),
          ),
      )
      .addSubcommand(sub("adapters", "List LoRA adapters")),
  );

  return cmd;
}

/** Helper for simple subcommands with no options. */
function sub(name: string, description: string) {
  return new SlashCommandSubcommandBuilder().setName(name).setDescription(description);
}

/**
 * Register slash commands as guild commands (instant availability).
 * Derives application ID from token if not provided.
 */
export async function registerSlashCommands(opts: {
  token: string;
  applicationId: string;
  guildId: string;
}): Promise<void> {
  const rest = new REST({ version: "10" }).setToken(opts.token);
  const commands = buildSlashCommands();

  const result = await rest.put(Routes.applicationGuildCommands(opts.applicationId, opts.guildId), {
    body: commands,
  });
  const count = Array.isArray(result) ? result.length : 0;
  console.log(`[discord-gw] Registered ${count} slash command(s) for guild ${opts.guildId}`);
}

/** Extract application ID from bot token (base64-encoded ID before first dot). */
export function applicationIdFromToken(token: string): string {
  const encoded = token.split(".")[0];
  return Buffer.from(encoded, "base64").toString("utf-8");
}
