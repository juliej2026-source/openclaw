---
summary: "Meta-Engine: autonomous task classification, model scoring, and performance tracking for intelligent routing"
read_when:
  - You want to understand how tasks are classified and routed
  - You are configuring model selection behavior
  - You want to see how models are scored for each task type
title: "Meta-Engine"
---

# Meta-Engine

The Meta-Engine is an autonomous task classification and model scoring system. It analyzes incoming prompts, classifies them by type and complexity, scores available models against the task, and tracks performance over time. It serves as the primary intelligence node in the [neural graph](/plugins/neural-graph).

## How it works

```
User prompt
    |
    v
Task Classifier (pattern matching, no LLM)
    |
    v
TaskClassification {
  primary: "coding",
  secondary: ["reasoning"],
  confidence: 0.8,
  complexity: "moderate",
  requiresVision: false,
  requiresToolUse: false,
  contextLengthEstimate: 130
}
    |
    v
Model Scorer (weighted scoring)
    |
    v
Ranked model list with fitness breakdowns
```

## Task classification

The classifier uses regex pattern matching (no LLM needed) to categorize prompts. This is "Tier 1" classification covering approximately 80% of cases.

### Supported task types

| Task type       | Signal patterns                                                                              |
| --------------- | -------------------------------------------------------------------------------------------- |
| `coding`        | Code blocks, `function`, `class`, `import`, `implement`, `refactor`, `debug`, language names |
| `reasoning`     | `explain why`, `analyze`, `compare`, `prove`, `step-by-step`, `pros and cons`                |
| `vision`        | `image`, `screenshot`, `photo`, `describe the picture`, `OCR`                                |
| `math`          | `calculate`, `equation`, `integral`, `theorem`, `solve`, `probability`                       |
| `creative`      | `write a story/poem/song`, `imagine`, `brainstorm`, `come up with`                           |
| `summarization` | `summarize`, `summary`, `TL;DR`, `key points`, `condense`                                    |
| `analysis`      | `analyze`, `breakdown`, `review code/PR`, `audit`, `diagnose`, `root cause`                  |
| `tool-use`      | `search the web`, `fetch URL`, `run command`, `install package`, `deploy`                    |
| `chat`          | Fallback when no patterns match                                                              |

### Confidence scoring

| Condition                                               | Confidence |
| ------------------------------------------------------- | ---------- |
| Top type has 3+ pattern matches and second type has 0-1 | 0.95       |
| Top type has 2+ matches                                 | 0.80       |
| Top type has 1 match                                    | 0.60       |
| No patterns match (defaults to chat)                    | 0.30       |

### Complexity estimation

| Complexity | Criteria                                                |
| ---------- | ------------------------------------------------------- |
| `simple`   | Under 50 words, no code blocks, single question         |
| `moderate` | 50-200 words, or has code blocks, or multiple questions |
| `complex`  | Over 200 words, or multiple questions with code blocks  |

## Model scoring

The model scorer evaluates each candidate model against the classified task using 5 weighted criteria:

| Criterion           | Weight | Description                                                            |
| ------------------- | ------ | ---------------------------------------------------------------------- |
| Capability match    | 35%    | How well the model family handles this task type (from capability map) |
| Performance history | 30%    | Historical success rate for this model on this task type               |
| Size efficiency     | 15%    | Smaller models preferred for simple tasks, larger for complex          |
| Context fit         | 10%    | Whether the model context window can handle the estimated token count  |
| Latency             | 10%    | Historical or estimated response latency                               |

### Hardware filtering

Models that exceed available VRAM are deprioritized (sorted after models that fit).

### Score breakdown

Each scored model returns:

```json
{
  "modelId": "qwen2.5-coder:14b",
  "score": 78.5,
  "breakdown": {
    "capabilityMatch": 90,
    "performanceHistory": 72,
    "sizeEfficiency": 60,
    "contextFit": 100,
    "latencyScore": 75
  },
  "fitsHardware": true,
  "estimatedLatencyMs": 4500
}
```

## Performance tracking

The meta-engine tracks per-model, per-task-type performance in a local database (`~/.openclaw/meta-engine/performance.json`):

- **Success rate**: ratio of successful completions to total attempts
- **Average latency**: mean response time in milliseconds
- **Usage count**: how often each model is selected

This data feeds back into the model scorer, creating a reinforcement loop: models that perform well get selected more often.

## Integration with the neural graph

In the neural graph, meta-engine is the primary **orchestrator node** (`meta_orchestrator`). When a task enters the graph:

1. The orchestrator calls `classifyTask()` to determine the task type
2. It maps the task type to a capability node using the routing table:

| Task types                                      | Routed to                  |
| ----------------------------------------------- | -------------------------- |
| `chat`, `coding`, `analysis`, `creative`        | `capability_meta_engine`   |
| `model_management`, `model_pull`, `model_info`  | `capability_model_manager` |
| `training`, `fine_tune`, `evaluation`           | `capability_model_trainer` |
| `memory_search`, `knowledge_retrieval`          | `capability_memory`        |
| `network_scan`, `station_health`, `device_info` | `network_ops`              |

3. The orchestrator returns a LangGraph `Command({ goto })` to dynamically route to the selected node
4. Routing confidence is recorded for fitness scoring

## CLI commands

```bash
# Check meta-engine status and current model rankings
openclaw meta-engine status

# View task classification for a prompt
openclaw meta-engine classify "implement a binary search in Python"

# View model scores for a task
openclaw meta-engine score --task coding --complexity moderate
```

## Related

- [Neural Graph](/plugins/neural-graph)
- [Hive-Mind Station Network](/plugins/hive-mind)
