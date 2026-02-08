import { describe, it, expect, beforeEach, vi } from "vitest";
import type { ExecutionLog } from "../execution-log.js";
import type { JuliaClient } from "../julia-client.js";
import { createExecutionReporter } from "../execution-reporter.js";

// Injected mock classifier — avoids dynamic import mocking issues
const mockClassifyTask = vi.fn().mockReturnValue({
  primary: "coding",
  secondary: [],
  confidence: 0.8,
  contextLengthEstimate: 50,
  requiresVision: false,
  requiresToolUse: false,
  complexity: "moderate",
});

function mockJuliaClient(): JuliaClient {
  return {
    register: vi.fn().mockResolvedValue({ success: true }),
    reportExecution: vi.fn().mockResolvedValue({ received: true }),
    isAvailable: vi.fn().mockResolvedValue(true),
  } as unknown as JuliaClient;
}

function mockExecutionLog(): ExecutionLog {
  return {
    record: vi.fn(),
    getRecent: vi.fn().mockReturnValue([]),
    totalEntries: 0,
    reset: vi.fn(),
  } as unknown as ExecutionLog;
}

describe("createExecutionReporter", () => {
  let client: JuliaClient;
  let log: ExecutionLog;

  beforeEach(() => {
    client = mockJuliaClient();
    log = mockExecutionLog();
    mockClassifyTask.mockClear();
  });

  it("returns a function", () => {
    const reporter = createExecutionReporter(client, log, {
      classifyTask: mockClassifyTask,
    });
    expect(typeof reporter).toBe("function");
  });

  it("reports execution to JULIA on agent_end", async () => {
    const reporter = createExecutionReporter(client, log, {
      classifyTask: mockClassifyTask,
    });
    const event = {
      success: true,
      durationMs: 250,
      messages: [
        { role: "user", content: "Write a Python script to parse CSV" },
        { role: "assistant", content: "Here's a script..." },
      ],
    };

    await reporter(event as never, {} as never);

    expect(client.reportExecution).toHaveBeenCalledOnce();
    const call = (client.reportExecution as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(call).toHaveProperty("station_id", "iot-hub");
    expect(call).toHaveProperty("task_type", "coding");
    expect(call).toHaveProperty("success", true);
    expect(call).toHaveProperty("latency_ms", 250);
  });

  it("logs execution locally", async () => {
    const reporter = createExecutionReporter(client, log, {
      classifyTask: mockClassifyTask,
    });
    const event = {
      success: true,
      durationMs: 100,
      messages: [{ role: "user", content: "Hello" }],
    };

    await reporter(event as never, {} as never);

    expect(log.record).toHaveBeenCalledOnce();
    const entry = (log.record as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(entry).toHaveProperty("task_type", "coding");
    expect(entry).toHaveProperty("success", true);
  });

  it("silently handles JULIA reporting failure", async () => {
    const failClient = mockJuliaClient();
    (failClient.reportExecution as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("ECONNREFUSED"),
    );
    const reporter = createExecutionReporter(failClient, log, {
      classifyTask: mockClassifyTask,
    });
    const event = {
      success: true,
      durationMs: 100,
      messages: [{ role: "user", content: "test" }],
    };

    // Should not throw
    await reporter(event as never, {} as never);

    // Still logs locally
    expect(log.record).toHaveBeenCalledOnce();
    const entry = (log.record as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(entry.reported_to_julia).toBe(false);
  });

  it("marks reported_to_julia true on success", async () => {
    const reporter = createExecutionReporter(client, log, {
      classifyTask: mockClassifyTask,
    });
    const event = {
      success: true,
      durationMs: 100,
      messages: [{ role: "user", content: "test" }],
    };

    await reporter(event as never, {} as never);

    const entry = (log.record as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(entry.reported_to_julia).toBe(true);
  });

  it("skips reporting when no user message found", async () => {
    const reporter = createExecutionReporter(client, log, {
      classifyTask: mockClassifyTask,
    });
    const event = {
      success: true,
      durationMs: 100,
      messages: [],
    };

    await reporter(event as never, {} as never);

    expect(client.reportExecution).not.toHaveBeenCalled();
    expect(log.record).not.toHaveBeenCalled();
  });

  it("handles failed agent runs", async () => {
    const reporter = createExecutionReporter(client, log, {
      classifyTask: mockClassifyTask,
    });
    const event = {
      success: false,
      durationMs: 500,
      messages: [{ role: "user", content: "Do something complex" }],
    };

    await reporter(event as never, {} as never);

    const call = (client.reportExecution as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(call.success).toBe(false);
    expect(call.latency_ms).toBe(500);
  });

  it("calls classifyTask with user message", async () => {
    const reporter = createExecutionReporter(client, log, {
      classifyTask: mockClassifyTask,
    });
    const event = {
      success: true,
      durationMs: 50,
      messages: [{ role: "user", content: "Analyze this data" }],
    };

    await reporter(event as never, {} as never);

    expect(mockClassifyTask).toHaveBeenCalledWith("Analyze this data");
  });
});
