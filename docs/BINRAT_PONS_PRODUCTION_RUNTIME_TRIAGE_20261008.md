# BINRAT — production Pons read-plane runtime triage (read-only)

Date: 2026-10-08
Status: **DIAGNOSIS IN PROGRESS; no production change authorized**
Source of deployed response receipts: `docs/receipts/pons-runtime-v1/source-discovery.json` at `f0799f214a9134562ab0ae0340a2119f1b7c468f`.
Companion: `docs/BINRAT_REAL_PONS_RUNTIME_PROOF_V1.md`.

## Answer in one sentence

The public production endpoint is reporting a source version **predating the bounded /api/status and published-snapshot read paths**, while an isolated candidate demonstrates that those read paths work, but its **Pons sync is stale with an unclassified error**. The immediate work is provider/DB/queue **read-only forensics**, not another frontend redesign or an unreviewed deploy.

## Confirmed from source and preserved October 8 requests

| Scope | Evidence | What it proves and does not prove |
|---|---|---|
| Production site / Worker | `/health` 200, reported source `53325fd0806765578ed6921428ad55f15a9728f1` at both origins | The *observed public release string* is old and consistent between domains; exact active Cloudflare version is not independently read back |
| Production /api/status | 15,001ms timeout on both origins in preserved diagnostic | Public status unavailable within tested deadline. It does **not** prove CPU exhaustion or a particular Cloudflare exception |
| Production /api/launches/latest | 15,001–15,002ms timeout on both origins | Latest endpoint is not usable at the tested boundary; no live-read green receipt |
| Source `53325fd…` | Worker has **no dedicated /api/status**; unexpected API paths can fall through to `readyContext`; latest uses `latestPonsLaunchSnapshot` | Expensive fallback and on-request computation are **plausible** latency mechanisms, not confirmed profiler findings |
| New source on proof branch | `src/cloudflare/worker.ts`: status calls `publicStatus`, latest calls `readPublicSnapshot`, unknown route fails before `readyContext` | Code already contains the bounded-read fix; additional generic indexing/projection refactors are not justified yet |
| Deployed candidate | `/api/status` 200 in 239ms, `/api/launches/latest` 200 in 290ms, validated feed/status binding; source `e34a94cf…` | Candidate read architecture and one **stale verified** Case work. Independent execution proofs, fresh streaming service, and current production release acceptance are NOT established |
| Candidate state | `STALE_VERIFIED`, `SYNC_UNKNOWN_ERROR`, history PARTIAL | Published old evidence can be read; queue/sync is not demonstrated healthy |
| Candidate provenance | `sourceBinding=UNVERIFIED`, `observedManifestDigest=null`, `deploymentBinding=REQUIRES_DEPLOYMENT_RECEIPT` | Do not promote candidate to fully verified deployed source or copy it into production directly |

**Receipt timestamp:** preserved GET sample began 2026-10-08T18:46:15Z. These facts do not assert a newer live check. This triage environment could not resolve the public domains; it cannot independently reproduce a new HTTP status.

## Separate the two failures

**P0 — production read route/deployed source:** on the reported old source, `/api/status` cannot be served by the bounded handler because that handler is absent. An otherwise healthy old Worker's `/health` 200 does not prove that the data API is healthy. The old latest handler runs D1 projection work on each GET, increasing risk of timeout under load/index growth. Read actual active Cloudflare Worker deployment and route binding before deciding this is exclusively a code-version problem.

**P0 — candidate upstream sync:** `SYNC_UNKNOWN_ERROR` is a generic fallback of `syncErrorCode`, NOT an explicit RPC/auth/rate-limit diagnosis. In `src/cloudflare/syncQueue.ts`, `reportSyncFailure` emits `event=SYNC_FAILURE` with safe `phase`, `errorName`, `httpStatus`, `causeCode`. Possible phases include SOURCE_CONSTRUCTION, SOURCE_BOOTSTRAP, LIVE_SYNC, and RUNTIME_D1. Collect this exact event first. The queue/schedule, RPC source and D1 require separate read-only checks.

## Smallest next experiment — provider-side READ ONLY

Use the owner's authenticated local Codex session or a separately approved **read-only** GitHub Actions diagnostic context. Never echo tokens, RPC URLs, secret values, authorization headers, raw exception messages or Telegram principals. Do not invoke deployment, migration, secret mutation, queue writes, cron trigger, candidate smoke POST, or token transaction tools.

1. **Active deployment and routing**: read active version(s) and percentage for `binrat-edge-v0`; resolve `binrat.tech` route/service binding; compare provider deployment version, reported source SHA, and generated build identity. Record version IDs and timestamps only.
2. **Read-only D1 inventory**: establish production D1 ID/config without printing secrets. Query the existence/version of `binrat_public_snapshots`, `binrat_runtime_state`, and numeric read indexes. Query *only* the Pons `chain_id=4663` runtime row and snapshot metadata (checkpoint, block hash, digest, verified_at_ms, updated_at_ms, publication_version, sourceVerified/liveCaughtUp, lastSyncError); no updates and no raw wallet/principal tables.
3. **Queue and cron inventory**: read cron config and Pons queue producer/consumer bindings, queue state and recent redacted `SYNC_FAILURE` events for source/phase/errorName/httpStatus/causeCode. Verify whether cron enqueues and consumers execute. `SYNC_UNKNOWN_ERROR` cannot justify changing RPC providers without this evidence.
4. **Controlled public GET sample**: one bounded pass per production origin, `/health`, `/api/status`, `/api/launches/latest`, max 15s each, no retry/load test. Capture HTTP code, elapsed time, CF-Ray, build/source response headers, route and sanitized status/error code; stop if resource exhaustion (1102) is observed.
5. **Compare against deployed candidate readback**, not only code or copied release strings; freshness requires two independent successful publications separated by the actual schedule/TTL, with checkpoint/digest consistency.

If any provider access is denied, output **BLOCKED_PROVIDER_READBACK** and the exact missing permission. Do not ask to deploy to gather logs.

### Example operator commands (review configuration before use)

These examples are *manual reads*, not a request to execute them automatically. Production Wrangler config is intentionally **not** committed in the repo; substitute an already existing authorized local path.

```bash
# Read-only public diagnostic already supplied by the repo:
node scripts/diagnose-public-runtime.mjs https://binrat.tech
node scripts/diagnose-public-runtime.mjs https://binrat-edge-v0.pettevik.workers.dev

# Provider metadata only: first confirm exact config name, account and script.
pnpm dlx wrangler@4.135.0 deployments list --config /PATH/TO/EXISTING_PRODUCTION_CONFIG.jsonc --json

# When a scoped D1 read token and exact database binding are available:
pnpm dlx wrangler@4.135.0 d1 execute DB --remote --json --config /PATH/TO/EXISTING_PRODUCTION_CONFIG.jsonc \
  --command "SELECT chain_id, source_verified, live_caught_up, head_block, target_block, last_sync_error, updated_at_ms FROM binrat_runtime_state WHERE chain_id=4663 LIMIT 1;"
```

If either the command syntax or scoped permission differs under the installed Wrangler version, stop and consult its help rather than broadening privileges. Keep raw telemetry local; share only sanitized receipts.

## Decision table after collection

| Evidence | Smallest next action |
|---|---|
| Active Worker is genuinely old; D1 snapshot/index migrations and Pons runtime are verified compatible | Prepare **separate, signed-off** production rollout of reviewed bounded-read Worker release; no unapproved deploy |
| Old Worker with missing D1 migration or no verified snapshot | Resolve exact schema/readiness dependencies first in a tested candidate, then review a production migration plan; do not fake a fresh label |
| Candidate/production queue not running | Repair the exact queue/cron binding only after reproducing root cause and approval |
| Sync failure is SOURCE_BOOTSTRAP / transport | Diagnose isolated RPC/authority evidence with existing bounded safe diagnostics; do not switch providers or turn off checks speculatively |
| Sync failure is LIVE_SYNC or RUNTIME_D1 | Reproduce with a bounded local/candidate test at exact checkpoint, then change the smallest implicated component |
| CPU/memory exhaustion confirmed by provider logs | Profile the implicated route at the actual active version; do not generalize from one HTTP timeout |
| Readback/access unavailable | STOP: `PRODUCTION_ROOT_CAUSE_UNVERIFIED` |

## Acceptance to resume V3 cutover

- Exact deployed source/build/active version route bound to `binrat.tech` and Worker.
- Required production D1 migrations, queue/cron wiring and canonical read-model semantics verified; no unreviewed schema mutation.
- Two separate fresh canonical feed/status observations across publication interval + TTL, with matching chain 4663/checkpoint/block hash/digest, plus honest stale/503 behavior.
- One real production Pons Case, actual mobile/desktop browser read, and separate owner visual/production authorization.
- No Arc 5042 fallback, false capability activation, token signing, production deploy or merge during triage.

**Now:** `SOURCE_VERSION_MISMATCH_EVIDENCED`, `PRODUCTION_TIMEOUT_MECHANISM_PLAUSIBLE_NOT_PROVED`, `CANDIDATE_SYNC_ROOT_CAUSE_UNKNOWN`, `PRODUCTION_ACCEPTANCE=BLOCKED`.
