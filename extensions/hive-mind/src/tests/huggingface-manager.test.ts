import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { HuggingFaceManager, loadHfToken } from "../huggingface-manager.js";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  mockFetch.mockReset();
});

describe("loadHfToken", () => {
  const originalEnv = process.env.HF_TOKEN;
  const originalHome = process.env.HOME;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "hf-token-test-"));
    delete process.env.HF_TOKEN;
    process.env.HOME = tmpDir;
  });

  afterEach(() => {
    if (originalEnv !== undefined) process.env.HF_TOKEN = originalEnv;
    else delete process.env.HF_TOKEN;
    process.env.HOME = originalHome;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns HF_TOKEN from environment", () => {
    process.env.HF_TOKEN = "hf_env_token_123";
    expect(loadHfToken()).toBe("hf_env_token_123");
  });

  it("reads token from ~/.cache/huggingface/token", () => {
    const tokenDir = path.join(tmpDir, ".cache", "huggingface");
    fs.mkdirSync(tokenDir, { recursive: true });
    fs.writeFileSync(path.join(tokenDir, "token"), "hf_cached_token_456\n");
    expect(loadHfToken()).toBe("hf_cached_token_456");
  });

  it("throws when no token is available", () => {
    expect(() => loadHfToken()).toThrow("HF token not found");
  });

  it("prefers HF_TOKEN env over cached file", () => {
    process.env.HF_TOKEN = "hf_env_wins";
    const tokenDir = path.join(tmpDir, ".cache", "huggingface");
    fs.mkdirSync(tokenDir, { recursive: true });
    fs.writeFileSync(path.join(tokenDir, "token"), "hf_cached");
    expect(loadHfToken()).toBe("hf_env_wins");
  });
});

describe("HuggingFaceManager", () => {
  const mgr = new HuggingFaceManager({ token: "hf_test_token" });

  describe("getWhoAmI", () => {
    it("returns user info", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ name: "testuser" }));
      const result = await mgr.getWhoAmI();
      expect(result.name).toBe("testuser");
      expect(mockFetch).toHaveBeenCalledWith(
        "https://huggingface.co/api/whoami-v2",
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: "Bearer hf_test_token" }),
        }),
      );
    });
  });

  describe("listSpaces", () => {
    it("returns spaces list", async () => {
      const spaces = [{ id: "user/space1", author: "user", lastModified: "2026-01-01" }];
      mockFetch.mockResolvedValueOnce(jsonResponse(spaces));
      const result = await mgr.listSpaces({ author: "user", limit: 5 });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("user/space1");
      expect(mockFetch.mock.calls[0][0]).toContain("author=user");
      expect(mockFetch.mock.calls[0][0]).toContain("limit=5");
    });

    it("works without options", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse([]));
      const result = await mgr.listSpaces();
      expect(result).toEqual([]);
      expect(mockFetch.mock.calls[0][0]).toBe("https://huggingface.co/api/spaces");
    });
  });

  describe("getSpaceInfo", () => {
    it("returns space details", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ id: "user/myspace", sdk: "gradio" }));
      const result = await mgr.getSpaceInfo("user/myspace");
      expect(result.id).toBe("user/myspace");
    });
  });

  describe("listDatasets", () => {
    it("returns datasets list", async () => {
      const datasets = [{ id: "user/ds1", author: "user", lastModified: "2026-01-01" }];
      mockFetch.mockResolvedValueOnce(jsonResponse(datasets));
      const result = await mgr.listDatasets({ author: "user" });
      expect(result).toHaveLength(1);
    });
  });

  describe("getDatasetInfo", () => {
    it("returns dataset details", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ id: "user/ds1", downloads: 100 }));
      const result = await mgr.getDatasetInfo("user/ds1");
      expect(result.id).toBe("user/ds1");
    });
  });

  describe("listModels", () => {
    it("returns models list", async () => {
      const models = [{ id: "user/model1", downloads: 500 }];
      mockFetch.mockResolvedValueOnce(jsonResponse(models));
      const result = await mgr.listModels({ author: "user" });
      expect(result).toHaveLength(1);
    });
  });

  describe("getModelInfo", () => {
    it("returns model details", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ id: "user/model1", pipeline_tag: "text-generation" }),
      );
      const result = await mgr.getModelInfo("user/model1");
      expect(result.pipeline_tag).toBe("text-generation");
    });
  });

  describe("listJobs", () => {
    it("returns jobs list", async () => {
      const jobs = [{ id: "job-1", status: "running" }];
      mockFetch.mockResolvedValueOnce(jsonResponse(jobs));
      const result = await mgr.listJobs();
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe("running");
    });
  });

  describe("getJobInfo", () => {
    it("returns job details", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ id: "job-1", status: "completed" }));
      const result = await mgr.getJobInfo("job-1");
      expect(result.status).toBe("completed");
    });
  });

  describe("isAvailable", () => {
    it("returns true when API is reachable", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ name: "testuser" }));
      expect(await mgr.isAvailable()).toBe(true);
    });

    it("returns false when API fails", async () => {
      mockFetch.mockRejectedValueOnce(new Error("network error"));
      expect(await mgr.isAvailable()).toBe(false);
    });
  });

  describe("error handling", () => {
    it("throws on non-OK response", async () => {
      mockFetch.mockResolvedValueOnce(new Response("Unauthorized", { status: 401 }));
      await expect(mgr.listSpaces()).rejects.toThrow("HF API error: 401");
    });
  });
});
