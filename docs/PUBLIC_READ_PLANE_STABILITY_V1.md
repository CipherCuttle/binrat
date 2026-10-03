# BINRAT public read plane stability V1

## Authority and base

The supplied inspected frontdoor SHA, `64ec4702ca71330f41f2a8f8a8f575eeff44958f12`, was not available from local Git refs, `git fetch origin <sha>`, or GitHub's commit API. The production Worker release SHA therefore remains unverified.

The selected working base is `origin/ops/binrat-case-version-url-preview-v1` at `bb970868fdf0e6bf991195f78b8c7adcafe8c063`, whose Worker contains the live `/api/health`, `/api/launches/latest`, and full-projection creator routes described here. Its backend parent is `origin/integration/binrat-case-canonical-v1` at `9e8b37ec0a643aadf8aaf789e9ab6c4ae4b85cb3`. A read-only check of `https://binrat.tech` on 2026-10-04 returned `/api/health` 200 with Pons chain 4663 and historical Arc diagnostics, and `/api/status` 503 `PUBLIC_PROJECTION_UNAVAILABLE`. Response headers did not identify a release SHA. This identifies the relevant live surface, not its exact source revision.

## Before

Counts below are derived from the selected base's code paths. They are statement counts, not production timing measurements.

| Path | Before | Evidence |
| --- | ---: | --- |
| `/api/health` | Up to 9 D1 statements | Initial Pons runtime read; checkpoint, backfill, runtime, and count for each health chain. |
| `/api/launches/latest` | 3 + 2 × returned rows; 43 at 20 | Two authority reads, one joined feed read, then launch and provenance reads for every row. |
| Homepage `/api/creator/:address` | Full projection, 7 reads on the healthy Pons path | `readyContext()` reads checkpoint, all launches, and all provenance facts before projecting the creator file, then rechecks checkpoint/runtime. |

Baseline query-plan checks on the selected base's SQL used `idx_launches_chain_block` or `idx_launches_creator_order` for the chain/creator prefix, then `USE TEMP B-TREE FOR ORDER BY` because block heights were cast to integers. The through-checkpoint count had an indexed chain prefix but evaluated the cast for each matching chain row.

## Architecture and failure behavior

```text
Pons RPC → sync + canonical/provenance verification → complete bounded feed
         → atomic binrat_public_snapshots upsert → public readers
```

The writer publishes only after a successful caught-up Pons sync where the durable checkpoint equals the verified runtime target. Publication is one D1 upsert. The prior row remains readable if sync, validation, or the upsert fails. A Pons failure continues to mark runtime state unhealthy through the existing failure path; it does not touch the snapshot row. The public snapshot is a read model and does not replace canonical launch or provenance evidence.

`GET /api/status` is the cheap user-facing publication state. It reads the Pons publication row and Pons runtime row (2 statements) and returns `FRESH_VERIFIED`, `STALE_VERIFIED`, or `NO_VERIFIED_SNAPSHOT`. Freshness requires a fresh verified runtime targeting the published checkpoint with no sync error. A stored snapshot is still served after an RPC/indexer failure, and status labels it stale.

`GET /api/health` remains deep operational health, including launch counts, backfill diagnostics, and historical Arc. Browser availability should use `/api/status`. The browser caller changes belong to the browser owner; this backend adds the endpoint and bounded creator summary without changing the legacy creator-file contract.

`GET /api/launches/latest` serves the exact persisted feed and validates the stored canonical digest before returning it. The deterministic digest is SHA-256 over the canonical feed fields excluding the `feedDigest` field itself. The snapshot is Pons V2 chain 4663 only. One malformed or mismatched provenance fact blocks a new publication.

`GET /api/creator/:address/summary` reads at most four latest verified Pons launch rows and their canonical provenance facts. It returns the checkpoint, feed digest, bounded coverage boundary, and evidence fact IDs/digests. It uses 2 D1 statements and leaves `/api/creator/:address` compatible with its current complete creator-file contract.

## SQL query plans

`EXPLAIN QUERY PLAN` was run against the selected-base `cloudflare/schema.sql` and the updated schema using SQLite. Plans after the change:

| Hot query | Before | After |
| --- | --- | --- |
| Latest 20 Pons launches | `SEARCH l USING INDEX idx_launches_chain_block (chain_id=?)`; provenance primary-key search; temp B-tree for order | `SEARCH l USING INDEX idx_launches_chain_source_block_numeric (chain_id=? AND source=? AND <expr><?)`; provenance unique launch index; no temp B-tree |
| Creator summary | `SEARCH l USING INDEX idx_launches_creator_order (chain_id=? AND creator=?)`; provenance unique launch index; temp B-tree for order | `SEARCH l USING INDEX idx_launches_chain_source_creator_block_numeric (chain_id=? AND source=? AND creator=? AND <expr><?)`; provenance unique launch index; no temp B-tree |
| Deep-health count through checkpoint | Chain-prefix search over raw text index; cast filter applied per matching chain row | `SEARCH launches USING INDEX idx_launches_chain_block_numeric (chain_id=? AND <expr><?)` |

Expression indexes match the existing integer casts. Stored heights remain TEXT; no broad numeric-column migration was needed. The correlated prior-launch count uses the creator expression index and the one-to-one provenance launch index. The `COUNT(*)` is equivalent to the previous `COUNT(DISTINCT launch_id)` because `launch_id` is unique and provenance has a unique launch ID constraint.

## Query and payload budgets

| Path | Before | After |
| --- | ---: | ---: |
| `/api/status` | No endpoint | 2 D1 statements; no scans/counts/RPC |
| `/api/launches/latest` | 43 at 20 | 1 D1 statement to read the publication; independent of feed size |
| Latest snapshot build at sync | 43 at 20 | 2 D1 statements (one checkpoint/runtime anchor and one joined feed query) |
| Bounded creator summary | Full historical projection | 2 D1 statements, at most 4 output rows |

The local SQLite-backed 20-row Worker test measured a 10,288-byte feed response over 30 sequential reads: p50 0.444 ms, p95 0.673 ms, and 1 D1 statement per request. These are local compatibility-database measurements, not production Cloudflare latency claims. The feed query returned 20 joined rows; creator summary returns at most 4. Test instrumentation asserts the 1-vs-20 query count and captures `EXPLAIN QUERY PLAN` for the feed and creator SQL.

## Cache policy

`/api/status`: public, browser/shared max-age 5 seconds, `ETag`, conditional 304, `must-revalidate`.

`/api/launches/latest` and `/api/creator/:address/summary`: public checkpoint/digest-bound JSON, short browser/shared TTL, `ETag`, conditional 304, `stale-while-revalidate`, and `stale-if-error`.

The generic JSON helper still defaults to `Cache-Control: no-store`. Holder auth, Telegram principal/session state, private holder views, mutating POSTs, and all unclassified routes retain `no-store`.

## Migration

Apply these idempotent D1 migrations before deploying code that uses the public reader:

1. `cloudflare/migrations/0001_public_read_snapshot.sql`
2. `cloudflare/migrations/0002_launch_numeric_read_indexes.sql`

`cloudflare/schema.sql` and `D1_SCHEMA_SQL` include the same table and indexes for new databases. No migration was applied to production.

## Verification and limits

Tests cover no snapshot, fresh-to-stale transitions, successful replacement, failed publication retention, sync failure retention, deterministic digest behavior, one-vs-twenty feed statement count, four-row creator summary, canonical mismatch, checkpoint/canonical mismatch, chain binding, cache headers/304, corrupted digest rejection, deep-health isolation, and private no-store behavior. Requested full `pnpm check` and final `git diff --check` are recorded in the task report.

One hundred simultaneous readers were assessed by query shape rather than load-tested: each latest-feed request performs one bounded snapshot read and no per-launch D1 loop. The existing full creator-file route remains expensive until its browser consumer switches to the new summary contract.
