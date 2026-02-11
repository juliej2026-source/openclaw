---
summary: "Hive-Mind station network daemon: station identity, Julie registration, network scanning, dual-WAN, and portal"
read_when:
  - You want to understand how OpenClaw stations communicate
  - You are configuring or deploying the hive-mind extension
  - You want to add a new station to the network
title: "Hive-Mind Station Network"
---

# Hive-Mind Station Network

Hive-Mind is the station network daemon that turns individual OpenClaw nodes into a coordinated mesh. It handles station identity, Julie registration, network scanning, dual-WAN failover, UniFi integration, neural graph API proxying, and the portal web UI.

Each station runs a hive-mind instance that:

- Builds and broadcasts a **station identity** (capabilities, layers, models)
- Registers with the **Julie orchestrator** every 5 minutes
- Runs continuous **network scanning** (UDM + station pings)
- Manages **dual-network failover** (primary/secondary WiFi)
- Serves **HTTP APIs** for the portal and inter-station communication
- Exports **Prometheus metrics** for Grafana monitoring

## Station identity

Each station identifies itself with a structured payload sent to Julie:

```json
{
  "station_id": "iot-hub",
  "hostname": "iot-hub",
  "ip_address": "10.1.7.158",
  "port": 3001,
  "platform": "linux",
  "arch": "x64",
  "version": "1.0.0",
  "capabilities": ["model_management", "model_training", ...],
  "layers": { ... },
  "models": [ ... ]
}
```

### Layers

The identity includes 4 capability layers, each reporting its status:

| Layer           | Description                                         | Status detection                  |
| --------------- | --------------------------------------------------- | --------------------------------- |
| `model_manager` | Hardware detection, model discovery, inventory      | Checks for `inventory.json`       |
| `meta_engine`   | Task classification, model scoring, routing         | Checks for `performance.json`     |
| `model_trainer` | Dataset curation, training, adapters                | Always active (creates on demand) |
| `neural_graph`  | LangGraph + Convex backbone, evolution, replication | Checks for neural-graph extension |

Each layer reports: name, description, tools, CLI command count, hooks, providers, and status (`active` or `unavailable`).

## Julie orchestrator

Julie is the central coordinator station. Hive-mind stations register with Julie on startup and re-register every 5 minutes via HTTP:

```
POST http://<julie-host>:8000/api/stations/register
Content-Type: application/json

{ <station identity payload> }
```

Julie maintains a live registry of all stations, their capabilities, and health. When a station misses heartbeats, Julie marks it degraded.

## Network API

Hive-mind serves these HTTP routes (default port 3001):

### Network

| Path                     | Description                 |
| ------------------------ | --------------------------- |
| `/api/network/ping`      | Ping response (alive check) |
| `/api/network/identity`  | Station identity payload    |
| `/api/network/command`   | Execute a station command   |
| `/api/network/scan`      | Latest network scan results |
| `/api/network/path`      | Network path analysis       |
| `/api/network/dashboard` | Network dashboard data      |

### UniFi

| Path                  | Description               |
| --------------------- | ------------------------- |
| `/api/unifi/snapshot` | UniFi controller snapshot |
| `/api/unifi/devices`  | Network devices           |
| `/api/unifi/clients`  | Connected clients         |
| `/api/unifi/health`   | UniFi health status       |
| `/api/unifi/stations` | UniFi station list        |
| `/api/unifi/alerts`   | UniFi alerts              |

### Neural Graph

| Path                   | Description                           |
| ---------------------- | ------------------------------------- |
| `/api/neural/status`   | Graph status (with genesis fallback)  |
| `/api/neural/topology` | Full topology (with genesis fallback) |
| `/api/neural/events`   | Evolution events                      |
| `/api/neural/pending`  | Pending approvals                     |

### Infrastructure

| Path                 | Description                 |
| -------------------- | --------------------------- |
| `/api/apache/status` | Apache server status        |
| `/metrics`           | Prometheus metrics endpoint |
| `/monitor`           | Health monitor              |

## Network scanning

Hive-mind runs a continuous network scanner (every 30 seconds) that:

1. Pings the UDM gateway to verify WAN connectivity
2. Discovers other stations on the network via ARP and mDNS
3. Pings each known station to check reachability and latency
4. Reports results to the portal and Prometheus

The scanner uses the UDM host from `UNIFI_HOST` (default `10.1.7.1`).

## Dual-network management

The dual-network manager handles WiFi failover:

- Monitors primary network quality every 60 seconds
- After 3 consecutive failures, switches to secondary network
- After 2 consecutive successes on primary, switches back
- Reports current path (`primary` or `secondary`) and quality metrics

## UniFi integration

Hive-mind integrates with UniFi network controllers in 2 ways:

1. **Local controller** using `UNIFI_HOST`, `UNIFI_USERNAME`, `UNIFI_PASSWORD` environment variables
2. **UniFi Cloud API** (api.ui.com) using `UNIFI_CLOUD_API_KEY` as fallback

The poller collects device, client, and health data for the portal.

## Alert management

The AlertManager tracks network conditions and generates alerts:

- Connection failures
- Latency spikes
- Station unreachable
- WAN failover events

Alerts are exposed via the `/metrics` Prometheus endpoint and the portal dashboard.

## Portal

The hive-mind portal is a web UI served via Apache on port 80. It provides 10 pages:

| Page         | Route             | Description                                    |
| ------------ | ----------------- | ---------------------------------------------- |
| Dashboard    | `/#/`             | Overview with system health and status cards   |
| Network      | `/#/network`      | Network scan results and station connectivity  |
| Topology     | `/#/topology`     | Network topology SVG visualization             |
| Neural Graph | `/#/neural-graph` | AI graph visualization with evolution timeline |
| UniFi        | `/#/unifi`        | UniFi controller integration data              |
| Stations     | `/#/stations`     | Station registry with capabilities             |
| Apache       | `/#/apache`       | Apache server status                           |
| Alerts       | `/#/alerts`       | Alert history and active alerts                |
| Metrics      | `/#/metrics`      | Prometheus metrics browser                     |
| System       | `/#/system`       | System info and configuration                  |

## Running hive-mind

Hive-mind starts as a Node.js HTTP server:

```bash
# Start the daemon
node dist/serve.js

# Check logs
tail -f /tmp/hivemind.log
```

The process logs all registered routes and service status on startup. It handles SIGTERM/SIGINT for graceful shutdown (stops scanner, dual-network, closes server).

## Environment variables

| Variable              | Default                 | Description                     |
| --------------------- | ----------------------- | ------------------------------- |
| `UNIFI_HOST`          | `10.1.7.1`              | UDM gateway IP                  |
| `UNIFI_USERNAME`      | (none)                  | Local UniFi controller username |
| `UNIFI_PASSWORD`      | (none)                  | Local UniFi controller password |
| `UNIFI_CLOUD_API_KEY` | (none)                  | UniFi Cloud API key (fallback)  |
| `JULIE_BASE_URL`      | `http://10.1.7.87:8000` | Julie orchestrator URL          |
| `CONVEX_URL`          | `http://127.0.0.1:3210` | Convex deployment URL           |

## Related

- [Neural Graph](/plugins/neural-graph)
- [Network Propagation Guide](/plugins/neural-graph-network)
- [Neural Graph API Reference](/plugins/neural-graph-api)
