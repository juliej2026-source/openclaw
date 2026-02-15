import { describe, it, expect } from "vitest";
import { parseCSV, parseJSON } from "../connectors/csv-connector.js";
import { getHotelPrices, getHotelAvailability } from "../connectors/hotel-connector.js";
import { getModelPerformance, getTaskDistribution } from "../connectors/meta-connector.js";
import { getNetworkTelemetry } from "../connectors/network-connector.js";
import { getNeuralExecutions, getNeuralTopology } from "../connectors/neural-connector.js";

describe("Data Connectors", () => {
  describe("neural-connector", () => {
    it("returns execution data series", async () => {
      const series = await getNeuralExecutions();
      expect(series.length).toBeGreaterThan(0);
      for (const s of series) {
        expect(s.source).toBe("neural_graph");
        expect(s.points.length).toBeGreaterThan(0);
        expect(typeof s.points[0].value).toBe("number");
      }
    });

    it("returns topology data", async () => {
      const { nodes, edges } = await getNeuralTopology();
      expect(nodes.length).toBeGreaterThan(0);
      expect(edges.length).toBeGreaterThan(0);
      expect(nodes[0].id).toBeTruthy();
      expect(edges[0].source).toBeTruthy();
      expect(edges[0].target).toBeTruthy();
    });
  });

  describe("hotel-connector", () => {
    it("returns price data series", async () => {
      const series = await getHotelPrices();
      expect(series.length).toBeGreaterThan(0);
      for (const s of series) {
        expect(s.source).toBe("hotel_scraper");
        expect(s.points.length).toBeGreaterThan(0);
      }
    });

    it("returns availability data", async () => {
      const series = await getHotelAvailability();
      expect(series.length).toBeGreaterThan(0);
    });
  });

  describe("meta-connector", () => {
    it("returns performance data", async () => {
      const series = await getModelPerformance();
      expect(series.length).toBeGreaterThan(0);
      for (const s of series) {
        expect(s.source).toBe("meta_engine");
      }
    });

    it("returns task distribution", async () => {
      const dist = await getTaskDistribution();
      expect(Object.keys(dist).length).toBeGreaterThan(0);
      expect(dist.coding).toBeGreaterThan(0);
    });
  });

  describe("network-connector", () => {
    it("returns telemetry data", async () => {
      const series = await getNetworkTelemetry();
      expect(series.length).toBeGreaterThan(0);
      for (const s of series) {
        expect(s.source).toBe("network");
      }
    });
  });

  describe("csv-connector", () => {
    it("parses CSV with headers", () => {
      const csv = `timestamp,value\n1000,10\n2000,20\n3000,30`;
      const series = parseCSV(csv);
      expect(series.points).toHaveLength(3);
      expect(series.points[0].value).toBe(10);
      expect(series.points[2].value).toBe(30);
      expect(series.source).toBe("custom");
    });

    it("parses CSV without headers", () => {
      const csv = `1000,10\n2000,20\n3000,30`;
      const series = parseCSV(csv, { hasHeader: false });
      expect(series.points).toHaveLength(3);
    });

    it("handles custom delimiter", () => {
      const csv = `ts;val\n1;100\n2;200`;
      const series = parseCSV(csv, { delimiter: ";" });
      expect(series.points).toHaveLength(2);
      expect(series.points[0].value).toBe(100);
    });

    it("parses empty CSV", () => {
      const series = parseCSV("");
      expect(series.points).toHaveLength(0);
    });
  });

  describe("json-connector", () => {
    it("parses JSON array of objects", () => {
      const json = JSON.stringify([
        { timestamp: 1000, value: 10 },
        { timestamp: 2000, value: 20 },
      ]);
      const series = parseJSON(json);
      expect(series.points).toHaveLength(2);
      expect(series.points[0].value).toBe(10);
    });

    it("parses JSON array of numbers", () => {
      const json = JSON.stringify([1, 2, 3, 4, 5]);
      const series = parseJSON(json);
      expect(series.points).toHaveLength(5);
      expect(series.points[0].value).toBe(1);
    });

    it("parses JSON with x/y keys", () => {
      const json = JSON.stringify([
        { x: 1, y: 10 },
        { x: 2, y: 20 },
      ]);
      const series = parseJSON(json);
      expect(series.points).toHaveLength(2);
      expect(series.points[0].value).toBe(10);
    });

    it("handles non-array JSON", () => {
      const json = JSON.stringify({ key: "value" });
      const series = parseJSON(json);
      expect(series.points).toHaveLength(0);
    });
  });
});
