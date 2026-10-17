# BINRAT public source freshness — bounded live diagnosis (2026-10-17)

**Decision:** `SOURCE_STALE_CONFIRMED; PRODUCTION_RECOVERY_NOT_AUTHORIZED`.

**Status:** exact-version observation, **not** an implementation approval, production mutation, deploy receipt, evidence that Cloudflare billing caused the failure, or acceptance of present-day onchain coverage.

## Source and execution authority

- Owner requested read-only diagnosis following the fail-closed live Bitquery overlap benchmark (Bitquery calls in this phase: **0**).
- Source code consulted: `src/cloudflare/publicSnapshot.ts`, `src/cloudflare/worker.ts`, and `src/cloudflare/syncQueue.ts` at the experiment base/observed release as relevant.
- Current captured backend public identity: `releaseSha=30564864f5d406414f0c09c4d2ba2be5d1e79ab8`, confirmed as a GitHub commit authored on 2026-10-09. Worker revision ID `28ebc65b-bb14-4862-b677-cbe74b6aad2b`. The public release identifier is **not** independent proof of deployed binary identity.
- Probe source: `scripts/binrat-public-status-diagnose.mjs`; test `test/binratPublicStatusDiagnose.test.mjs`. Nine offline tests passed.
- **Read-only production observation:** [GitHub Actions #39038665544](https://github.com/CipherCuttle/binrat/actions/runs/39038665544). Authorized one-shot grant commit `258b0402903e34e19737a341295993fa6376cc08`. Three public GET requests, zero RPC requests, zero Bitquery requests, zero production mutations.
- Probe timestamp: `2026-10-17T13:57:11.628Z`. No authorization to rerun the one-shot diagnostic or reactivate Cloudflare workloads.

## Exact observed failing contract

| Field | Observed value | Predicate |
| --- | --- | --- |
| `/api/status` HTTP | 200 | HTTP reachability **PASS** |
| chain/schema | `4663`, `binrat.public-status/0.1` | **PASS** |
| `state` | `STALE_VERIFIED` | **FAIL**, expected `FRESH_VERIFIED` |
| `verifiedAtMs` | `1791715716704` = 2026-10-11T10:48:36.704Z | **FAIL**, 529715 sec old |
| `freshnessValidUntilMs` | `1791715896704` = 2026-10-11T10:51:36.704Z | **FAIL**, expired ~529535 sec |
| `runtimeUpdatedAtMs` | `1791715716704` | No runtime advancement in 6.13 days |
| `lastSyncError` | null | No *recorded* current sync error; does not prove successful scheduling |
| `publicationVersion` | 3362 | Historical, not ongoing verification |
| `checkpointBlock` | 85774952 | Historical snapshot, not current head |
| `feedDigest` | `cbac2c2ed8e0068ff89295236417d06799eb6913ae95d08eb31ead2e3e8b3db1` | Format PASS |
| `/api/health` | `indexReady=false`, `liveCaughtUp=false`, `runtimeFresh=false`, `ok=false` | **FAIL** |
| `/health` | `service=binrat-cloudflare-edge`, `releaseSha=30564864f5d406414f0c09c4d2ba2be5d1e79ab8`, `effectiveMaxStatusAgeMs=180000` | Identity reported, 3-minute bound |

The exact three failed `validateStatus` keys were `state`, `beforeExpiry`, and `ageWithin180s`. The corresponding benchmark correctly stopped after one BINRAT status GET with **zero Bitquery calls** ([run #39037759116](https://github.com/CipherCuttle/binrat/actions/runs/39037759116)).

## Source-path inference — not a diagnosed infrastructure failure mode

The observed Worker source wires scheduled Pons ingestion through `enqueuePonsSyncCycle` onto `SYNC_QUEUE`; queue consumers handle `PONS_SYNC_CYCLE`. On an admitted near-head sync, they update the Pons runtime state and publish a canonical source-bound public snapshot. The absence of both runtime and publication movement **fits** a stopped/paused/unreachable producer, queue, consumer or backend, but the public API cannot prove *which* stage stopped. In particular, a null `lastSyncError` can mean no new sync attempt reached runtime failure recording.

Render access shows multiple historical BINRAT preview/static services. Nothing in that listing identifies a replacement authoritative production collector for `binrat.tech`. Do not redeploy a preview or assume a completed hosting migration.

An earlier emergency Cloudflare pause proposal in draft PR #181 was explicitly marked **NOT RUN** there; present-day Cloudflare Cron/queue settings have **not** been inspected in this diagnosis. Do not infer a pause, paid account loss, DNS cutover or release downgrade from historical correspondence.

## Next information-gaining action: provider control-plane inspection, read-only

With the actual deployed Cloudflare account/worker identity confirmed by the owner, inspect:
1. The live route mapping for `binrat.tech`, current Worker deployment/version and bindings; cross-check reported release SHA and worker revision ID.
2. Worker Cron triggers and last execution/error time **after** 2026-10-11 10:48 UTC.
3. Queue producer/consumer association, delivery-paused flag, failed/delayed/expired message counts and recent delivery logs. Historic candidates `binrat-edge-v0` / `binrat-sync-v0` are **not** accepted without current provider confirmation.
4. D1 durable checkpoint/current status and the actual current Cloudflare plan/cost exposure; plan safe backup/restart sequence only after clear source provenance.

Then decide **PAUSED_BY_POLICY / DISABLED_SERVICE / MISBOUND_DEPLOYMENT / NO_QUEUE_DELIVERY / RPC_FAILED / UNKNOWN** based on provider receipts. Don't infer this classification from GitHub code or a previously fresh UI.

## Safety / stopping rule

**STOP before** enabling Cron/Queues, unpausing delivery, upgrading a billing plan, replaying historical sync, changing DNS, deploying Workers, modifying D1, spending Alchemy/Bitquery credits, merging PRs or launching tokens. Those require a new narrowly scoped owner grant and verified cost/data preservation gates.

**Verdict:** Freshness monitor is correct; **no code adjustment to the 180-second bound is justified**. The next repair is operational only after current control-plane evidence establishes the specific outage mechanism.
