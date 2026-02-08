import type { Command } from "commander";
import { discoverLocalModels } from "../discovery.js";
import { detectHardware, formatBytes } from "../hardware.js";
import { ModelInventory } from "../inventory.js";
import { OllamaClient } from "../ollama-client.js";

/**
 * Register `local-models` CLI subcommands under the given parent program.
 */
export function registerModelManagerCli(program: Command): void {
  const cmd = program
    .command("local-models")
    .description("Manage locally installed AI models (Ollama + llama.cpp)");

  cmd
    .command("list")
    .description("List all locally installed models")
    .option("--capability <cap>", "Filter by capability (code, reasoning, vision, chat, etc.)")
    .option("--runtime <rt>", "Filter by runtime (ollama, llamacpp)")
    .action(async (opts: { capability?: string; runtime?: string }) => {
      const inventory = new ModelInventory();
      let models = inventory.listAll();

      if (opts.capability) {
        const cap = opts.capability as import("../types.js").ModelCapability;
        models = models.filter((m) => m.capabilities.includes(cap));
      }
      if (opts.runtime) {
        models = models.filter((m) => m.runtime === opts.runtime);
      }

      if (models.length === 0) {
        console.log(
          "No local models found. Run `openclaw local-models pull <model>` to download one.",
        );
        return;
      }

      console.log(`\nLocal Models (${models.length}):\n`);
      for (const m of models) {
        const caps = m.capabilities.join(", ");
        console.log(
          `  ${m.id.padEnd(30)} ${formatBytes(m.sizeBytes).padEnd(10)} ${(m.parameterCount ?? "?").padEnd(8)} [${caps}]`,
        );
      }
      console.log(`\nTotal size: ${formatBytes(inventory.totalSizeBytes())}`);
    });

  cmd
    .command("pull")
    .description("Download a model via Ollama")
    .argument("<model>", "Model name (e.g. qwen3:14b, llama3.3:70b)")
    .action(async (model: string) => {
      const client = new OllamaClient();
      if (!(await client.isAvailable())) {
        console.error("Error: Ollama is not running. Start Ollama first: https://ollama.com");
        process.exitCode = 1;
        return;
      }

      console.log(`Pulling ${model}...`);
      const result = await client.pullAndWait(model, (event) => {
        if (event.total && event.completed) {
          const pct = Math.round((event.completed / event.total) * 100);
          process.stdout.write(
            `\r  ${event.status}: ${pct}% (${formatBytes(event.completed)}/${formatBytes(event.total)})`,
          );
        } else {
          process.stdout.write(`\r  ${event.status}${"".padEnd(40)}`);
        }
      });
      console.log();

      if (!result.success) {
        console.error(`Pull failed: ${result.finalStatus}`);
        process.exitCode = 1;
        return;
      }

      // Update inventory
      const inventory = new ModelInventory();
      const models = await discoverLocalModels(inventory.listAll());
      inventory.replaceAll(models);

      console.log(`Successfully pulled ${model}`);
    });

  cmd
    .command("remove")
    .description("Remove a locally installed model")
    .argument("<model>", "Model ID to remove")
    .action(async (model: string) => {
      const inventory = new ModelInventory();
      const existing = inventory.get(model);
      if (!existing) {
        console.error(`Model "${model}" not found in inventory`);
        process.exitCode = 1;
        return;
      }

      if (existing.runtime === "ollama") {
        const client = new OllamaClient();
        if (await client.isAvailable()) {
          await client.deleteModel(existing.ollamaTag ?? model);
        }
      }

      inventory.remove(model);
      console.log(`Removed ${model}`);
    });

  cmd
    .command("info")
    .description("Show detailed info about a model")
    .argument("<model>", "Model ID to inspect")
    .action(async (model: string) => {
      const inventory = new ModelInventory();
      const entry = inventory.get(model);
      if (!entry) {
        console.error(`Model "${model}" not found in inventory`);
        process.exitCode = 1;
        return;
      }

      console.log(`\nModel: ${entry.name}`);
      console.log(`  ID:            ${entry.id}`);
      console.log(`  Runtime:       ${entry.runtime}`);
      console.log(`  Size:          ${formatBytes(entry.sizeBytes)}`);
      console.log(`  Parameters:    ${entry.parameterCount ?? "unknown"}`);
      console.log(`  Family:        ${entry.family ?? "unknown"}`);
      console.log(`  Quantization:  ${entry.quantization ?? "unknown"}`);
      console.log(`  Capabilities:  ${entry.capabilities.join(", ")}`);
      console.log(`  Context:       ${entry.contextWindow} tokens`);
      console.log(`  Max Output:    ${entry.maxTokens} tokens`);
      console.log(`  Installed:     ${entry.installedAt}`);
      console.log(`  Last Used:     ${entry.lastUsed ?? "never"}`);
      console.log(`  Usage Count:   ${entry.usageCount}`);
    });

  cmd
    .command("hardware")
    .description("Detect local hardware capabilities for AI model inference")
    .action(async () => {
      const hw = await detectHardware();

      console.log("\nHardware Profile:\n");
      console.log(`  Platform:  ${hw.platform} (${hw.arch})`);
      console.log(`  CPU Cores: ${hw.cpuCores}`);
      console.log(
        `  RAM:       ${formatBytes(hw.totalRamBytes)} total, ${formatBytes(hw.availableRamBytes)} available`,
      );

      if (hw.gpus.length > 0) {
        console.log(`\n  GPUs (${hw.gpus.length}):`);
        for (const gpu of hw.gpus) {
          console.log(`    ${gpu.name} — ${formatBytes(gpu.vramBytes)} VRAM`);
          if (gpu.driver) {
            console.log(`      Driver: ${gpu.driver}`);
          }
          if (gpu.cudaVersion) {
            console.log(`      CUDA: ${gpu.cudaVersion}`);
          }
        }
      } else {
        console.log("\n  GPUs: none detected (models will run on CPU)");
      }

      console.log(
        `\n  Ollama: ${hw.ollamaAvailable ? `available (v${hw.ollamaVersion ?? "unknown"})` : "not detected"}`,
      );
    });

  cmd
    .command("discover")
    .description("Rediscover models from Ollama and update the inventory")
    .action(async () => {
      const inventory = new ModelInventory();
      console.log("Discovering local models...");
      const models = await discoverLocalModels(inventory.listAll());
      inventory.replaceAll(models);
      console.log(`Found ${models.length} models`);
    });
}
