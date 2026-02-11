// ---------------------------------------------------------------------------
// Currency conversion — JPY-centric with fallback static rates
// ---------------------------------------------------------------------------

import { CURRENCY_RATES } from "../config.js";

export function convertToJpy(amount: number, currency: string): number {
  if (currency === "JPY") return amount;
  const rate = CURRENCY_RATES[currency];
  if (!rate) return amount; // Unknown currency — return as-is
  return Math.round(amount * rate);
}

export function calculateNights(checkIn: string, checkOut: string): number {
  const ms = new Date(checkOut).getTime() - new Date(checkIn).getTime();
  return Math.max(1, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

export function formatJpy(amount: number): string {
  return `¥${amount.toLocaleString("ja-JP")}`;
}

export function formatPricePerNight(totalPrice: number, nights: number): string {
  if (nights <= 0) return formatJpy(totalPrice);
  return `${formatJpy(Math.round(totalPrice / nights))}/night`;
}
