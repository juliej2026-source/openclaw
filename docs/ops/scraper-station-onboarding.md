# SCRAPER Station Network Onboarding

**Station:** SCRAPER (10.1.7.180)
**Date:** 2026-02-11
**Prepared by:** IOT-HUB (10.1.7.158)
**Status:** Active — previously decommissioned, now re-activated in hive-mind

---

## 1. Network Identity

| Field           | Value                                                 |
| --------------- | ----------------------------------------------------- |
| IP Address      | `10.1.7.180`                                          |
| Station Label   | `SCRAPER`                                             |
| Role            | `worker`                                              |
| Current Service | Hotel Rate Calculator (Next.js + Convex) on port 3001 |
| Gateway         | UDM Pro (`10.1.7.1`)                                  |
| Connection Type | Wired (Ethernet)                                      |
| Network         | `10.1.7.0/24` (LAN)                                   |

### Known Stations on the Network

| IP              | Label     | Role                  | Status                                        |
| --------------- | --------- | --------------------- | --------------------------------------------- |
| `10.1.7.1`      | UDM Pro   | Gateway               | Online                                        |
| `10.1.7.87`     | Julie     | AI Orchestrator       | Online (degraded — Qdrant down)               |
| `10.1.7.158`    | IOT-HUB   | Meta-Intelligence Hub | Online                                        |
| `10.1.7.180`    | SCRAPER   | Hotel Rate Worker     | Online (health check failing — see Section 3) |
| `10.1.7.239`    | CLERK     | Task Worker           | Unreachable                                   |
| `10.1.7.131`    | Bravia TV | Smart TV              | Online                                        |
| `192.168.128.1` | HR02 5G   | NTT Docomo 5G Modem   | Online (backup WAN)                           |

---

## 2. What Changed

SCRAPER was previously listed as **decommissioned** in the hive-mind codebase. The following changes have been made to re-activate it:

1. **`unifi-types.ts`** — `DECOMMISSIONED_STATIONS` emptied (was `Set(["10.1.7.180"])`, now `Set<string>()`)
2. **`unifi-types.ts`** — SCRAPER comment updated to "Hotel Rate Calculator (Next.js + Convex) on port 3001"
3. **`monitor-page.ts`** — SCRAPER role changed from `"decommissioned"` to `"worker"`
4. **`portal/htdocs/js/topology.js`** — Same role change for portal topology view
5. **`channel-welcome.ts`** — SCRAPER listed as active station in Discord `#hive-network` channel
6. **`alert-manager.test.ts`** — Test updated to expect alerts when SCRAPER goes offline
7. **Network topology** — SCRAPER appears as a green `worker` node connected to UDM Pro

**Impact:** The network scanner now actively monitors SCRAPER. If its health check fails, a `station_offline` alert is fired and posted to the `#hive-alerts` Discord channel.

---

## 3. CRITICAL: Health Check Endpoint

### What the Network Scanner Expects

The hive-mind network scanner (running on IOT-HUB) pings every known station every **30 seconds** on port **3001**:

```
GET http://10.1.7.180:3001/health
```

**Expected response:** HTTP 200 with a JSON body. Any 200 response marks the station as `reachable`. Example:

```json
{
  "status": "alive",
  "station": "scraper",
  "timestamp": "2026-02-11T12:00:00.000Z"
}
```

The scanner code (`network-scanner.ts:60-78`):

```typescript
async function pingStation(ip: string, port: number): Promise<StationPingResult> {
  try {
    await fetch(`http://${ip}:${port}/health`, {
      signal: AbortSignal.timeout(3_000),
    });
    return { ip, label, reachable: true, latencyMs: Date.now() - start };
  } catch {
    return { ip, label, reachable: false };
  }
}
```

Key details:

- **Timeout:** 3 seconds. If no response within 3s, station is marked unreachable.
- **Any HTTP response** (even 4xx/5xx) counts as reachable — the `fetch()` only throws on network errors and timeouts.
- **Redirects:** By default, `fetch()` follows redirects. A 307 redirect to `/login` is followed automatically. If the redirected page returns 200, the station appears reachable. If it times out or errors, it appears unreachable.

### Current Problem

The SCRAPER's Next.js app on port 3001 returns a **307 redirect** to `/login` when `/health` is hit. This may cause inconsistent health check results depending on whether the redirect chain completes within 3 seconds.

### Recommended Fix

Add a dedicated `/health` API route to the Next.js app that returns 200 immediately **without authentication**:

**For Next.js App Router** (`app/health/route.ts` or `app/api/health/route.ts`):

```typescript
export async function GET() {
  return Response.json({
    status: "alive",
    station: "scraper",
    service: "hotel-rate-calculator",
    timestamp: new Date().toISOString(),
  });
}
```

**For Next.js Pages Router** (`pages/api/health.ts`):

```typescript
export default function handler(req, res) {
  res.status(200).json({
    status: "alive",
    station: "scraper",
    service: "hotel-rate-calculator",
    timestamp: new Date().toISOString(),
  });
}
```

This endpoint must:

- Return HTTP 200
- Be unauthenticated (no redirect to `/login`)
- Respond within 3 seconds
- Return valid JSON

---

## 4. Julie Registration Protocol

Julie is the AI orchestrator at `10.1.7.87:8000`. Stations register with Julie to participate in the hive mind's task routing and capability discovery.

### Registration Endpoint

```
POST http://10.1.7.87:8000/api/v1/orchestration/hive/register
Content-Type: application/json
```

**Payload format:**

```json
{
  "agent_id": "scraper",
  "identity_data": {
    "capabilities": ["hotel_scraping", "price_comparison", "web_scraping", "data_collection"],
    "availableModels": [],
    "version": "1.0.0",
    "platform": "linux",
    "layers": {
      "hotel_scraper": {
        "name": "Hotel Scraper",
        "description": "Niseko hotel price comparison — 5 data sources",
        "tools": ["hotel_scrape", "hotel_prices", "hotel_compare"],
        "cli_commands": 0,
        "hooks": [],
        "providers": ["ratehawk", "apify", "nisade", "playwright", "roomboss"],
        "status": "active"
      }
    },
    "commands": ["scraper:status", "scraper:run", "scraper:prices"],
    "endpoints": [
      { "path": "/health", "method": "GET" },
      { "path": "/api/scraper/status", "method": "GET" },
      { "path": "/api/scraper/jobs", "method": "GET" },
      { "path": "/api/scraper/prices", "method": "GET" }
    ],
    "runtime": {
      "uptime_seconds": 86400
    }
  }
}
```

**Expected response:**

```json
{
  "success": true,
  "agent_id": "scraper",
  "capabilities": ["hotel_scraping", "price_comparison"],
  "dynamic": true
}
```

### Registration Frequency

IOT-HUB registers every **5 minutes**. SCRAPER should do the same to keep its capabilities current in Julie's routing table.

### Julie Health Check

```
GET http://10.1.7.87:8000/api/v1/health
```

Returns 200 if Julie is available. Check this before attempting registration.

### Execution Reporting

After completing a task, report it to Julie for the performance learning loop:

```
POST http://10.1.7.87:8000/api/v1/orchestration/hive/record
Content-Type: application/json
```

```json
{
  "station_id": "scraper",
  "task_type": "hotel_scraping",
  "success": true,
  "latency_ms": 45000,
  "quality_score": 0.95,
  "capabilities_used": ["hotel_scraping", "web_scraping"],
  "timestamp": "2026-02-11T12:00:00.000Z"
}
```

---

## 5. IOT-HUB Command Protocol

IOT-HUB exposes a command dispatch API. Other stations can call it to interact with the hive:

```
POST http://10.1.7.158:3001/api/network/command
Content-Type: application/json
```

```json
{
  "command": "network:scan",
  "params": {},
  "request_id": "optional-tracking-id"
}
```

### Available Commands (61 total)

**Network commands:**

- `ping` — basic health check
- `capabilities` — station identity and capabilities
- `network:scan` — latest network scan results
- `network:stations` — station reachability
- `network:path` — dual-WAN state
- `network:switch` — switch WAN path (`params: { path: "primary" | "hr02_5g" }`)
- `network:5g` — HR02 5G modem status
- `network:alerts` — get alerts (`params: { active: true, limit: 20 }`)
- `network:alerts:ack` — acknowledge alert (`params: { id: "alert-..." }`)
- `network:failover` — failover state

**Meta-engine commands:**

- `meta:classify` — classify a task (`params: { text: "..." }`)
- `meta:recommend` — recommend best model for a task
- `meta:score` — score models for a task type
- `meta:hardware` — hardware detection (CPU, GPU, RAM)
- `meta:models` — Ollama model inventory
- `meta:status` — combined hardware + models + engine status
- `meta:dashboard` — full dashboard
- `meta:train` — start training job
- `meta:train:jobs` — list training jobs
- `meta:train:adapters` — list LoRA adapters
- `meta:search` — search HuggingFace models
- `meta:evaluate` — evaluate a model

**UniFi commands:**

- `unifi:status`, `unifi:devices`, `unifi:clients`, `unifi:health`
- `unifi:stations`, `unifi:alerts`, `unifi:snapshot`
- `unifi:cloud:discover`, `unifi:cloud:status`

**Neural graph commands:**

- `neural:status`, `neural:topology`, `neural:evolve`, `neural:query`

**HuggingFace commands:**

- `hf:spaces`, `hf:datasets`, `hf:models`, `hf:jobs`, `hf:status`

---

## 6. IOT-HUB API Endpoints

Direct HTTP endpoints on IOT-HUB (`http://10.1.7.158:3001`):

| Path                     | Method | Description              |
| ------------------------ | ------ | ------------------------ |
| `/health`                | GET    | Health check             |
| `/api/network/ping`      | GET    | Ping response            |
| `/api/network/identity`  | GET    | Station identity         |
| `/api/network/command`   | POST   | Command dispatch         |
| `/api/network/scan`      | GET    | Network scan results     |
| `/api/network/path`      | GET    | Dual-WAN state           |
| `/api/network/dashboard` | GET    | Full dashboard           |
| `/api/unifi/snapshot`    | GET    | UniFi full snapshot      |
| `/api/unifi/devices`     | GET    | UniFi devices            |
| `/api/unifi/clients`     | GET    | UniFi clients            |
| `/api/unifi/health`      | GET    | UniFi health             |
| `/api/unifi/stations`    | GET    | Station views            |
| `/api/unifi/alerts`      | GET    | UniFi alerts             |
| `/api/neural/status`     | GET    | Neural graph status      |
| `/api/neural/topology`   | GET    | Neural graph topology    |
| `/api/neural/events`     | GET    | Neural graph events      |
| `/api/neural/pending`    | GET    | Pending neural approvals |
| `/metrics`               | GET    | Prometheus metrics       |
| `/monitor`               | GET    | HTML monitor page        |

---

## 7. Alert System

When SCRAPER's health check fails, the alert manager fires a `station_offline` alert:

```json
{
  "id": "alert-1707654321000-a1b2c3",
  "type": "station_offline",
  "severity": "warning",
  "message": "Station SCRAPER (10.1.7.180) went offline",
  "source": "iot-hub",
  "target": "10.1.7.180",
  "timestamp": "2026-02-11T12:00:00.000Z",
  "acknowledged": false,
  "metadata": { "station_label": "SCRAPER" }
}
```

When SCRAPER comes back, a `station_online` alert fires:

```json
{
  "type": "station_online",
  "severity": "info",
  "message": "Station SCRAPER (10.1.7.180) came back online"
}
```

Alerts are:

- Persisted to `~/.openclaw/hive-mind/alerts.json`
- Posted to `#hive-alerts` Discord channel as embeds with Acknowledge buttons
- Available via `network:alerts` command and `/api/network/dashboard`
- Exported as Prometheus metrics

---

## 8. Discord Integration

The hive-mind bot (Hive Mind#5969) runs 8 Discord channels:

| Channel           | Purpose                             |
| ----------------- | ----------------------------------- |
| `#hive-alerts`    | Real-time infrastructure alerts     |
| `#hive-status`    | Periodic health reports (30m/1h/6h) |
| `#hive-network`   | Network topology changes            |
| `#hive-scraper`   | Hotel scraper activity and prices   |
| `#hive-neural`    | Neural graph evolution              |
| `#hive-models`    | AI model inventory changes          |
| `#hive-ai`        | Free-form AI conversations          |
| `#hive-execution` | Command execution logs              |

SCRAPER activity is reported in `#hive-scraper`. Available Discord commands:

- `/hive scraper status` — scraper health
- `/hive scraper jobs` — list recent jobs
- `/hive scraper prices` — latest prices
- `/hive scraper run` — start a new scrape
- `!scraper` — quick status (message command)

---

## 9. Dual-WAN Configuration

The network has two WAN paths:

| Path      | Provider       | Gateway                      | Status  |
| --------- | -------------- | ---------------------------- | ------- |
| `primary` | The 1898 Moiwa | UDM Pro (`10.1.7.1`)         | Default |
| `hr02_5g` | NTT Docomo 5G  | HR02 Modem (`192.168.128.1`) | Backup  |

Auto-failover triggers after **3 consecutive failures** on the primary path. Failback occurs after **2 consecutive successes** on the primary. SCRAPER should be aware that during failover, its external connectivity routes through the 5G modem.

---

## 10. Prometheus Metrics

IOT-HUB exports Prometheus metrics at `http://10.1.7.158:3001/metrics`. SCRAPER can scrape this for network-wide health data, or export its own metrics for the central Grafana dashboard.

Recommended metrics for SCRAPER to export:

```
# HELP scraper_jobs_total Total scraper jobs executed
# TYPE scraper_jobs_total counter
scraper_jobs_total{status="success"} 42
scraper_jobs_total{status="failure"} 3

# HELP scraper_prices_collected Total prices collected
# TYPE scraper_prices_collected gauge
scraper_prices_collected{source="ratehawk"} 156
scraper_prices_collected{source="google"} 89

# HELP scraper_job_duration_seconds Last job duration
# TYPE scraper_job_duration_seconds gauge
scraper_job_duration_seconds 45.2
```

---

## 11. Checklist: Bringing SCRAPER Online

1. **[ ] Add `/health` endpoint** — Must return HTTP 200 JSON without auth (see Section 3)
2. **[ ] Verify health check** — `curl http://10.1.7.180:3001/health` should return 200 JSON
3. **[ ] Register with Julie** — POST to `http://10.1.7.87:8000/api/v1/orchestration/hive/register`
4. **[ ] Set up periodic re-registration** — Every 5 minutes, re-register with fresh runtime state
5. **[ ] Report executions** — After each scrape job, POST to Julie's `/hive/record` endpoint
6. **[ ] Export Prometheus metrics** — Add `/metrics` endpoint for Grafana dashboard
7. **[ ] Verify from IOT-HUB** — Run `curl http://10.1.7.158:3001/api/network/command -d '{"command":"network:stations"}'` and confirm SCRAPER shows as reachable
8. **[ ] Verify Discord alerts** — Take SCRAPER offline briefly, confirm `station_offline` alert appears in `#hive-alerts`

---

## 12. Environment Reference

Env vars used by the hive-mind system (for reference if SCRAPER needs to integrate):

| Variable                 | Purpose               | Example                  |
| ------------------------ | --------------------- | ------------------------ |
| `DISCORD_BOT_TOKEN`      | Discord bot auth      | (ask admin)              |
| `DISCORD_GUILD_ID`       | Discord server ID     | (ask admin)              |
| `UNIFI_HOST`             | UDM Pro address       | `10.1.7.1`               |
| `OPENCLAW_GATEWAY_URL`   | AI agent runtime      | `http://127.0.0.1:18789` |
| `OPENCLAW_GATEWAY_TOKEN` | AI agent auth token   | (ask admin)              |
| `HF_TOKEN`               | HuggingFace API token | (ask admin)              |
| `CONVEX_URL`             | Convex backend        | `http://127.0.0.1:3210`  |

---

## 13. Quick Test Commands

Run these from the SCRAPER machine to verify connectivity:

```bash
# Check IOT-HUB is reachable
curl -s http://10.1.7.158:3001/health | jq .

# Check Julie is reachable
curl -s http://10.1.7.87:8000/api/v1/health | jq .

# Get network scan from IOT-HUB
curl -s http://10.1.7.158:3001/api/network/scan | jq .stations

# Get full dashboard
curl -s http://10.1.7.158:3001/api/network/dashboard | jq .

# Get active alerts
curl -s -X POST http://10.1.7.158:3001/api/network/command \
  -H "Content-Type: application/json" \
  -d '{"command": "network:alerts", "params": {"active": true}}' | jq .

# Test self health check (must return 200)
curl -v http://localhost:3001/health
```
