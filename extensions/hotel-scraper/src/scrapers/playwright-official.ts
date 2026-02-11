// ---------------------------------------------------------------------------
// Official hotel website scraper via Playwright / HTTP fallback
// Ported from hotel-calc-kelvin convex/actions/playwrightScraper.ts
// Uses booking engine detection (Guesty, BookingSync) + CSS selector extraction
// ---------------------------------------------------------------------------

import type { Hotel, ScrapeParams, ScrapeResult } from "../types.js";
import { PLAYWRIGHT_SERVICE_URL, CURRENCY_RATES } from "../types.js";

type BookingEngine = "guesty" | "bookingsync" | "custom" | "unknown";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function detectBookingEngine(html: string): BookingEngine {
  const lower = html.toLowerCase();
  if (lower.includes("guesty") || lower.includes("guestywidget")) return "guesty";
  if (lower.includes("bookingsync") || lower.includes("rentalsunited")) return "bookingsync";
  if (lower.includes("booking-widget") || lower.includes("availability-calendar")) return "custom";
  return "unknown";
}

function extractGuestyPrice(html: string): { price: number; currency: string } | null {
  // JSON responses
  const jsonMatch = html.match(/\{"price":\s*(\d+(?:\.\d+)?),\s*"currency":\s*"([A-Z]{3})"/);
  if (jsonMatch) return { price: parseFloat(jsonMatch[1]), currency: jsonMatch[2] };

  // Data attributes
  const dataMatch = html.match(/data-price="(\d+(?:\.\d+)?)"\s+data-currency="([A-Z]{3})"/);
  if (dataMatch) return { price: parseFloat(dataMatch[1]), currency: dataMatch[2] };

  // Display elements
  const priceMatch = html.match(
    /class="[^"]*price[^"]*"[^>]*>.*?(¥|JPY|\$|USD)\s*([0-9,]+(?:\.\d{2})?)/i,
  );
  if (priceMatch) {
    const currency = priceMatch[1] === "¥" || priceMatch[1] === "JPY" ? "JPY" : "USD";
    return { price: parseFloat(priceMatch[2].replace(/,/g, "")), currency };
  }

  return null;
}

function extractBookingSyncPrice(html: string): { price: number; currency: string } | null {
  const match = html.match(
    /class="[^"]*booking-price[^"]*"[^>]*>.*?([¥$€])\s*([0-9,]+(?:\.\d{2})?)/i,
  );
  if (match) {
    const map: Record<string, string> = { "¥": "JPY", $: "USD", "€": "EUR" };
    return { price: parseFloat(match[2].replace(/,/g, "")), currency: map[match[1]] || "USD" };
  }

  const dataMatch = html.match(/data-total[^>]*="([0-9,]+(?:\.\d{2})?)"/i);
  if (dataMatch) return { price: parseFloat(dataMatch[1].replace(/,/g, "")), currency: "JPY" };

  return null;
}

function extractWithSelector(
  html: string,
  selector: string,
): { price: number; currency: string } | null {
  const clean = selector.replace(/^\./, "");
  const re = new RegExp(
    `class="[^"]*${clean}[^"]*"[^>]*>.*?([¥$€])?\\s*([0-9,]+(?:\\.\\d{2})?)`,
    "i",
  );
  const match = html.match(re);
  if (match) {
    const map: Record<string, string> = { "¥": "JPY", $: "USD", "€": "EUR" };
    const currency = match[1] ? map[match[1]] || "USD" : "JPY";
    const price = parseFloat(match[2].replace(/,/g, ""));
    if (!isNaN(price) && price > 0) return { price, currency };
  }
  return null;
}

function extractPrice(html: string, engine: BookingEngine, selector?: string) {
  switch (engine) {
    case "guesty":
      return extractGuestyPrice(html);
    case "bookingsync":
      return extractBookingSyncPrice(html);
    default: {
      if (selector) {
        const result = extractWithSelector(html, selector);
        if (result) return result;
      }
      // Generic selectors fallback
      for (const s of [
        "price-total",
        "total-price",
        "booking-price",
        "final-price",
        "price-amount",
      ]) {
        const result = extractWithSelector(html, s);
        if (result) return result;
      }
      return null;
    }
  }
}

function calculateNights(checkIn: string, checkOut: string): number {
  return Math.max(
    1,
    Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000),
  );
}

function convertToJpy(amount: number, currency: string): number {
  if (currency === "JPY") return amount;
  return Math.round(amount * (CURRENCY_RATES[currency] || 150));
}

// Placeholder: In production, this reads from Convex websiteMetadata table
type SiteConfig = {
  hotelName: string;
  officialUrl: string;
  priceSelector?: string;
  bookingWidgetUrl?: string;
};

export async function scrape(params: ScrapeParams, sites?: SiteConfig[]): Promise<ScrapeResult> {
  const start = Date.now();
  const hotels: Hotel[] = [];

  if (!sites || sites.length === 0) {
    return {
      source: "playwright",
      hotels: [],
      pricesFound: 0,
      duration_ms: Date.now() - start,
      error: "No verified websites configured",
    };
  }

  for (const site of sites) {
    try {
      const url = new URL(site.bookingWidgetUrl || site.officialUrl);
      url.searchParams.set("checkin", params.checkIn);
      url.searchParams.set("checkout", params.checkOut);
      url.searchParams.set("guests", String(params.guests));

      const resp = await fetch(url.toString(), {
        headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml" },
      });

      if (!resp.ok) continue;

      const html = await resp.text();
      const engine = detectBookingEngine(html);
      const priceResult = extractPrice(html, engine, site.priceSelector);

      if (priceResult && priceResult.price > 0) {
        const nights = calculateNights(params.checkIn, params.checkOut);
        hotels.push({
          hotelId: `playwright-${site.hotelName.toLowerCase().replace(/\s+/g, "-")}`,
          source: "playwright",
          providerName: "Official Website",
          name: site.hotelName,
          location: {
            prefecture: "Hokkaido",
            city: "Kutchan",
            district: "Hirafu",
            address: "",
            coordinates: { lat: 42.8486, lon: 140.6873 },
          },
          price: priceResult.price,
          currency: priceResult.currency,
          priceInYen: convertToJpy(priceResult.price, priceResult.currency),
          checkIn: params.checkIn,
          checkOut: params.checkOut,
          nights,
          guests: params.guests,
          availability: true,
          url: url.toString(),
          lastUpdated: Date.now(),
        });
      }
    } catch {
      // Skip failed sites
    }
  }

  return {
    source: "playwright",
    hotels,
    pricesFound: hotels.length,
    duration_ms: Date.now() - start,
  };
}
