import { execFile } from "node:child_process";
import os from "node:os";
import { promisify } from "node:util";
import type { GpuInfo, HardwareInfo } from "./types.js";

const execFileAsync = promisify(execFile);
const EXEC_TIMEOUT_MS = 5_000;

/** Detect NVIDIA GPUs via nvidia-smi (Linux/Windows). */
async function detectNvidiaGpus(): Promise<GpuInfo[]> {
  try {
    const { stdout } = await execFileAsync(
      "nvidia-smi",
      [
        "--query-gpu=name,memory.total,driver_version,utilization.gpu",
        "--format=csv,noheader,nounits",
      ],
      { timeout: EXEC_TIMEOUT_MS },
    );
    return stdout
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [name, vramMb, driver, utilization] = line.split(",").map((s) => s.trim());
        return {
          name: name ?? "Unknown NVIDIA GPU",
          vramBytes: Number(vramMb ?? 0) * 1024 * 1024,
          driver,
          cudaVersion: undefined, // Parsed separately if needed
          utilizationPercent: utilization ? Number(utilization) : undefined,
        };
      });
  } catch {
    return [];
  }
}

/** Detect GPUs on macOS via system_profiler. */
async function detectMacGpus(): Promise<GpuInfo[]> {
  try {
    const { stdout } = await execFileAsync("system_profiler", ["SPDisplaysDataType", "-json"], {
      timeout: EXEC_TIMEOUT_MS,
    });
    const data = JSON.parse(stdout) as {
      SPDisplaysDataType?: Array<{
        _name?: string;
        sppci_model?: string;
        spdisplays_vram?: string;
        spdisplays_vram_shared?: string;
      }>;
    };
    const displays = data.SPDisplaysDataType ?? [];
    return displays.map((d) => {
      const vramStr = d.spdisplays_vram ?? d.spdisplays_vram_shared ?? "0";
      const vramMatch = vramStr.match(/(\d+)/);
      const vramMb = vramMatch ? Number(vramMatch[1]) : 0;
      // On Apple Silicon, "shared" VRAM is reported — treat as unified memory
      const isMb = /MB/i.test(vramStr);
      const isGb = /GB/i.test(vramStr);
      const vramBytes = isGb ? vramMb * 1024 * 1024 * 1024 : isMb ? vramMb * 1024 * 1024 : vramMb;
      return {
        name: d.sppci_model ?? d._name ?? "Unknown GPU",
        vramBytes,
      };
    });
  } catch {
    return [];
  }
}

/** Check if Ollama is available and get its version. */
async function detectOllama(): Promise<{ available: boolean; version?: string }> {
  try {
    const { stdout } = await execFileAsync("ollama", ["--version"], {
      timeout: EXEC_TIMEOUT_MS,
    });
    const match = stdout.match(/(\d+\.\d+\.\d+)/);
    return { available: true, version: match?.[1] };
  } catch {
    // Also try the HTTP endpoint in case the CLI isn't on PATH
    try {
      const res = await fetch("http://127.0.0.1:11434/api/version", {
        signal: AbortSignal.timeout(3_000),
      });
      if (res.ok) {
        const body = (await res.json()) as { version?: string };
        return { available: true, version: body.version };
      }
    } catch {
      // Ollama not running
    }
    return { available: false };
  }
}

/** Detect the full hardware profile of the host. */
export async function detectHardware(): Promise<HardwareInfo> {
  const platform = process.platform;

  const [gpus, ollama] = await Promise.all([
    platform === "darwin" ? detectMacGpus() : detectNvidiaGpus(),
    detectOllama(),
  ]);

  return {
    gpus,
    totalRamBytes: os.totalmem(),
    availableRamBytes: os.freemem(),
    cpuCores: os.cpus().length,
    platform,
    arch: process.arch,
    ollamaAvailable: ollama.available,
    ollamaVersion: ollama.version,
  };
}

/** Format bytes as a human-readable string. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
