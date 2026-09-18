# BINRAT Cloudflare D1 V0

## Objective

Move durable BINRAT memory out of ephemeral Render SQLite without weakening evidence, replay, identity, checkpoint, backfill, observation, or reorg semantics.

## CF1 contract

`D1Store` implements the existing asynchronous BINRAT store contracts:

- `LaunchStore`
- `HistoricalBackfillStore`
- `ObservationStore`

The existing `SqliteStore` remains the local/reference implementation.

## Atomicity

Cloudflare D1 `batch()` is used for multi-statement state transitions.

Historical batches include explicit invariant guards. If a launch or provenance fact collides with a different canonical payload, a CHECK constraint aborts the D1 batch before the history cursor advances.

Reorg rewind is one D1 batch.

## Schema

D1 retains the existing logical tables:

- launches
- provenance_facts
- provenance_edges
- launch_observations
- launch_history_backfill_state
- chain_checkpoints

D1 additionally stores `launches.authority_json` as canonical identity material and uses a private `binrat_invariant_guard` CHECK table solely to abort conflicting atomic batches.

## Deployment boundary

This slice does **not** authorize Cloudflare production deployment.

Next gates:

1. D1 parity CI PASS.
2. Worker read API over D1.
3. Worker Telegram webhook over the same D1-backed read surface.
4. bounded index/backfill jobs.
5. restart/retry/reorg hostile review.
6. explicit owner deployment authorization.

No trading, signing, capital, launch, or marketing authority is added.


## CF2 read plane

`src/cloudflare/worker.ts` exposes the existing BINRAT read contracts from D1:

- `GET /api/health`
- `GET /api/capabilities`
- `GET /api/feed`
- `GET /api/creator/:address`
- `GET /api/bag/:id`
- `GET /api/bag/:id/intelligence`
- `GET /api/bag/:id/replay`

The Worker is independent of indexer process uptime.

Freshness authority is stored in `binrat_runtime_state`. Durable old evidence may remain queryable inside D1, but public projection routes return 503 if the indexer's verified runtime state is stale or has an active sync error.

`/api/health` itself remains fast and returns a structured degraded state rather than relying on a sleeping application server.

`cloudflare/wrangler.example.jsonc` is intentionally non-deployable until a real D1 database id is bound.
