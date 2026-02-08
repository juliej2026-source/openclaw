import fs from "node:fs";
import path from "node:path";
import type { JuliaClient } from "./julia-client.js";
import { buildStationIdentity } from "./station-identity.js";
import { REGISTRATION_INTERVAL_MS } from "./types.js";

type ServiceContext = {
  config: unknown;
  stateDir: string;
  logger: {
    info: (msg: string) => void;
    warn?: (msg: string) => void;
    error?: (msg: string) => void;
    debug?: (msg: string) => void;
  };
};

function saveState(stateDir: string, data: Record<string, unknown>): void {
  fs.mkdirSync(stateDir, { recursive: true });
  const existing = loadState(stateDir);
  const merged = { ...existing, ...data };
  fs.writeFileSync(path.join(stateDir, "state.json"), JSON.stringify(merged, null, 2));
}

function loadState(stateDir: string): Record<string, unknown> {
  try {
    const raw = fs.readFileSync(path.join(stateDir, "state.json"), "utf-8");
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function createRegistrationService(juliaClient: JuliaClient) {
  let intervalId: ReturnType<typeof setInterval> | undefined;

  return {
    id: "hive-mind-registration",

    async start(ctx: ServiceContext) {
      const doRegister = async () => {
        try {
          const identity = buildStationIdentity();
          await juliaClient.register(identity);
          saveState(ctx.stateDir, {
            last_registered: new Date().toISOString(),
          });
          ctx.logger.info("Hive-Mind: registered with JULIA");
        } catch (err) {
          ctx.logger.warn?.(
            `Hive-Mind: registration failed: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      };

      await doRegister();
      intervalId = setInterval(doRegister, REGISTRATION_INTERVAL_MS);
    },

    stop(_ctx?: ServiceContext) {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = undefined;
      }
    },
  };
}
