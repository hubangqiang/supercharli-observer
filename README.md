# supercharli-observer

Read-only web observer for SuperCharli runtime data.

## Scope (v0.1)
- Memory overview: `L1/L2/L3/L4`
- Learning overview: events, metrics, stage, candidate, policy version, rollout
- Runtime overview: session activity, route stats, self model snapshot

This repo is **observer-only** and does not write back to SuperCharli core data.

## Augmentation Boundary
- This repository does not replace or replicate large-model intelligence.
- It visualizes local continuity/governance signals (memory and learning state).
- It must stay read-only against SuperCharli core runtime state.

中文说明：`README.zh-CN.md`

## Run
```bash
cd /Users/apple/Documents/code/supercharli-observer
npm start
```

Open: [http://localhost:4100](http://localhost:4100)

## Data Source
Default DB path:
- `~/supercharli-runtime/data/supercharli.db`

Optional env vars:
- `PORT` (default `4100`)
- `SUPERCHARLI_DB_PATH`
- `SUPERCHARLI_LEARNING_SCOPE` (default `daemon-main`)
- `SUPERCHARLI_SELF_SCOPE` (default `daemon-main`)

## API (read-only)
- `/api/observer/summary`
- `/api/observer/memory`
- `/api/observer/learning`
- `/api/observer/runtime`
- `/api/observer/sessions`
