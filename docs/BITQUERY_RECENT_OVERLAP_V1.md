# BINRAT × Bitquery — same-recent-Pons evidence comparison V1

**Status:** ONE-SHOT LIVE CANDIDATE; do not label verified until the exact workflow receipt is inspected.

## Purpose

The prior free-tier Bitquery run returned a recent Pons factory event, but the matched target BINRAT Case was an older capture and the historical query returned no Events. That comparison was **NOT_COMPARABLE**, not a product win or loss.

This attempt is **one new explicitly user-authorized bounded experiment**. It uses only BINRAT's public read-plane and Bitquery's existing free realtime tier. No token launch, trades, contract calls, archive data add-on, deployments, customer billing, OpenRouter proxy or fees.

## Admission and exact budget

1. `GET https://binrat.tech/api/status`; require Robinhood 4663, `FRESH_VERIFIED`, 180s age bound, intact source checkpoint, non-expired freshness, no sync error.
2. `GET https://binrat.tech/api/launches/latest`; require schema `binrat.latest-launches/0.1`, same feed digest, checkpoint block/hash and chain; at most 20 launches.
3. Only then: Bitquery free realtime `EVM.Events` latest ten factory `TokenLaunched` events (one GraphQL POST), with exact Pons V2 factory/topic.
4. Select *the same event* by exact tx hash, block, token and deployer between providers. If none, report `NOT_COMPARABLE: NO_IDENTICAL_RECENT_PONS_EVENT`.
5. `GET https://binrat.tech/api/bag/{id}/evidence`; require a complete, independently verified Case envelope using BINRAT's canonical `verifyCaseEnvelope`; source publication must match the initial snapshot.
6. `GET https://binrat.tech/api/status` again; reject if publication moved.
7. Only if all gates pass: a second bounded Bitquery realtime GraphQL query for the same exact Pons-reported deployer. Compare independently verified overlaps and direct event fields, not unknown or absent history.

**Hard caps:** 4 BINRAT GETs; 2 Bitquery POSTs; 10 seconds/request; 64 KiB maximum per response; no retry, cache archive, alternate origins, raw secret logging or raw response artifacts. Unknown current source, old status, nonmatching Case or failed schema => `NOT_RUN`, no fabricated benchmark.

**Fairness boundaries:** The same launch can be compared for identity, transaction, block and reported deployer. A 20-receipt partial BINRAT Case cannot be treated as full history. Bitquery's realtime data can omit older events; lack of records does not imply no history. This is a **factual evidence availability** probe, not a blind LLM usefulness test, complete crypto investigative benchmark, or price comparison. Credit cost is **UNKNOWN** unless provider receipts state otherwise.

## Trigger and stop

`.github/workflows/binrat-bitquery-recent-ab-once.yml` runs **only** when an exact new file `bench/bitquery-recent-overlap-grant-20261017.txt` is created as the sole addition in an exact new commit with message `test(benchmark): owner one-shot recent Pons overlap` and content `BINRAT_RECENT_PONS_AB_ONE_SHOT`. The workflow checks run attempt one and reads the existing GitHub Actions secret `BITQUERY_AB_FREE_TOKEN` in the isolated query step.

**Stopping rule:** After one terminal receipt, stop. Any further request or changed test target needs separate explicit authorization. Do not merge PR #209, deploy, or spend money.

## Terminal execution receipt — 2026-10-17

- User authorized exactly one live overlapping-recent-Pons A/B attempt, triggered by marker commit `19246051515e94282e15d6ffcb38cc8776db37d9`.
- [GitHub Actions run #39037759116](https://github.com/CipherCuttle/binrat/actions/runs/39037759116) reached the bounded live step. Preflight/mock suite **8/8 PASS**. The workflow run itself ended **failure** because fail-closed admission set exit 2, not because those tests failed.
- First bounded GET `https://binrat.tech/api/status` returned **HTTP 200**, 433 response bytes, ~3,856 ms; SHA-256 `dfaeb7eb09cdaf08fae839ccda3d2ff5a3afe8f86f5d1edae33d1f5d7f2924e7`.
- Parsed status did **not** pass `validateStatus`: terminal code `BINRAT_STATUS_NOT_CURRENT_VERIFIED`. That gate combines chain/schema, published source state, verifiedAtMs age, freshness expiry and lastSyncError. **Which individual condition failed is unmeasured**; avoid ungrounded claims about the exact reason.
- External calls: **BINRAT 1**, **Bitquery 0**, no archive or paid endpoints, no repeated requests and no merge/deploy. No Bitquery model comparison performed.
- **Decision:** `A_B_BLOCKED_BY_BINRAT_SOURCE_ADMISSION`; outcome is NOT_RUN, not a Bitquery or BINRAT forensic-quality result.
- **Next smallest information-gaining action requires a separate owner grant:** readonly inspection of exact status fields and deployed identity, and repair only the proven source freshness/contract issue. Then re-evaluate whether same-source recent coverage exists. Do not consume additional Bitquery calls until that gate passes.

**STOP. The one-shot authorization is consumed.**
