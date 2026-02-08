import { afterEach, describe, expect, it, vi } from "vitest";
import { searchHuggingFaceModels, listHuggingFaceGgufFiles } from "../huggingface-client.js";

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

afterEach(() => {
  vi.restoreAllMocks();
  mockFetch.mockReset();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a fake HuggingFace API model result. */
function makeHfModel(overrides?: Record<string, unknown>) {
  return {
    _id: "abc123",
    id: "TheBloke/Llama-2-7B-GGUF",
    modelId: "TheBloke/Llama-2-7B-GGUF",
    author: "TheBloke",
    tags: ["gguf", "llama"],
    downloads: 50_000,
    library_name: "transformers",
    pipeline_tag: "text-generation",
    siblings: [
      { rfilename: "llama-2-7b.Q4_K_M.gguf", size: 4_000_000_000 },
      { rfilename: "llama-2-7b.F16.gguf", size: 14_000_000_000 },
      { rfilename: "README.md", size: 1_200 },
      { rfilename: "config.json", size: 500 },
    ],
    ...overrides,
  };
}

function okJson(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function errorResponse(status: number, statusText: string): Response {
  return new Response("error", { status, statusText });
}

// ---------------------------------------------------------------------------
// searchHuggingFaceModels
// ---------------------------------------------------------------------------

describe("searchHuggingFaceModels", () => {
  it("returns parsed results with id, name, and capabilities", async () => {
    mockFetch.mockResolvedValueOnce(okJson([makeHfModel()]));

    const results = await searchHuggingFaceModels("llama");

    expect(results).toHaveLength(1);
    const r = results[0];
    expect(r.id).toBe("hf:TheBloke/Llama-2-7B-GGUF");
    expect(r.source).toBe("huggingface");
    expect(r.name).toBe("TheBloke/Llama-2-7B-GGUF");
    expect(r.description).toBe("text-generation");
    expect(r.downloads).toBe(50_000);
    expect(Array.isArray(r.capabilities)).toBe(true);
    // capabilities is inferred from the name; at minimum should have chat
    expect(r.capabilities.length).toBeGreaterThan(0);
  });

  it("extracts quantization info from GGUF filenames (Q4_K_M, F16)", async () => {
    mockFetch.mockResolvedValueOnce(okJson([makeHfModel()]));

    const results = await searchHuggingFaceModels("llama");
    const r = results[0];
    expect(r.quantizations).toContain("Q4_K_M");
    expect(r.quantizations).toContain("F16");
  });

  it("deduplicates quantizations", async () => {
    const model = makeHfModel({
      siblings: [
        { rfilename: "model.Q4_K_M.gguf", size: 100 },
        { rfilename: "model-v2.Q4_K_M.gguf", size: 200 },
        { rfilename: "model.Q8_0.gguf", size: 300 },
      ],
    });
    mockFetch.mockResolvedValueOnce(okJson([model]));

    const results = await searchHuggingFaceModels("model");
    expect(results[0]?.quantizations).toEqual(["Q4_K_M", "Q8_0"]);
  });

  it("calculates total size from GGUF files only", async () => {
    mockFetch.mockResolvedValueOnce(okJson([makeHfModel()]));

    const results = await searchHuggingFaceModels("llama");
    // 4GB + 14GB from the two .gguf files, ignoring README.md and config.json
    expect(results[0]?.sizeBytes).toBe(4_000_000_000 + 14_000_000_000);
  });

  it("handles empty results", async () => {
    mockFetch.mockResolvedValueOnce(okJson([]));

    const results = await searchHuggingFaceModels("nonexistent-model");
    expect(results).toEqual([]);
  });

  it("throws on non-ok response (e.g. 500)", async () => {
    mockFetch.mockResolvedValueOnce(errorResponse(500, "Internal Server Error"));

    await expect(searchHuggingFaceModels("llama")).rejects.toThrow(
      /HuggingFace search failed: 500/,
    );
  });

  it("respects limit parameter", async () => {
    mockFetch.mockResolvedValueOnce(okJson([makeHfModel()]));

    await searchHuggingFaceModels("llama", { limit: 5 });

    const url = mockFetch.mock.calls[0]?.[0];
    expect(url).toContain("limit=5");
  });

  it("uses default limit of 20 when not specified", async () => {
    mockFetch.mockResolvedValueOnce(okJson([]));

    await searchHuggingFaceModels("llama");

    const url = mockFetch.mock.calls[0]?.[0];
    expect(url).toContain("limit=20");
  });

  it("sends correct query parameters", async () => {
    mockFetch.mockResolvedValueOnce(okJson([]));

    await searchHuggingFaceModels("codellama");

    const url = mockFetch.mock.calls[0]?.[0];
    expect(url).toContain("search=codellama");
    expect(url).toContain("filter=gguf");
    expect(url).toContain("sort=downloads");
    expect(url).toContain("direction=-1");
  });

  it("handles models with no siblings", async () => {
    const model = makeHfModel({ siblings: undefined });
    mockFetch.mockResolvedValueOnce(okJson([model]));

    const results = await searchHuggingFaceModels("test");
    expect(results[0]?.quantizations).toEqual([]);
    expect(results[0]?.sizeBytes).toBeUndefined();
  });

  it("handles GGUF files with no size", async () => {
    const model = makeHfModel({
      siblings: [{ rfilename: "model.Q4_K_M.gguf" }],
    });
    mockFetch.mockResolvedValueOnce(okJson([model]));

    const results = await searchHuggingFaceModels("test");
    // size is 0 from reduce, which becomes undefined (falsy)
    expect(results[0]?.sizeBytes).toBeUndefined();
  });

  it("handles GGUF files with unrecognized quantization patterns", async () => {
    const model = makeHfModel({
      siblings: [{ rfilename: "model-custom.gguf", size: 1000 }],
    });
    mockFetch.mockResolvedValueOnce(okJson([model]));

    const results = await searchHuggingFaceModels("test");
    // No quantization pattern found
    expect(results[0]?.quantizations).toEqual([]);
  });

  it("returns multiple results in order", async () => {
    const models = [
      makeHfModel({ id: "author/model-a", modelId: "author/model-a" }),
      makeHfModel({ id: "author/model-b", modelId: "author/model-b" }),
    ];
    mockFetch.mockResolvedValueOnce(okJson(models));

    const results = await searchHuggingFaceModels("model");
    expect(results).toHaveLength(2);
    expect(results[0]?.id).toBe("hf:author/model-a");
    expect(results[1]?.id).toBe("hf:author/model-b");
  });
});

// ---------------------------------------------------------------------------
// listHuggingFaceGgufFiles
// ---------------------------------------------------------------------------

describe("listHuggingFaceGgufFiles", () => {
  it("returns download URLs for GGUF files only", async () => {
    const model = makeHfModel();
    mockFetch.mockResolvedValueOnce(okJson(model));

    const files = await listHuggingFaceGgufFiles("TheBloke/Llama-2-7B-GGUF");

    expect(files).toHaveLength(2);
    expect(files[0]).toEqual({
      filename: "llama-2-7b.Q4_K_M.gguf",
      size: 4_000_000_000,
      downloadUrl:
        "https://huggingface.co/TheBloke/Llama-2-7B-GGUF/resolve/main/llama-2-7b.Q4_K_M.gguf",
    });
    expect(files[1]).toEqual({
      filename: "llama-2-7b.F16.gguf",
      size: 14_000_000_000,
      downloadUrl:
        "https://huggingface.co/TheBloke/Llama-2-7B-GGUF/resolve/main/llama-2-7b.F16.gguf",
    });
  });

  it("excludes non-GGUF files", async () => {
    const model = makeHfModel();
    mockFetch.mockResolvedValueOnce(okJson(model));

    const files = await listHuggingFaceGgufFiles("TheBloke/Llama-2-7B-GGUF");

    const filenames = files.map((f) => f.filename);
    expect(filenames).not.toContain("README.md");
    expect(filenames).not.toContain("config.json");
  });

  it("throws on non-ok response", async () => {
    mockFetch.mockResolvedValueOnce(errorResponse(404, "Not Found"));

    await expect(listHuggingFaceGgufFiles("nonexistent/repo")).rejects.toThrow(
      /HuggingFace model info failed: 404/,
    );
  });

  it("returns empty array when no GGUF files exist", async () => {
    const model = makeHfModel({
      siblings: [
        { rfilename: "README.md", size: 1_000 },
        { rfilename: "model.safetensors", size: 5_000_000_000 },
      ],
    });
    mockFetch.mockResolvedValueOnce(okJson(model));

    const files = await listHuggingFaceGgufFiles("author/safetensors-only");
    expect(files).toEqual([]);
  });

  it("returns empty array when siblings is undefined", async () => {
    const model = makeHfModel({ siblings: undefined });
    mockFetch.mockResolvedValueOnce(okJson(model));

    const files = await listHuggingFaceGgufFiles("author/no-siblings");
    expect(files).toEqual([]);
  });

  it("defaults size to 0 for files without size", async () => {
    const model = makeHfModel({
      siblings: [{ rfilename: "model.Q4_K_M.gguf" }],
    });
    mockFetch.mockResolvedValueOnce(okJson(model));

    const files = await listHuggingFaceGgufFiles("author/no-size");
    expect(files[0]?.size).toBe(0);
  });

  it("constructs correct API URL", async () => {
    const model = makeHfModel({ siblings: [] });
    mockFetch.mockResolvedValueOnce(okJson(model));

    await listHuggingFaceGgufFiles("TheBloke/Llama-2-7B-GGUF");

    const url = mockFetch.mock.calls[0]?.[0];
    expect(url).toBe("https://huggingface.co/api/models/TheBloke/Llama-2-7B-GGUF");
  });
});
