import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createSshClient, type SshConfig } from "../cloud-ssh.js";

// ---------------------------------------------------------------------------
// Mock child_process.execFile
// ---------------------------------------------------------------------------

const mockExecFile = vi.fn();

vi.mock("node:child_process", () => ({
  execFile: (...args: unknown[]) => mockExecFile(...args),
}));

// Mock fs for pushContent temp file
const mockWriteFileSync = vi.fn();
const mockUnlinkSync = vi.fn();

vi.mock("node:fs", () => ({
  default: {
    writeFileSync: (...args: unknown[]) => mockWriteFileSync(...args),
    unlinkSync: (...args: unknown[]) => mockUnlinkSync(...args),
    chmodSync: vi.fn(),
  },
  writeFileSync: (...args: unknown[]) => mockWriteFileSync(...args),
  unlinkSync: (...args: unknown[]) => mockUnlinkSync(...args),
  chmodSync: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_CONFIG: SshConfig = {
  host: "47.88.1.100",
  keyPath: "/home/admin/.ssh/openclaw-ecs.pem",
};

function simulateExecFile(stdout: string, stderr = "", code = 0) {
  mockExecFile.mockImplementationOnce(
    (
      _cmd: string,
      _args: string[],
      _opts: unknown,
      cb: (err: Error | null, stdout: string, stderr: string) => void,
    ) => {
      if (code !== 0) {
        const err = new Error(`exit code ${code}`) as Error & { code: number };
        err.code = code;
        cb(err, stdout, stderr);
      } else {
        cb(null, stdout, stderr);
      }
    },
  );
}

function simulateExecFileError(message: string) {
  mockExecFile.mockImplementationOnce(
    (
      _cmd: string,
      _args: string[],
      _opts: unknown,
      cb: (err: Error | null, stdout: string, stderr: string) => void,
    ) => {
      cb(new Error(message), "", "");
    },
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockExecFile.mockReset();
  mockWriteFileSync.mockReset();
  mockUnlinkSync.mockReset();
});

describe("createSshClient", () => {
  describe("exec", () => {
    it("runs ssh command with correct arguments", async () => {
      simulateExecFile("hello world\n");

      const client = createSshClient(TEST_CONFIG);
      const result = await client.exec("echo hello world");

      expect(result.stdout).toBe("hello world\n");
      expect(result.stderr).toBe("");
      expect(result.code).toBe(0);

      const [cmd, args] = mockExecFile.mock.calls[0]!;
      expect(cmd).toBe("ssh");
      expect(args).toContain("-o");
      expect(args).toContain("StrictHostKeyChecking=no");
      expect(args).toContain("-i");
      expect(args).toContain("/home/admin/.ssh/openclaw-ecs.pem");
      expect(args).toContain("root@47.88.1.100");
      expect(args).toContain("echo hello world");
    });

    it("uses default user root", async () => {
      simulateExecFile("ok");

      const client = createSshClient({ host: "1.2.3.4", keyPath: "/tmp/key.pem" });
      await client.exec("uptime");

      const [, args] = mockExecFile.mock.calls[0]!;
      expect(args).toContain("root@1.2.3.4");
    });

    it("uses custom user when provided", async () => {
      simulateExecFile("ok");

      const client = createSshClient({ host: "1.2.3.4", keyPath: "/tmp/key.pem", user: "admin" });
      await client.exec("ls");

      const [, args] = mockExecFile.mock.calls[0]!;
      expect(args).toContain("admin@1.2.3.4");
    });

    it("passes ConnectTimeout option", async () => {
      simulateExecFile("ok");

      const client = createSshClient({ ...TEST_CONFIG, timeoutMs: 5000 });
      await client.exec("whoami");

      const [, args] = mockExecFile.mock.calls[0]!;
      expect(args).toContain("ConnectTimeout=5");
    });

    it("defaults ConnectTimeout to 10 seconds", async () => {
      simulateExecFile("ok");

      const client = createSshClient(TEST_CONFIG);
      await client.exec("pwd");

      const [, args] = mockExecFile.mock.calls[0]!;
      expect(args).toContain("ConnectTimeout=10");
    });

    it("returns stderr and non-zero code on error", async () => {
      simulateExecFile("", "command not found", 127);

      const client = createSshClient(TEST_CONFIG);
      const result = await client.exec("badcmd");

      expect(result.code).toBe(127);
      expect(result.stderr).toBe("command not found");
    });

    it("rejects on connection error", async () => {
      simulateExecFileError("ECONNREFUSED");

      const client = createSshClient(TEST_CONFIG);
      await expect(client.exec("ls")).rejects.toThrow("ECONNREFUSED");
    });
  });

  describe("pushFile", () => {
    it("runs scp with correct source and destination", async () => {
      simulateExecFile("");

      const client = createSshClient(TEST_CONFIG);
      await client.pushFile("/tmp/index.html", "/var/www/html/index.html");

      const [cmd, args] = mockExecFile.mock.calls[0]!;
      expect(cmd).toBe("scp");
      expect(args).toContain("-o");
      expect(args).toContain("StrictHostKeyChecking=no");
      expect(args).toContain("-i");
      expect(args).toContain("/home/admin/.ssh/openclaw-ecs.pem");
      expect(args).toContain("/tmp/index.html");
      expect(args).toContain("root@47.88.1.100:/var/www/html/index.html");
    });

    it("throws on scp failure", async () => {
      simulateExecFileError("Permission denied");

      const client = createSshClient(TEST_CONFIG);
      await expect(client.pushFile("/tmp/file.txt", "/root/file.txt")).rejects.toThrow(
        "Permission denied",
      );
    });
  });

  describe("pushContent", () => {
    it("writes temp file, SCPs it, then cleans up", async () => {
      simulateExecFile(""); // scp call

      const client = createSshClient(TEST_CONFIG);
      await client.pushContent("<h1>Hello</h1>", "/var/www/html/index.html");

      // Should have written a temp file
      expect(mockWriteFileSync).toHaveBeenCalledTimes(1);
      const [tmpPath, content] = mockWriteFileSync.mock.calls[0]!;
      expect(content).toBe("<h1>Hello</h1>");
      expect(typeof tmpPath).toBe("string");

      // Should have cleaned up
      expect(mockUnlinkSync).toHaveBeenCalledTimes(1);
      expect(mockUnlinkSync.mock.calls[0]![0]).toBe(tmpPath);

      // SCP should have been called with temp file path
      const [, scpArgs] = mockExecFile.mock.calls[0]!;
      expect(scpArgs).toContain(tmpPath);
      expect(scpArgs).toContain("root@47.88.1.100:/var/www/html/index.html");
    });

    it("cleans up temp file even on SCP failure", async () => {
      simulateExecFileError("network error");

      const client = createSshClient(TEST_CONFIG);
      await expect(client.pushContent("data", "/remote/path")).rejects.toThrow("network error");

      // Temp file should still be cleaned up
      expect(mockUnlinkSync).toHaveBeenCalledTimes(1);
    });
  });

  describe("pullFile", () => {
    it("runs scp in reverse direction", async () => {
      simulateExecFile("");

      const client = createSshClient(TEST_CONFIG);
      await client.pullFile("/var/log/httpd/error_log", "/tmp/error.log");

      const [cmd, args] = mockExecFile.mock.calls[0]!;
      expect(cmd).toBe("scp");
      expect(args).toContain("root@47.88.1.100:/var/log/httpd/error_log");
      expect(args).toContain("/tmp/error.log");
    });
  });

  describe("isReachable", () => {
    it("returns true on successful SSH connection", async () => {
      simulateExecFile("");

      const client = createSshClient(TEST_CONFIG);
      const result = await client.isReachable();

      expect(result).toBe(true);

      const [, args] = mockExecFile.mock.calls[0]!;
      expect(args).toContain("true"); // ssh ... root@host true
    });

    it("returns false on connection refused", async () => {
      simulateExecFileError("ECONNREFUSED");

      const client = createSshClient(TEST_CONFIG);
      const result = await client.isReachable();

      expect(result).toBe(false);
    });

    it("returns false on non-zero exit code", async () => {
      simulateExecFile("", "error", 255);

      const client = createSshClient(TEST_CONFIG);
      const result = await client.isReachable();

      expect(result).toBe(false);
    });
  });
});
