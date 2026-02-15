import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SshConfig = {
  host: string;
  user?: string;
  keyPath: string;
  timeoutMs?: number;
};

export type ExecResult = {
  stdout: string;
  stderr: string;
  code: number;
};

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createSshClient(config: SshConfig) {
  const user = config.user ?? "root";
  const timeoutSec = Math.floor((config.timeoutMs ?? 10_000) / 1000);
  const target = `${user}@${config.host}`;

  function sshBaseArgs(): string[] {
    return [
      "-o",
      "StrictHostKeyChecking=no",
      "-o",
      `ConnectTimeout=${timeoutSec}`,
      "-i",
      config.keyPath,
    ];
  }

  function runCommand(cmd: string, args: string[]): Promise<ExecResult> {
    return new Promise((resolve, reject) => {
      execFile(
        cmd,
        args,
        { timeout: (config.timeoutMs ?? 10_000) + 5000 },
        (err, stdout, stderr) => {
          if (err) {
            const code = (err as Error & { code?: number }).code;
            if (typeof code === "number") {
              resolve({ stdout: stdout ?? "", stderr: stderr ?? "", code });
            } else {
              reject(err);
            }
          } else {
            resolve({ stdout: stdout ?? "", stderr: stderr ?? "", code: 0 });
          }
        },
      );
    });
  }

  return {
    async exec(command: string): Promise<ExecResult> {
      const args = [...sshBaseArgs(), target, command];
      return runCommand("ssh", args);
    },

    async pushFile(localPath: string, remotePath: string): Promise<void> {
      const args = [...sshBaseArgs(), localPath, `${target}:${remotePath}`];
      await runCommand("scp", args);
    },

    async pushContent(content: string, remotePath: string): Promise<void> {
      const tmpFile = path.join(
        os.tmpdir(),
        `openclaw-ssh-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      );
      fs.writeFileSync(tmpFile, content);
      try {
        const args = [...sshBaseArgs(), tmpFile, `${target}:${remotePath}`];
        await runCommand("scp", args);
      } finally {
        fs.unlinkSync(tmpFile);
      }
    },

    async pullFile(remotePath: string, localPath: string): Promise<void> {
      const args = [...sshBaseArgs(), `${target}:${remotePath}`, localPath];
      await runCommand("scp", args);
    },

    async isReachable(): Promise<boolean> {
      try {
        const result = await runCommand("ssh", [...sshBaseArgs(), target, "true"]);
        return result.code === 0;
      } catch {
        return false;
      }
    },
  };
}
