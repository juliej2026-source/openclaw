import type { NeuralGraphStateType } from "./state.js";

// ---------------------------------------------------------------------------
// Network operations node — station management, health, scanning
// ---------------------------------------------------------------------------

async function getNetworkScan() {
  const { fetchUdmSystemInfo, scanStations } =
    await import("../../../hive-mind/src/network-scanner.js");
  const [udm, stations] = await Promise.all([
    fetchUdmSystemInfo(process.env.UNIFI_HOST ?? "10.1.7.1"),
    scanStations(3001),
  ]);
  return { timestamp: new Date().toISOString(), udm, stations };
}

export async function networkOps(
  state: NeuralGraphStateType,
): Promise<Partial<NeuralGraphStateType>> {
  const start = Date.now();
  const nodeId = "network_ops";

  try {
    const scan = await getNetworkScan();

    return {
      nodesVisited: [nodeId],
      nodeLatencies: { [nodeId]: Date.now() - start },
      result: scan,
      success: true,
    };
  } catch (err) {
    return {
      nodesVisited: [nodeId],
      nodeLatencies: { [nodeId]: Date.now() - start },
      error: err instanceof Error ? err.message : String(err),
      success: false,
    };
  }
}
