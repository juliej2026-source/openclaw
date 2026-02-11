// ---------------------------------------------------------------------------
// nisade.com scraper — Niseko's official accommodation portal
// Ported from hotel-calc-kelvin convex/actions/nisadeScraper.ts
// Strategy: Try JSON API first, fall back to HTML parsing with cheerio
// ---------------------------------------------------------------------------

import type { Hotel, ScrapeParams, ScrapeResult } from "../types.js";
import type { NisadeProperty } from "./types.js";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function calculateNights(checkIn: string, checkOut: string): number {
  const ms = new Date(checkOut).getTime() - new Date(checkIn).getTime();
  return Math.max(1, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

async function tryApiScrape(params: ScrapeParams): Promise<NisadeProperty[]> {
  const url = `https://nisade.com/api/properties?checkIn=${params.checkIn}&checkOut=${params.checkOut}&guests=${params.guests}`;
  const resp = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
  });

  if (!resp.ok) throw new Error(`API returned ${resp.status}`);

  const data = (await resp.json()) as { properties?: any[] };
  if (!Array.isArray(data.properties)) return [];

  return data.properties.map((p: any) => ({
    name: p.name || p.title,
    nameJa: p.nameJa || p.titleJa,
    url: `https://nisade.com/properties/${p.id || p.slug}`,
    pricePerNight: p.pricePerNight || p.price,
    currency: p.currency || "JPY",
    availability: p.available !== false,
    propertyType: p.type,
    location: p.location || p.area,
    bedrooms: p.bedrooms,
    maxGuests: p.maxGuests || p.capacity,
  }));
}

async function tryHtmlScrape(): Promise<NisadeProperty[]> {
  const resp = await fetch("https://nisade.com/properties", {
    headers: { "User-Agent": USER_AGENT },
  });
  if (!resp.ok) throw new Error(`HTML fetch failed: HTTP ${resp.status}`);

  const html = await resp.text();
  const properties: NisadeProperty[] = [];

  // Use cheerio if available, otherwise regex fallback
  try {
    const { load } = await import("cheerio");
    const $ = load(html);

    $(".property-card, [data-property]").each((_i, el) => {
      const $el = $(el);
      const name = $el.find(".property-name, h2, h3").first().text().trim();
      const href = $el.find("a[href*='/properties/']").first().attr("href") || "";
      const priceText = $el.text().match(/¥([0-9,]+)/);
      const pricePerNight = priceText ? parseInt(priceText[1].replace(/,/g, "")) : undefined;

      if (name) {
        properties.push({
          name,
          url: href.startsWith("http") ? href : `https://nisade.com${href}`,
          pricePerNight,
          currency: "JPY",
          availability: true,
        });
      }
    });
  } catch {
    // Cheerio not available — regex fallback
    const matches = html.matchAll(
      /<div[^>]*class="[^"]*property-card[^"]*"[^>]*>([\s\S]*?)<\/div>/g,
    );
    for (const match of matches) {
      const card = match[1];
      const nameMatch = card.match(/<h[0-9][^>]*>(.*?)<\/h[0-9]>/i);
      const urlMatch = card.match(/href="([^"]*\/properties\/[^"]*)"/i);
      const priceMatch = card.match(/¥([0-9,]+)/);

      if (nameMatch) {
        properties.push({
          name: nameMatch[1].trim(),
          url: urlMatch ? `https://nisade.com${urlMatch[1]}` : "",
          pricePerNight: priceMatch ? parseInt(priceMatch[1].replace(/,/g, "")) : undefined,
          currency: "JPY",
          availability: true,
        });
      }
    }
  }

  return properties;
}

function propertyToHotel(prop: NisadeProperty, params: ScrapeParams): Hotel {
  const nights = calculateNights(params.checkIn, params.checkOut);
  const totalPrice = prop.pricePerNight ? prop.pricePerNight * nights : 0;

  return {
    hotelId: `nisade-${prop.name.toLowerCase().replace(/\s+/g, "-")}`,
    source: "nisade",
    providerName: "nisade.com",
    name: prop.name,
    nameJa: prop.nameJa,
    location: {
      prefecture: "Hokkaido",
      city: "Kutchan",
      district: prop.location || "Hirafu",
      address: "",
      coordinates: { lat: 42.8486, lon: 140.6873 },
    },
    price: totalPrice,
    currency: prop.currency,
    priceInYen: totalPrice,
    checkIn: params.checkIn,
    checkOut: params.checkOut,
    nights,
    guests: params.guests,
    availability: prop.availability,
    url: prop.url,
    lastUpdated: Date.now(),
    bedrooms: prop.bedrooms,
    maxGuests: prop.maxGuests,
  };
}

export async function scrape(params: ScrapeParams): Promise<ScrapeResult> {
  const start = Date.now();
  try {
    let properties: NisadeProperty[];

    try {
      properties = await tryApiScrape(params);
      if (properties.length === 0) throw new Error("Empty API response");
    } catch {
      properties = await tryHtmlScrape();
    }

    const hotels = properties
      .filter((p) => p.pricePerNight && p.pricePerNight > 0)
      .map((p) => propertyToHotel(p, params));

    return {
      source: "nisade",
      hotels,
      pricesFound: hotels.length,
      duration_ms: Date.now() - start,
    };
  } catch (err) {
    return {
      source: "nisade",
      hotels: [],
      pricesFound: 0,
      duration_ms: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
