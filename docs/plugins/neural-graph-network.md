---
summary: "Neural graph network propagation: replication modes, cross-station consensus, Convex setup, and monitoring"
read_when:
  - You want to add a new station to the neural graph
  - You are setting up Convex self-hosted for graph persistence
  - You want to understand how the graph replicates across stations
title: "Network Propagation"
---

# Neural Graph Network Propagation

The neural graph is designed to spread across all stations in the OpenClaw network. Each station maintains its own subgraph while keeping the full topology in sync. This guide covers replication, consensus, setup, and monitoring.

## Replication modes

The graph uses 3 replication modes based on available connectivity:

| Mode                | When                                                   | How                                                                          | Latency   |
| ------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------- | --------- |
| **convex-realtime** | Stations share a Convex deployment                     | Automatic via Convex subscriptions. All stations read/write the same tables. | Real-time |
| **julie-relay**     | No shared Convex, but Julie is reachable               | Batch graph deltas sent through Julie API during heartbeat cycle.            | 5 min     |
| **offline**         | Network partition (neither Convex nor Julie reachable) | Deltas queued locally. Synced when connectivity returns.                     | Variable  |

Mode detection is automatic. On each replication attempt, the system:

1. Checks if Convex is healthy (port 3210)
2. If not, checks if Julie is healthy (port 8000)
3. If neither, queues for offline sync

### Convex-realtime mode

This is the preferred mode. When all stations point to the same Convex deployment:

- Mutations are applied directly to Convex tables
- Other stations see changes via real-time subscriptions
- The `stationId` field on every record enables station-specific filtering
- No explicit sync logic needed

### julie-relay mode

When stations cannot share a Convex deployment:

```
Station A -> POST /api/neural/sync -> Julie -> broadcasts to Station B, C
```

Graph deltas include: nodes added/updated/removed, edges added/updated/removed, and evolution events. Julie batches these into the 5-minute registration heartbeat.

### Offline mode

During network partitions:

- Deltas are queued in memory on the local station
- The station operates on its local subgraph (filtered by `stationId`)
- When connectivity returns, queued deltas are flushed in order

## Cross-station consensus

When a station proposes a graph mutation that affects other stations, consensus is required:

### Consensus flow

1. **Proposer** creates a consensus request with the evolution proposal and list of affected station IDs
2. Request is broadcast to affected stations (via Convex subscription or Julie relay)
3. Each station **votes**: `approve`, `reject`, or `timeout`
4. **Majority wins** (approve + timeout count as approve)
5. **5-minute auto-approve** on timeout (non-responding stations default to approve)

### Vote types

| Vote      | Meaning                                                       |
| --------- | ------------------------------------------------------------- |
| `approve` | Station agrees with the proposed mutation                     |
| `reject`  | Station objects (provides reason)                             |
| `timeout` | Station did not respond within 5 minutes (counted as approve) |

### What requires consensus

- Pruning a node that exists on multiple stations
- Creating an edge between nodes on different stations
- Changing the maturation phase (affects all stations)

Local-only mutations (fitness recalculation, edge weight changes on local edges) do not require consensus.

## Subgraph extraction

Each station maintains a view of the full graph filtered by `stationId`:

- **Local subgraph**: nodes and edges where `stationId` matches the current station
- **Remote view**: read-only view of nodes and edges from other stations
- **Merged topology**: the portal shows the full merged graph with all stations

When Convex is available, the merged view is automatic (all data in one database). In relay/offline mode, stations exchange subgraphs during sync.

## Adding a new station

To add a new station to the neural graph network:

### Step 1: Install hive-mind

```bash
cd extensions/hive-mind
npm install
npm run build
```

### Step 2: Configure environment

```bash
# Required: Julie orchestrator URL
export JULIE_BASE_URL="http://10.1.7.87:8000"

# Optional: Shared Convex deployment
export CONVEX_URL="http://10.1.7.158:3210"

# Optional: UniFi credentials
export UNIFI_HOST="10.1.7.1"
```

### Step 3: Start the daemon

```bash
node dist/serve.js
```

The daemon will:

1. Start the HTTP server on port 3001
2. Build station identity with all detected layers
3. Register with Julie (you should see "Registered with Julie: OK")
4. Start the network scanner
5. Start dual-network management

### Step 4: Verify registration

```bash
# Check Julie saw the registration
curl http://10.1.7.87:8000/api/stations

# Check the neural graph has the new station as a node
curl http://localhost:3001/api/neural/topology
```

On first run, the neural graph extension seeds genesis nodes for the new station. You should see the station appear in the graph topology.

## Convex self-hosted setup

Convex provides reactive persistence for the neural graph. It runs as a Docker container alongside the monitoring stack.

### Docker Compose

Add to your `monitoring/docker-compose.yml`:

```yaml
services:
  convex:
    image: ghcr.io/get-convex/convex-backend:latest
    restart: unless-stopped
    ports:
      - "127.0.0.1:3210:3210"
    volumes:
      - convex-data:/convex/data
      - ../extensions/neural-graph/convex:/convex/functions
    environment:
      CONVEX_SITE_URL: "http://10.1.7.158"
    networks:
      - monitoring

volumes:
  convex-data:
```

### Schema

The Convex schema defines 6 tables:

| Table               | Purpose                            | Key indexes                                                  |
| ------------------- | ---------------------------------- | ------------------------------------------------------------ |
| `graph_nodes`       | AI capabilities, stations, models  | by_nodeId, by_stationId, by_status, by_nodeType              |
| `graph_edges`       | Relationships between nodes        | by_edgeId, by_source, by_target, by_stationId, by_myelinated |
| `checkpoints`       | LangGraph thread state             | by_threadId, by_checkpointId                                 |
| `evolution_events`  | Audit log of graph mutations       | by_stationId, by_approvalStatus, by_targetId                 |
| `execution_records` | Every graph traversal              | by_stationId, by_threadId, by_taskType                       |
| `graph_embeddings`  | Semantic search (1536-dim vectors) | by_sourceId, by_stationId, vectorIndex by_embedding          |

### Start Convex

```bash
cd monitoring
docker compose up -d convex
```

Verify:

```bash
curl http://127.0.0.1:3210/version
```

## Grafana monitoring

The neural graph exports Prometheus metrics scraped by the existing Prometheus job:

### Available metrics

| Metric                                | Type    | Description                         |
| ------------------------------------- | ------- | ----------------------------------- |
| `neural_graph_node_count`             | Gauge   | Total nodes by type and status      |
| `neural_graph_edge_weight`            | Gauge   | Edge weights by type                |
| `neural_graph_node_fitness`           | Gauge   | Node fitness scores                 |
| `neural_graph_execution_total`        | Counter | Total graph executions by task type |
| `neural_graph_evolution_events_total` | Counter | Evolution events by type            |
| `neural_graph_myelinated_edges`       | Gauge   | Count of myelinated edges           |

### Grafana dashboard

Import `monitoring/grafana/dashboards/07-neural-graph.json` for a pre-built dashboard with:

- Node count over time (by type)
- Fitness score distribution
- Edge weight heatmap
- Execution throughput
- Evolution event rate
- Maturation phase timeline

## Related

- [Neural Graph](/plugins/neural-graph)
- [Hive-Mind Station Network](/plugins/hive-mind)
- [Neural Graph API Reference](/plugins/neural-graph-api)
