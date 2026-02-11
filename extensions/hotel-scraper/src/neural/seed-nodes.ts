// ---------------------------------------------------------------------------
// Neural graph node seeding for hotel-scraper
// Pattern: neural-graph/src/maturation/lifecycle.ts seedGenesis()
// ---------------------------------------------------------------------------

import type { HotelSource } from "../types.js";

type HotelScraperNode = {
  nodeId: string;
  nodeType: "capability" | "data_source";
  name: string;
  description: string;
  capabilities: string[];
};

type HotelScraperEdge = {
  sourceNodeId: string;
  targetNodeId: string;
  edgeType: "data_flow" | "activation" | "monitoring";
};

const HOTEL_SCRAPER_NODES: HotelScraperNode[] = [
  {
    nodeId: "hotel-scraper",
    nodeType: "capability",
    name: "Hotel Scraper Coordinator",
    description:
      "Orchestrates 5 data sources for Niseko hotel price comparison — scheduling, entity resolution, dedup",
    capabilities: ["web_scraping", "price_comparison", "data_collection", "entity_resolution"],
  },
  {
    nodeId: "scraper-ratehawk",
    nodeType: "data_source",
    name: "RateHawk API",
    description: "GPS-based hotel search via RateHawk API — all 4 Niseko areas",
    capabilities: ["api_integration", "hotel_rates"],
  },
  {
    nodeId: "scraper-google-hotels",
    nodeType: "data_source",
    name: "Google Hotels (Apify)",
    description: "Google Hotels price data via Apify FREE actor",
    capabilities: ["api_integration", "hotel_rates", "ota_scraping"],
  },
  {
    nodeId: "scraper-nisade",
    nodeType: "data_source",
    name: "nisade.com",
    description: "Niseko accommodation portal — HTML scraping + API fallback",
    capabilities: ["web_scraping", "html_parsing"],
  },
  {
    nodeId: "scraper-playwright",
    nodeType: "data_source",
    name: "Official Hotel Sites",
    description: "Booking engine detection + CSS selector extraction via Playwright service",
    capabilities: ["web_scraping", "browser_automation", "booking_engine_detection"],
  },
  {
    nodeId: "scraper-roomboss",
    nodeType: "data_source",
    name: "RoomBoss / Vacation Niseko",
    description: "30 Vacation Niseko properties via HF Playwright service",
    capabilities: ["web_scraping", "browser_automation", "pms_integration"],
  },
];

const HOTEL_SCRAPER_EDGES: HotelScraperEdge[] = [
  // Coordinator → each source (activation)
  { sourceNodeId: "hotel-scraper", targetNodeId: "scraper-ratehawk", edgeType: "activation" },
  { sourceNodeId: "hotel-scraper", targetNodeId: "scraper-google-hotels", edgeType: "activation" },
  { sourceNodeId: "hotel-scraper", targetNodeId: "scraper-nisade", edgeType: "activation" },
  { sourceNodeId: "hotel-scraper", targetNodeId: "scraper-playwright", edgeType: "activation" },
  { sourceNodeId: "hotel-scraper", targetNodeId: "scraper-roomboss", edgeType: "activation" },
  // Each source → coordinator (data_flow back)
  { sourceNodeId: "scraper-ratehawk", targetNodeId: "hotel-scraper", edgeType: "data_flow" },
  { sourceNodeId: "scraper-google-hotels", targetNodeId: "hotel-scraper", edgeType: "data_flow" },
  { sourceNodeId: "scraper-nisade", targetNodeId: "hotel-scraper", edgeType: "data_flow" },
  { sourceNodeId: "scraper-playwright", targetNodeId: "hotel-scraper", edgeType: "data_flow" },
  { sourceNodeId: "scraper-roomboss", targetNodeId: "hotel-scraper", edgeType: "data_flow" },
  // Coordinator → iot-hub station (monitoring)
  { sourceNodeId: "hotel-scraper", targetNodeId: "iot-hub", edgeType: "monitoring" },
];

export async function seedHotelNodes(stationId: string): Promise<{
  nodesCreated: number;
  edgesCreated: number;
}> {
  let nodesCreated = 0;
  let edgesCreated = 0;

  try {
    const { getConvexClient, isConvexHealthy } = await import("../persistence/convex-client.js");

    if (!(await isConvexHealthy())) {
      return { nodesCreated: 0, edgesCreated: 0 };
    }

    const client = getConvexClient();
    const now = new Date().toISOString();

    for (const node of HOTEL_SCRAPER_NODES) {
      try {
        await client.mutation("graph_nodes:create" as any, {
          nodeId: node.nodeId,
          nodeType: node.nodeType,
          name: node.name,
          description: node.description,
          stationId,
          status: "active",
          fitnessScore: 50,
          maturationPhase: "genesis",
          capabilities: node.capabilities,
          activationCount: 0,
          totalLatencyMs: 0,
          successCount: 0,
          failureCount: 0,
          createdAt: now,
          metadata: {},
        });
        nodesCreated++;
      } catch {
        // Already exists — idempotent
      }
    }

    for (const edge of HOTEL_SCRAPER_EDGES) {
      try {
        const edgeId = `${edge.sourceNodeId}->${edge.targetNodeId}`;
        await client.mutation("graph_edges:create" as any, {
          edgeId,
          sourceNodeId: edge.sourceNodeId,
          targetNodeId: edge.targetNodeId,
          edgeType: edge.edgeType,
          weight: 0.5,
          myelinated: false,
          activationCount: 0,
          coActivationCount: 0,
          avgLatencyMs: 0,
          stationId,
          createdAt: now,
          metadata: {},
        });
        edgesCreated++;
      } catch {
        // Already exists — idempotent
      }
    }
  } catch {
    // Convex unavailable — non-critical
  }

  return { nodesCreated, edgesCreated };
}

// Exported for testing
export { HOTEL_SCRAPER_NODES, HOTEL_SCRAPER_EDGES };
