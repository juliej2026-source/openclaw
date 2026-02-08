import { Type } from "@sinclair/typebox";
import type { AnyAgentTool } from "../../../../src/agents/tools/common.js";
import { detectHardware, formatBytes } from "../hardware.js";

export function createHardwareInfoTool(): AnyAgentTool {
  return {
    name: "local_hardware_info",
    label: "Hardware Info",
    description:
      "Detect local hardware capabilities for running AI models: GPU(s), VRAM, " +
      "RAM, CPU cores, and whether Ollama is available. Use this to determine " +
      "which model sizes the system can handle.",
    parameters: Type.Object({}),
    async execute() {
      const hw = await detectHardware();

      const payload = {
        gpus: hw.gpus.map((g) => ({
          name: g.name,
          vram: formatBytes(g.vramBytes),
          vramBytes: g.vramBytes,
          driver: g.driver,
          cudaVersion: g.cudaVersion,
          utilization: g.utilizationPercent != null ? `${g.utilizationPercent}%` : undefined,
        })),
        ram: {
          total: formatBytes(hw.totalRamBytes),
          available: formatBytes(hw.availableRamBytes),
          totalBytes: hw.totalRamBytes,
          availableBytes: hw.availableRamBytes,
        },
        cpu: {
          cores: hw.cpuCores,
          platform: hw.platform,
          arch: hw.arch,
        },
        ollama: {
          available: hw.ollamaAvailable,
          version: hw.ollamaVersion ?? "not detected",
        },
        recommendations: generateRecommendations(hw),
      };

      return {
        content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
        details: payload,
      };
    },
  };
}

function generateRecommendations(hw: Awaited<ReturnType<typeof detectHardware>>): string[] {
  const recs: string[] = [];
  const totalVram = hw.gpus.reduce((sum, g) => sum + g.vramBytes, 0);
  const gb = (bytes: number) => bytes / (1024 * 1024 * 1024);

  if (!hw.ollamaAvailable) {
    recs.push("Install Ollama (https://ollama.com) to manage local models");
  }

  if (hw.gpus.length === 0) {
    recs.push(
      "No GPU detected. Models will run on CPU (slower). Consider models ≤7B with Q4 quantization.",
    );
  } else if (gb(totalVram) < 6) {
    recs.push("Limited VRAM (<6GB). Recommended: 1-3B parameter models with Q4_K_M quantization.");
  } else if (gb(totalVram) < 12) {
    recs.push(
      "Moderate VRAM (6-12GB). Recommended: up to 7-8B parameter models with Q4_K_M quantization.",
    );
  } else if (gb(totalVram) < 24) {
    recs.push(
      "Good VRAM (12-24GB). Recommended: up to 14B parameter models, or 7B at higher quantization.",
    );
  } else {
    recs.push(
      `Excellent VRAM (${gb(totalVram).toFixed(0)}GB). Can run up to 70B+ parameter models.`,
    );
  }

  if (gb(hw.totalRamBytes) >= 32 && hw.gpus.length === 0) {
    recs.push(
      "With 32GB+ RAM, you can run 7-13B models on CPU, though inference will be slower than GPU.",
    );
  }

  return recs;
}
