# Hotel-Calc-Kelvin Documentation

> Comprehensive documentation for the Niseko Hotel Price Comparison System, ported from the standalone hotel-calc-kelvin project into the OpenClaw `@openclaw/hotel-scraper` extension.

---

## 1. User Guide

### 1.1 What is Hotel-Calc-Kelvin?

Hotel-Calc-Kelvin is a **Niseko ski resort hotel price comparison engine** that automatically scrapes pricing data from 5 different sources, normalizes all prices to JPY, matches hotels across sources using entity resolution, and presents unified price comparisons. It was originally a standalone Convex + Next.js application and has been ported into the OpenClaw ecosystem as the `@openclaw/hotel-scraper` extension.

**Key capabilities:**

- Aggregates hotel prices from 5 data sources (RateHawk API, Google Hotels via Apify, nisade.com, official hotel websites via Playwright, and RoomBoss/Vacation Niseko)
- Covers 4 Niseko geographic areas: Hirafu (40 properties), Niseko Village (15), Annupuri (10), Hanazono (8)
- Automated scheduling with staggered intervals (hourly to daily depending on source)
- Entity resolution using Haversine distance + Jaro-Winkler string similarity
- Price deduplication keeping the lowest price per hotel/source/date group
- Currency conversion to JPY with static fallback rates
- Data quality monitoring with freshness tracking and outlier detection
- Full CLI (`openclaw hotel`) and HTTP API (`/api/hotel-scraper/*`)

### 1.2 CLI Commands

All commands are available under `openclaw hotel`:

| Command                            | Description                                                           | Example                                                                         |
| ---------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `openclaw hotel status`            | Show extension status, scheduler state, active timers, jobs in memory | `openclaw hotel status`                                                         |
| `openclaw hotel scrape`            | Trigger a new scrape job                                              | `openclaw hotel scrape --check-in 2026-02-15 --check-out 2026-02-17 --guests 2` |
| `openclaw hotel prices`            | Show latest prices from completed jobs                                | `openclaw hotel prices --area Hirafu`                                           |
| `openclaw hotel compare <hotelId>` | Compare prices for one hotel across all sources                       | `openclaw hotel compare "Hinode Hills"`                                         |
| `openclaw hotel resolve`           | Run entity resolution on latest scrape results                        | `openclaw hotel resolve`                                                        |
| `openclaw hotel jobs`              | List recent scrape jobs                                               | `openclaw hotel jobs --status completed -n 5`                                   |

**Scrape command options:**

- `--check-in <YYYY-MM-DD>` — Check-in date (default: 7 days from now)
- `--check-out <YYYY-MM-DD>` — Check-out date (default: check-in + 2 nights)
- `--guests <n>` — Number of guests (default: 2)
- `--sources <list>` — Comma-separated source list: `ratehawk,google_hotels,nisade,playwright,roomboss`
- `--strategy <type>` — Strategy: `auto` (all 5), `apify_only` (Google Hotels), `playwright_only` (Playwright + RoomBoss), `hybrid` (Google + Playwright + RoomBoss)

### 1.3 Understanding Price Output

Prices are displayed in JPY (Japanese Yen) as the canonical currency. Each price entry includes:

- **Hotel name** — The property name as reported by the source
- **Source** — Which scraper found this price (ratehawk, google_hotels, nisade, playwright, roomboss)
- **Price in JPY** — Total stay price converted to JPY
- **Area** — Niseko district (Hirafu, Village, Annupuri, Hanazono)
- **URL** — Direct link to the booking page

Prices are sorted lowest-first. The `compare` command shows all prices for a single hotel across sources, highlighting the cheapest option.

### 1.4 Seasonal Pricing Context

The Niseko market has distinct seasons affecting pricing:

- **Winter Peak** (Dec 20 - Mar 15): Ski season, highest demand and prices
- **Summer** (Jul 1 - Aug 31): Summer activities, moderate demand
- **Spring Thaw** (Mar 16 - Apr 30): Post-ski, lowest prices
- **Autumn** (Sep 1 - Nov 30): Pre-ski, low demand

Hotels store 7 seasonal rates: `peakRate`, `cnyRate`, `cny2Rate`, `midRate`, `lowRate`, `endRate`, `preRate`.

---

## 2. Admin Guide

### 2.1 Architecture Overview

```
@openclaw/hotel-scraper extension
├── src/
│   ├── types.ts              — Core types (Hotel, ScrapeJob, PriceEntry, etc.)
│   ├── config.ts             — Geographic areas, schedule, currency rates, seasons
│   ├── api-handlers.ts       — HTTP API handlers (/api/hotel-scraper/*)
│   ├── cli/hotel-cli.ts      — CLI commands (openclaw hotel *)
│   ├── scrapers/
│   │   ├── types.ts          — Scraper interfaces + RoomBoss hotel IDs
│   │   ├── ratehawk.ts       — RateHawk API scraper
│   │   ├── google-hotels.ts  — Google Hotels via Apify actor
│   │   ├── nisade.ts         — nisade.com scraper (API + HTML fallback)
│   │   ├── playwright-official.ts — Official hotel websites via booking engine detection
│   │   ├── roomboss.ts       — RoomBoss/Vacation Niseko via HF Playwright service
│   │   └── index.ts          — Unified orchestrator (Promise.allSettled)
│   ├── processing/
│   │   ├── entity-resolution.ts — Haversine + Jaro-Winkler hotel matching
│   │   ├── price-dedup.ts    — Keep lowest price per group
│   │   ├── currency.ts       — JPY conversion + formatting
│   │   └── data-quality.ts   — Freshness monitoring + outlier detection
│   ├── scheduler/
│   │   ├── scraper-scheduler.ts — setInterval-based scheduler with stagger
│   │   └── queue-processor.ts   — Retry logic + strategy routing
│   ├── persistence/
│   │   ├── convex-client.ts  — Convex HTTP client singleton
│   │   ├── hotel-store.ts    — Hotel CRUD wrapper
│   │   └── price-store.ts    — Price read/write wrapper
│   ├── metrics/
│   │   └── scraper-metrics.ts — Prometheus metrics renderer
│   └── neural/
│       └── seed-nodes.ts     — Neural graph node seeding for hotel-scraper
├── convex/
│   ├── schema.ts             — 10-table Convex schema
│   ├── queries.ts            — Convex query functions (public + internal)
│   └── mutations.ts          — Convex mutation functions (public + internal)
└── package.json              — Extension manifest
```

### 2.2 Data Flow

```
1. Scheduler triggers scrape task (or user triggers via CLI/API)
2. Orchestrator (scrapers/index.ts) runs selected sources via Promise.allSettled
3. Each scraper returns ScrapeResult { source, hotels[], pricesFound, duration_ms }
4. Results stored in-memory job store (Map<string, ScrapeJob>)
5. Optionally persisted to Convex for long-term storage
6. Entity resolution matches hotels across sources (Haversine + Jaro-Winkler)
7. Price dedup keeps lowest price per hotel/source/date/guest group
8. Data quality checks assess freshness, success rates, outliers
9. Prometheus metrics exported for Grafana dashboards
10. Neural graph nodes seeded for visualization in /monitor
```

### 2.3 Environment Variables

| Variable                 | Required                | Default                                             | Description                        |
| ------------------------ | ----------------------- | --------------------------------------------------- | ---------------------------------- |
| `RATEHAWK_API_KEY`       | Yes (for RateHawk)      | —                                                   | RateHawk B2B API bearer token      |
| `APIFY_API_TOKEN`        | Yes (for Google Hotels) | —                                                   | Apify platform API token           |
| `CONVEX_URL`             | No                      | `http://10.1.7.158:3210`                            | Convex deployment URL              |
| `PLAYWRIGHT_SERVICE_URL` | No                      | `https://igoraid-playwright-hotel-scraper.hf.space` | HuggingFace Playwright service URL |

### 2.4 Dependencies

| Package     | Version | Purpose                                                |
| ----------- | ------- | ------------------------------------------------------ |
| `axios`     | ^1.13.4 | RateHawk API HTTP client                               |
| `cheerio`   | ^1.2.0  | HTML parsing for nisade.com fallback                   |
| `convex`    | ^1.17.4 | Convex serverless database client                      |
| `haversine` | ^1.1.1  | Geographic distance calculation for entity resolution  |
| `natural`   | ^8.1.0  | Jaro-Winkler string similarity for hotel name matching |

### 2.5 API Endpoints

All endpoints are served under the hive-mind HTTP server (127.0.0.1:3001, proxied via Apache to 10.1.7.158):

| Endpoint                      | Method | Description                                            |
| ----------------------------- | ------ | ------------------------------------------------------ |
| `/api/hotel-scraper/status`   | GET    | Extension status, scheduler state, active timers       |
| `/api/hotel-scraper/health`   | GET    | Health check including Playwright service reachability |
| `/api/hotel-scraper/prices`   | GET    | Latest prices with optional date/area filters          |
| `/api/hotel-scraper/hotels`   | GET    | Unique hotels from completed jobs                      |
| `/api/hotel-scraper/scrape`   | POST   | Trigger a new scrape job (returns jobId immediately)   |
| `/api/hotel-scraper/jobs`     | GET    | List scrape jobs with optional status filter           |
| `/api/hotel-scraper/compare`  | GET    | Compare prices for a specific hotel across sources     |
| `/api/hotel-scraper/schedule` | GET    | Show schedule configuration and defaults               |

### 2.6 Monitoring

**Prometheus Metrics** (exposed at `/metrics` as part of hive-mind):

| Metric                                    | Type    | Description                                          |
| ----------------------------------------- | ------- | ---------------------------------------------------- |
| `hotel_scraper_up`                        | gauge   | Extension is running (1/0)                           |
| `hotel_scraper_sources_total`             | gauge   | Number of configured sources (5)                     |
| `hotel_scraper_areas_total`               | gauge   | Number of search areas (4)                           |
| `hotel_scraper_scheduler_running`         | gauge   | Scheduler active (1/0)                               |
| `hotel_scraper_scheduler_uptime_seconds`  | gauge   | Scheduler uptime                                     |
| `hotel_scraper_scheduler_active_timers`   | gauge   | Number of active timers                              |
| `hotel_scraper_schedule_enabled`          | gauge   | Number of enabled schedule entries                   |
| `hotel_scraper_task_runs_total`           | counter | Per-task run count                                   |
| `hotel_scraper_task_last_run_timestamp`   | gauge   | Per-task last run time                               |
| `hotel_scraper_task_error`                | gauge   | Per-task error state (1/0)                           |
| `hotel_scraper_jobs_total`                | gauge   | Total jobs in memory                                 |
| `hotel_scraper_jobs_by_status`            | gauge   | Jobs by status (pending/processing/completed/failed) |
| `hotel_scraper_prices_found_total`        | counter | Total prices across completed jobs                   |
| `hotel_scraper_playwright_reachable`      | gauge   | Playwright service health (1/0)                      |
| `hotel_scraper_schedule_interval_seconds` | gauge   | Configured interval per entry                        |

**Grafana Dashboard**: Available at `http://10.1.7.158/grafana/` when the Docker monitoring stack is running (`monitoring/docker-compose.yml`).

**Hive Monitor Dashboard**: Hotel scraper section visible at `http://10.1.7.158/monitor` showing Sources, Areas, Scheduler status, Timers, Active Jobs, Playwright Health, and recent jobs table.

### 2.7 Neural Graph Integration

The hotel-scraper extension seeds 6 nodes into the neural graph:

1. **hotel-scraper** (capability) — Coordinator node
2. **scraper-ratehawk** (data_source) — RateHawk API
3. **scraper-google-hotels** (data_source) — Google Hotels/Apify
4. **scraper-nisade** (data_source) — nisade.com
5. **scraper-playwright** (data_source) — Official hotel websites
6. **scraper-roomboss** (data_source) — RoomBoss/Vacation Niseko

Plus 11 edges (5 activation from coordinator to sources, 5 data_flow back, 1 monitoring to iot-hub).

---

## 3. Configuration Guide

### 3.1 Geographic Search Areas

Four Niseko areas are configured in `config.ts`:

| Area               | Latitude | Longitude | Radius | Est. Properties | Property Types                      |
| ------------------ | -------- | --------- | ------ | --------------- | ----------------------------------- |
| **Hirafu**         | 42.8486  | 140.6873  | 2.5 km | 40              | Chalets, Condos, Hotels, Apartments |
| **Niseko Village** | 42.8056  | 140.6842  | 2.0 km | 15              | International Hotels, Condos        |
| **Annupuri**       | 42.835   | 140.655   | 1.5 km | 10              | Lodges, Pensions, Small Hotels      |
| **Hanazono**       | 42.865   | 140.71    | 1.5 km | 8               | Luxury Hotels, Premium Condos       |

### 3.2 Schedule Configuration

9 scheduled tasks in `config.ts`:

| Task Name                 | Source        | Interval  | Description                     | Enabled |
| ------------------------- | ------------- | --------- | ------------------------------- | ------- |
| `ratehawk_hourly`         | ratehawk      | 1 hour    | RateHawk API sync for all areas | Yes     |
| `google_hotels_hourly`    | google_hotels | 1 hour    | Google Hotels via Apify         | Yes     |
| `nisade_daily`            | nisade        | 24 hours  | nisade.com portal scrape        | Yes     |
| `playwright_6h`           | playwright    | 6 hours   | Official hotel websites         | Yes     |
| `roomboss_hourly`         | roomboss      | 1 hour    | Vacation Niseko properties      | Yes     |
| `queue_processor`         | system        | 2 minutes | Process pending scrape requests | Yes     |
| `data_quality_hourly`     | system        | 1 hour    | Freshness and alert checks      | Yes     |
| `price_dedup_hourly`      | system        | 1 hour    | Remove duplicate prices         | Yes     |
| `progress_cleanup_hourly` | system        | 1 hour    | TTL cleanup of progress entries | Yes     |

**Stagger logic**: Each task starts with a random delay of 0-30 seconds to avoid thundering herd.

### 3.3 Default Search Parameters

```typescript
{
  currency: "JPY",
  language: "en",
  residency: "jp",
  guests: 2,
  nightsAhead: 7,   // check-in = 7 days from now
  stayLength: 2      // 2-night stay
}
```

### 3.4 Currency Conversion Rates

Static fallback rates (to be replaced by live API):

| Currency | Rate to JPY |
| -------- | ----------- |
| JPY      | 1           |
| USD      | 150         |
| AUD      | 100         |
| EUR      | 165         |
| GBP      | 190         |
| RMB      | 21          |

### 3.5 Entity Resolution Thresholds

| Parameter                   | Value      | Description                           |
| --------------------------- | ---------- | ------------------------------------- |
| `DISTANCE_THRESHOLD_KM`     | 0.05 (50m) | Maximum distance for geographic match |
| `NAME_SIMILARITY_THRESHOLD` | 0.85 (85%) | Minimum Jaro-Winkler similarity       |
| `AUTO_MERGE_CONFIDENCE`     | 0.70 (70%) | Auto-merge threshold                  |

**Match weights:**

- Geographic proximity: 50%
- English name similarity: 30%
- Japanese name similarity: 15%
- Address matching: 5%

### 3.6 Queue Processor Settings

| Setting             | Value | Description                             |
| ------------------- | ----- | --------------------------------------- |
| `MAX_CONCURRENT`    | 3     | Maximum concurrent scrape requests      |
| Default max retries | 3     | Per scrape request                      |
| Default priority    | 5     | Request queue priority (higher = first) |

### 3.7 Scraper Strategies

| Strategy          | Sources Used                                                  |
| ----------------- | ------------------------------------------------------------- |
| `auto` (default)  | ratehawk, google_hotels, nisade, playwright, roomboss (all 5) |
| `apify_only`      | google_hotels                                                 |
| `playwright_only` | playwright, roomboss                                          |
| `hybrid`          | google_hotels, playwright, roomboss                           |

---

## 4. Operations Guide

### 4.1 Starting the Extension

The hotel-scraper extension runs as part of the hive-mind service on IOT-HUB (10.1.7.158). It's loaded automatically when the hive-mind server starts:

```bash
# Start hive-mind (includes hotel-scraper)
cd /home/admin/openclaw
npx tsx extensions/hive-mind/src/serve.ts
```

The scheduler starts automatically and begins scraping at configured intervals.

### 4.2 Checking Status

```bash
# CLI
openclaw hotel status

# HTTP API
curl http://127.0.0.1:3001/api/hotel-scraper/status | jq

# Prometheus metrics
curl http://127.0.0.1:3001/metrics | grep hotel_scraper
```

### 4.3 Triggering Manual Scrapes

```bash
# Scrape all sources with default dates
openclaw hotel scrape

# Scrape specific sources for specific dates
openclaw hotel scrape --check-in 2026-03-01 --check-out 2026-03-05 --guests 4 --sources ratehawk,nisade

# Via API
curl -X POST http://127.0.0.1:3001/api/hotel-scraper/scrape \
  -H "Content-Type: application/json" \
  -d '{"checkIn":"2026-03-01","checkOut":"2026-03-05","guests":4}'
```

### 4.4 Viewing Results

```bash
# All prices
openclaw hotel prices

# Prices for specific area
openclaw hotel prices --area Hirafu

# Compare one hotel across sources
openclaw hotel compare "Hinode Hills"

# Recent jobs
openclaw hotel jobs --status completed -n 5
```

### 4.5 Convex Database

The extension uses Convex (default: `http://10.1.7.158:3210`) for long-term storage. 10 tables:

| Table              | Purpose                                             | Key Indexes                       |
| ------------------ | --------------------------------------------------- | --------------------------------- |
| `hotels`           | Hotel master records (slug, name, rates, location)  | by_slug, by_area, by_priority     |
| `prices`           | Scraped price entries (hotel, source, price, dates) | by_hotel, by_source, by_dedup_key |
| `scrapeJobs`       | Job tracking (status, sources, dates, results)      | by_status                         |
| `currencyRates`    | Live currency conversion rates                      | by_currency                       |
| `websiteMetadata`  | Official website config for Playwright scraping     | by_hotel, by_status               |
| `selectorTracking` | CSS selector health tracking per hotel              | by_hotel_selector                 |
| `selectorAttempts` | Individual selector attempt history                 | by_hotel, by_timestamp            |
| `alerts`           | System alerts (scrape failures, data quality)       | by_acknowledged, by_severity      |
| `scrapeProgress`   | Real-time job progress with TTL                     | by_job, by_ttl                    |
| `scrapeRequests`   | Queued scrape requests with priority                | by_status_priority                |

### 4.6 Troubleshooting

**Scheduler not running:**

```bash
curl http://127.0.0.1:3001/api/hotel-scraper/status | jq .scheduler
```

If `running: false`, the hive-mind server may need restarting.

**RateHawk failing:**
Check `RATEHAWK_API_KEY` environment variable. The API uses Bearer token authentication against `https://api.worldota.net/api/b2b/v3`.

**Google Hotels failing:**
Check `APIFY_API_TOKEN`. The scraper uses the FREE Apify actor `vittuhy~google-travel-hotel-prices` with residential JP proxy. Actor runs have a 120-second timeout with 5-second polling.

**Playwright service unreachable:**

```bash
curl https://igoraid-playwright-hotel-scraper.hf.space/health
```

The HuggingFace Spaces service may be sleeping (cold start). The RoomBoss scraper sends 30 hotel IDs per request.

**Convex unavailable:**
The extension gracefully degrades when Convex is down. In-memory job store continues working. Check: `curl http://10.1.7.158:3210/version`

**Price data stale:**
Check `hotel_scraper_task_last_run_timestamp` metrics. Data quality checks run hourly and flag sources older than 24 hours as stale.

### 4.7 Data Quality

The `data-quality.ts` module provides:

- **Freshness monitoring**: Each source tracked by last scrape time, flagged as stale after `maxAgeHours` (default: 24)
- **Outlier detection**: IQR-based price outlier check (1.5x IQR above Q3 or below Q1)
- **Success rate tracking**: Per-source success/failure counting

Report fields:

```typescript
{
  timestamp: number,
  totalSources: number,
  healthySources: number,
  staleSources: string[],
  failedSources: string[],
  priceCount: number,
  freshnessBySource: Record<string, { lastScrape, ageHours, status }>
}
```

---

## 5. Data Sources Reference

### 5.1 RateHawk API (`ratehawk.ts`)

**Type**: REST API (B2B)
**Base URL**: `https://api.worldota.net/api/b2b/v3`
**Auth**: Bearer token (`RATEHAWK_API_KEY`)
**Timeout**: 30 seconds

**How it works:**

1. Searches all 4 Niseko areas in parallel (`Promise.allSettled`)
2. Each area search sends a POST to `/search/serp` with geo coordinates, radius, dates, guests
3. Results include hotel name (en/ja/zh), coordinates, rates, booking URL, stars
4. Deduplicates by hotelId across area overlaps
5. Converts currency to JPY using static rates
6. District detection via closest-area algorithm (Euclidean distance to area center)

**Data extracted per hotel:**

- hotelId (prefixed `ratehawk-`)
- Name (English, Japanese, Chinese)
- Location (lat/lon, city, detected district)
- Price (converted to JPY), original currency
- Stars rating
- Booking URL

### 5.2 Google Hotels via Apify (`google-hotels.ts`)

**Type**: Apify actor (cloud scraping)
**Actor**: `vittuhy~google-travel-hotel-prices` (FREE tier)
**Auth**: Apify API token (`APIFY_API_TOKEN`)
**Timeout**: 120 seconds (polling every 5s)
**Proxy**: Apify residential proxy, JP country

**How it works:**

1. Starts the Apify actor with search query "Niseko Hirafu, Japan"
2. Polls actor run status every 5 seconds until SUCCEEDED/FAILED/ABORTED
3. Fetches results from the actor's default dataset
4. Each result has: name, price, currency, rating, URL, provider, roomType

**Data extracted per hotel:**

- hotelId (prefixed `google-`)
- Name, price (already in JPY via actor config)
- Rating (Google's star rating)
- Booking URL
- Provider name

### 5.3 nisade.com Scraper (`nisade.ts`)

**Type**: Web scraper (API-first, HTML fallback)
**Target**: `https://nisade.com` — Niseko's official accommodation portal
**Auth**: None (public website)

**How it works:**

1. **API attempt**: GET `https://nisade.com/api/properties?checkIn=...&checkOut=...&guests=...`
   - Parses JSON response for property listings
   - Extracts: name, nameJa, URL, pricePerNight, currency, availability, type, location, bedrooms, maxGuests
2. **HTML fallback** (if API fails or returns empty):
   - Fetches `https://nisade.com/properties`
   - Tries cheerio parsing first (`.property-card` or `[data-property]` selectors)
   - Falls back to regex extraction if cheerio unavailable
   - Extracts: name from `<h2>/<h3>`, URL from `/properties/` links, price from `¥` pattern

**Data extracted per hotel:**

- hotelId (prefixed `nisade-`, slugified name)
- Name (English, optional Japanese)
- Price per night (multiplied by nights for total)
- Property type, bedrooms, maxGuests
- Location/area

### 5.4 Official Hotel Websites via Playwright (`playwright-official.ts`)

**Type**: Browser automation + HTTP fallback
**Service**: Playwright browser service (configurable URL)
**Auth**: None (scrapes public booking pages)

**How it works:**

1. Takes a list of `SiteConfig` entries (hotel name, official URL, optional price selector, booking widget URL)
2. For each site:
   - Constructs URL with checkin/checkout/guests query params
   - Fetches HTML content
   - **Booking engine detection**: Checks for Guesty, BookingSync, or custom booking widgets
   - **Price extraction** based on detected engine:
     - **Guesty**: JSON price data, data attributes, or CSS class-based price elements
     - **BookingSync**: Booking-price classes, data-total attributes
     - **Custom/Unknown**: Tries generic selectors (`price-total`, `total-price`, `booking-price`, `final-price`, `price-amount`)
     - Can also use site-specific CSS selector if configured
   - Converts extracted price to JPY

**Supported booking engines:**

- Guesty (`guestywidget`)
- BookingSync (`bookingsync`, `rentalsunited`)
- Custom (`booking-widget`, `availability-calendar`)
- Unknown (generic selector fallback)

### 5.5 RoomBoss / Vacation Niseko (`roomboss.ts`)

**Type**: Browser automation via HuggingFace Playwright service
**Service URL**: `https://igoraid-playwright-hotel-scraper.hf.space`
**Target**: Vacation Niseko (RoomBoss PMS)
**Hotel count**: 30 pre-configured property IDs

**How it works:**

1. Sends POST to `{SERVICE_URL}/api/roomboss` with:
   - 30 Vacation Niseko hotel IDs (hardcoded in `scrapers/types.ts`)
   - Check-in/out dates, guest count
2. The HuggingFace Spaces service navigates `stay.vacationniseko.com` using Playwright
3. Returns `{ success, hotelsFound, prices: [{ hotelName, price, currency, roomType }] }`
4. Each price is mapped to a Hotel object

**The 30 hotel IDs** are hexadecimal RoomBoss property identifiers for Vacation Niseko's portfolio, covering properties across all Niseko areas.

### 5.6 Source Comparison Matrix

| Feature            | RateHawk     | Google Hotels | nisade.com | Playwright       | RoomBoss      |
| ------------------ | ------------ | ------------- | ---------- | ---------------- | ------------- |
| **Method**         | REST API     | Apify actor   | API + HTML | HTTP + selector  | HF Playwright |
| **Auth required**  | API key      | API token     | None       | None             | None          |
| **Response time**  | ~5-10s       | ~30-120s      | ~2-5s      | ~5-15s/site      | ~10-30s       |
| **Area coverage**  | All 4        | Hirafu focus  | All areas  | Configured sites | Hirafu focus  |
| **Price currency** | Multi (→JPY) | JPY direct    | JPY        | Multi (→JPY)     | JPY           |
| **Coordinates**    | Yes (GPS)    | No            | No         | No               | No            |
| **Japanese names** | Yes          | No            | Optional   | No               | No            |
| **Stars/rating**   | Yes          | Yes           | No         | No               | No            |
| **Scheduling**     | Hourly       | Hourly        | Daily      | Every 6h         | Hourly        |
| **Cost**           | API quota    | Free tier     | Free       | Free             | Free          |

---

## 6. FAQ

### General

**Q: What region does this system cover?**
A: Niseko, Hokkaido, Japan — specifically the 4 main ski resort areas: Hirafu, Niseko Village, Annupuri, and Hanazono. Total estimated coverage: ~73 properties across all areas.

**Q: How often are prices updated?**
A: Depends on the source. RateHawk, Google Hotels, and RoomBoss scrape hourly. Playwright scrapes every 6 hours. nisade.com scrapes daily. The queue processor runs every 2 minutes. Data quality checks run hourly.

**Q: What happens if a source fails?**
A: Each source operates independently via `Promise.allSettled`. If one fails, others still succeed. Failed sources are tracked in metrics (`hotel_scraper_task_error`), in the scheduler error map, and in data quality reports. The queue processor retries failed requests up to 3 times.

**Q: How are duplicate hotels handled across sources?**
A: Entity resolution uses a weighted scoring system:

- 50% geographic proximity (Haversine distance, threshold 50m)
- 30% English name similarity (Jaro-Winkler, threshold 85%)
- 15% Japanese name similarity
- 5% address matching
  Hotels scoring above 70% confidence are auto-merged. Those between 50-70% are flagged for manual review.

**Q: How are duplicate prices handled?**
A: Price dedup groups entries by `hotelId|source|checkIn|checkOut|guests`. Within each group, only the lowest price is kept; others are marked for deletion.

### Technical

**Q: Where is data stored?**
A: Two storage layers:

1. **In-memory** (`Map<string, ScrapeJob>`): Active jobs and recent results. Fast access, lost on restart.
2. **Convex** (10 tables): Long-term persistent storage with queries, mutations, and indexes. Used for hotel master data, historical prices, alerts, selector tracking.

**Q: What is the Convex URL?**
A: Default `http://10.1.7.158:3210`. Configurable via `CONVEX_URL` environment variable. Part of the Docker monitoring stack.

**Q: What is the Playwright service?**
A: A HuggingFace Spaces deployment (`igoraid-playwright-hotel-scraper.hf.space`) running Playwright for browser-based scraping. Used by both the Playwright official scraper and the RoomBoss scraper. It may have cold start delays.

**Q: How does the scheduler work?**
A: Uses `setInterval` with staggered starts (0-30s random delay per task). Each task runs a scrape for its assigned source or a system task (queue processing, dedup, quality check). State tracked in Maps for lastRun, runCount, errors. Heartbeat interval ensures scheduler liveness.

**Q: What is the neural graph integration?**
A: The hotel-scraper seeds 6 nodes (1 coordinator + 5 data sources) and 11 edges into the OpenClaw neural graph (Convex-backed). This enables visualization of the hotel scraper within the system-wide neural topology on the /monitor dashboard.

**Q: How are prices converted to JPY?**
A: Static fallback rates in `config.ts`: USD=150, AUD=100, EUR=165, GBP=190, RMB=21. The `currencyRates` Convex table supports live rate updates via the `updateCurrencyRate` mutation.

### Operational

**Q: How do I add a new hotel to the system?**
A: Use the Convex `addHotel` mutation with: slug, name (en/ja/zh), location, area, seasonal rates (peak/cny/mid/low/end/pre), bedrooms, maxGuests, size, and optional booking URLs. Hotels are created enabled with priority 1.

**Q: How do I add a new official website for Playwright scraping?**
A: Add a record to the `websiteMetadata` Convex table with: hotelId, officialWebsite, bookingEngine (guesty/bookingsync/custom/unknown), optional bookingWidgetUrl, priceSelector, calendarSelector. The Playwright scraper reads these configs.

**Q: How do I check CSS selector health?**
A: The `selectorTracking` table records per-hotel selector success rates. Query it for `consecutiveFailures > 0` to find broken selectors. Individual attempts are logged in `selectorAttempts`.

**Q: How do I monitor scrape progress in real-time?**
A: The `scrapeProgress` table holds live progress per job (phase, hotel, source, progress percentage, message). Entries auto-expire after 1 hour (TTL).

**Q: How do I view alerts?**
A: `curl http://127.0.0.1:3001/api/hotel-scraper/status` includes alert counts. The Convex `alerts` table stores all alerts with type, severity, message, and acknowledgement state. Active alerts: query `alerts` where `acknowledged = false`.

**Q: What are the system tasks in the scheduler?**
A:

- `queue_processor` (every 2 min): Picks pending scrape requests from queue, runs them with retry logic
- `data_quality_hourly`: Checks freshness, success rates, generates alerts for stale/failed sources
- `price_dedup_hourly`: Groups prices by hotel+source+dates, keeps lowest, deletes duplicates
- `progress_cleanup_hourly`: Deletes expired `scrapeProgress` entries (TTL > 1 hour)

---

## Appendix A: Hotel Data Model

```typescript
type Hotel = {
  hotelId: string; // Source-prefixed ID (e.g., "ratehawk-12345")
  canonicalId?: string; // Merged canonical ID after entity resolution
  aliases?: string[]; // Alternative names

  source: string; // Origin source
  providerName: string; // Display name for the source
  sources?: string[]; // All sources that have data for this hotel

  name: string; // English name
  nameJa?: string; // Japanese name
  nameZh?: string; // Chinese name

  location: {
    prefecture: string; // "Hokkaido"
    city: string; // "Kutchan"
    district: string; // "Hirafu" | "Village" | "Annupuri" | "Hanazono"
    address: string;
    coordinates: { lat: number; lon: number };
  };

  price: number; // Total stay price in original currency
  currency: string; // Original currency code
  priceInYen: number; // Normalized to JPY

  checkIn: string; // YYYY-MM-DD
  checkOut: string; // YYYY-MM-DD
  nights: number;
  guests: number;

  availability: boolean;
  url: string; // Booking URL
  lastUpdated: number; // Epoch ms

  stars?: number;
  bedrooms?: number;
  maxGuests?: number;
};
```

## Appendix B: Convex Schema Quick Reference

| Table            | Records            | Key Fields                                                                     |
| ---------------- | ------------------ | ------------------------------------------------------------------------------ |
| hotels           | ~73 properties     | slug, name, nameJa, nameZh, niseko_area, 7 seasonal rates, bedrooms, maxGuests |
| prices           | Growing            | hotelId, source, priceInYen, checkIn/Out, guests, scrapedAt                    |
| scrapeJobs       | Growing            | status, type, sources, checkIn/Out, startedAt/completedAt                      |
| currencyRates    | 6 currencies       | fromCurrency, toYen, updatedAt                                                 |
| websiteMetadata  | Per hotel          | hotelId, officialWebsite, bookingEngine, priceSelector                         |
| selectorTracking | Per hotel+selector | totalAttempts, successfulAttempts, consecutiveFailures                         |
| selectorAttempts | Growing            | hotelId, selector, success, priceFound, timestamp                              |
| alerts           | Growing            | type, severity, message, acknowledged, createdAt                               |
| scrapeProgress   | Transient (TTL 1h) | jobId, phase, progress, message                                                |
| scrapeRequests   | Queue              | status, priority, checkIn/Out, strategy, retryCount                            |

## Appendix C: RoomBoss Hotel IDs

30 Vacation Niseko property IDs are hardcoded in `scrapers/types.ts`:

```
8a80818a89e080a50189e26f0b792fc6, 2c98902a536277ac015369c4eff3572e,
40288094178b572e01178b578ff00001, 2c98902a62266df1016227c2cc451b5d,
2c98902a5ac97fd0015aca6bc7320de2, 8a80818a992a98eb01992cf953c114ac,
... (30 total)
```

These map to properties on `stay.vacationniseko.com`.
