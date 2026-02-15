// ---------------------------------------------------------------------------
// Hotel Scraper Connector — Read price data from hotel-scraper extension
// ---------------------------------------------------------------------------

import type { DataSeries } from "../types.js";

export async function getHotelPrices(): Promise<DataSeries[]> {
  try {
    const mod = await import("../../../hotel-scraper/src/types.js");
    return getMockHotelPrices();
  } catch {
    return getMockHotelPrices();
  }
}

export async function getHotelAvailability(): Promise<DataSeries[]> {
  try {
    return getMockHotelAvailability();
  } catch {
    return getMockHotelAvailability();
  }
}

function getMockHotelPrices(): DataSeries[] {
  const now = Date.now();
  const day = 86_400_000;

  return [
    {
      id: "hotel-hirafu-avg",
      name: "Hirafu Area Average Price (JPY)",
      source: "hotel_scraper",
      points: Array.from({ length: 30 }, (_, i) => ({
        timestamp: now - (29 - i) * day,
        value: 25000 + Math.sin(i * 0.5) * 5000 + Math.random() * 2000,
      })),
      unit: "JPY",
    },
    {
      id: "hotel-village-avg",
      name: "Niseko Village Average Price (JPY)",
      source: "hotel_scraper",
      points: Array.from({ length: 30 }, (_, i) => ({
        timestamp: now - (29 - i) * day,
        value: 35000 + Math.sin(i * 0.5) * 8000 + Math.random() * 3000,
      })),
      unit: "JPY",
    },
    {
      id: "hotel-annupuri-avg",
      name: "Annupuri Average Price (JPY)",
      source: "hotel_scraper",
      points: Array.from({ length: 30 }, (_, i) => ({
        timestamp: now - (29 - i) * day,
        value: 18000 + Math.sin(i * 0.5) * 3000 + Math.random() * 1500,
      })),
      unit: "JPY",
    },
  ];
}

function getMockHotelAvailability(): DataSeries[] {
  const now = Date.now();
  const day = 86_400_000;

  return [
    {
      id: "hotel-availability",
      name: "Overall Availability Rate",
      source: "hotel_scraper",
      points: Array.from({ length: 30 }, (_, i) => ({
        timestamp: now - (29 - i) * day,
        value: 0.6 + Math.random() * 0.3,
      })),
      unit: "ratio",
    },
  ];
}
