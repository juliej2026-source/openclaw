// ---------------------------------------------------------------------------
// Price deduplication — keep lowest price per group
// Ported from hotel-calc-kelvin convex/actions/priceDedupe.ts
// Operates on in-memory arrays (decoupled from Convex)
// ---------------------------------------------------------------------------

type PriceRecord = {
  id: string;
  hotelId: string;
  source: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  priceInYen: number;
};

export type DedupResult = {
  totalPrices: number;
  uniqueGroups: number;
  duplicatesRemoved: number;
  idsToDelete: string[];
};

function groupKey(p: PriceRecord): string {
  return `${p.hotelId}|${p.source}|${p.checkIn}|${p.checkOut}|${p.guests}`;
}

export function deduplicatePrices(prices: PriceRecord[]): DedupResult {
  if (prices.length === 0) {
    return { totalPrices: 0, uniqueGroups: 0, duplicatesRemoved: 0, idsToDelete: [] };
  }

  const groups = new Map<string, PriceRecord[]>();

  for (const price of prices) {
    const key = groupKey(price);
    const group = groups.get(key);
    if (group) {
      group.push(price);
    } else {
      groups.set(key, [price]);
    }
  }

  const idsToDelete: string[] = [];

  for (const group of groups.values()) {
    if (group.length <= 1) continue;

    // Sort ascending by priceInYen — keep the lowest
    group.sort((a, b) => a.priceInYen - b.priceInYen);

    for (let i = 1; i < group.length; i++) {
      idsToDelete.push(group[i].id);
    }
  }

  return {
    totalPrices: prices.length,
    uniqueGroups: groups.size,
    duplicatesRemoved: idsToDelete.length,
    idsToDelete,
  };
}
