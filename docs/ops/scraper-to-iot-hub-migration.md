# Scraper Station Migration to IOT-HUB

**Date:** 2026-02-08
**From:** SCRAPER station at `10.1.7.180` (physically powered off)
**To:** IOT-HUB station at `10.1.7.158`

---

## What the scraper station was doing

The scraper station (10.1.7.180) had deployed partial functionality to Hugging Face:

| Resource type | Description                                   |
| ------------- | --------------------------------------------- |
| HF Spaces     | Gradio/Streamlit apps for data processing     |
| HF Datasets   | Scraped/collected data repositories           |
| HF Jobs       | Compute jobs running on HF infrastructure     |
| HF Models     | Trained/fine-tuned models uploaded to the Hub |

These resources are hosted on HF infrastructure and do not depend on the scraper station being online. However, any webhooks, CI triggers, or local automation that pushed updates from the scraper need to be re-pointed at IOT-HUB.

---

## Changes made in OpenClaw

The following codebase changes consolidate scraper functionality onto IOT-HUB:

1. **New capabilities added** to `StationCapability`: `web_scraping`, `data_collection`, `huggingface_management`
2. **SCRAPER marked as decommissioned** in `KNOWN_STATIONS` registry
3. **Alert suppression** for decommissioned stations (no more "SCRAPER offline" alerts)
4. **HuggingFace Manager layer** added to station identity with `hf:*` network commands
5. **Topology visualization** shows SCRAPER greyed out as decommissioned

---

## Setup steps on IOT-HUB (10.1.7.158)

### 1. Authenticate with Hugging Face

```bash
# Option A: Use the hf CLI
hf auth login
# Paste your HF token when prompted

# Option B: Set environment variable
export HF_TOKEN="hf_your_token_here"
```

The token is stored at `~/.cache/huggingface/token` by the CLI.

### 2. Verify HF access

After restarting the hive-mind backend:

```bash
# Check the huggingface layer is active
curl -s http://127.0.0.1:3001/api/network/identity | jq '.layers.huggingface'

# Use the new hf:status command
curl -s http://127.0.0.1:3001/api/network/command \
  -X POST -H "Content-Type: application/json" \
  -d '{"command": "hf:status"}'
```

Expected: `huggingface` layer status is `"active"` and `hf:status` returns counts of your spaces, datasets, models, and jobs.

### 3. Transfer HF resource ownership (if needed)

If HF resources were created under a different account tied to the scraper:

- **Spaces**: Go to Space Settings > Transfer ownership, or recreate under the correct account
- **Datasets**: Use `hf repo transfer` CLI command or recreate
- **Models**: Use `hf repo transfer` CLI command or recreate
- **Jobs**: Jobs are ephemeral; just launch new ones from IOT-HUB

### 4. Update any webhooks or CI triggers

If the scraper had:

- GitHub Actions pushing to HF: update the runner or secrets to use IOT-HUB
- Cron jobs or systemd timers: recreate on IOT-HUB
- Webhook URLs pointing at `10.1.7.180`: update to `10.1.7.158`

---

## Available hf:\* commands

After the hive-mind backend restarts with the new code, these network commands are available:

| Command            | Description           | Params                |
| ------------------ | --------------------- | --------------------- |
| `hf:spaces`        | List your HF Spaces   | `{ limit?, author? }` |
| `hf:spaces:info`   | Get Space details     | `{ id }`              |
| `hf:datasets`      | List your HF Datasets | `{ limit?, author? }` |
| `hf:datasets:info` | Get Dataset details   | `{ id }`              |
| `hf:models`        | List your HF Models   | `{ limit?, author? }` |
| `hf:models:info`   | Get Model details     | `{ id }`              |
| `hf:jobs`          | List HF Jobs          | none                  |
| `hf:jobs:info`     | Get Job details       | `{ id }`              |
| `hf:status`        | Combined overview     | none                  |

---

## Decommissioning checklist

- [x] SCRAPER marked as decommissioned in `KNOWN_STATIONS`
- [x] Alert suppression active for `10.1.7.180`
- [x] Topology shows SCRAPER greyed out
- [x] New capabilities (`web_scraping`, `data_collection`, `huggingface_management`) added to IOT-HUB
- [x] HuggingFace Manager layer added to station identity
- [x] `hf:*` commands available via command dispatch
- [ ] HF token configured on IOT-HUB (`hf auth login` or `HF_TOKEN` env var)
- [ ] Hive-mind backend restarted with new code
- [ ] `hf:status` returns valid data
- [ ] Any webhooks/CI triggers re-pointed from scraper to IOT-HUB
- [ ] Scraper station physically labeled as decommissioned

---

## Rollback

If the scraper station needs to come back online:

1. Remove `"10.1.7.180"` from `DECOMMISSIONED_STATIONS` in `extensions/hive-mind/src/unifi-types.ts`
2. Change SCRAPER role back to `"worker"` in `extensions/hive-mind/portal/htdocs/js/topology.js`
3. Restart hive-mind backend
