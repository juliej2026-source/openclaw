// ---------------------------------------------------------------------------
// Scraper interfaces — all scrapers implement the same contract
// ---------------------------------------------------------------------------

import type { Hotel, ScrapeParams, ScrapeResult, HotelSource } from "../types.js";

export type ScraperFn = (params: ScrapeParams) => Promise<ScrapeResult>;

export type ScraperModule = {
  name: string;
  source: HotelSource;
  scrape: ScraperFn;
};

// RateHawk API types
export type RateHawkHotel = {
  id: string;
  name: { en?: string; ja?: string; zh?: string };
  address: { city?: string; region?: string; line1?: string };
  location: { lat: number; lon: number };
  rates: { min_price: number; currency: string };
  booking_url?: string;
  stars?: number;
};

export type RateHawkSearchResponse = {
  data?: {
    hotels?: RateHawkHotel[];
  };
  error?: string;
};

// Apify/Google Hotels types
export type GoogleHotelResult = {
  name: string;
  price: number;
  currency?: string;
  rating?: number;
  url: string;
  provider?: string;
  roomType?: string;
  id?: string;
};

// Nisade property
export type NisadeProperty = {
  name: string;
  nameJa?: string;
  url: string;
  pricePerNight?: number;
  currency: string;
  availability: boolean;
  propertyType?: string;
  location?: string;
  bedrooms?: number;
  maxGuests?: number;
};

// RoomBoss hotel IDs (Vacation Niseko / Hokkaido Tracks)
export const VACATION_NISEKO_HOTEL_IDS = [
  "8a80818a89e080a50189e26f0b792fc6",
  "2c98902a536277ac015369c4eff3572e",
  "40288094178b572e01178b578ff00001",
  "2c98902a62266df1016227c2cc451b5d",
  "2c98902a5ac97fd0015aca6bc7320de2",
  "8a80818a992a98eb01992cf953c114ac",
  "8a80818a8693eeb901869bbd2d7a6de6",
  "2c98902a511abb3d0151238b847208f0",
  "2c98902a64fc4e030164fe0afd462ce9",
  "2c98902a54bb76cc0154c7f9781039e3",
  "f808ad96391798630139282bd9c614c3",
  "2c98902a69b56a2a0169b81025645287",
  "2c9990187649783401764ab55d501fb7",
  "2c98902a5ac97fd0015aca6b5b6c0dde",
  "2c98902a57f37ae70157ff5065d34514",
  "8a80818a7d2a95db017d45e04b4b6070",
  "2c9890f06d12b588016d14ce07517881",
  "2c98902a6327c6c101633874f2077089",
  "2c98902a4f47e9d7014f494bd6881725",
  "f808ad96456c7463014572731c550c19",
  "2c98902a62266df1016227f0a81d20aa",
  "2c999018734f35e201735006398d0e17",
  "8a80818a8693eeb901869bbbc4cc6d46",
  "c879d5991d6d147a011d763661a51155",
  "2c98902a513b4c20015147bb89585fd3",
  "8a80818a91951b65019197426e562314",
  "2c98902a57f37ae70157ff4fe9e6450d",
  "2c98902a57f37ae70157f515c96124d1",
  "2c98902a4d787deb014d790b538602b5",
  "8a80818a93efa3630193f1a455da5d1e",
];
