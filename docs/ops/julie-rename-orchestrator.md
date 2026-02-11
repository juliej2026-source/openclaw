# Julie Rename: Orchestrator Station Changes

**Date:** 2026-02-08
**Affected station:** Orchestrator at `10.1.7.87:8000`
**Context:** The OpenClaw codebase unified all references from JULIA / Julia / July to the canonical name **Julie**. The orchestrator station needs matching changes so names, metrics, and IDs are consistent across the entire network.

---

## Summary of OpenClaw-side changes

| Area                     | Old                                       | New                                       |
| ------------------------ | ----------------------------------------- | ----------------------------------------- |
| Display name             | JULIA                                     | Julie                                     |
| Node / station ID        | julia                                     | julie                                     |
| Class name               | JuliaClient                               | JulieClient                               |
| Variable names           | juliaRegistered, juliaUp                  | julieRegistered, julieUp                  |
| Environment variable     | JULIA_BASE_URL                            | JULIE_BASE_URL                            |
| Prometheus metrics       | hivemind_julia_registered                 | hivemind_julie_registered                 |
| Prometheus metrics       | hivemind_julia_last_heartbeat_age_seconds | hivemind_julie_last_heartbeat_age_seconds |
| Replication mode         | julia-relay                               | julie-relay                               |
| File name                | julia-client.ts                           | julie-client.ts                           |
| Neural graph node ID     | julia                                     | julie                                     |
| Grafana dashboard labels | JULIA                                     | Julie                                     |
| Grafana queries          | hivemind*julia*\*                         | hivemind*julie*\*                         |

---

## Changes needed on the orchestrator (10.1.7.87)

### 1. FastAPI application title

Find the FastAPI app initialization (likely in `main.py` or `app.py`):

```python
# BEFORE
app = FastAPI(title="July Agent API", ...)

# AFTER
app = FastAPI(title="Julie Agent API", ...)
```

Search pattern:

```bash
grep -rn "July Agent API" .
grep -rn "July" . --include="*.py"
```

### 2. HTML frontend title

Find the built frontend HTML (likely `index.html` in a `dist/`, `static/`, or `templates/` folder):

```html
<!-- BEFORE -->
<title>July Control Panel</title>

<!-- AFTER -->
<title>Julie Control Panel</title>
```

### 3. HTML meta description

In the same HTML file:

```html
<!-- BEFORE -->
<meta name="description" content="July Agent Control Panel" />

<!-- AFTER -->
<meta name="description" content="Julie Agent Control Panel" />
```

### 4. Swagger UI page title (may auto-update)

If the FastAPI title change propagates automatically, the Swagger docs at `/docs` will update. If there is a custom Swagger HTML override:

```html
<!-- BEFORE -->
<title>July Agent API - Swagger UI</title>

<!-- AFTER -->
<title>Julie Agent API - Swagger UI</title>
```

### 5. Station registry / agent IDs

If the orchestrator stores or references its own station ID internally, update any hardcoded values:

```python
# BEFORE
STATION_ID = "julia"
# or
agent_name = "JULIA"

# AFTER
STATION_ID = "julie"
# or
agent_name = "Julie"
```

Search pattern:

```bash
grep -rni "julia\|july" . --include="*.py" --include="*.html" --include="*.json" --include="*.yaml" --include="*.yml" --include="*.toml" --include="*.env"
```

### 6. API response payloads

If any API endpoints return the orchestrator name in response bodies, update those:

```python
# BEFORE
{"orchestrator": "JULIA", ...}
{"name": "July Agent", ...}

# AFTER
{"orchestrator": "Julie", ...}
{"name": "Julie Agent", ...}
```

### 7. Log messages

Update any log statements referencing the old names:

```python
# BEFORE
logger.info("JULIA orchestrator started")
logger.info("July agent listening on ...")

# AFTER
logger.info("Julie orchestrator started")
logger.info("Julie agent listening on ...")
```

### 8. Environment variables (if used)

If the orchestrator reads `JULIA_BASE_URL` or similar env vars internally:

```bash
# BEFORE
JULIA_BASE_URL=http://10.1.7.87:8000

# AFTER
JULIE_BASE_URL=http://10.1.7.87:8000
```

### 9. Docker / systemd service names (if applicable)

```bash
# Check for service names
systemctl list-units | grep -i julia
systemctl list-units | grep -i july
docker ps | grep -i julia
docker ps | grep -i july
```

If found, rename accordingly. Update any `.service` files or `docker-compose.yml` references.

---

## Full search commands

Run these on the orchestrator to find all remaining references:

```bash
# Find all old name variants in source code
grep -rni "julia\|july" /path/to/orchestrator/src/ \
  --include="*.py" --include="*.html" --include="*.json" \
  --include="*.yaml" --include="*.yml" --include="*.toml" \
  --include="*.js" --include="*.ts" --include="*.env" \
  --include="*.cfg" --include="*.ini" --include="*.conf"

# Find in config files
grep -rni "julia\|july" /etc/ --include="*.conf" --include="*.service" 2>/dev/null

# Find in environment
env | grep -i julia
env | grep -i july
```

After making changes, verify zero matches:

```bash
grep -rni "julia\|july" /path/to/orchestrator/src/ \
  --include="*.py" --include="*.html" --include="*.json" \
  --include="*.yaml" --include="*.yml"
# Expected: 0 results
```

---

## Naming convention reference

| Context                                   | Format            | Example                   |
| ----------------------------------------- | ----------------- | ------------------------- |
| Display name (UI, docs, logs, API titles) | Title case        | Julie                     |
| Station / node / agent ID                 | Lowercase         | julie                     |
| Python class name                         | PascalCase        | JulieClient               |
| Python variable                           | snake_case        | julie_registered          |
| Environment variable                      | UPPER_SNAKE       | JULIE_BASE_URL            |
| Prometheus metric                         | snake_case prefix | hivemind_julie_registered |
| Service / container name                  | kebab-case        | julie-orchestrator        |

---

## Verification checklist

After applying changes, verify from the OpenClaw station (iot-hub):

```bash
# 1. Health check
curl http://10.1.7.87:8000/health

# 2. API title shows "Julie Agent API"
curl -s http://10.1.7.87:8000/openapi.json | grep -i title

# 3. HTML title shows "Julie Control Panel"
curl -s http://10.1.7.87:8000/ | grep "<title>"

# 4. Station registration works with new names
curl -s http://10.1.7.87:8000/api/v1/orchestration/hive/register \
  -X POST -H "Content-Type: application/json" \
  -d '{"agent_id":"iot-hub","identity_data":{"station_id":"iot-hub"}}'

# 5. Hive-mind connects successfully
curl http://127.0.0.1:3001/api/network/identity

# 6. Portal shows "Julie" in topology
# Open http://10.1.7.158/#/topology and verify the node label
```

---

## Timeline

The OpenClaw codebase changes are already applied and will take effect on the next hive-mind restart. The orchestrator changes should be applied before or at the same time to avoid name mismatches in logs and dashboards.

No breaking API changes were made. The registration endpoint paths, request formats, and response formats are unchanged. Only display names, metric names, and internal identifiers were updated.
