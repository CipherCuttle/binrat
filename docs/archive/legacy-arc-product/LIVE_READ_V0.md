# BINRAT live read V0

One service serves `web/` and the public read API. The token remains **NOT LIVE**; no wallet or trading functionality is included. The frozen experiment is unchanged.

## Run

```sh
pnpm install --frozen-lockfile
pnpm build
ARC_RPC_URL=https://rpc.mainnet.arc.io \
BINRAT_DB_PATH=./data/binrat.sqlite \
BINRAT_LIVE_LOOKBACK_BLOCKS=50000 \
pnpm start
```

Default port: 4174; `PORT` overrides it. Development: `pnpm serve:live`.
If this checkout is nested inside an unrelated pnpm workspace, install with `pnpm install --ignore-workspace --frozen-lockfile` instead. No dependency versions were upgraded; the new lockfile records the previously pinned package.json dependencies.

Use a persistent SQLite path for deployments and one service instance per database. `ARC_RPC_URL` is required and is never returned by the API. Normal indexer settings (`BINRAT_CONFIRMATIONS`, `BINRAT_MAX_BATCH_BLOCKS`, `BINRAT_POLL_MS`) remain configurable. The service alone applies the new fresh-database lookback; the CLI and scientific experiment are unchanged.

## Pipeline and snapshot boundary

`ArcPadLaunchSource` → `runLaunchWatcher` / `syncLaunches` → `SqliteStore` → `projectPublicFeed` → HTTP → narrow browser adapter → Astra UI.

On a fresh DB, start at `max(ARCPAD_START_BLOCK, head - lookback)`. Existing checkpoints resume normally. The existing indexer's authority, confirmation, provenance, and reorg checks are reused unchanged.

For each API snapshot, capture a checkpoint, filter launches/facts at or below that block, and call the existing projection. Recheck the checkpoint after projection; if a concurrent commit or rewind changed it, return 503 instead of mixed evidence. No raw store rows or internal evidence objects cross the API.

- `GET /api/health`: operational readiness, committed launch count/block, and sanitized sync error code. No RPC URL or upstream error payload.
- `GET /api/feed`: exact `binrat.public-feed/0.1` output, or 503 with `ready:false`.
- `GET /api/bag/:id`: bag and receipt from the same projection snapshot; absent bag returns 404.
- Non-GET requests return 405. Static file resolution stays inside the real `web/` directory, including symlink checks; image/font MIME types are provided.

The service retries watcher failures after the configured poll interval and stops serving feed snapshots while a sync error is active. Fresh startup may expose already-committed partial catch-up checkpoints; they explicitly carry `UNVERIFIED` history. Readiness does not claim a complete historical backfill.

## Browser behavior

Normal mode fetches same-origin `/api/feed` without caching. It validates schema, chain, receipt checkpoint, coverage, and required bag/trail/evidence fields. No silent fixture fallback. A 15-second foreground refresh checks operational health and refreshes the feed; an open drawer retains its original snapshot unless health fails, in which case it is cleared and closed.

- `?fixtures=1` explicitly imports developer fixtures and stamps them FIXTURE.
- Zero live bags: `NO BAGS IN CURRENT INDEX WINDOW`; random-bag action disabled.
- Failure: `DUMPSTER DATA UNAVAILABLE / LIVE INDEX NOT AVAILABLE`; no bags or false live status.
- Live age labels use block numbers because the projection has no chain timestamps.
- `24H MATURE`, `TOP 5`, and trail outcomes are `NOT PROJECTED`.
- History coverage remains `UNVERIFIED`; rat notes use only the projected prior count.
- Receipts identify the projection snapshot, separately from the launch block and transaction.
- Live share cards/posts say `LIVE // PUBLIC PROJECTION` and never carry fixture analytics.

## Real local smoke — 2026-09-18 Europe/Stockholm

Official RPC: `https://rpc.mainnet.arc.io`, chain 5042.
DB: `/tmp/binrat-live-smoke.sqlite`; lookback 50,000; initial start block 21,346,768.

Final recorded API checkpoint: **21,397,721**; **1 launch**; index ready; no sync error.

Observed bag:

- name / symbol: `6Z`
- launch block: `21368989`
- token: `0xf123c4c46df22adb7cf477686b63c668d30e1d5a`
- ArcPad-reported creator address: `0xcc3d9cdfcb587c9c4bdb84ef8272ae7f99046f85`
- transaction: `0x24aec6e9ac52cc9f89fa29ae486e60c570740529975725d8be993feff59842e0`
- prior indexed launches: 0; history coverage: `UNVERIFIED`

Validation was bounded: one successful TypeScript build and one `pnpm web:check`; the first build attempt could not start before dependencies were installed outside the ancestor workspace. No backend test suite or CI simulation.

Real `/api/health`, `/api/feed`, and `/api/bag/:id` verified. Desktop 1440×1000 and mobile 375×812: search and history filter, drawer, receipt, live share text, no fixture wording, no fake metrics, and no horizontal overflow. Explicit fixture mode rendered three fixture bags with fixture share stamps. A forced browser-side 503 verified fail-closed UI behavior. An earlier genuine empty checkpoint (21,365,767) was replayed locally to verify the zero-bag state; it was not fabricated data. Missing bag returned 404 and POST returned 405.

Screenshots are local smoke artifacts in `/tmp/binrat-live-{desktop,mobile,drawer,receipt}.png`. Public API captures: `/tmp/binrat-live-feed.json` (initial empty checkpoint) and `/tmp/binrat-live-final-feed.json`.

## Intentionally limited

No complete-history claim, outcome/concentration/sellability analytics, pagination, public rate limiting, authentication, premium tools, token logic, or deployment in this commit. Public snapshots currently project the full indexed launch set on demand. This is a single-instance vertical slice, not a horizontally scaled service. Sync diagnostics expose safe error codes rather than provider messages.

Next: deploy this exact head to Render and verify public end-to-end, with the required RPC environment variable and a persistent SQLite disk.
