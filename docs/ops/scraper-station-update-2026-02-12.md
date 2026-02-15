# IOT-HUB Update Bulletin for SCRAPER Station

**From:** IOT-HUB (`10.1.7.158:3001`)
**To:** SCRAPER (`10.1.7.180:3001`)
**Date:** 2026-02-12
**Subject:** Critical connectivity fix + new peer protocol integration

---

## 1. CRITICAL: IOT-HUB Is Now Reachable

IOT-HUB was bound to `127.0.0.1:3001` (localhost only). This is why SCRAPER's report showed:

```
IOT-HUB  10.1.7.158:3001  UNREACHABLE  Connection refused
```

**Fixed.** IOT-HUB now binds to `0.0.0.0:3001`. SCRAPER should immediately re-test connectivity:

```bash
curl -s http://10.1.7.158:3001/health | jq .
```

Expected response:

```json
{
  "status": "alive",
  "station": "iot-hub",
  "timestamp": "2026-02-12T02:30:00.000Z",
  "message": "IOT-HUB Meta-Intelligence Node ready"
}
```

**Action required:** Remove any workaround or fallback logic that was in place due to IOT-HUB being unreachable. Re-enable all peer connectivity checks.

---

## 2. IOT-HUB Identity

Updated IOT-HUB station profile that SCRAPER should store:

```json
{
  "station_id": "iot-hub",
  "ip": "10.1.7.158",
  "port": 3001,
  "platform": "linux",
  "capabilities": [
    "model_management",
    "model_training",
    "task_classification",
    "hardware_detection",
    "model_scoring",
    "dataset_curation",
    "lora_adapters",
    "model_evaluation",
    "huggingface_search",
    "iot",
    "smart_home",
    "sensors",
    "network_monitoring",
    "dual_wan",
    "linux",
    "neural_graph",
    "web_scraping",
    "data_collection",
    "huggingface_management",
    "hotel_scraping",
    "price_comparison",
    "discord_notifications",
    "discord_gateway",
    "discord_commands",
    "network_control",
    "alert_management",
    "tandem_tasks",
    "julie_delegation"
  ]
}
```

Key additions: `tandem_tasks` and `julie_delegation` — IOT-HUB now speaks the same bilateral protocol as SCRAPER.

---

## 3. New IOT-HUB Endpoints

Four new endpoints that match SCRAPER's tandem/delegation protocol:

| Endpoint                           | Method | Auth    | Description                  |
| ---------------------------------- | ------ | ------- | ---------------------------- |
| `/api/network/tandem`              | POST   | API Key | Receive inbound tandem tasks |
| `/api/network/tandem/callback`     | POST   | API Key | Receive tandem task results  |
| `/api/network/delegation/inbound`  | POST   | API Key | Receive delegated tasks      |
| `/api/network/delegation/callback` | POST   | API Key | Receive delegation results   |

**Authentication:** All POST endpoints require `X-API-Key` header:

```
X-API-Key: openclaw-network-2026-kelvin
```

### Full IOT-HUB Endpoint Map (22 endpoints)

```
GET  /health
GET  /api/network/ping
GET  /api/network/identity
POST /api/network/command
GET  /api/network/scan
GET  /api/network/path
GET  /api/network/dashboard
POST /api/network/tandem              <-- NEW
POST /api/network/tandem/callback     <-- NEW
POST /api/network/delegation/inbound  <-- NEW
POST /api/network/delegation/callback <-- NEW
GET  /api/apache/status
GET  /api/unifi/snapshot
GET  /api/unifi/devices
GET  /api/unifi/clients
GET  /api/unifi/health
GET  /api/unifi/stations
GET  /api/unifi/alerts
GET  /api/neural/status
GET  /api/neural/topology
GET  /api/neural/events
GET  /api/neural/pending
GET  /metrics
GET  /monitor
```

---

## 4. Tandem Task Protocol Specification

IOT-HUB now implements the same tandem task protocol SCRAPER uses. Both stations can now send bilateral tasks to each other.

### 4.1 Sending a Tandem Task to IOT-HUB

```
POST http://10.1.7.158:3001/api/network/tandem
Content-Type: application/json
X-API-Key: openclaw-network-2026-kelvin
```

```json
{
  "task_id": "tandem-1707700000-abc123",
  "from_station": "scraper",
  "task_type": "meta:classify",
  "payload": {
    "text": "Compare hotel prices in Hirafu for March"
  },
  "callback_url": "http://10.1.7.180:3001/api/network/tandem/callback",
  "timeout_ms": 30000
}
```

**Response (immediate, HTTP 202):**

```json
{
  "accepted": true,
  "task_id": "tandem-1707700000-abc123",
  "station_id": "iot-hub"
}
```

IOT-HUB executes the task asynchronously and POSTs the result to `callback_url`:

```json
{
  "task_id": "tandem-1707700000-abc123",
  "station_id": "iot-hub",
  "success": true,
  "result": { "task_type": "analysis", "complexity": "medium", "confidence": 0.85 },
  "latency_ms": 42
}
```

### 4.2 Type Definitions

These are the exact types both stations must implement:

```typescript
type TandemTaskRequest = {
  task_id: string; // Unique ID, format: "tandem-{timestamp}-{random}"
  from_station: string; // Sender station ID
  task_type: string; // Command to execute (maps to command-dispatch handler)
  payload: Record<string, unknown>; // Command parameters
  callback_url: string; // Where to POST the result
  timeout_ms?: number; // Optional timeout (default: 30000)
};

type TandemTaskResponse = {
  accepted: boolean;
  task_id: string;
  station_id: string;
  error?: string;
};

type TandemTaskCallback = {
  task_id: string;
  station_id: string;
  success: boolean;
  result?: unknown;
  error?: string;
  latency_ms: number;
};
```

### 4.3 Tandem Task Types SCRAPER Can Delegate to IOT-HUB

These commands are particularly useful for SCRAPER to delegate:

| Command            | Description                         | Params                 |
| ------------------ | ----------------------------------- | ---------------------- |
| `meta:classify`    | Classify a task type                | `{ text: "..." }`      |
| `meta:recommend`   | Recommend best model for a task     | `{ text: "..." }`      |
| `meta:score`       | Score models for a task type        | `{ task_type: "..." }` |
| `meta:hardware`    | Get IOT-HUB hardware info           | `{}`                   |
| `meta:models`      | List Ollama models on IOT-HUB       | `{}`                   |
| `meta:status`      | Combined hardware + models + engine | `{}`                   |
| `network:scan`     | Latest network scan                 | `{}`                   |
| `network:stations` | Station reachability                | `{}`                   |
| `network:alerts`   | Get alerts                          | `{ active: true }`     |
| `network:path`     | Dual-WAN state                      | `{}`                   |
| `neural:status`    | Neural graph status                 | `{}`                   |
| `neural:query`     | Route a task through neural graph   | `{ task: "..." }`      |
| `hf:status`        | HuggingFace summary                 | `{}`                   |

---

## 5. Delegation Protocol Specification

Delegation is like tandem but typically Julie-mediated. The wire format is:

### 5.1 Sending a Delegation to IOT-HUB

```
POST http://10.1.7.158:3001/api/network/delegation/inbound
Content-Type: application/json
X-API-Key: openclaw-network-2026-kelvin
```

```json
{
  "task_id": "deleg-1707700000-xyz789",
  "from_station": "scraper",
  "delegated_by": "julie",
  "command": "network:scan",
  "params": {},
  "callback_url": "http://10.1.7.180:3001/api/network/delegation/callback"
}
```

**Response (immediate, HTTP 202):**

```json
{
  "accepted": true,
  "task_id": "deleg-1707700000-xyz789",
  "station_id": "iot-hub"
}
```

Result delivered to `callback_url` asynchronously.

### 5.2 Delegation Types

```typescript
type DelegationRequest = {
  task_id: string;
  from_station: string;
  delegated_by?: string; // "julie" if Julie-mediated
  command: string; // Command to execute
  params?: Record<string, unknown>;
  callback_url?: string; // Optional — fire-and-forget if omitted
};

type DelegationResponse = {
  accepted: boolean;
  task_id: string;
  station_id: string;
  error?: string;
};
```

---

## 6. Command Dispatch Protocol

SCRAPER can also use the standard command dispatch endpoint (same as before, but now reachable):

```
POST http://10.1.7.158:3001/api/network/command
Content-Type: application/json
X-API-Key: openclaw-network-2026-kelvin
```

```json
{
  "command": "meta:dashboard",
  "params": {},
  "request_id": "optional-tracking-id"
}
```

### Full Command List (75 commands)

**Core:**
`ping`, `capabilities`

**Meta-engine:**
`meta:classify`, `meta:score`, `meta:recommend`, `meta:hardware`, `meta:models`, `meta:status`, `meta:train`, `meta:train:jobs`, `meta:train:adapters`, `meta:dashboard`, `meta:search`, `meta:search:files`, `meta:evaluate`

**UniFi:**
`unifi:status`, `unifi:devices`, `unifi:clients`, `unifi:health`, `unifi:stations`, `unifi:alerts`, `unifi:snapshot`, `unifi:cloud:discover`, `unifi:cloud:status`

**Network:**
`network:scan`, `network:udm`, `network:stations`, `network:path`, `network:switch`, `network:5g`, `network:alerts`, `network:alerts:ack`, `network:failover`

**Neural graph:**
`neural:status`, `neural:topology`, `neural:evolve`, `neural:query`

**HuggingFace:**
`hf:spaces`, `hf:spaces:info`, `hf:datasets`, `hf:datasets:info`, `hf:models`, `hf:models:info`, `hf:jobs`, `hf:jobs:info`, `hf:status`

**SCRAPER (proxy — forwards to SCRAPER via peer client):**
`scraper:status`, `scraper:prices`, `scraper:jobs`, `scraper:run`

**Peer management:**
`peer:status`, `peer:tandem`, `peer:delegate`

---

## 7. IOT-HUB Knows About SCRAPER

IOT-HUB now has SCRAPER registered as a peer station with this profile:

```json
{
  "station_id": "scraper",
  "ip": "10.1.7.180",
  "port": 3001,
  "platform": "darwin",
  "llm_model": "qwen2.5:7b",
  "capabilities": [
    "niseko_intel",
    "price_monitoring",
    "hotel_scraping",
    "anomaly_detection",
    "local_llm",
    "family_report",
    "tandem_tasks",
    "julie_delegation",
    "web_scraping"
  ],
  "endpoints": [
    { "path": "/health", "method": "GET" },
    { "path": "/api/network/ping", "method": "GET" },
    { "path": "/api/network/command", "method": "POST" },
    { "path": "/api/network/monitor", "method": "GET" },
    { "path": "/api/network/delegation/inbound", "method": "POST" },
    { "path": "/api/network/delegation/callback", "method": "POST" },
    { "path": "/api/network/tandem", "method": "POST" },
    { "path": "/api/network/tandem/callback", "method": "POST" }
  ]
}
```

**Verify this is accurate.** If SCRAPER has additional endpoints or capabilities not listed above, report them back to IOT-HUB so the peer registry can be updated.

---

## 8. What IOT-HUB Expects from SCRAPER

### 8.1 Health Check (every 30 seconds)

IOT-HUB's network scanner pings SCRAPER every 30 seconds:

```
GET http://10.1.7.180:3001/health
Timeout: 3 seconds
```

SCRAPER already has this working (confirmed in station report). No changes needed.

### 8.2 Command Dispatch Format

When IOT-HUB sends tandem tasks or delegations to SCRAPER, it sends to:

- `POST /api/network/tandem` with `X-API-Key: openclaw-network-2026-kelvin`
- `POST /api/network/delegation/inbound` with `X-API-Key: openclaw-network-2026-kelvin`

**SCRAPER must validate the API key on these endpoints.** The shared key is:

```
openclaw-network-2026-kelvin
```

### 8.3 IOT-HUB Will Proxy Commands to SCRAPER

When someone runs `scraper:status`, `scraper:prices`, `scraper:jobs`, or `scraper:run` on IOT-HUB (via Discord slash commands or the command API), IOT-HUB forwards the request to SCRAPER via:

```
POST http://10.1.7.180:3001/api/network/command
X-API-Key: openclaw-network-2026-kelvin
```

```json
{
  "command": "scraper:prices",
  "params": { "area": "hirafu" }
}
```

**SCRAPER must handle these command names in its own command dispatch handler.** The expected commands are:

| Command          | What IOT-HUB sends                                 | Expected response                                      |
| ---------------- | -------------------------------------------------- | ------------------------------------------------------ |
| `ping`           | `{ "command": "ping" }`                            | `{ "station_id": "scraper", "status": "online", ... }` |
| `scraper:status` | `{ "command": "scraper:status" }`                  | Scraper health data                                    |
| `scraper:prices` | `{ "command": "scraper:prices", "params": {...} }` | Latest price data                                      |
| `scraper:jobs`   | `{ "command": "scraper:jobs", "params": {...} }`   | Recent job list                                        |
| `scraper:run`    | `{ "command": "scraper:run", "params": {...} }`    | Job accepted response                                  |

---

## 9. Julie Registration Update

SCRAPER's registration to Julie should include IOT-HUB as a known peer:

```json
{
  "agent_id": "scraper",
  "identity_data": {
    "capabilities": [
      "niseko_intel",
      "price_monitoring",
      "hotel_scraping",
      "anomaly_detection",
      "local_llm",
      "family_report",
      "tandem_tasks",
      "julie_delegation",
      "web_scraping"
    ],
    "availableModels": ["qwen2.5:7b"],
    "version": "0.1.0",
    "platform": "darwin",
    "layers": {
      "hotel_scraper": {
        "name": "Hotel Scraper",
        "description": "Niseko hotel price intelligence — multi-source tracking, anomaly detection, family reports",
        "tools": ["hotel_scrape", "hotel_prices", "hotel_compare", "anomaly_detect"],
        "cli_commands": 0,
        "hooks": [],
        "providers": ["booking", "expedia", "nisade", "playwright", "roomboss"],
        "status": "active"
      },
      "local_llm": {
        "name": "Local LLM",
        "description": "Ollama qwen2.5:7b — CPU-only inference with speed-probe fallback",
        "tools": ["llm_generate", "llm_classify"],
        "cli_commands": 0,
        "hooks": [],
        "providers": ["ollama"],
        "status": "active"
      }
    },
    "commands": ["ping", "scraper:status", "scraper:prices", "scraper:jobs", "scraper:run"],
    "endpoints": [
      { "path": "/health", "method": "GET" },
      { "path": "/api/network/ping", "method": "GET" },
      { "path": "/api/network/command", "method": "POST" },
      { "path": "/api/network/monitor", "method": "GET" },
      { "path": "/api/network/delegation/inbound", "method": "POST" },
      { "path": "/api/network/delegation/callback", "method": "POST" },
      { "path": "/api/network/tandem", "method": "POST" },
      { "path": "/api/network/tandem/callback", "method": "POST" }
    ],
    "runtime": {
      "uptime_seconds": 86400,
      "network": {
        "active_path": "primary",
        "failover_active": false,
        "scanner_running": true,
        "stations_online": 2,
        "stations_total": 5
      }
    }
  }
}
```

---

## 10. Discord Integration

IOT-HUB runs the Hive Mind Discord bot with 8 channels. SCRAPER activity appears in `#hive-scraper`.

The following Discord commands proxy to SCRAPER:

| Discord Command        | Maps To          | What Happens                                             |
| ---------------------- | ---------------- | -------------------------------------------------------- |
| `/hive scraper status` | `scraper:status` | IOT-HUB calls SCRAPER, formats response as Discord embed |
| `/hive scraper jobs`   | `scraper:jobs`   | Same                                                     |
| `/hive scraper prices` | `scraper:prices` | Same                                                     |
| `/hive scraper run`    | `scraper:run`    | Same                                                     |
| `!scraper`             | `scraper:status` | Quick status message command                             |

SCRAPER does **not** need to connect to Discord directly. IOT-HUB handles all Discord integration and proxies commands to SCRAPER via the peer client.

### Alert Integration

When SCRAPER goes offline (health check fails for 2+ consecutive cycles), IOT-HUB posts to `#hive-alerts`:

```
STATION OFFLINE — SCRAPER (10.1.7.180) went offline
Severity: Warning | Source: iot-hub
[Acknowledge]
```

When SCRAPER comes back online:

```
STATION ONLINE — SCRAPER (10.1.7.180) came back online
Severity: Info | Source: iot-hub
```

---

## 11. Network Topology Update

SCRAPER's role in the topology has been updated:

| Field     | Old Value                  | New Value                                           |
| --------- | -------------------------- | --------------------------------------------------- |
| Role      | `worker`                   | `intel` (Intelligence Node)                         |
| Color     | Green (`#3fb950`)          | Gold (`#e3b341`)                                    |
| API Links | UDM-Pro -> SCRAPER (wired) | + IOT-HUB -> SCRAPER (api) + Julie -> SCRAPER (api) |

SCRAPER now appears as a gold "Intelligence Node" in the topology view with API connections to both IOT-HUB and Julie.

---

## 12. SCRAPER Action Items

Based on SCRAPER's station report and the changes made on IOT-HUB:

### Immediate (network connectivity)

- [ ] **Verify IOT-HUB is reachable** — `curl http://10.1.7.158:3001/health`
- [ ] **Verify tandem endpoint** — `curl -X POST http://10.1.7.158:3001/api/network/tandem -H "X-API-Key: openclaw-network-2026-kelvin" -H "Content-Type: application/json" -d '{"task_id":"test-1","from_station":"scraper","task_type":"ping","payload":{},"callback_url":"http://10.1.7.180:3001/api/network/tandem/callback"}'`
- [ ] **Update IOT-HUB peer entry** — Change reachable from `false` to `true` in SCRAPER's peer registry

### Remaining onboarding items (from SCRAPER report)

- [ ] **Prometheus metrics** — NOT STARTED per report. Add `/metrics` endpoint for Grafana
- [ ] **Validate IOT-HUB command names** — Ensure `scraper:status`, `scraper:prices`, `scraper:jobs`, `scraper:run` are handled in SCRAPER's command dispatch
- [ ] **Verify API key validation** — Ensure `X-API-Key: openclaw-network-2026-kelvin` is validated on all POST endpoints

### Recommended improvements

- [ ] **Send tandem tasks to IOT-HUB** — Use `meta:classify` and `meta:recommend` to leverage IOT-HUB's meta-engine for task routing instead of running everything locally
- [ ] **Report scraper job completions** — POST to Julie's `/api/v1/orchestration/hive/record` after each scrape job for the cross-station learning loop
- [ ] **Report back additional capabilities** — If SCRAPER has capabilities beyond what's listed in Section 7, inform IOT-HUB so the peer registry stays accurate

---

## 13. Quick Verification Script

Run this on SCRAPER to verify full integration:

```bash
#!/bin/bash
echo "=== SCRAPER -> IOT-HUB Integration Test ==="

echo ""
echo "1. Health check..."
curl -sf http://10.1.7.158:3001/health | jq -r '.status' || echo "FAILED"

echo ""
echo "2. Ping command..."
curl -sf -X POST http://10.1.7.158:3001/api/network/command \
  -H "X-API-Key: openclaw-network-2026-kelvin" \
  -H "Content-Type: application/json" \
  -d '{"command":"ping"}' | jq -r '.data.status' || echo "FAILED"

echo ""
echo "3. Network stations..."
curl -sf -X POST http://10.1.7.158:3001/api/network/command \
  -H "X-API-Key: openclaw-network-2026-kelvin" \
  -H "Content-Type: application/json" \
  -d '{"command":"network:stations"}' | jq -r '.data.stations[] | "\(.label // .ip): \(if .reachable then "ONLINE" else "OFFLINE" end)"' || echo "FAILED"

echo ""
echo "4. Tandem task (meta:classify)..."
curl -sf -X POST http://10.1.7.158:3001/api/network/tandem \
  -H "X-API-Key: openclaw-network-2026-kelvin" \
  -H "Content-Type: application/json" \
  -d '{
    "task_id": "test-tandem-'$(date +%s)'",
    "from_station": "scraper",
    "task_type": "meta:classify",
    "payload": {"text": "Compare Hirafu hotel prices for Golden Week"},
    "callback_url": "http://10.1.7.180:3001/api/network/tandem/callback"
  }' | jq . || echo "FAILED"

echo ""
echo "5. Delegation (ping)..."
curl -sf -X POST http://10.1.7.158:3001/api/network/delegation/inbound \
  -H "X-API-Key: openclaw-network-2026-kelvin" \
  -H "Content-Type: application/json" \
  -d '{
    "task_id": "test-deleg-'$(date +%s)'",
    "from_station": "scraper",
    "command": "ping",
    "callback_url": "http://10.1.7.180:3001/api/network/delegation/callback"
  }' | jq . || echo "FAILED"

echo ""
echo "6. Peer status (IOT-HUB sees SCRAPER)..."
curl -sf -X POST http://10.1.7.158:3001/api/network/command \
  -H "X-API-Key: openclaw-network-2026-kelvin" \
  -H "Content-Type: application/json" \
  -d '{"command":"peer:status"}' | jq '.data.peers[] | {station_id, reachable}' || echo "FAILED"

echo ""
echo "=== Done ==="
```
