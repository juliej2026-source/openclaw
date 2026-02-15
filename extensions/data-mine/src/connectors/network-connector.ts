// ---------------------------------------------------------------------------
// Network Connector — Read telemetry from hive-mind extension
// ---------------------------------------------------------------------------

import type { DataSeries } from "../types.js";

export async function getNetworkTelemetry(): Promise<DataSeries[]> {
  return getMockNetworkTelemetry();
}

function getMockNetworkTelemetry(): DataSeries[] {
  const now = Date.now();
  const hour = 3_600_000;

  return [
    {
      id: "net-latency",
      name: "Network Latency (ms)",
      source: "network",
      points: Array.from({ length: 24 }, (_, i) => ({
        timestamp: now - (23 - i) * hour,
        value: 5 + Math.random() * 10,
      })),
      unit: "ms",
    },
    {
      id: "net-devices",
      name: "Connected Devices",
      source: "network",
      points: Array.from({ length: 24 }, (_, i) => ({
        timestamp: now - (23 - i) * hour,
        value: Math.floor(30 + Math.random() * 15),
      })),
      unit: "count",
    },
  ];
}
