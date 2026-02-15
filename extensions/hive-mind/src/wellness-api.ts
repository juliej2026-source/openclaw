import type http from "node:http";

// ---------------------------------------------------------------------------
// Wellness Concierge API handlers — proxies to wellness-concierge extension
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

export async function handleWellnessStatus(
  _req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  try {
    const mod = await import("../../wellness-concierge/src/api-handlers.js");
    const data = await mod.handleWellnessStatus();
    json(res, data);
  } catch (err: any) {
    json(res, { status: "ok", phase: "scaffold", error: err.message });
  }
}

export async function handleWellnessQuery(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  try {
    const body = await parseBody(req);
    const mod = await import("../../wellness-concierge/src/api-handlers.js");
    const data = await mod.handleWellnessQuery(body);
    json(res, data, data.status ?? 200);
  } catch (err: any) {
    json(res, { error: err.message }, 500);
  }
}

export async function handleWellnessSessions(
  _req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  try {
    const mod = await import("../../wellness-concierge/src/api-handlers.js");
    const data = await mod.handleWellnessSessions();
    json(res, data);
  } catch (err: any) {
    json(res, { sessions: [], error: err.message });
  }
}

export async function handleWellnessConsent(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  try {
    const body = await parseBody(req);
    const mod = await import("../../wellness-concierge/src/api-handlers.js");
    const data = await mod.handleWellnessConsent(body);
    json(res, data, data.status ?? 200);
  } catch (err: any) {
    json(res, { error: err.message }, 500);
  }
}

export async function handleWellnessAgents(
  _req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  try {
    const mod = await import("../../wellness-concierge/src/api-handlers.js");
    const data = await mod.handleWellnessAgents();
    json(res, data);
  } catch (err: any) {
    json(res, { agents: [], error: err.message });
  }
}

export async function handleWellnessTools(
  _req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  try {
    const mod = await import("../../wellness-concierge/src/api-handlers.js");
    const data = await mod.handleWellnessTools();
    json(res, data);
  } catch (err: any) {
    json(res, { tools: [], error: err.message });
  }
}

export async function handleWellnessAudit(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  try {
    const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
    const limit = parseInt(url.searchParams.get("limit") ?? "50", 10);
    const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);
    const mod = await import("../../wellness-concierge/src/api-handlers.js");
    const data = await mod.handleWellnessAudit({ limit, offset });
    json(res, data);
  } catch (err: any) {
    json(res, { entries: [], error: err.message });
  }
}

export async function handleWellnessCapa(
  _req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  try {
    const mod = await import("../../wellness-concierge/src/api-handlers.js");
    const data = await mod.handleWellnessCapa();
    json(res, data);
  } catch (err: any) {
    json(res, { findings: [], error: err.message });
  }
}

export async function handleWellnessEscalate(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  try {
    const body = await parseBody(req);
    const mod = await import("../../wellness-concierge/src/api-handlers.js");
    const data = await mod.handleWellnessEscalate(body);
    json(res, data, data.status ?? 200);
  } catch (err: any) {
    json(res, { error: err.message }, 500);
  }
}

export async function handleWellnessMetrics(
  _req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  try {
    const mod = await import("../../wellness-concierge/src/api-handlers.js");
    const data = await mod.handleWellnessMetrics();
    text(res, data as string);
  } catch (err: any) {
    text(res, `# error: ${err.message}\n`);
  }
}
