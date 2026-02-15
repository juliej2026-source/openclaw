// ---------------------------------------------------------------------------
// CSV/JSON Connector — Parse imported files into DataSeries
// ---------------------------------------------------------------------------

import { parse } from "csv-parse/sync";
import type { DataSeries, DataPoint } from "../types.js";

/**
 * Parse CSV content into a DataSeries.
 */
export function parseCSV(
  content: string,
  options?: {
    delimiter?: string;
    hasHeader?: boolean;
    timestampColumn?: string;
    valueColumn?: string;
    name?: string;
  },
): DataSeries {
  const records = parse(content, {
    delimiter: options?.delimiter ?? ",",
    columns: options?.hasHeader !== false,
    skip_empty_lines: true,
    trim: true,
  });

  if (records.length === 0) {
    return {
      id: `csv-${Date.now()}`,
      name: options?.name ?? "Imported CSV",
      source: "custom",
      points: [],
    };
  }

  const tsCol = options?.timestampColumn;
  const valCol = options?.valueColumn;

  let points: DataPoint[];

  if (typeof records[0] === "object" && !Array.isArray(records[0])) {
    // Named columns
    const keys = Object.keys(records[0]);
    const timeKey = tsCol ?? keys.find((k) => /time|date|ts|timestamp/i.test(k)) ?? keys[0];
    const valueKey = valCol ?? keys.find((k) => /value|val|price|amount|score/i.test(k)) ?? keys[1];

    points = records
      .map((row: any, i: number) => ({
        timestamp: parseTimestamp(row[timeKey]) ?? i,
        value: parseFloat(row[valueKey]),
      }))
      .filter((p: DataPoint) => !isNaN(p.value));
  } else {
    // Array columns
    points = records
      .map((row: any[], i: number) => ({
        timestamp: parseTimestamp(row[0]) ?? i,
        value: parseFloat(row[1] ?? row[0]),
      }))
      .filter((p: DataPoint) => !isNaN(p.value));
  }

  return {
    id: `csv-${Date.now()}`,
    name: options?.name ?? "Imported CSV",
    source: "custom",
    points,
  };
}

/**
 * Parse JSON array into a DataSeries.
 */
export function parseJSON(content: string, name?: string): DataSeries {
  const data = JSON.parse(content);

  if (!Array.isArray(data)) {
    return {
      id: `json-${Date.now()}`,
      name: name ?? "Imported JSON",
      source: "custom",
      points: [],
    };
  }

  const points: DataPoint[] = data
    .map((item: any, i: number) => {
      if (typeof item === "number") {
        return { timestamp: i, value: item };
      }
      return {
        timestamp: parseTimestamp(item.timestamp ?? item.time ?? item.x ?? item.t) ?? i,
        value: parseFloat(item.value ?? item.y ?? item.v ?? item),
        label: item.label,
        metadata: item.metadata,
      };
    })
    .filter((p: DataPoint) => !isNaN(p.value));

  return {
    id: `json-${Date.now()}`,
    name: name ?? "Imported JSON",
    source: "custom",
    points,
  };
}

function parseTimestamp(value: unknown): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "number") return value;
  const str = String(value);
  const num = Number(str);
  if (!isNaN(num)) return num;
  const date = new Date(str);
  return isNaN(date.getTime()) ? null : date.getTime();
}
