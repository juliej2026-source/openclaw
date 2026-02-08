# OpenClaw Meta-Intelligence Capabilities Report

**Node:** openclaw-meta-intelligence
**Generated:** 2026-02-07
**Test Validation:** 285 tests / 25 files / 100% pass
**Integration Surface:** 13 agent tools, 15 CLI commands, 3 hooks, 1 provider

---

## 1. System Identity & Overview

OpenClaw Meta-Intelligence is a three-layer extension stack that gives the OpenClaw agent runtime the ability to autonomously manage, select, fine-tune, and evaluate local AI models. Each layer builds on the one below it, creating a self-improving feedback loop.

### Architecture

```
 ┌─────────────────────────────────────────────────────────┐
 │              Layer 3: Model Trainer (Evolution)         │
 │  Dataset collection ─► Validation ─► Training ─►       │
 │  Adapter management ─► Merge ─► Evaluation              │
 │  5 tools │ 6 CLI cmds │ 1 hook │ 15 config templates   │
 ├─────────────────────────────────────────────────────────┤
 │              Layer 2: Meta-Engine (Intelligence)        │
 │  Task classification ─► Capability mapping ─►           │
 │  Model scoring ─► Performance tracking ─► Routing       │
 │  3 tools │ 3 CLI cmds │ 2 hooks                        │
 ├─────────────────────────────────────────────────────────┤
 │              Layer 1: Model Manager (Foundation)        │
 │  Hardware detection ─► Model discovery ─►               │
 │  Inventory tracking ─► Pull/Remove lifecycle            │
 │  5 tools │ 6 CLI cmds │ 1 hook │ 1 provider            │
 ├─────────────────────────────────────────────────────────┤
 │              OpenClaw Plugin SDK                        │
 │  api.registerTool() │ api.registerProvider()            │
 │  api.on() hooks     │ api.registerCli()                 │
 └─────────────────────────────────────────────────────────┘
```

### Data Flow

```
 Ollama Server ──► Model Manager (inventory.json)
                        │
                        ▼
                   Meta-Engine reads inventory ──► scores & routes
                        │
                        ▼
                   Model Trainer reads inventory ──► selects training targets
                        │
                        ▼
                   Agent sessions ──► performance data ──► Meta-Engine
                        │                                    (feedback loop)
                        ▼
                   Session transcripts ──► Model Trainer
                                           (passive data pipeline)
```

---

## 2. Layer 1 — Model Manager (Foundation)

**Plugin ID:** `model-manager`
**Provider:** `local-models` (Label: "Local Models (Ollama/llama.cpp)")
**Storage:** `~/.openclaw/model-manager/inventory.json`

### Tools

| Tool Name             | Description                        | Parameters                |
| --------------------- | ---------------------------------- | ------------------------- |
| `local_model_list`    | List all locally installed models  | `capability?`, `runtime?` |
| `local_model_pull`    | Download a model via Ollama        | `model` (e.g. qwen3:14b)  |
| `local_model_remove`  | Remove a locally installed model   | `model` (model ID)        |
| `local_model_info`    | Show detailed info about a model   | `model` (model ID)        |
| `local_hardware_info` | Detect local hardware capabilities | (none)                    |

### CLI Commands (`openclaw local-models`)

| Command          | Description                                                              |
| ---------------- | ------------------------------------------------------------------------ |
| `list`           | List all locally installed models (filters: `--capability`, `--runtime`) |
| `pull <model>`   | Download a model via Ollama                                              |
| `remove <model>` | Remove a locally installed model                                         |
| `info <model>`   | Show detailed info about a model                                         |
| `hardware`       | Detect local hardware capabilities for AI model inference                |
| `discover`       | Rediscover models from Ollama and update the inventory                   |

### Hooks

| Event           | Behavior                                             |
| --------------- | ---------------------------------------------------- |
| `gateway_start` | Auto-discovers models from Ollama on gateway startup |

### Core Assets

**ModelInventory** (`src/inventory.ts`)

- JSON-backed model registry at `~/.openclaw/model-manager/inventory.json`
- Methods: `listAll`, `listByCapability`, `listByRuntime`, `get`, `upsert`, `remove`, `recordUsage`, `replaceAll`, `totalSizeBytes`, `reload`
- Tracks: usage counts, last-used timestamps, size, quantization, capabilities

**OllamaClient** (`src/ollama-client.ts`)

- HTTP client for Ollama server (default: `http://127.0.0.1:11434`)
- 6 API endpoints: `/api/version`, `/api/tags`, `/api/pull`, `/api/delete`, `/api/show`, `/api/ps`
- Methods: `isAvailable`, `listModels`, `pull` (streaming), `pullAndWait`, `deleteModel`, `showModel`, `listRunning`

**Hardware Detection** (`src/hardware.ts`)

- Detects: NVIDIA GPUs (via nvidia-smi), macOS GPUs (via system_profiler), RAM, CPU cores, platform, architecture
- Detects Ollama availability and version
- Output type: `HardwareInfo` with `GpuInfo[]` (name, VRAM, driver, CUDA version, utilization)

**Model Discovery** (`src/discovery.ts`)

- `discoverLocalModels()` — Syncs Ollama models to inventory, preserving usage stats
- `inferCapabilities()` — Heuristic capability detection from model name/family
- Capabilities detected: code, reasoning, vision, chat, creative, embedding, tool-use

**HuggingFace Client** (`src/huggingface-client.ts`)

- `searchHuggingFaceModels()` — Search GGUF models on HuggingFace Hub (sorted by downloads)
- `listHuggingFaceGgufFiles()` — Get GGUF file listing with download URLs
- Extracts quantization info from filenames (Q4_K_M, Q8_0, F16, etc.)
- API: `https://huggingface.co/api/models`

### Type System

| Type                 | Purpose                                                                                              |
| -------------------- | ---------------------------------------------------------------------------------------------------- |
| `LocalModel`         | Full model record (id, name, runtime, size, quantization, capabilities, context, usage)              |
| `ModelCapability`    | `"code"` \| `"reasoning"` \| `"vision"` \| `"chat"` \| `"creative"` \| `"embedding"` \| `"tool-use"` |
| `ModelRuntime`       | `"ollama"` \| `"llamacpp"`                                                                           |
| `HardwareInfo`       | GPU/RAM/CPU/platform/Ollama detection results                                                        |
| `GpuInfo`            | GPU name, VRAM, driver, CUDA version, utilization                                                    |
| `ModelSearchResult`  | Search result from Ollama or HuggingFace                                                             |
| `OllamaModelTag`     | Raw Ollama model listing entry                                                                       |
| `OllamaModelInfo`    | Detailed model info from Ollama                                                                      |
| `OllamaPullProgress` | Streaming pull progress events                                                                       |
| `OllamaRunningModel` | Currently loaded model info                                                                          |

---

## 3. Layer 2 — Meta-Engine (Intelligence)

**Plugin ID:** `meta-engine`
**Storage:** `~/.openclaw/meta-engine/performance.json`

### Tools

| Tool Name             | Description                                  | Parameters              |
| --------------------- | -------------------------------------------- | ----------------------- |
| `meta_model_select`   | Recommend the best local model for a task    | `task` (description)    |
| `meta_model_status`   | Show meta-engine state and performance stats | (none)                  |
| `meta_model_override` | Pin a model for the current session          | `model` (ID or "clear") |

### CLI Commands (`openclaw meta`)

| Command  | Description                                                         |
| -------- | ------------------------------------------------------------------- |
| `status` | Show meta-engine status and available models (top 15 by runs)       |
| `stats`  | Show detailed performance statistics (filters: `--model`, `--task`) |
| `reset`  | Clear all performance data                                          |

### Hooks

| Event                | Priority | Behavior                                                                    |
| -------------------- | -------- | --------------------------------------------------------------------------- |
| `before_agent_start` | 100      | Classifies task, scores models, injects routing advisory into agent context |
| `agent_end`          | —        | Records performance data (success/failure, latency, task type)              |

### Task Classification

**9 Task Types:**

| Task Type       | Signal Patterns                                                                            |
| --------------- | ------------------------------------------------------------------------------------------ |
| `coding`        | Code blocks, function/class/def/import, "fix bug", "implement", "refactor", language names |
| `reasoning`     | "explain why", "analyze", "compare", "step-by-step", "pros and cons"                       |
| `creative`      | "write story/poem/song", "brainstorm", "come up with", "generate name/idea"                |
| `vision`        | "image", "screenshot", "photo", "describe what you see", "ocr"                             |
| `chat`          | Default fallback (no specific patterns)                                                    |
| `analysis`      | "analyze", "breakdown", "review code/pr", "audit", "root cause"                            |
| `tool-use`      | "search web", "fetch url", "run command", "install package", "deploy"                      |
| `math`          | "calculate", "equation", "integral", "proof", "theorem", "probability"                     |
| `summarization` | "summarize", "tldr", "key points", "condense"                                              |

**Complexity Estimation:**

- Simple: < 50 words, no code blocks, <= 1 question
- Moderate: 50-200 words, has code blocks or multiple questions
- Complex: > 200 words or multiple questions + code blocks

### Capability Map (13 Model Families)

| Family      | Coding | Reasoning | Chat | Creative | Math | Vision | Analysis | Tool-Use | Summarization |
| ----------- | ------ | --------- | ---- | -------- | ---- | ------ | -------- | -------- | ------------- |
| `codellama` | 0.90   | 0.50      | 0.40 | 0.30     | 0.50 | —      | 0.60     | 0.70     | 0.40          |
| `codegemma` | 0.85   | 0.50      | 0.40 | 0.30     | 0.50 | —      | 0.60     | 0.70     | 0.40          |
| `starcoder` | 0.85   | 0.40      | 0.30 | 0.20     | 0.40 | —      | 0.50     | 0.60     | 0.30          |
| `deepseek`  | 0.85   | 0.80      | 0.70 | 0.50     | 0.80 | —      | 0.80     | 0.70     | 0.60          |
| `llama`     | 0.70   | 0.75      | 0.85 | 0.70     | 0.60 | —      | 0.70     | 0.65     | 0.75          |
| `qwen`      | 0.80   | 0.80      | 0.85 | 0.70     | 0.75 | —      | 0.80     | 0.75     | 0.75          |
| `qwen2`     | 0.80   | 0.80      | 0.85 | 0.70     | 0.75 | —      | 0.80     | 0.75     | 0.75          |
| `mistral`   | 0.70   | 0.75      | 0.80 | 0.70     | 0.65 | —      | 0.70     | 0.70     | 0.75          |
| `gemma`     | 0.65   | 0.65      | 0.75 | 0.65     | 0.60 | —      | 0.65     | 0.55     | 0.70          |
| `phi`       | 0.70   | 0.70      | 0.70 | 0.55     | 0.70 | —      | 0.65     | 0.60     | 0.65          |
| `command`   | 0.50   | 0.70      | 0.80 | 0.70     | 0.50 | —      | 0.70     | 0.60     | 0.80          |
| `qwq`       | 0.75   | 0.95      | 0.60 | 0.50     | 0.90 | —      | 0.90     | 0.60     | 0.60          |
| `llava`     | 0.30   | 0.50      | 0.65 | 0.50     | —    | 0.90   | 0.60     | —        | 0.50          |

**Default strengths (unknown families):** coding=0.5, reasoning=0.5, chat=0.6, creative=0.5, math=0.4, analysis=0.5, tool-use=0.5, summarization=0.5

### Scoring Algorithm (5-Factor Composite)

| Factor               | Weight | Range | Description                                                   |
| -------------------- | ------ | ----- | ------------------------------------------------------------- |
| `capabilityMatch`    | 0.35   | 0-100 | Primary task strength (80%) + secondary task bonus (20%)      |
| `performanceHistory` | 0.30   | 0-100 | Historical success rate for this model on this task type      |
| `sizeEfficiency`     | 0.15   | 0-100 | Right-sized model for task complexity                         |
| `contextFit`         | 0.10   | 0-100 | Context window meets estimated requirement (2x safety margin) |
| `latencyScore`       | 0.10   | 0-100 | Historical or estimated response latency                      |

**Total: 1.00**

**Size Efficiency by Complexity:**

| Model Size | Simple | Moderate | Complex |
| ---------- | ------ | -------- | ------- |
| <= 3B      | 100    | 50       | 40      |
| <= 7B      | 85     | 90\*     | 40\*    |
| <= 14B     | 60     | 90       | 65      |
| <= 34B     | —      | 80       | 85      |
| > 34B      | 40     | 70       | 100     |

### Performance Database

- Storage: `~/.openclaw/meta-engine/performance.json`
- Max records: 10,000 (auto-prunes at 5,000 keeping most recent)
- Tracked per record: modelId, taskType, success (bool), durationMs, tokenInput, tokenOutput, timestamp, sessionKey

### Routing Logic

1. Classify incoming prompt into task type with confidence and complexity
2. Score all inventory models against the classified task
3. Filter for hardware-compatible models
4. Select highest-scoring model; build fallback chain (next 3 candidates)
5. Inject advisory context into agent session (via `before_agent_start` hook)
6. After agent run, record performance metrics (via `agent_end` hook)

---

## 4. Layer 3 — Model Trainer (Evolution)

**Plugin ID:** `model-trainer`
**Storage Root:** `~/.openclaw/model-trainer/`

### Tools

| Tool Name               | Description                                    | Parameters                                          |
| ----------------------- | ---------------------------------------------- | --------------------------------------------------- |
| `training_data_collect` | Collect training data from session transcripts | `output`, `agent?`, `format?`, `maxPairs?`          |
| `training_start`        | Start a fine-tuning job                        | `base`, `dataset`, `output`, `method?`, hyperparams |
| `training_status`       | Show training job status                       | `job?`, `filter?`                                   |
| `adapter_list`          | List LoRA adapters                             | (none)                                              |
| `model_eval`            | Evaluate a model against test cases            | `model`, `base?`, `dataset?`, `maxCases?`           |

### CLI Commands (`openclaw train`)

| Command    | Description                                                                                                                                |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `data`     | Collect training data from session transcripts (`--output`, `--agent`, `--format`, `--max-pairs`, `--base-model`)                          |
| `start`    | Start a fine-tuning job (`--base`, `--dataset`, `--output`, `--method`, `--epochs`, `--batch-size`, `--lr`, `--lora-rank`, `--lora-alpha`) |
| `status`   | Show training job status (`--job`, `--filter`)                                                                                             |
| `adapters` | List LoRA adapters                                                                                                                         |
| `datasets` | List exported training datasets                                                                                                            |
| `eval`     | Evaluate a model against dataset test cases (`--model`, `--base`, `--dataset`, `--max-cases`)                                              |

### Hooks

| Event       | Behavior                                                             |
| ----------- | -------------------------------------------------------------------- |
| `agent_end` | Passively collects successful conversation pairs from agent sessions |

### Training Methods

**Method 1: Ollama Modelfile** (`ollama-modelfile`)

- No GPU required
- Behavioral customization via system prompt extraction
- Analyzes dataset response patterns to generate tone-appropriate system prompt
- Generates Modelfile with FROM, SYSTEM, and PARAMETER directives
- Runs `ollama create` to register the customized model

**Method 2: Unsloth QLoRA** (`unsloth-qlora`)

- Requires CUDA GPU (8GB+ VRAM)
- Generates a complete Python training script
- Uses: unsloth, datasets, trl, transformers
- LoRA target modules: q_proj, k_proj, v_proj, o_proj, gate_proj, up_proj, down_proj
- Spawns `python3` process, monitors stdout for training signals
- Signals: `TRAINING_START`, `TRAINING_COMPLETE loss=<val>`, `ADAPTER_SAVED path=<val>`

### Dataset Pipeline

**Collector** (`src/dataset/collector.ts`)

- Reads JSONL session transcripts from `~/.openclaw/agents/<agentId>/sessions/`
- Extracts user-assistant conversation pairs
- Filters out tool calls, system messages, error responses
- Handles multimodal content formats

**Formatter** (`src/dataset/formatter.ts`)

- 3 output formats: ShareGPT, Alpaca, ChatML
- ShareGPT: `{ conversations: [{ from: "human"|"gpt", value }] }`
- Alpaca: `{ instruction, input, output }`
- Storage: `~/.openclaw/model-trainer/datasets/<id>.jsonl`

**Validator** (`src/dataset/validator.ts`)

- 7 rejection criteria:

| Rule                 | Condition                                                   |
| -------------------- | ----------------------------------------------------------- |
| `missing_role`       | No user or assistant message                                |
| `prompt_too_short`   | User message < 3 characters                                 |
| `response_too_short` | Assistant response < 10 characters                          |
| `response_too_long`  | Assistant response > 50,000 characters                      |
| `error_response`     | Contains error patterns (rate limit, model not found, etc.) |
| `duplicate`          | Content hash collision (first 200 chars)                    |

### Config Templates (15 Pre-Tuned Configurations)

**Base Hyperparameter Tiers:**

| Parameter            | 8GB VRAM | 16GB VRAM | 24GB+ VRAM |
| -------------------- | -------- | --------- | ---------- |
| epochs               | 3        | 3         | 3          |
| batchSize            | 2        | 4         | 8          |
| learningRate         | 2e-4     | 2e-4      | 1e-4       |
| loraRank             | 16       | 32        | 64         |
| loraAlpha            | 32       | 64        | 128        |
| maxSeqLength         | 2048     | 4096      | 8192       |
| warmupSteps          | 10       | 10        | 20         |
| gradientAccumulation | 4        | 4         | 2          |

**Templates by Family:**

| Template Name        | Family    | VRAM Tier |
| -------------------- | --------- | --------- |
| `llama-7b-8gb`       | llama     | 8GB       |
| `llama-7b-16gb`      | llama     | 16GB      |
| `llama-13b-24gb`     | llama     | 24GB      |
| `qwen-7b-8gb`        | qwen      | 8GB       |
| `qwen-7b-16gb`       | qwen      | 16GB      |
| `qwen-14b-24gb`      | qwen      | 24GB      |
| `mistral-7b-8gb`     | mistral   | 8GB       |
| `mistral-7b-16gb`    | mistral   | 16GB      |
| `gemma-7b-8gb`       | gemma     | 8GB       |
| `gemma-7b-16gb`      | gemma     | 16GB      |
| `phi-3b-8gb`         | phi       | 8GB       |
| `deepseek-7b-16gb`   | deepseek  | 16GB      |
| `deepseek-7b-24gb`   | deepseek  | 24GB      |
| `codellama-7b-8gb`   | codellama | 8GB       |
| `codellama-13b-24gb` | codellama | 24GB      |

### Adapter Management

**AdapterStore** (`src/adapters/adapter-store.ts`)

- Registry: `~/.openclaw/model-trainer/adapters.json`
- Functions: `registerAdapter`, `getAdapter`, `listAdapters`, `removeAdapter`, `updateAdapterEvalScore`, `createAdapterFromJob`

**AdapterMerge** (`src/adapters/adapter-merge.ts`)

- Detects PEFT format via `adapter_config.json` presence
- PEFT adapters: Modelfile with `ADAPTER` directive
- Non-PEFT: Modelfile with `SYSTEM` fallback
- Runs `ollama create` to register merged model
- Function: `mergeAdapterToOllama(adapter, outputModelName)`

### Evaluation Pipeline

**Evaluator** (`src/eval/evaluator.ts`)

- Generates responses via Ollama API (`/api/generate`, temperature=0.1)
- Compares against reference responses from dataset
- Optional base model comparison for improvement measurement
- Results stored at: `~/.openclaw/model-trainer/evals/<modelId>-<timestamp>.json`

**Metrics** (`src/eval/metrics.ts`)

| Metric              | Algorithm                                                                                    |
| ------------------- | -------------------------------------------------------------------------------------------- |
| `jaccardSimilarity` | Word-level intersection/union (0-1)                                                          |
| `fluencyScore`      | Sentence structure + word diversity + paragraph presence (0-1)                               |
| `accuracyScore`     | Jaccard similarity x length penalty (0-1)                                                    |
| `overallScore`      | With task scores: accuracy 40% + fluency 20% + task 40%. Without: accuracy 60% + fluency 40% |

### Job Lifecycle

```
queued ──► preparing ──► training ──► merging ──► completed
                │            │           │
                └────────────┴───────────┴──► failed
                                              cancelled
```

- Jobs stored at: `~/.openclaw/model-trainer/jobs.json`
- Scripts at: `~/.openclaw/model-trainer/scripts/<jobId>.py`
- Logs at: `~/.openclaw/model-trainer/logs/<jobId>.log`
- Adapters at: `~/.openclaw/model-trainer/adapters/<name>/`
- Modelfiles at: `~/.openclaw/model-trainer/modelfiles/<name>.Modelfile`

---

## 5. Cross-Layer Data Flow

### Shared Storage Namespace

All extensions share the `~/.openclaw/` base directory with isolated subdirectories:

```
~/.openclaw/
├── model-manager/
│   └── inventory.json          ◄── Layer 1 writes; Layer 2 & 3 read
├── meta-engine/
│   └── performance.json        ◄── Layer 2 writes (after each agent run)
└── model-trainer/
    ├── datasets/               ◄── Layer 3 writes (JSONL training data)
    │   └── <id>.jsonl
    ├── jobs.json               ◄── Layer 3 writes (job tracking)
    ├── adapters.json           ◄── Layer 3 writes (adapter registry)
    ├── scripts/                ◄── Layer 3 writes (generated Python)
    ├── logs/                   ◄── Layer 3 writes (training output)
    ├── modelfiles/             ◄── Layer 3 writes (Ollama Modelfiles)
    ├── adapters/               ◄── Layer 3 writes (LoRA weight files)
    └── evals/                  ◄── Layer 3 writes (evaluation results)
```

### Integration Points

| Source          | Target        | Data                                              |
| --------------- | ------------- | ------------------------------------------------- |
| Ollama Server   | Model Manager | Model tags, model info, running models            |
| Model Manager   | Meta-Engine   | Model inventory (capabilities, sizes, families)   |
| Model Manager   | Model Trainer | Model inventory (training targets)                |
| Agent Sessions  | Meta-Engine   | Performance records (success, latency, task type) |
| Agent Sessions  | Model Trainer | Conversation transcripts (training data)          |
| Model Trainer   | Model Manager | New models via `ollama create` (auto-discovered)  |
| Meta-Engine     | Agent Runtime | Routing advisory (via before_agent_start hook)    |
| HuggingFace Hub | Model Manager | Model search results, GGUF file listings          |

---

## 6. Self-Improvement & Meta-Evolution Techniques

### Technique 1: Passive Data Collection

Every successful agent interaction auto-feeds the training data pipeline. The model-trainer `agent_end` hook silently captures conversation pairs from completed sessions. No manual data curation required.

### Technique 2: Performance Feedback Loop

After each agent run, the meta-engine `agent_end` hook records success/failure, latency, and task classification. This historical data directly improves future model routing decisions. The system gets measurably better at model selection with every interaction.

### Technique 3: Autonomous Model Selection

The meta-engine classifies tasks in real-time (9 types, 3 complexity levels), scores all available models using a 5-factor algorithm, and routes to the optimal model automatically. No human intervention needed for model selection.

### Technique 4: Fine-Tuning Pipeline

Collected session data flows through validation (7 rejection rules, deduplication) into formatted datasets, which feed into either Ollama Modelfile customization (no GPU) or QLoRA training (GPU). The resulting adapter is merged back into Ollama as a new model.

### Technique 5: Evaluation-Driven Iteration

After training, the evaluator measures accuracy (Jaccard similarity) and fluency against the training dataset, and optionally compares against the base model. This provides quantitative evidence of improvement (or regression) before deployment.

### Technique 6: Hardware-Aware Optimization

Hardware detection identifies available GPUs, VRAM, and RAM. The config template system (15 pre-tuned configurations across 7 families and 3 VRAM tiers) automatically selects optimal training hyperparameters. The scorer filters out models that exceed available VRAM.

### Technique 7: Config Template Evolution

Pre-optimized hyperparameters for 7 model families across 3 VRAM tiers (8GB, 16GB, 24GB+) with family-specific overrides. Templates encode best practices for LoRA rank, alpha, batch size, learning rate, sequence length, and gradient accumulation per hardware tier.

---

## 7. Orchestrator Integration Manifest

### Node Identity

| Field        | Value                                             |
| ------------ | ------------------------------------------------- |
| Node Name    | `openclaw-meta-intelligence`                      |
| Network Role | Model management, autonomous routing, fine-tuning |
| Plugin IDs   | `model-manager`, `meta-engine`, `model-trainer`   |
| Runtime      | Node.js 22+ / TypeScript ESM                      |

### Available Tool Endpoints (13)

**Model Manager (5):**

1. `local_model_list` — List models (filter by capability/runtime)
2. `local_model_pull` — Download model from Ollama registry
3. `local_model_remove` — Remove installed model
4. `local_model_info` — Get detailed model metadata
5. `local_hardware_info` — Detect GPU/VRAM/RAM/CPU

**Meta-Engine (3):** 6. `meta_model_select` — Get optimal model recommendation for a task 7. `meta_model_status` — Get engine state and performance stats 8. `meta_model_override` — Pin model for a session

**Model Trainer (5):** 9. `training_data_collect` — Mine session transcripts for training data 10. `training_start` — Launch a fine-tuning job 11. `training_status` — Query job progress 12. `adapter_list` — List trained LoRA adapters 13. `model_eval` — Evaluate model quality against dataset

### CLI Command Surface (15)

**`openclaw local-models` (6):** list, pull, remove, info, hardware, discover
**`openclaw meta` (3):** status, stats, reset
**`openclaw train` (6):** data, start, status, adapters, datasets, eval

### Hook Integration Points (3)

| Hook                                | Extension                   | Purpose                                    |
| ----------------------------------- | --------------------------- | ------------------------------------------ |
| `gateway_start`                     | model-manager               | Auto-discover models on startup            |
| `before_agent_start` (priority 100) | meta-engine                 | Inject model routing advisory              |
| `agent_end`                         | meta-engine + model-trainer | Record performance + collect training data |

### Data Exchange Format

All data stored as JSON files at deterministic paths under `~/.openclaw/`:

| Path                                | Format                          | Purpose             |
| ----------------------------------- | ------------------------------- | ------------------- |
| `model-manager/inventory.json`      | JSON (model array)              | Model registry      |
| `meta-engine/performance.json`      | JSON (version + records array)  | Performance history |
| `model-trainer/jobs.json`           | JSON (version + jobs array)     | Training job state  |
| `model-trainer/adapters.json`       | JSON (version + adapters array) | Adapter registry    |
| `model-trainer/datasets/<id>.jsonl` | JSONL                           | Training datasets   |
| `model-trainer/evals/<id>.json`     | JSON                            | Evaluation results  |

### External API Dependencies

| Service     | Endpoints                                                                | Purpose                          |
| ----------- | ------------------------------------------------------------------------ | -------------------------------- |
| Ollama      | `http://127.0.0.1:11434/api/{version,tags,pull,delete,show,ps,generate}` | Model lifecycle + inference      |
| HuggingFace | `https://huggingface.co/api/models`                                      | Model discovery + GGUF downloads |

---

## 8. Technical Specifications

| Spec                  | Value                                                              |
| --------------------- | ------------------------------------------------------------------ |
| Runtime               | Node.js 22+, TypeScript ESM                                        |
| Plugin SDK            | `openclaw/plugin-sdk`                                              |
| Schema Library        | `@sinclair/typebox`                                                |
| Test Framework        | Vitest                                                             |
| Lint/Format           | Oxlint + Oxfmt                                                     |
| Tests                 | 285 passing / 25 files / 0 failures                                |
| Lint Errors           | 0                                                                  |
| Dependencies          | @sinclair/typebox + Node.js built-ins only                         |
| External Requirements | Ollama (required), Python 3.10+ with unsloth (optional, for QLoRA) |

### Test Coverage by Extension

| Extension     | Test Files | Tests   |
| ------------- | ---------- | ------- |
| model-manager | 8          | ~100    |
| meta-engine   | 7          | ~95     |
| model-trainer | 10         | ~90     |
| **Total**     | **25**     | **285** |

---

## Machine-Parseable Manifest

```json
{
  "node": "openclaw-meta-intelligence",
  "generated": "2026-02-07",
  "extensions": [
    {
      "id": "model-manager",
      "layer": 1,
      "role": "foundation",
      "tools": [
        "local_model_list",
        "local_model_pull",
        "local_model_remove",
        "local_model_info",
        "local_hardware_info"
      ],
      "cli": {
        "parent": "local-models",
        "commands": ["list", "pull", "remove", "info", "hardware", "discover"]
      },
      "hooks": ["gateway_start"],
      "provider": "local-models",
      "storage": ["~/.openclaw/model-manager/inventory.json"],
      "externalApis": ["ollama", "huggingface"]
    },
    {
      "id": "meta-engine",
      "layer": 2,
      "role": "intelligence",
      "tools": ["meta_model_select", "meta_model_status", "meta_model_override"],
      "cli": {
        "parent": "meta",
        "commands": ["status", "stats", "reset"]
      },
      "hooks": ["before_agent_start", "agent_end"],
      "storage": ["~/.openclaw/meta-engine/performance.json"],
      "scoringWeights": {
        "capabilityMatch": 0.35,
        "performanceHistory": 0.3,
        "sizeEfficiency": 0.15,
        "contextFit": 0.1,
        "latencyScore": 0.1
      },
      "taskTypes": [
        "coding",
        "reasoning",
        "creative",
        "vision",
        "chat",
        "analysis",
        "tool-use",
        "math",
        "summarization"
      ],
      "modelFamilies": [
        "codellama",
        "codegemma",
        "starcoder",
        "deepseek",
        "llama",
        "qwen",
        "qwen2",
        "mistral",
        "gemma",
        "phi",
        "command",
        "qwq",
        "llava"
      ]
    },
    {
      "id": "model-trainer",
      "layer": 3,
      "role": "evolution",
      "tools": [
        "training_data_collect",
        "training_start",
        "training_status",
        "adapter_list",
        "model_eval"
      ],
      "cli": {
        "parent": "train",
        "commands": ["data", "start", "status", "adapters", "datasets", "eval"]
      },
      "hooks": ["agent_end"],
      "storage": [
        "~/.openclaw/model-trainer/jobs.json",
        "~/.openclaw/model-trainer/adapters.json",
        "~/.openclaw/model-trainer/datasets/",
        "~/.openclaw/model-trainer/scripts/",
        "~/.openclaw/model-trainer/logs/",
        "~/.openclaw/model-trainer/modelfiles/",
        "~/.openclaw/model-trainer/adapters/",
        "~/.openclaw/model-trainer/evals/"
      ],
      "trainingMethods": ["ollama-modelfile", "unsloth-qlora"],
      "datasetFormats": ["sharegpt", "alpaca", "chatml"],
      "configTemplates": 15,
      "templateFamilies": ["llama", "qwen", "mistral", "gemma", "phi", "deepseek", "codellama"],
      "vramTiers": ["8gb", "16gb", "24gb"]
    }
  ],
  "totals": {
    "tools": 13,
    "cliCommands": 15,
    "hooks": 3,
    "providers": 1,
    "tests": 285,
    "testFiles": 25,
    "configTemplates": 15,
    "modelFamilies": 13,
    "taskTypes": 9
  }
}
```
