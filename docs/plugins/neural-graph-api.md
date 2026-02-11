---
summary: "Neural Graph HTTP API reference: endpoints, request/response schemas, and Convex table definitions"
read_when:
  - You want to integrate with the neural graph API
  - You are building a client that reads graph topology
  - You need the response schema for neural graph endpoints
title: "Neural Graph API Reference"
---

# Neural Graph API Reference

The neural graph HTTP API is served by hive-mind on port 3001 (proxied through Apache on port 80). All endpoints return JSON. When Convex is unavailable, endpoints return static genesis data as a fallback.

## Authentication

All endpoints are currently **local-only** (bound to `127.0.0.1`). No authentication is required for loopback access. Apache proxies `/api/neural/*` from port 80 to the backend.

## GET /api/neural/status

Returns a summary of the current graph state.

**Response:**

```json
{
  "phase": "genesis",
  "totalNodes": 6,
  "totalEdges": 10,
  "totalExecutions": 0,
  "myelinatedEdges": 0,
  "avgFitness": 50,
  "stationId": "iot-hub",
  "convexConnected": false,
  "lastEvolutionCycle": "2026-02-08T12:00:00.000Z"
}
```

| Field                | Type    | Description                                                                                           |
| -------------------- | ------- | ----------------------------------------------------------------------------------------------------- |
| `phase`              | string  | Current maturation phase: `genesis`, `differentiation`, `synaptogenesis`, `pruning`, or `myelination` |
| `totalNodes`         | number  | Total node count                                                                                      |
| `totalEdges`         | number  | Total edge count                                                                                      |
| `totalExecutions`    | number  | Total graph traversals                                                                                |
| `myelinatedEdges`    | number  | Count of high-traffic optimized edges                                                                 |
| `avgFitness`         | number  | Average fitness score across all nodes (0-100)                                                        |
| `stationId`          | string  | Reporting station ID                                                                                  |
| `convexConnected`    | boolean | Whether Convex persistence is available                                                               |
| `lastEvolutionCycle` | string  | ISO timestamp of last evolution cycle (optional)                                                      |

## GET /api/neural/topology

Returns the full graph topology (nodes and edges).

**Response:**

```json
{
  "nodes": [
    {
      "nodeId": "meta-engine",
      "nodeType": "capability",
      "name": "Meta-Engine",
      "status": "active",
      "fitnessScore": 50,
      "maturationPhase": "genesis",
      "capabilities": ["task_classification", "model_scoring", "performance_tracking"],
      "activationCount": 0
    }
  ],
  "edges": [
    {
      "edgeId": "meta-engine->model-manager",
      "sourceNodeId": "meta-engine",
      "targetNodeId": "model-manager",
      "edgeType": "data_flow",
      "weight": 0.5,
      "myelinated": false,
      "activationCount": 0
    }
  ],
  "phase": "genesis",
  "totalExecutions": 0,
  "stationId": "iot-hub"
}
```

### Node object

| Field             | Type     | Description                                      |
| ----------------- | -------- | ------------------------------------------------ |
| `nodeId`          | string   | Unique node identifier                           |
| `nodeType`        | string   | `capability`, `station`, `model`, or `synthetic` |
| `name`            | string   | Human-readable name                              |
| `status`          | string   | `active`, `degraded`, `dormant`, or `pruned`     |
| `fitnessScore`    | number   | Fitness score (0-100)                            |
| `maturationPhase` | string   | Current maturation phase                         |
| `capabilities`    | string[] | List of capability identifiers                   |
| `activationCount` | number   | How many times this node has been activated      |

### Edge object

| Field             | Type    | Description                                                          |
| ----------------- | ------- | -------------------------------------------------------------------- |
| `edgeId`          | string  | Unique edge identifier (format: `source->target`)                    |
| `sourceNodeId`    | string  | Source node ID                                                       |
| `targetNodeId`    | string  | Target node ID                                                       |
| `edgeType`        | string  | `data_flow`, `dependency`, `activation`, `fallback`, or `inhibition` |
| `weight`          | number  | Edge weight (0.0 to 1.0)                                             |
| `myelinated`      | boolean | Whether this is an optimized high-traffic path                       |
| `activationCount` | number  | How many times this edge has been traversed                          |

## GET /api/neural/events

Returns recent evolution events (most recent first, up to 20).

**Response:**

```json
[
  {
    "eventType": "phase_transition",
    "targetId": "iot-hub",
    "reason": "100 total executions reached differentiation threshold",
    "triggeredBy": "evolution_cycle",
    "previousState": { "phase": "genesis" },
    "newState": { "phase": "differentiation" },
    "requiresApproval": false,
    "approvalStatus": "auto_approved",
    "createdAt": "2026-02-08T12:00:00.000Z"
  }
]
```

### Evolution event object

| Field              | Type    | Description                                                                                                                                                                       |
| ------------------ | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `eventType`        | string  | One of: `node_created`, `node_pruned`, `node_status_changed`, `edge_created`, `edge_pruned`, `edge_weight_changed`, `edge_myelinated`, `fitness_recalculated`, `phase_transition` |
| `targetId`         | string  | ID of the affected node or edge                                                                                                                                                   |
| `reason`           | string  | Human-readable explanation                                                                                                                                                        |
| `triggeredBy`      | string  | `system`, `evolution_cycle`, `human`, or a station ID                                                                                                                             |
| `previousState`    | object  | State before the mutation                                                                                                                                                         |
| `newState`         | object  | State after the mutation                                                                                                                                                          |
| `requiresApproval` | boolean | Whether human approval is needed                                                                                                                                                  |
| `approvalStatus`   | string  | `pending`, `approved`, `rejected`, or `auto_approved`                                                                                                                             |
| `createdAt`        | string  | ISO timestamp                                                                                                                                                                     |

## GET /api/neural/pending

Returns evolution events that are waiting for human approval.

**Response:**

```json
[
  {
    "_id": "abc123",
    "eventType": "node_pruned",
    "targetId": "synthetic-node-42",
    "reason": "Fitness below 30 for 7+ days",
    "requiresApproval": true,
    "approvalStatus": "pending"
  }
]
```

Same schema as evolution events, filtered to `approvalStatus: "pending"`.

## POST /api/neural/approve

Approve a pending evolution event.

**Request:**

```json
{
  "eventId": "abc123"
}
```

**Response:**

```json
{
  "success": true
}
```

## POST /api/neural/reject

Reject a pending evolution event.

**Request:**

```json
{
  "eventId": "abc123"
}
```

**Response:**

```json
{
  "success": true
}
```

## Convex tables

The neural graph persists data in 6 Convex tables. All tables are indexed by `stationId` for network partitioning.

### graph_nodes

Stores AI capabilities, models, and stations (the "neurons").

| Field             | Type     | Description                                   |
| ----------------- | -------- | --------------------------------------------- |
| `nodeId`          | string   | Unique identifier                             |
| `nodeType`        | string   | `capability`, `station`, `model`, `synthetic` |
| `name`            | string   | Display name                                  |
| `description`     | string   | Human-readable description                    |
| `stationId`       | string   | Owning station                                |
| `status`          | string   | `active`, `degraded`, `dormant`, `pruned`     |
| `fitnessScore`    | float64  | 0 to 100                                      |
| `maturationPhase` | string   | Current phase                                 |
| `capabilities`    | string[] | Capability list                               |
| `activationCount` | float64  | Total activations                             |
| `totalLatencyMs`  | float64  | Cumulative latency                            |
| `successCount`    | float64  | Successful executions                         |
| `failureCount`    | float64  | Failed executions                             |
| `createdAt`       | string   | ISO timestamp                                 |

### graph_edges

Stores relationships between nodes (the "synapses").

| Field               | Type    | Description                                                       |
| ------------------- | ------- | ----------------------------------------------------------------- |
| `edgeId`            | string  | Unique identifier                                                 |
| `sourceNodeId`      | string  | Source node                                                       |
| `targetNodeId`      | string  | Target node                                                       |
| `edgeType`          | string  | `data_flow`, `dependency`, `activation`, `fallback`, `inhibition` |
| `weight`            | float64 | 0.0 to 1.0                                                        |
| `myelinated`        | boolean | Optimized path flag                                               |
| `activationCount`   | float64 | Total traversals                                                  |
| `coActivationCount` | float64 | Times both endpoints activated together                           |
| `avgLatencyMs`      | float64 | Average traversal latency                                         |

### checkpoints

LangGraph thread state for persistent graph execution.

| Field                | Type              | Description                  |
| -------------------- | ----------------- | ---------------------------- |
| `threadId`           | string            | Thread identifier            |
| `checkpointId`       | string            | Checkpoint identifier        |
| `parentCheckpointId` | string (optional) | Parent checkpoint            |
| `channelValues`      | string            | JSON-serialized state values |
| `channelVersions`    | string            | JSON-serialized version map  |

### evolution_events

Audit log of all graph mutations.

| Field              | Type    | Description                                        |
| ------------------ | ------- | -------------------------------------------------- |
| `eventType`        | string  | Event type                                         |
| `targetId`         | string  | Affected entity                                    |
| `previousState`    | any     | State before                                       |
| `newState`         | any     | State after                                        |
| `reason`           | string  | Explanation                                        |
| `triggeredBy`      | string  | Source of the mutation                             |
| `requiresApproval` | boolean | Needs human approval                               |
| `approvalStatus`   | string  | `pending`, `approved`, `rejected`, `auto_approved` |

### execution_records

Telemetry for every graph traversal.

| Field             | Type     | Description                 |
| ----------------- | -------- | --------------------------- |
| `threadId`        | string   | LangGraph thread ID         |
| `taskType`        | string   | Classified task type        |
| `taskDescription` | string   | Original task text          |
| `nodesVisited`    | string[] | Nodes traversed             |
| `edgesTraversed`  | string[] | Edges traversed             |
| `success`         | boolean  | Whether execution succeeded |
| `totalLatencyMs`  | float64  | End-to-end latency          |
| `nodeLatencies`   | object   | Per-node latency map        |

### graph_embeddings

Vector embeddings for semantic search across the graph.

| Field         | Type          | Description             |
| ------------- | ------------- | ----------------------- |
| `sourceId`    | string        | Source entity ID        |
| `embedding`   | float64[1536] | 1536-dimensional vector |
| `textContent` | string        | Original text           |

Indexed with a Convex `vectorIndex` on the `embedding` field (1536 dimensions).

## Related

- [Neural Graph](/plugins/neural-graph)
- [Hive-Mind Station Network](/plugins/hive-mind)
- [Network Propagation Guide](/plugins/neural-graph-network)
