# BINRAT R1 — preservation metadata inventory (OFFLINE-ONLY CANDIDATE)

**Status:** Prepared; NOT LIVE, NOT authorized to read Cloudflare, NOT verified backup, NOT recovery approval.
**As of:** 2026-10-17. **Authority:** `CipherCuttle/binrat` PR #209 at `b4ef76c3a09506c6b295b345e1bc8cf3f4eb4056`; isolated changeset branched from that exact head. Default `main` is older ArcPad. **Track:** PRODUCT_MVP / MAINTENANCE.

## Frozen user job

Identify whether the existing Pons 4663 collector's pause, queue backlog, and D1 preservation state can be investigated with bounded metadata **before** deciding to preserve/export/migrate data or restart collection. Current independently captured operational evidence remains `docs/BINRAT_PUBLIC_FRESHNESS_DIAG_20261017.md`, with run receipts #39038665544 and #39039308302. Public status was `STALE_VERIFIED`; Cloudflare Cron absent, queue paused. Do not redo that diagnosis.

## What is implemented / not implemented

- `scripts/binrat-recovery-readonly-inventory.mjs` exports `inspectRecovery`, a strict, injected-request async inspector. Import and synthetic fixtures can test it. **There is no production runner:** CLI allows only `--dry-run`. `--read-only`, environment tokens, or other commands refuse. No `fetch` call is made by the CLI.
- `test/binratRecoveryInventory.test.mjs` validates the allowlist, zero-network admission, hard request/response/time budgets, unknown-consumer semantics, pagination, sanitizer, tamper and fail-closed behavior with mocked `Response`s.
- `.github/workflows/binrat-r1-inventory-offline.yml` runs on isolated-branch changes or manual dispatch, **tests only**. No secrets/Cloudflare request. It has not been dispatched. A future credentialed one-shot runner needs a *different, separately approved changeset and owner grant*.
- No worker, D1, RPC, Queue, DNS, provider plan or production file is mutated; existing WIP and PR #209 remain untouched.

## Exact read-only Cloudflare path allowlist (maximum eight requests)

All paths use **only** `GET https://api.cloudflare.com/client/v4/accounts/{PINNED_ACCOUNT}` with `redirect:error`; no extra discovery, retries, pagination, alternate origins, redirects, export, D1 SQL/query, RPC or Worker execution.

1. `/workers/scripts/binrat-edge-v0/settings` — producer/D1 binding identity, sanitized booleans only
2. `/workers/scripts/binrat-edge-v0/schedules` — Cron count
3. `/queues?per_page=100` — queue UUID discovery via exact queue name
4. `/queues/{VERIFIED_ID}` — paused flag, message-retention policy, consumer identity if explicit
5. `/queues/{VERIFIED_ID}/metrics` — best-effort backlog count/bytes/oldest message timestamp
6. `/d1/database?per_page=100` — match Worker-bound D1 UUID; only identity boolean reported
7. `/d1/database/{VERIFIED_ID}/time_travel/bookmark` — bookmark available boolean; **never expose the bookmark**
8. `/subscriptions` — subscription count only; **cannot establish zero charges or account standing**

If D1 identity cannot be pinned, skip #7 (maximum seven requests). Queue/D1 list pages must include explicit consistent first-page pagination metadata (`page`, `count`, `total_count`); if absent, contradictory or incomplete, STOP rather than assume unique resource identity. If the queue cannot be uniquely pinned, stop. Auth failure, invalid responses, any unexpected path or over-budget result stops without fallback. Routes/DNS, D1 restore ability, off-platform backup, historical checkpoint and executable cost ceiling remain UNKNOWN.

**Budgets:** ≤8 GETs, one at a time, ≤5 seconds/request, ≤45 seconds overall, ≤64 KiB/request, ≤512 KiB total. No retry, fan-out, recursive discovery, storage of raw provider data or provider error bodies. Empty/malformed/missing data is never silently promoted to proof; `METADATA_ONLY` means the *metadata checks* ran, **not** that restore/restart is safe.

## Preservation contract and open gates

Before any data export or recovery, independently preserve and verify: complete D1 schema and data, all Pons 4663 launch/observation receipts and provenance edges, checkpoint block + block hash, canonical publication/version/feed digest, runtime state including sync error/target/caught-up flags, backfill cursor/lease state, and a successful off-platform restore test. A D1 Time Travel bookmark is not an export or off-platform backup. Do not trust snapshot version alone as current head. Do not replace 180-second `FRESH_VERIFIED` contract.

**Current blockers:** Cloudflare account downgrade/feature accessibility and possible D1 loss; no confirmed independent backup; exact consumer identity and live route/DNS authority not proven; Queue metrics not measured; RPC cost and restart backlog unknown; auto-enqueue on unfinished catch-up in `src/cloudflare/syncQueue.ts`; provider subscriptions metadata does not prove absence of charges. Alternative self-hosted collector is only local historical evidence, not independently accepted production authority.

## Future live one-shot admission (NOT IMPLEMENTED)

Requires explicit separate owner grant, `$0` *verified* incremental paid exposure (not just a notification threshold), reviewed endpoint/scope contract, real provider-token privileges limited to read-only metadata, a **single-use** and **expiring** grant durably consumed across runs, exact repo/branch/full commit SHA + script/workflow digest + pinned account/endpoint manifest, concurrency 1, no persistent raw response artifacts, and a kill-on-any-mismatch workflow. Neither this document nor an old Actions marker constitutes such a grant. If a metadata GET has uncertain cost, report `BLOCKED_COST` and do not run.

A later separately scoped D1 export would require an approved destination/retention/security policy and restore evidence. A later collector restart would require aggregate (not merely per-cycle) RPC/queue/D1 caps, finite backlog strategy, source/Worker identity, rollback and live publication/digest/freshness acceptance. Queue stays paused and Cron absent pending new authorization.

## Verification / stopping

Local offline check (no repository deps, credentials or provider calls):

```sh
node --check scripts/binrat-recovery-readonly-inventory.mjs
node --check test/binratRecoveryInventory.test.mjs
node scripts/binrat-recovery-readonly-inventory.mjs --dry-run
node --test test/binratRecoveryInventory.test.mjs
```

Stop after one bounded hostile review, targeted Critical/High fix only, and one re-review only if required. Do not run this against Cloudflare until a separate grant and guarded live runner exist. Rollback: discard/revert this isolated branch; no production rollback is required because no production work is authorized.
