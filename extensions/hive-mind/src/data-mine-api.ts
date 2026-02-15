import type http from "node:http";

// ---------------------------------------------------------------------------
// Data Mine API handlers — proxies to data-mine extension
// ---------------------------------------------------------------------------

function json(res: http.ServerResponse, data: unknown, status = 200): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

function text(res: http.ServerResponse, data: string, status = 200): void {
  res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(data);
}

async function parseBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk: Buffer) => (body += chunk.toString()));
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
    req.on("error", reject);
  });
}

function parseQuery(req: http.IncomingMessage): Record<string, string> {
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
  const query: Record<string, string> = {};
  for (const [k, v] of url.searchParams) {
    query[k] = v;
  }
  return query;
}

export async function handleDataMineStatus(
  _req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  try {
    const mod = await import("../../data-mine/src/api-handlers.js");
    const data = await mod.handleDataMineStatus();
    json(res, data);
  } catch (err: any) {
    json(res, { status: "ok", phase: "scaffold", error: err.message });
  }
}

export async function handleDataMineAnalyze(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  try {
    const body = await parseBody(req);
    const mod = await import("../../data-mine/src/api-handlers.js");
    const data = await mod.handleAnalyze(body);
    json(res, data, (data as any).status ?? 200);
  } catch (err: any) {
    json(res, { error: err.message }, 500);
  }
}

export async function handleDataMineResults(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  try {
    const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
    const pathParts = url.pathname.split("/");
    const id = pathParts[pathParts.length - 1];

    // If last segment looks like an ID (not "results"), fetch single result
    if (id && id !== "results") {
      const mod = await import("../../data-mine/src/api-handlers.js");
      const data = await mod.handleGetResult(id);
      json(res, data, (data as any).status ?? 200);
      return;
    }

    const limit = parseInt(url.searchParams.get("limit") ?? "50", 10);
    const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);
    const mod = await import("../../data-mine/src/api-handlers.js");
    const data = await mod.handleListResults({ limit, offset });
    json(res, data);
  } catch (err: any) {
    json(res, { results: [], error: err.message });
  }
}

export async function handleDataMineDatasets(
  _req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  try {
    const mod = await import("../../data-mine/src/api-handlers.js");
    const data = await mod.handleListDatasets();
    json(res, data);
  } catch (err: any) {
    json(res, { datasets: [], error: err.message });
  }
}

export async function handleDataMineImport(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  try {
    const body = await parseBody(req);
    const mod = await import("../../data-mine/src/api-handlers.js");
    const data = await mod.handleImportDataset(body);
    json(res, data, (data as any).status ?? 200);
  } catch (err: any) {
    json(res, { error: err.message }, 500);
  }
}

export async function handleDataMineStats(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  try {
    const query = parseQuery(req);
    const mod = await import("../../data-mine/src/api-handlers.js");
    const data = await mod.handleStats(query);
    json(res, data);
  } catch (err: any) {
    json(res, { error: err.message });
  }
}

export async function handleDataMineCorrelations(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  try {
    const query = parseQuery(req);
    const mod = await import("../../data-mine/src/api-handlers.js");
    const data = await mod.handleCorrelations(query);
    json(res, data);
  } catch (err: any) {
    json(res, { error: err.message });
  }
}

export async function handleDataMineTimeseries(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  try {
    const query = parseQuery(req);
    const mod = await import("../../data-mine/src/api-handlers.js");
    const data = await mod.handleTimeseries(query);
    json(res, data);
  } catch (err: any) {
    json(res, { error: err.message });
  }
}

export async function handleDataMineClusters(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  try {
    const query = parseQuery(req);
    const mod = await import("../../data-mine/src/api-handlers.js");
    const data = await mod.handleClusters({
      ...query,
      k: query.k ? parseInt(query.k, 10) : undefined,
    } as any);
    json(res, data);
  } catch (err: any) {
    json(res, { error: err.message });
  }
}

export async function handleDataMineAnomalies(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  try {
    const query = parseQuery(req);
    const mod = await import("../../data-mine/src/api-handlers.js");
    const data = await mod.handleAnomalies({
      ...query,
      threshold: query.threshold ? parseFloat(query.threshold) : undefined,
    } as any);
    json(res, data);
  } catch (err: any) {
    json(res, { error: err.message });
  }
}

export async function handleDataMineGraph(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  try {
    const query = parseQuery(req);
    const mod = await import("../../data-mine/src/api-handlers.js");
    const data = await mod.handleGraph(query);
    json(res, data);
  } catch (err: any) {
    json(res, { error: err.message });
  }
}

export async function handleDataMineCreateExperiment(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  try {
    const body = await parseBody(req);
    const mod = await import("../../data-mine/src/api-handlers.js");
    const data = await mod.handleCreateExperiment(body);
    json(res, data, (data as any).status ?? 200);
  } catch (err: any) {
    json(res, { error: err.message }, 500);
  }
}

export async function handleDataMineExperiments(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  try {
    const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
    const pathParts = url.pathname.split("/");
    const id = pathParts[pathParts.length - 1];

    if (id && id !== "experiments") {
      const mod = await import("../../data-mine/src/api-handlers.js");
      const data = await mod.handleGetExperiment(id);
      json(res, data, (data as any).status ?? 200);
      return;
    }

    const mod = await import("../../data-mine/src/api-handlers.js");
    const data = await mod.handleListExperiments();
    json(res, data);
  } catch (err: any) {
    json(res, { experiments: [], error: err.message });
  }
}

export async function handleDataMineMetrics(
  _req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  try {
    const mod = await import("../../data-mine/src/api-handlers.js");
    const data = await mod.handleDataMineMetrics();
    text(res, data as string);
  } catch (err: any) {
    text(res, `# error: ${err.message}\n`);
  }
}
