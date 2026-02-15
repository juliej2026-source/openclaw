import { describe, it, expect, beforeEach, vi } from "vitest";
import type { ExecutionLog } from "../execution-log.js";
import type { JulieClient } from "../julie-client.js";
import { createExecutionReporter, inferCapabilitiesUsed } from "../execution-reporter.js";

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

function mockJulieClient(): JulieClient {
  return {
    register: vi.fn().mockResolvedValue({ success: true }),
    reportExecution: vi.fn().mockResolvedValue({ received: true }),
    isAvailable: vi.fn().mockResolvedValue(true),
  } as unknown as JulieClient;
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
  let client: JulieClient;
  let log: ExecutionLog;

  beforeEach(() => {
    client = mockJulieClient();
    log = mockExecutionLog();
    mockClassifyTask.mockClear();
  });

  it("returns a function", () => {
    const reporter = createExecutionReporter(client, log, {
      classifyTask: mockClassifyTask,
    });
    expect(typeof reporter).toBe("function");
  });

  it("reports execution to Julie on agent_end", async () => {
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

  it("silently handles Julie reporting failure", async () => {
    const failClient = mockJulieClient();
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
    expect(entry.reported_to_julie).toBe(false);
  });

  it("marks reported_to_julie true on success", async () => {
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
    expect(entry.reported_to_julie).toBe(true);
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

describe("inferCapabilitiesUsed", () => {
  it("maps meta:classify to task_classification", () => {
    expect(inferCapabilitiesUsed("meta:classify")).toContain("task_classification");
  });

  it("maps meta:recommend to task_classification", () => {
    expect(inferCapabilitiesUsed("meta:recommend")).toContain("task_classification");
  });

  it("maps meta:hardware to model_management + hardware_detection", () => {
    const caps = inferCapabilitiesUsed("meta:hardware");
    expect(caps).toContain("model_management");
    expect(caps).toContain("hardware_detection");
  });

  it("maps meta:train to model_training", () => {
    expect(inferCapabilitiesUsed("meta:train")).toContain("model_training");
  });

  it("maps network:scan to network_monitoring", () => {
    expect(inferCapabilitiesUsed("network:scan")).toContain("network_monitoring");
  });

  it("maps network:switch to network_control + dual_wan", () => {
    const caps = inferCapabilitiesUsed("network:switch");
    expect(caps).toContain("network_control");
    expect(caps).toContain("dual_wan");
  });

  it("maps network:alerts to alert_management", () => {
    expect(inferCapabilitiesUsed("network:alert")).toContain("alert_management");
  });

  it("maps unifi: to network_monitoring", () => {
    expect(inferCapabilitiesUsed("unifi:devices")).toContain("network_monitoring");
  });

  it("maps neural: to neural_graph", () => {
    expect(inferCapabilitiesUsed("neural:status")).toContain("neural_graph");
  });

  it("maps hf: to huggingface_management", () => {
    expect(inferCapabilitiesUsed("hf:spaces")).toContain("huggingface_management");
  });

  it("falls back to command name for unknown commands", () => {
    expect(inferCapabilitiesUsed("ping")).toEqual(["ping"]);
  });
});
