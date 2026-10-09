# BINRAT — Alchemy paid RPC → isolated candidate recovery

Date: 2026-10-09
Authority: owner said "let's do it" after an isolated candidate recovery proposal. **No production change or token operation is authorized.**
Base branch: `fix/pons-rpc-limit-diagnostics-v1` at `0256a71714a04774f86d98417ad4c1d5088672ae`.
Status: **RECOVERY PROCEDURE PREPARED; CANDIDATE DEPLOYMENT NOT EXECUTED IN THIS SESSION.**

## What is verified

- Connected Alchemy app `rifjsz2xsrgmzpcc`, Robinhood mainnet chain ID **4663**, Pons factory `0x7ed598bcef8bd9edd8c97a195c6d13f40801ec7e`.
- Owner set a **$10 account-wide usage limit**, independently read back as USD 10 limit / USD 0.00 used (2026-10-09T00:08Z); **not** a per-app limit or a guarantee of hard-stop semantics.
- Read-only `eth_getLogs` through Alchemy: 1-block, 1,024-block, and topic-filtered 4,096-block windows PASS, including exact known launch at block **83540796**, tx `0x42e8d2c04a5810a3400c54a21e48f3e46504a75860fdeb33b708b54ee99fb93b`. The 4,096-block unfiltered provider response was truncated by the ChatGPT connector, **not shown to be rejected by Alchemy**. These tests do not establish continuous indexing, CU cost, or full 4,096-event response handling.
- Both existing Pons checkpoints were stationary during prior provider readback: production **83573396**, candidate **83573282**.
- The principal Pons scanner constructs `PonsLaunchSource({ rpcUrl: resolveRobinhoodRpcUrl(env) })` in `src/cloudflare/syncQueue.ts`. It consumes `ROBINHOOD_RPC_URL`, **not** `BINRAT_ROBINHOOD_ARCHIVE_RPC_URL`. The latter serves outcome/identity/funding observers separately.
- `.github/workflows/public-read-plane-stability-candidate.yml` is historically **pinned to an older source SHA** and only sets the archive secret. **Do not re-run it unchanged as the RPC recovery.**
- The connected ChatGPT tools do not expose a Cloudflare Workers management/deploy API or GitHub Actions workflow-dispatch method; provider-side application, readback, and fresh-publication proof require an authorized operator with those credentials.

## Exact candidate-only target

**Re-read these identities immediately before acting; historical values are NOT current authority.**

| Binding | Intended isolated candidate | Forbidden production |
|---|---|---|
| Worker | `binrat-read-plane-stability-candidate` | `binrat-edge-v0` |
| D1 | `binrat-read-plane-stability-candidate` / historical ID `6bd76897-c255-4d8e-a66f-9423a2fbdd77` | `binrat-v0` / `46814564-1a41-449a-88e5-c1349eed3a27` |
| Queue | `binrat-read-plane-stability-candidate-sync` | `binrat-sync-v0` |
| Host | `https://binrat-read-plane-stability-candidate.pettevik.workers.dev` | `binrat.tech` |
| Principal RPC binding | `ROBINHOOD_RPC_URL` → verified PAYG Alchemy Robinhood endpoint | Never alter |
| Archive RPC binding | Keep existing `BINRAT_ROBINHOOD_ARCHIVE_RPC_URL` separate | Never alter |

Historical candidate rollback version ID: `1f68b4d6-3a57-4022-bb3b-c4496b864bcb`; actual active deployment/version and 100% routing must be freshly re-read.

## Bounded operator procedure (not yet executed)

1. **Fail closed on source/worktree.** Inspect `AGENTS.md`, `git status --short`, actual candidate Worker source/module digest, branch ancestry, `wrangler --version`, and the current exact source commit. Preserve WIP. No implicit merge or bulk cherry-pick.
2. **Re-read provider bindings (read-only).** Confirm account, Worker name, active deployment+version, D1 UUID/schema/checkpoint, queue producer+consumer, cron schedule, present secrets by **name only**, current Pons error, and rollback version. Require exact candidate D1/queue and no production route/domain.
3. **Establish the correct secret endpoint.** In an authorized local protected context, read the paid Alchemy app's Robinhood mainnet RPC URL without printing, recording, logging, or committing the key; verify chain=4663 and factory bytecode hash. Do not assume that the existing archive secret is attached to the now-paid Alchemy app. Use the verified endpoint only for the candidate's `ROBINHOOD_RPC_URL` binding; never put it under `vars`, in shell history, a PR, or a log.
4. **Validate candidate config before any write.** Worker `binrat-read-plane-stability-candidate`, candidate D1 and queue exactly, `workers_dev=true`, no `routes`, `route`, `custom_domains`, or production D1/queue IDs. Keep public-facing Rat/Telegram/AI/holder writes disabled. Keep `BINRAT_PONS_MAX_BATCH_BLOCKS=1024`, `BINRAT_PONS_CATCHUP_MAX_BATCH_BLOCKS=4096`, `BINRAT_PONS_CATCHUP_MAX_BATCHES=4`, existing lease/verification rules, and no unsafe override.
5. **Dry-run before deploy.** Build source at the reviewed exact commit, run existing relevant Pons/runtime tests and TypeScript, inspect the compiled Worker asset output, verify actual endpoint type from the secret without logging it, and save sanitized source/build/binding receipts. Do NOT use a historical workflow that silently checks out a different SHA.
6. **Apply candidate ONLY.** With the owner-approved candidate scope, set candidate `ROBINHOOD_RPC_URL` via a secure stdin-based secret command bound explicitly to the reviewed candidate config. Deploy **only** the existing candidate Worker with its existing D1 and queue; no production route, no production secret, no database migration, no new D1, no token activity. Capture active version/module hash and retain rollback identity.
7. **Prove actual recovery.** Observe natural cron/queue execution and D1 `chain_id=4663` checkpoint advancement beyond **83573282**; gather bounded `PONS_CATCHUP_RECEIPT` and sanitized error telemetry. Require **two different advancing FRESH_VERIFIED publications at least 60 seconds apart** with strictly increasing checkpoint and publicationVersion, status/feed/D1 identical chain 4663, matching blockHash and digest, freshness valid within TTL. Same cached response or a single fresh status is NOT enough. Record measured invocation/CU/spend and budget/alert threshold before deciding production economics.
8. **Negative controls (isolated fixtures only).** Force simulated stale, no-snapshot, corrupt digest, RPC failures; verify stale remains visible but not fresh, missing/digest-invalid snapshots return 503, and failure cannot advance checkpoint. No tests against production D1/queues.
9. **STOP.** Report `CANDIDATE_RECOVERY=PASS|FAIL|BLOCKED`, exact SHA/deployment version, first/second publication receipts, CU/estimated monthly cost, rollback version, open risks, `PRODUCTION_AUTHORIZATION=FALSE`. Do not cut over V3 or change production.

## Stop conditions

- Unknown/changed candidate D1 or queue; ambiguous Cloudflare account; current source digest not reconciled with intended code.
- Alchemy endpoint paid tier/network not demonstrably correct, missing secret, absent $10 account usage limit, unexpectedly high charges, or leaked RPC URL.
- Incomplete authority checks, log rejects, source hash drift, D1/runtime mismatch, no natural queue progress, improper freshness/receipt binding.
- Candidate build tries to provision/migrate production resources, alter routes, or enable write-capable Telegram/AI/holder features.
- Provider readback or authentication unavailable. **Do not deploy to recover the ability to inspect a broken provider.**

## Commercial sequencing

A passing candidate is a prerequisite to a truthful live V3 demo, **not monetization proof**. After recovering it, prioritize one real user journey (`FIND → CASE → WATCH → ALERT`), measured utility for early Pons users, then a bounded paid Watch/capacity demand test. Do not substitute more frontend work or token launch for actual paying-customer evidence.

PLAN → CHANGESET → VERIFY → VERDICT.
