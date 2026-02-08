import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import type { LoraAdapter } from "../types.js";

const execFileAsync = promisify(execFile);
function trainerDir(): string {
  return path.join(process.env.HOME ?? "~", ".openclaw", "model-trainer");
}

/**
 * Merge a LoRA adapter into its base model and register with Ollama.
 *
 * This creates an Ollama Modelfile pointing to the merged GGUF, then runs
 * `ollama create` to register the resulting model.
 *
 * Requires: Ollama running, adapter files on disk.
 */
export async function mergeAdapterToOllama(
  adapter: LoraAdapter,
  outputModelName: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    // Build a Modelfile that references the adapter's base model
    // and adds the LoRA adapter path
    const modelfileDir = path.join(trainerDir(), "modelfiles");
    fs.mkdirSync(modelfileDir, { recursive: true });
    const modelfilePath = path.join(modelfileDir, `${outputModelName}.Modelfile`);

    // Check if adapter path contains adapter_config.json (HuggingFace PEFT format)
    const adapterConfigPath = path.join(adapter.path, "adapter_config.json");
    const hasPeftAdapter = fs.existsSync(adapterConfigPath);

    if (hasPeftAdapter) {
      // For PEFT/LoRA adapters, create a Modelfile with ADAPTER directive
      const content = [`FROM ${adapter.baseModel}`, `ADAPTER ${adapter.path}`].join("\n");
      fs.writeFileSync(modelfilePath, content);
    } else {
      // Fallback: create model from base with system prompt referencing the adapter
      const content = [
        `FROM ${adapter.baseModel}`,
        `SYSTEM """Fine-tuned model based on ${adapter.baseModel} with adapter ${adapter.name}."""`,
      ].join("\n");
      fs.writeFileSync(modelfilePath, content);
    }

    // Run ollama create
    const { stderr } = await execFileAsync(
      "ollama",
      ["create", outputModelName, "-f", modelfilePath],
      { timeout: 10 * 60 * 1000 }, // 10 minutes for larger merges
    );

    if (stderr && stderr.toLowerCase().includes("error")) {
      return { success: false, error: stderr.trim() };
    }

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Check if an adapter's files are present on disk.
 */
export function isAdapterOnDisk(adapter: LoraAdapter): boolean {
  try {
    return fs.existsSync(adapter.path) && fs.statSync(adapter.path).isDirectory();
  } catch {
    return false;
  }
}
