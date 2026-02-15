# IOT-HUB Station — Full Capability Report for Julie Orchestrator

## Station Identity

| Field            | Value                                                |
| ---------------- | ---------------------------------------------------- |
| **Station ID**   | `iot-hub`                                            |
| **Hostname**     | `ubuntu`                                             |
| **IP Address**   | `10.1.7.158`                                         |
| **API Port**     | `3001`                                               |
| **Platform**     | `linux / x64`                                        |
| **Version**      | `1.0.0`                                              |
| **Registration** | Julie at `http://10.1.7.87:8000` — OK (dynamic=true) |
| **Heartbeat**    | Every 5 minutes with full runtime state              |

---

## Capabilities (26)

### AI / Model Management

- `model_management` — Ollama model lifecycle (list, pull, remove, info)
- `model_training` — Fine-tuning via Ollama Modelfile + QLoRA (Unsloth)
- `task_classification` — Automatic task type detection (analysis, reasoning, coding, tool-use, chat)
- `hardware_detection` — GPU/CPU/RAM detection for model compatibility
- `model_scoring` — Performance-based model ranking per task type
- `model_evaluation` — A/B evaluation against base models
- `dataset_curation` — Training data collection and validation
- `lora_adapters` — LoRA adapter management and application
- `huggingface_search` — HuggingFace Hub model/GGUF search
- `huggingface_management` — HF spaces, datasets, models, jobs lifecycle

### Network Infrastructure

- `network_monitoring` — Station ping scanning every 30s, UDM Pro health
- `network_control` — Dual-WAN switching, failover, 5G modem control
- `dual_wan` — Primary (The 1898 Moiwa / UDM Pro) + HR02 5G (NTT Docomo)
- `alert_management` — Alert creation, acknowledgment, lifecycle tracking
- `iot` — IoT device monitoring and management
- `smart_home` — Smart home integration (Bravia TV, sensors)
- `sensors` — Environmental and network sensor data

### AI Graph and Intelligence

- `neural_graph` — LangGraph + Convex graph orchestration, maturation, evolution, cross-station replication
- `web_scraping` — Playwright-based web scraping
- `data_collection` — Multi-source data aggregation
- `hotel_scraping` — Niseko hotel price monitoring (5 sources)
- `price_comparison` — Cross-source price comparison and best-deal analysis

### Discord Integration

- `discord_notifications` — REST-based real-time alerts + periodic health reports to 7 channels
- `discord_gateway` — WebSocket bidirectional control (slash commands, buttons, message commands)
- `discord_commands` — 10 slash command trees under `/hive` for full infrastructure control

### Platform

- `linux` — Native Linux platform support

---

## Layers (8)

### 1. Model Manager

- **Status:** Pending inventory (no models downloaded yet)
- **Tools:** `local_model_list`, `local_model_pull`, `local_model_remove`, `local_model_info`, `local_hardware_info`
- **Hooks:** `gateway_start`
- **Providers:** local-models (Ollama)

### 2. Meta-Engine

- **Status:** Pending performance DB
- **Tools:** `meta_model_select`, `meta_model_status`, `meta_model_override`
- **Hooks:** `before_agent_start`, `agent_end`
- **Description:** Task classification, model scoring, performance tracking, autonomous routing

### 3. Model Trainer

- **Status:** Active
- **Tools:** `training_data_collect`, `training_start`, `training_status`, `adapter_list`, `model_eval`
- **Hooks:** `agent_end`
- **Methods:** Ollama Modelfile, Unsloth QLoRA

### 4. Neural Graph

- **Status:** Active
- **Tools:** `neural_query`, `neural_topology`, `neural_evolve`, `neural_approve`
- **Hooks:** `gateway_start`, `agent_end`
- **Providers:** Convex, LangGraph
- **Description:** Graph orchestration, maturation lifecycle (Genesis > Growth > Maturation > Stable), evolution, cross-station replication

### 5. HuggingFace Manager

- **Status:** Active
- **Tools:** `hf_spaces_list`, `hf_datasets_list`, `hf_models_list`, `hf_jobs_list`, `hf_status`
- **Providers:** huggingface
- **Description:** HF Hub account management — spaces, datasets, models, and compute jobs

### 6. Hotel Scraper

- **Status:** Active
- **Tools:** `hotel_scrape`, `hotel_prices`, `hotel_compare`, `hotel_resolve`
- **Hooks:** `gateway_start`
- **Providers:** RateHawk, Apify, Nisade, Playwright, RoomBoss
- **Coverage:** Hirafu, Niseko Village, Annupuri, Hanazono, Moiwa, Kutchan

### 7. Discord Gateway

- **Status:** Active
- **Tools:** `discord_notify`, `discord_slash`, `discord_message`, `discord_button`
- **Hooks:** `alert_fired`, `scan_complete`, `failover_triggered`
- **Providers:** discord
- **Bot:** Hive Mind#5969
- **Guild:** juliej2026's server (ID: 1468838771763187827)
- **Channels:** 7 (hive-alerts, hive-status, hive-network, hive-scraper, hive-neural, hive-models, hive-execution)

### 8. Network Control

- **Status:** Active
- **Tools:** `network_scan`, `network_switch`, `alert_ack`, `failover_status`
- **Hooks:** `scan_complete`
- **Providers:** UDM Pro, HR02 5G
- **Active Path:** Primary (The 1898 Moiwa, gateway 10.1.7.1)
- **Backup Path:** HR02 5G (NTT Docomo, gateway 192.168.128.1)
- **Auto-failover:** After 3 consecutive failures, auto-failback after 2 successes

---

## Command Dispatch (47 commands)

All commands are dispatchable via `POST /api/network/command` with JSON body `{"command": "<name>", "params": {...}}`.

### Ping and Identity (2)

| Command        | Description                                      |
| -------------- | ------------------------------------------------ |
| `ping`         | Station health check (status, uptime)            |
| `capabilities` | Full station identity with all layers and models |

### Meta-Engine (13)

| Command               | Params                             | Description                                                        |
| --------------------- | ---------------------------------- | ------------------------------------------------------------------ |
| `meta:classify`       | `text`                             | Classify task type (analysis, reasoning, coding, tool-use, chat)   |
| `meta:score`          | `task_type?`                       | Score models for a task type                                       |
| `meta:recommend`      | `text`                             | Recommend best model for a prompt                                  |
| `meta:hardware`       | —                                  | Detect GPU/CPU/RAM hardware                                        |
| `meta:models`         | —                                  | List installed + running Ollama models                             |
| `meta:status`         | —                                  | Combined hardware + models + performance summary                   |
| `meta:dashboard`      | —                                  | Full system dashboard (hardware, models, network, WAN, executions) |
| `meta:train`          | `dataset`, `base_model`, `method?` | Start fine-tuning job                                              |
| `meta:train:jobs`     | `status?`                          | List training jobs                                                 |
| `meta:train:adapters` | —                                  | List LoRA adapters                                                 |
| `meta:search`         | `query`, `limit?`                  | Search HuggingFace Hub models                                      |
| `meta:search:files`   | `repo`                             | List GGUF files in a HF repo                                       |
| `meta:evaluate`       | `model`, `dataset?`, `base?`       | Evaluate model performance                                         |

### Network (9)

| Command              | Params                     | Description                                         |
| -------------------- | -------------------------- | --------------------------------------------------- |
| `network:scan`       | —                          | Full topology scan (UDM + all station pings)        |
| `network:udm`        | —                          | UDM Pro status                                      |
| `network:stations`   | —                          | Station reachability list                           |
| `network:path`       | —                          | Dual-WAN path state (primary/5G, quality, failover) |
| `network:switch`     | `target` (primary/hr02_5g) | Switch active WAN path                              |
| `network:5g`         | —                          | HR02 5G modem status                                |
| `network:alerts`     | `active?`, `limit?`        | List alerts (all or active only)                    |
| `network:alerts:ack` | `id`                       | Acknowledge an alert                                |
| `network:failover`   | —                          | Failover state summary                              |

### UniFi (9)

| Command                | Description                                 |
| ---------------------- | ------------------------------------------- |
| `unifi:status`         | UDM Pro availability check                  |
| `unifi:devices`        | List network devices                        |
| `unifi:clients`        | List connected clients                      |
| `unifi:health`         | Network health summary                      |
| `unifi:stations`       | Station-specific UniFi data                 |
| `unifi:alerts`         | UniFi alert history                         |
| `unifi:snapshot`       | Full UniFi data snapshot                    |
| `unifi:cloud:discover` | Cloud API discovery (hosts, sites, devices) |
| `unifi:cloud:status`   | Cloud API connectivity check                |

### Neural Graph (4)

| Command           | Params                              | Description                                    |
| ----------------- | ----------------------------------- | ---------------------------------------------- |
| `neural:status`   | —                                   | Graph phase, nodes, edges, fitness score       |
| `neural:topology` | —                                   | Full graph structure (nodes + edges + weights) |
| `neural:evolve`   | —                                   | Trigger evolution cycle                        |
| `neural:query`    | `task`, `task_type?`, `complexity?` | Route a task through the graph                 |

### HuggingFace (9)

| Command            | Params              | Description                                         |
| ------------------ | ------------------- | --------------------------------------------------- |
| `hf:spaces`        | `limit?`, `author?` | List HF Spaces                                      |
| `hf:spaces:info`   | `id`                | Get Space details                                   |
| `hf:datasets`      | `limit?`, `author?` | List HF datasets                                    |
| `hf:datasets:info` | `id`                | Get dataset details                                 |
| `hf:models`        | `limit?`, `author?` | List HF models                                      |
| `hf:models:info`   | `id`                | Get model details                                   |
| `hf:jobs`          | —                   | List compute jobs                                   |
| `hf:jobs:info`     | `id`                | Get job details                                     |
| `hf:status`        | —                   | HF account summary (spaces, datasets, models, jobs) |

---

## HTTP API Endpoints (20)

All endpoints are on `http://10.1.7.158:3001`.

| Method | Path                     | Description                                              |
| ------ | ------------------------ | -------------------------------------------------------- |
| GET    | `/`                      | Health check                                             |
| GET    | `/health`                | Health check                                             |
| GET    | `/api/network/ping`      | Station ping                                             |
| GET    | `/api/network/identity`  | Full station identity JSON                               |
| POST   | `/api/network/command`   | Command dispatch (`{"command": "...", "params": {...}}`) |
| GET    | `/api/network/scan`      | Latest network scan                                      |
| GET    | `/api/network/path`      | Dual-WAN path state                                      |
| GET    | `/api/network/dashboard` | Full HTML dashboard                                      |
| GET    | `/api/apache/status`     | Apache server status                                     |
| GET    | `/api/unifi/snapshot`    | UniFi data snapshot                                      |
| GET    | `/api/unifi/devices`     | UniFi devices                                            |
| GET    | `/api/unifi/clients`     | UniFi clients                                            |
| GET    | `/api/unifi/health`      | UniFi health                                             |
| GET    | `/api/unifi/stations`    | UniFi stations                                           |
| GET    | `/api/unifi/alerts`      | UniFi alerts                                             |
| GET    | `/api/neural/status`     | Neural graph status                                      |
| GET    | `/api/neural/topology`   | Neural graph topology                                    |
| GET    | `/api/neural/events`     | Neural graph events                                      |
| GET    | `/api/neural/pending`    | Pending neural approvals                                 |
| GET    | `/metrics`               | Prometheus metrics                                       |
| GET    | `/monitor`               | HTML monitoring page                                     |

---

## Discord Integration

### Bot

- **Name:** Hive Mind#5969
- **Guild:** juliej2026's server (ID: `1468838771763187827`)
- **Gateway:** WebSocket connected (discord.js v14)

### Channels (7, under "Hive Infrastructure" category)

| Channel           | Purpose                                                                            |
| ----------------- | ---------------------------------------------------------------------------------- |
| `#hive-alerts`    | Real-time infrastructure alerts (station offline, failover, degraded connectivity) |
| `#hive-status`    | Periodic health reports (30min station health, 1hr dashboard, 6hr deep report)     |
| `#hive-network`   | Network topology changes (station online/offline, port changes)                    |
| `#hive-scraper`   | Hotel scraper job results, price discoveries, comparison summaries                 |
| `#hive-neural`    | Neural graph events (phase changes, evolution, maturation)                         |
| `#hive-models`    | AI model changes (installed, removed, started, stopped)                            |
| `#hive-execution` | Command execution log and performance data                                         |

### Slash Commands (10 trees under `/hive`)

| Command         | Subcommands                                                  |
| --------------- | ------------------------------------------------------------ |
| `/hive status`  | Full system dashboard                                        |
| `/hive models`  | AI model inventory                                           |
| `/hive ping`    | Quick connectivity check                                     |
| `/hive help`    | All available commands                                       |
| `/hive network` | `scan`, `path`, `switch <target>`, `5g`, `failover`          |
| `/hive alerts`  | `list [active_only]`, `ack <id>`                             |
| `/hive unifi`   | `status`, `devices`, `clients`, `health`, `cloud`            |
| `/hive meta`    | `status`, `classify <text>`, `recommend <text>`, `dashboard` |
| `/hive neural`  | `status`, `topology`, `evolve`, `query <task>`               |
| `/hive scraper` | `status`, `jobs`, `prices`, `run`                            |
| `/hive hf`      | `status`, `models`, `spaces`, `datasets`                     |
| `/hive train`   | `start <dataset> <model>`, `jobs`, `adapters`                |

### Message Commands (prefix `!` in hive channels)

`!status`, `!scan`, `!path`, `!switch primary|5g`, `!5g`, `!alerts`, `!ack <id>`, `!unifi`, `!devices`, `!clients`, `!models`, `!neural`, `!scraper`, `!ping`, `!hf`, `!help`

### Interactive Buttons

- **[Refresh]** on status/dashboard embeds
- **[Acknowledge]** on alert embeds
- **[Switch Primary] / [Switch 5G]** on network embeds
- **[Evolve] / [Topology]** on neural embeds
- **[Start Scrape] / [View Prices]** on scraper embeds

---

## Network Topology (Live)

| Station                    | IP           | Status                   | Latency |
| -------------------------- | ------------ | ------------------------ | ------- |
| **Julie** (orchestrator)   | `10.1.7.87`  | Online                   | 13ms    |
| **IOT-HUB** (this station) | `10.1.7.158` | Online                   | 1ms     |
| ~~SCRAPER~~                | `10.1.7.180` | Offline (decommissioned) | —       |
| CLERK                      | `10.1.7.239` | Offline                  | —       |
| Bravia TV                  | `10.1.7.131` | Offline                  | —       |

### Dual-WAN State

- **Active:** Primary (The 1898 Moiwa, UDM Pro, gateway `10.1.7.1`)
- **Backup:** HR02 5G (NTT Docomo, gateway `192.168.128.1`)
- **Failover:** Inactive, 0 switches
- **Primary Quality:** Reachable, 1.5ms latency, 0% packet loss

---

## Registration Payload (sent to Julie every 5 minutes)

The registration now includes:

1. **26 capabilities** (full capability surface)
2. **8 layers** with status, tools, hooks, providers
3. **47 commands** (full dispatchable command inventory)
4. **20 endpoints** (full HTTP API map with methods)
5. **Runtime state** (live snapshot):
   - Discord: connected, gateway active, guild ID, 7 channels, 10 slash commands
   - Network: active WAN path, failover state, scanner running, stations online/total
   - Alerts: active count, total count
   - Uptime: system uptime in seconds

---

## How to Interact with IOT-HUB

### From another station (HTTP)

```bash
# Ping
curl http://10.1.7.158:3001/api/network/ping

# Get full identity
curl http://10.1.7.158:3001/api/network/identity

# Dispatch any command
curl -X POST http://10.1.7.158:3001/api/network/command \
  -H 'Content-Type: application/json' \
  -d '{"command": "meta:dashboard"}'

# Network scan
curl http://10.1.7.158:3001/api/network/scan

# Prometheus metrics
curl http://10.1.7.158:3001/metrics
```

### From Discord

```
/hive status          -- full dashboard
/hive network scan    -- topology scan
/hive alerts list     -- active alerts
/hive neural status   -- graph phase and fitness
!scan                 -- quick topology (in #hive-network)
!status               -- quick dashboard (in #hive-status)
```

---

## Execution Reporting

Every command dispatched through the hive API is:

1. Classified by task type (analysis, reasoning, coding, tool-use, chat)
2. Recorded in the local performance DB with latency and success metrics
3. Reported to Julie with actual `capabilities_used` (derived from command prefix, not hardcoded)
4. Logged to the local execution log with Julie delivery status

This enables Julie to build a cross-station performance model and optimize task routing across the hive network.
