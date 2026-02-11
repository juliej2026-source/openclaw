---
summary: "Neural Graph backbone: LangGraph + Convex self-evolving AI orchestration across the station network"
read_when:
  - You want to understand the neural graph backbone
  - You are configuring or deploying the neural graph extension
  - You want to see how tasks are routed through the AI graph
title: "Neural Graph"
---

# Neural Graph

The neural graph is a self-evolving AI backbone that unifies all OpenClaw extensions (meta-engine, model-manager, model-trainer, memory) into a single living graph. It routes tasks, self-evaluates performance, strengthens successful paths, prunes underperformers, and replicates across the station network.

Built on [LangGraph](https://langchain-ai.github.io/langgraph/) for stateful graph orchestration and [Convex](https://www.convex.dev/) (self-hosted) for reactive persistence.

## Architecture

```
Portal (#/neural-graph)
    |
    v
HTTP API (/api/neural/*)
    |
    v
+-------------------------------------------+
|          neural-graph extension            |
|                                           |
|  LangGraph StateGraph (9 nodes)           |
|    START                                  |
|      -> meta_orchestrator                 |
|      -> [capability node] (conditional)   |
|      -> evaluation                        |
|      -> mutation (if evolving)            |
|      -> human_gate (if approval needed)   |
|      -> END                               |
|                                           |
|  Convex (self-hosted, port 3210)          |
|    graph_nodes, graph_edges, checkpoints, |
|    evolution_events, execution_records,   |
|    graph_embeddings (vector search)       |
+-------------------------------------------+
         |              |            |
    meta-engine   model-manager  model-trainer
                       |
                  memory-lancedb
```

## Graph topology

### Genesis nodes (6)

The graph seeds with these core nodes on first run:

| Node ID          | Type       | Description                                                     |
| ---------------- | ---------- | --------------------------------------------------------------- |
| `meta-engine`    | capability | Task classification, model scoring, autonomous routing          |
| `model-manager`  | capability | Hardware detection, model discovery, lifecycle management       |
| `model-trainer`  | capability | Dataset curation, training (Ollama Modelfile + QLoRA), adapters |
| `memory-lancedb` | capability | Vector-based memory storage and semantic search                 |
| `iot-hub`        | station    | Primary compute station running gateway and AI extensions       |
| `julie`          | station    | Central hive-mind orchestrator coordinating the station network |

### Node types

| Type         | Symbol  | Description                                                 |
| ------------ | ------- | ----------------------------------------------------------- |
| `capability` | Hexagon | AI extension wrapper (meta-engine, model-manager, etc.)     |
| `station`    | Diamond | Physical or logical station (iot-hub, julie)                |
| `model`      | Circle  | Specific AI model instance (created during differentiation) |
| `synthetic`  | Star    | Dynamically created by the evolution engine                 |

### Edge types

| Type         | Color  | Description                                 |
| ------------ | ------ | ------------------------------------------- |
| `data_flow`  | Blue   | Data passes from source to target           |
| `dependency` | Purple | Target depends on source                    |
| `activation` | Cyan   | Source activates target                     |
| `fallback`   | Orange | Target is fallback for source (dashed line) |
| `inhibition` | Red    | Source inhibits target                      |

All edges have a **weight** (0.0 to 1.0) and can become **myelinated** (optimized) after heavy use.

## LangGraph StateGraph

The graph is compiled as a `StateGraph` with 14 typed state channels:

**Input channels:** `taskDescription`, `taskType`, `complexity`, `sourceStationId`
**Routing channels:** `selectedRoute`, `routingConfidence`
**Tracking channels:** `nodesVisited` (append), `nodeLatencies` (merge)
**Result channels:** `result`, `success`, `error`
**Evolution channels:** `shouldEvolve`, `evolutionProposals` (append), `pendingApproval`

### Graph nodes (9)

| Node                       | Purpose                                                                              |
| -------------------------- | ------------------------------------------------------------------------------------ |
| `meta_orchestrator`        | Classifies task via meta-engine, routes to capability node using `Command({ goto })` |
| `capability_meta_engine`   | Wraps meta-engine task classification and model scoring                              |
| `capability_model_manager` | Wraps model-manager Ollama operations                                                |
| `capability_model_trainer` | Wraps model-trainer job management                                                   |
| `capability_memory`        | Wraps memory-lancedb vector search                                                   |
| `network_ops`              | Station management, ping, health                                                     |
| `evaluation`               | Post-execution self-evaluation: proposes edge changes                                |
| `mutation`                 | Applies auto-approved mutations; routes critical ones to human gate                  |
| `human_gate`               | Uses LangGraph `interrupt()` to pause for human approval                             |

### Execution flow

```
START -> meta_orchestrator -> [1 of 5 capability/network nodes]
                                      |
                                 evaluation
                                   /    \
                          (evolve?)     (no) -> END
                              |
                          mutation
                            /    \
                   (approval?)   (no) -> END
                        |
                   human_gate -> END
```

## Maturation lifecycle

The graph evolves through 5 biological phases based on total execution count:

| Phase               | Trigger                         | Behavior                                                                                                                               |
| ------------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **Genesis**         | First run (0 executions)        | Seeds 6 core nodes + 10 edges at weight 0.5. No evolution.                                                                             |
| **Differentiation** | 100+ executions                 | Fitness scoring activates. Nodes specialize based on success rates.                                                                    |
| **Synaptogenesis**  | 500+ executions                 | Co-activation analysis creates new edges between frequently paired nodes.                                                              |
| **Pruning**         | 1000+ executions                | Synthetic nodes with fitness below 30 (inactive 7+ days) are pruned. Edges below weight 0.1 with fewer than 5 activations are removed. |
| **Myelination**     | Ongoing (100+ edge activations) | High-traffic edges (100+ activations, weight 0.7+) are marked myelinated. The orchestrator prefers myelinated paths.                   |

Core nodes (`meta-engine`, `model-manager`, `model-trainer`, `memory-lancedb`, `iot-hub`, `julie`) are never pruned.

## Fitness scoring

Every node receives a fitness score from 0 to 100, recalculated every 15 minutes:

| Component    | Weight | Calculation                                       |
| ------------ | ------ | ------------------------------------------------- |
| Success rate | 40 pts | `successCount / (successCount + failureCount)`    |
| Latency      | 30 pts | Inverse ratio to global average (lower is better) |
| Utilization  | 20 pts | Activation count relative to most-active node     |
| Connectivity | 10 pts | Average weight of connected edges                 |

New nodes start at 50 (neutral). The portal colors nodes by fitness: green (above 70), yellow (above 40), red (40 or below).

## API endpoints

All endpoints are served by hive-mind on the station port (default 3001), proxied through Apache on port 80.

| Method | Path                   | Description                |
| ------ | ---------------------- | -------------------------- |
| GET    | `/api/neural/status`   | Graph status summary       |
| GET    | `/api/neural/topology` | Full node and edge data    |
| GET    | `/api/neural/events`   | Recent evolution events    |
| GET    | `/api/neural/pending`  | Pending approval queue     |
| POST   | `/api/neural/approve`  | Approve an evolution event |
| POST   | `/api/neural/reject`   | Reject an evolution event  |

See the full [API reference](/plugins/neural-graph-api).

## Portal visualization

Navigate to `/#/neural-graph` in the portal to see:

1. **Status cards** showing phase, node count, edge count, myelinated edges, executions, and average fitness
2. **Maturation phase** progress bar
3. **Graph topology** as an interactive force-directed SVG with fitness-colored nodes, weighted edges, and myelinated path glow effects
4. **Legend** for node types, fitness colors, and edge types
5. **Pending approvals** queue with approve/reject buttons
6. **Evolution timeline** showing recent graph mutations

## CLI commands

```bash
# View current graph status
openclaw neural-graph status

# View full topology (nodes + edges)
openclaw neural-graph topology

# Trigger an evolution cycle manually
openclaw neural-graph evolve

# Approve a pending mutation
openclaw neural-graph approve <eventId>
```

## Configuration

| Variable         | Default                 | Description            |
| ---------------- | ----------------------- | ---------------------- |
| `CONVEX_URL`     | `http://127.0.0.1:3210` | Convex deployment URL  |
| `JULIE_BASE_URL` | `http://10.1.7.87:8000` | Julie orchestrator URL |

The evolution cycle runs every 15 minutes. Fitness weights, phase thresholds, pruning thresholds, and myelination thresholds are configured as constants in the extension source.

## Cross-station replication

The neural graph supports 3 replication modes depending on network connectivity. See the [Network Propagation Guide](/plugins/neural-graph-network) for details.

## Related

- [Hive-Mind Station Network](/plugins/hive-mind)
- [Network Propagation Guide](/plugins/neural-graph-network)
- [Neural Graph API Reference](/plugins/neural-graph-api)
- [Meta-Engine](/plugins/meta-engine)
