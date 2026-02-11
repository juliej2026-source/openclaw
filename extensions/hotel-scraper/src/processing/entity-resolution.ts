// ---------------------------------------------------------------------------
// Hotel entity resolution — Haversine + Jaro-Winkler matching
// Ported from hotel-calc-kelvin lib/entity-resolution/matcher.ts
// ---------------------------------------------------------------------------

import haversine from "haversine";
import natural from "natural";
import type { Hotel } from "../types.js";

const JaroWinklerDistance = natural.JaroWinklerDistance;

// Matching thresholds tuned for Niseko market
const DISTANCE_THRESHOLD_KM = 0.05; // 50 meters
const NAME_SIMILARITY_THRESHOLD = 0.85; // 85%
const AUTO_MERGE_CONFIDENCE = 0.7; // 70%

const MATCH_WEIGHTS = {
  geographic: 0.5,
  nameEnglish: 0.3,
  nameJapanese: 0.15,
  address: 0.05,
};

export type MatchResult = {
  confidence: number;
  reasons: string[];
  canonicalId?: string;
  shouldMerge: boolean;
};

function normalizeAddress(address: string): string {
  return address
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[,.]/g, "")
    .replace(/(apartment|apt|suite|ste|building|bldg)/gi, "")
    .trim();
}

export function findMatchingHotel(candidate: Hotel, existing: Hotel[]): MatchResult {
  let bestMatch: Hotel | null = null;
  let bestScore = 0;
  const reasons: string[] = [];

  for (const hotel of existing) {
    let score = 0;
    const localReasons: string[] = [];

    // 1. Geographic proximity (50% weight)
    const dist = haversine(
      {
        latitude: candidate.location.coordinates.lat,
        longitude: candidate.location.coordinates.lon,
      },
      { latitude: hotel.location.coordinates.lat, longitude: hotel.location.coordinates.lon },
      { unit: "km" },
    );

    if (dist < DISTANCE_THRESHOLD_KM) {
      score += (1 - dist / DISTANCE_THRESHOLD_KM) * MATCH_WEIGHTS.geographic;
      localReasons.push(`Distance: ${(dist * 1000).toFixed(1)}m`);
    } else if (dist < 0.2) {
      score += ((0.2 - dist) / 0.2) * MATCH_WEIGHTS.geographic * 0.5;
      localReasons.push(`Distance: ${(dist * 1000).toFixed(0)}m (nearby)`);
    }

    // 2. English name similarity (30% weight)
    const nameSim = JaroWinklerDistance(candidate.name.toLowerCase(), hotel.name.toLowerCase());
    if (nameSim > NAME_SIMILARITY_THRESHOLD) {
      score += nameSim * MATCH_WEIGHTS.nameEnglish;
      localReasons.push(`Name: ${(nameSim * 100).toFixed(1)}%`);
    }

    // 3. Japanese name similarity (15% weight)
    if (candidate.nameJa && hotel.nameJa) {
      const jaSim = JaroWinklerDistance(candidate.nameJa, hotel.nameJa);
      if (jaSim > NAME_SIMILARITY_THRESHOLD) {
        score += jaSim * MATCH_WEIGHTS.nameJapanese;
        localReasons.push(`Japanese: ${(jaSim * 100).toFixed(1)}%`);
      }
    }

    // 4. Address matching (5% weight)
    if (candidate.location.address && hotel.location.address) {
      const addrSim = JaroWinklerDistance(
        normalizeAddress(candidate.location.address),
        normalizeAddress(hotel.location.address),
      );
      if (addrSim > 0.8) {
        score += addrSim * MATCH_WEIGHTS.address;
        localReasons.push(`Address: ${(addrSim * 100).toFixed(1)}%`);
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = hotel;
      reasons.length = 0;
      reasons.push(...localReasons);
    }
  }

  return {
    confidence: bestScore,
    reasons,
    canonicalId: bestMatch?.hotelId,
    shouldMerge: bestScore >= AUTO_MERGE_CONFIDENCE,
  };
}

export function batchMatch(candidates: Hotel[], existing: Hotel[]): Map<string, MatchResult> {
  const results = new Map<string, MatchResult>();
  for (const candidate of candidates) {
    results.set(candidate.hotelId, findMatchingHotel(candidate, existing));
  }
  return results;
}

export function calculateMatchStats(matches: Map<string, MatchResult>) {
  const arr = Array.from(matches.values());
  const autoMerges = arr.filter((m) => m.shouldMerge).length;
  const manualReview = arr.filter((m) => m.confidence > 0.5 && !m.shouldMerge).length;
  const noMatch = arr.filter((m) => m.confidence <= 0.5).length;
  const totalConf = arr.reduce((s, m) => s + m.confidence, 0);

  return {
    totalCandidates: arr.length,
    autoMerges,
    manualReview,
    noMatch,
    averageConfidence: arr.length > 0 ? totalConf / arr.length : 0,
    highConfidenceMatches: arr.filter((m) => m.confidence > 0.9).length,
  };
}
