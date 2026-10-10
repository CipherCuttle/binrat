# BINRAT A2.2 — disabled safe outcome collector

## PLAN and authority

Implementation parent: A2 PR #176, exact `7720773dc5a5c18168c54f0d8be8e9d10905a4f5`.
Production authority remains Worker 106 / `30564864f5d406414f0c09c4d2ba2be5d1e79ab8`.
Read before implementation: [A2.1 at f20e3a3](https://github.com/CipherCuttle/binrat/blob/f20e3a3/docs/BINRAT_A2_1_OUTCOME_COVERAGE.md).
This is a stacked draft against A2, not an implicit merge of #176. No production readback was repeated, so those identities remain **last verified**, not a new runtime claim.

Scope: finite, explicitly selected **new** Pons launches; indexed due jobs; one receipt per cycle; existing indexing and A2 projection. No continuous population collector, historical admission, public POST capability, new infrastructure, production migration or activation.

## CHANGESET

- `ponsOutcomePilot.ts`: strict narrow enablement, finite durable authorization, indexed due-job selection, freshness check, atomic scheduling/consumption and RPC reservation. Launch/event identities and canonical columns/authority must agree. Launch block must exceed the pilot's pinned start watermark; validated header timestamp must be at/after pilot activation. Jobs cannot change receipt identities or target ages.
- `20261010_pons_outcome_pilot.sql`: additive, empty-by-default control/job tables, <=20 launch IDs, exactly the existing three allowed horizons, <=60 unique jobs, <=2 attempts/job, <=120 cycles, <=1,200 actual RPC attempts and <=48h authorization lifetime. Applied only to local in-memory SQLite tests.
- `syncQueue.ts`: Pons post-success scheduling may admit only this controlled outcome message while read-only remains true. All other legacy consumers stay suppressed. Dispatch requires the matching pilot ID and durable pending cycle. Outcome execution never self-enqueues. Both existing writer leases remain; each invocation has a unique lease owner so concurrent copies of one queue message cannot release each other's locks.
- `ponsOutcomeBudget.ts`: shared discovery/archive budget, 40 RPC attempts/cycle, 15 seconds of work, 3 seconds/request, zero transport retries, 64 source operations. Only `eth_chainId`, `eth_getCode`, `eth_getBlockByNumber`, `eth_call`; JSON-RPC batches are rejected. Authorization is checked before/after every transport call and source operation. Known transient failures get at most one later job attempt; integrity/authority/budget failures are terminal. Queue copies cannot consume a pending cycle twice.
- `ponsOutcomeStore.ts`: remove the global incomplete-history CTE. Controlled execution retrieves exactly one approved launch/horizon. Legacy/offline candidate calls return at most 100 indexed recent launches without a join/group operation. Receipt lookups read at most three rows and validate stored columns against verified payloads. Receipt INSERT itself checks active pilot and both lease owners/expiries.
- `outcomeReceipts.ts`: preserve the first block at/after target, predecessor and boundary rechecks; reuse the already verified checkpoint header only for binary-search initialization. Recheck the checkpoint after outcome/boundary reads. Preserve 5m/1h/24h identities, proof digests and PARTIAL graduation without pool state.
- Tests and exact-head offline workflow: synthetic collector → D1 → A2 envelope → compiled WHY / TRAIL / RECEIPTS at 390/430/1024/1440. Existing captured A2 specimen tests also run; retained receipts are historical evidence, not newly collected live intelligence.

## Authorization contract and stop behavior

All four must match literally:

```text
BINRAT_PONS_READ_ONLY=true
BINRAT_PONS_OUTCOME_ENABLED=true
BINRAT_PONS_OUTCOME_COLLECT_AUTHORIZED=true
BINRAT_PONS_OUTCOME_PILOT_ID=<exact durable pilot ID>
```

`BINRAT_PONS_OUTCOME_MAX_PER_CYCLE` must be absent or exactly `1`. Missing, malformed, conflicting, expired or disabled controls fail closed. The new variables are absent from production configuration and from the example config. Disabled code performs no new collector database/RPC work.

Durable pilot row and jobs are operator-prepared admission, **not** an automatic scanner. After explicit separate authorization, freeze the current published checkpoint as `start_block`, wait for a new indexed launch above it, and bind its launch ID to verified launch-header time. Prepare only the authorized horizon jobs. There is no production seeding command or remote migration in this changeset.

The successful caught-up Pons sync is the scheduling opportunity. An atomic cooldown admits <=1 outcome message/60 seconds. A pending queue message expires after 60 seconds; later opportunities may replace it, never catch up missed minutes. Execution consumes the pending cycle before any RPC. A duplicate, delayed, mismatched or manually invented cycle cannot run. A failed queue send can lose that opportunity; it cannot multiply work.

40 calls are reserved durably before execution, shared across both clients. Only attempts actually not sent are refunded on normal unwind, after aborting the cycle. A crash keeps its entire reservation charged; no refund/replay recovery can overspend. Cycle count is never refunded. At <40 remaining, further cycles stop. A job whose attempt is lost to a crash can use only its remaining attempt; exhaustion becomes FAILED. Revocation permits cleanup/accounting writes but no new collection or receipt INSERT. Requests already sent before revocation may be charged by the provider; next checks stop further requests. An environment flag change requires a new Worker version to affect old isolates, so the **durable enabled=0 row is the emergency stop**.

## VERIFY and provenance

Local commands:

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm --dir web-v2 check
pnpm verify:pons-launch-authority
pnpm exec tsx --test test/ponsOutcomePilot.test.ts test/ponsOutcomeReceipts.test.ts test/ponsOutcomeCapability.test.ts test/ponsReadOnlyRelease.test.ts test/cloudflareSyncQueue.test.ts test/caseOutcomes.test.ts
pnpm --dir web-v2 build:production
pnpm exec tsx web-v2/checks/serve-a2-2-preview.mjs
BINRAT_FRONTDOOR_TOOLS=<pinned Playwright 1.56.1 modules> node web-v2/checks/a2-2-collector-browser.cjs
```

The frozen launch-authority checker deliberately reports launch authorization blocked; this is an unrelated token-launch gate, not an outcome-collector failure. No signing/broadcast occurs.

Query receipts: [query-plans.json](receipts/sprint-a2-2/query-plans.json). SQLite plans require indexed SEARCH and reject SCAN/TEMP B-TREE. Removing the required due index fails the selector rather than silently scanning. Selection reads <=1 due row, <=1 exact launch and <=3 receipt rows; no global launch COUNT/JOIN is used. Admission's cohort-cap trigger counts at most the 60 rows for one pilot, not launch history. Every test and browser artifact states synthetic or captured provenance. Offline SQLite is not provider D1 billing metering.

Adverse cases include disabled/malformed/conflicting enablement, wrong/missing durable row or message pilot, all other queue kinds/flags, three revocation boundaries, stale runtime/target/queue, launch watermark/time corruption, malformed headers, wrong numbers/hash/reorg, source timeout, duplicate delivery, two-attempt exhaustion, writer contention/concurrent copies, partial missing pool state, historical launches without jobs, recent eligible jobs, index removal and fixed RPC/time/method budgets. Existing Pons indexing publication and bounded catch-up tests stay green.

## Cost and throughput

A2.1 captured **20 actual launches across 18m25s**: 1.086 launches/minute. Extrapolating that particular short burst gives 1,564 launches/day and 4,691 receipts/day at three horizons. This is a demand scenario using an observed sample, **not** a measured population daily rate. Captured checkpoint/boundary blocks imply about 9.76 blocks/second over that day. The offline 10-block/second, worst CURVE/quote-decimals simulation needs **31 / 35 / 40 RPC calls** for 5m/1h/24h. These are simulated method counts, not measured live service latency or CU use. All three preserve target-age proofs within the fixed cap. A substantially delayed checkpoint can exhaust the cap and fail; it does not expand its budget.

Capacity is <=1 receipt/minute, <=1,440/day and <=480 three-horizon launches/day before failures/contention. Thus population-wide admission at the captured burst would permanently lag and is **unsupported**. The explicit cohort bound avoids that: <=20 launches create <=60 receipts and need 60 successful one-minute opportunities, usually spread across three maturity times. With at most two attempts/job it needs <=120 opportunities (<2 hours of active service), within the 48-hour control lifetime if Pons indexing and archive service remain healthy. No accepted infinite stream can accumulate; failure/expiry/budget exhaustion stays visible as absent evidence. The 1,200-call pilot ceiling may finish fewer than 60 receipts: the simulated 20×(31+35+40)=2,120 calls would exceed it. Therefore the measured worst-branch pilot size is **at most 11 launches without retry**, not 20. The schema's 20 is a ceiling, not a promise. Initial production canary is only one 5m job; expansion must use measured costs and headroom, never automatically raise the 1,200 cap.

Projected collector D1 work, excluding the existing Pons indexer/A2 page requests:

| Work | Rows read reserve | Rows written projection | RPC attempts |
|---|---:|---:|---:|
| One attempted cycle / <=1 receipt | <=500 | <=30 including index maintenance | <=40 |
| One 30-minute, single-cycle 5m canary including bounded idle checks/preflight | <=1,000 total | <=30 total for seed/execution/disable; confirm provider metering | <=40 (inside A2.1's 120 ceiling) |
| 11-launch, no-retry cohort / 33 receipts | <=16,500 + idle polls | <=990 + explicit seed/control overhead | simulated 1,166; hard <=1,200 |
| Schema maximum finite pilot / <=120 attempts | <=60,000 + idle polls | <=3,600 + <=182 seed/index rows | hard <=1,200; may be incomplete |
| Hypothetical full burst demand / 4,691 receipts/day | ~2,345,500 + polls | ~140,730 | <=187,640 first-attempt calls/day; unsupported |

These are conservative engineering projections, **not D1 measured rows**. Primary/secondary indexes and exact SQL establish bounded query work, but billing counts physical rows and index writes, not returned rows. Successful/idle scheduling checks have at most six single-row lookups; reserve 12 rows/opportunity to cover provider accounting differences (<=17,280/day while explicitly enabled; <=34,560 over the full 48h). Seed-trigger work is <=60 rows per insertion and must be included in a larger pilot's measured D1 envelope. Disabled state should be used between separately controlled horizon windows if low pilot row budgets are required. Do not claim the 1,000-row first-canary budget covers an unattended 24h wait.

Published [Alchemy method costs](https://www.alchemy.com/docs/reference/compute-unit-costs) are 0 CU for chain ID, 20 for headers/code and 26 for eth_call. [Published PAYG compute price](https://www.alchemy.com/pricing) is $0.525/million CU. Assuming that applies to the existing Robinhood archive account, even conservatively charging every allowed request at 26 CU projects <=1,040 CU / **$0.000546 per attempted receipt**, <=3,120 CU / $0.001638 for 120 requests, and <=31,200 CU / **$0.01638 for the whole 1,200-call pilot**. This is a conditional public-price projection; verify account/chain/method applicability before authorization. Existing ongoing indexing, subscriptions and capacity fees are separate. No account setting is treated as a hard cutoff. Last authenticated baseline remains A2.1's **$0.79 used / $9.21 remaining**; not refreshed or attributed to this offline work.

[Cloudflare D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/) charges reads/writes separately from Alchemy. Paid overage rates are $0.001/million reads and $1/million writes after included allowances; do not claim the account's actual marginal charge without its tier/current usage. No production D1, paid RPC or billing-account calls were made in A2.2.

## ONE hostile review → ONE targeted rereview

One hostile **self-review**, not an independent external audit. High findings: accounting exceptions could retain writer leases; verified stored payloads were not fully bound to receipt columns. Fixed with nested cleanup and column/payload validation plus focused regression tests. Additional checks strengthened method isolation, canonical authority, same-delivery concurrency and target-time binding. Realistic throughput verification found the redundant checkpoint lookup exhausting the 24h budget; removed only that duplicate lookup, retaining all later rechecks.

One targeted self-rereview completed: cleanup releases both leases even on accounting failure; stored-column tampering is rejected; same-delivery concurrency retains the active writer locks; canonical source/time corruption fails closed; unknown/batched RPC methods never reach transport; 31/35/40-call horizon proofs retain their later rechecks. No Critical/High issue remains in the finite authorized path. Local full check: 642/642 tests passed, plus type compilation and web invariants. Targeted final suite and clean-source browser/CI evidence follow in the PR. No additional review loop or reviewer agents. Exact CI and browser receipts are recorded separately in the ignored `.artifacts/a2-2/verification.json` and the draft PR after the final commit; they are evidence collection, not another hostile review.

## Controlled production pilot — separately authorized, not executed

1. Require green exact-source CI and an explicit owner authorization covering the candidate Worker, additive migration, small durable seed and narrow flags. Reconfirm Worker/source/queue batch-size/concurrency-1 authority and healthy consecutive published Pons snapshots. Keep read-only true and all unrelated production flags unchanged. Verify existing archive credentials/service pricing by name/account without exposing them; refreshed authenticated billing and method/CU applicability are preconditions. Reserve <=$0.25 incremental Alchemy, <=120 requests, <=1,000 D1 rows read and <=30 written for the initial canary. If those cannot be costed or monitored, do not start.
2. Apply only the additive pilot migration under that future authorization. Retain receipts and existing migrations. Deploy the exact reviewed source under a separate release action; A2 remains draft and its serving release is a separate authority decision.
3. Create a unique disabled pilot with `start_block` equal to the newly frozen published checkpoint, valid-from now, expires in <=30 minutes, rpc_remaining=40, cycles_remaining=1. Freeze one genuinely **new** launch above that watermark, verify its canonical launch-header hash/time, and seed exactly its 5m job. Seed costs are included in the D1 envelope. Do not seed any old backlog or a second launch. Case IDs and timestamps must come from actual capture; do not use fixture IDs.
4. Arm the matching flag/ID and durable row only after all preflight budgets fit; the next successful caught-up Pons sync can send one outcome cycle. Observe the single attempt with provider request/CU and D1 `meta.rows_read/rows_written` receipts or scoped provider analytics. Reserve its whole maximum before sending. Stop on missing metering, unexpected query plan, stale publication, source/reorg failure, RPC/time exhaustion, cost envelope breach or launch-indexing degradation. Do not automatically retry, replenish cycles/RPC credits, renew the lifetime or add launches.
5. Disable the durable row immediately after that one outcome opportunity. Capture the genuine receipt, bind it to its canonical source, verify persistence/idempotency and compare the A2 candidate Case envelope/UI under captured-data provenance. A2 production presentation is a separate undeployed decision. Refresh delayed provider billing and distinguish background workload. Report failure/absence as UNKNOWN; PARTIAL means only the evidence actually present.
6. Only after measured 5m success may a new explicit authorization add 1h/24h windows to the same admitted launch, with totals still within the separately approved cumulative envelope and original watermark/identity. Disable between windows. Offline three-horizon success does not authorize recurring collection or a 20-launch pilot.

Rollback/emergency disable (instructions only): first set the exact durable pilot's `enabled=0` using an owner-authorized D1 operation; this takes effect at the next collector boundary and receipt INSERT guard, including old isolates. Set `BINRAT_PONS_OUTCOME_COLLECT_AUTHORIZED=false` and `BINRAT_PONS_OUTCOME_ENABLED=false` in a separately authorized Worker release while retaining `BINRAT_PONS_READ_ONLY=true`. Existing queued outcomes acknowledge without work; do not purge the shared queue or suppress Pons indexing. Preserve jobs/receipts for inspection; do not reset counters, delete evidence or roll back tables. If a Worker rollback is needed, use the separately verified production immutable version (last known 106); resource/data state does not roll back with code. Confirm advancing Pons publication and no additional collector requests/receipt inserts. No command in this report has been executed remotely.

**STOP before merge, migration, deployment or collection activation.**

## VERDICT scope

Code readiness applies to the finite disabled pilot and offline A2 integration. Population-wide admission remains unsupported at the observed burst rate. Production archive latency/availability, applicable account price, provider D1 metering and actual new receipt collection remain for the separately authorized tiny canary. This document grants no production authority.
