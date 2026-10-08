# Pons RPC failure: diagnosis confirmed, recovery blocked

Assignment: [PR #169, P0 recovery](https://github.com/CipherCuttle/binrat/pull/169#issuecomment-6069444598).
Evidence window: 2026-10-08 22:02–22:25 UTC. All provider access was read-only; D1 queries were SELECT-only and reported zero rows written.

**Verdict: the diagnostic correction passes local verification. Indexing recovery has NOT been demonstrated.** No deployment, version switch, migration, production configuration change, queue send, webhook change, or frontend edit was performed.

## What broke and why

The configured upstream host, `rpc.ordofi.network`, rejects Pons `eth_getLogs` with HTTP 200 and JSON-RPC **-32005**, reporting “the network is busy, please try again in a moment.” The candidate fails in `LIVE_SYNC`, after `LIVE_LOG_READ_START` and before `LIVE_LOG_READ_DONE`, so it cannot commit the pending batch or publish fresh evidence.

The exact observed candidate range, **83573283–83577378**, reproduced the rejection using the repository's pinned viem 2.56.3 and unchanged `PonsLaunchSource`. Additional 364-block, 182-block, historical single-block, and recent single-block reads also failed with -32005. This does not support shrinking the range as a recovery fix. Production's configured endpoint independently returned the same code for a bounded log query.

Chain ID 4663, current head reads, and the factory bytecode hash passed on the configured provider. The head reached 83658219 during the probe. The alternative public endpoint returned HTTP 403 from this diagnostic environment; its availability from a Worker remains unverified. No automatic provider switch is justified by these results.

Viem represents the rejection as `LimitExceededRpcError`, with numeric `code: -32005` and a `RpcRequestError` cause. The deployed diagnostic allowlists recognize neither that name nor numeric code, collapsing it to `SYNC_UNKNOWN_ERROR`, `errorName: UNKNOWN_ERROR`, `httpStatus: null`, `causeCode: null`. HTTP status is null in this exception because the HTTP request itself succeeded. This is the confirmed application diagnostic defect.

**The provider's internal reason for returning busy is unverified.** Available evidence cannot distinguish quota exhaustion, node capacity, or another provider-side failure. Sporadic `SOURCE_BOOTSTRAP` head/factory failures were also observed; their exact underlying causes are not established by the deployed sanitized logs. They are not evidence of a D1/schema defect.

Production's old Worker reads runtime readiness directly. A failed sync persists `source_verified=0`, `live_caught_up=0`, and an error. Its `/api/status` has no dedicated status handler and falls through to `readyContext`, producing 503 `INDEX_NOT_READY`. `/api/launches/latest` rejects the unverified runtime anchor and becomes 503 `PUBLIC_PROJECTION_UNAVAILABLE`. Both responses were reproduced. The newer candidate can serve the retained snapshot as `STALE_VERIFIED`; that is not recovered indexing.

## Deployment, rollback, and binding receipt

Full sanitized evidence: [rpc-limit-readback-20261008.json](receipts/pons-runtime-v1/rpc-limit-readback-20261008.json). The receipt includes selected D1 schema SQL, two metadata samples per database, queue wiring, cron configuration, a failing invocation, RPC reproductions, module hashes, and local source-file hashes.

| Identity | Production | Existing isolated candidate |
| --- | --- | --- |
| Worker | `binrat-edge-v0` | `binrat-read-plane-stability-candidate` |
| Active deployment | `6b5b6741-452c-41f1-8e4d-bc352b2ef505` | `7990d92e-9a37-433d-8d6e-7350f3d6af53` |
| Active version / retained rollback identity | `f2744535-e04b-4944-85c2-341ccba40ecb` | `1f68b4d6-3a57-4022-bb3b-c4496b864bcb` |
| Reported source SHA | `53325fd0806765578ed6921428ad55f15a9728f1` | `e34a94cf1702340582266852495e28423728add0` |
| D1 binding | `46814564-1a41-449a-88e5-c1349eed3a27` | `6bd76897-c255-4d8e-a66f-9423a2fbdd77` |
| Queue | `binrat-sync-v0` | `binrat-read-plane-stability-candidate-sync` |

Provider route readback maps `binrat.tech` to `binrat-edge-v0`, production environment. Each active version receives 100% of its Worker's traffic. The source SHAs above are reported bindings; the separately downloaded active modules have these measured SHA-256 values:

- Production: `ab4dd261a8c12e03a6ecf928d0a760db697c8375b59c083ab7e9ae4e00ce5cce`.
- Candidate: `ff32ecdedf0585552b2aec7235ce46f017f4e2f35e72b74e413806ac8235a50f`, matching the preserved [candidate provider receipt](receipts/pons-runtime-v1/prior-provider-readback.json).

Both queues have the corresponding Worker as producer and consumer, batch size 1, maximum concurrency 1, five retries, and 30-second retry delay. Both schedules are `* * * * *`; scheduled and queue invocations were observed. Both databases contain the runtime, snapshot, checkpoint, and lease tables plus all three selected numeric launch indexes. Migration-ledger version is unverified: the selected schema query found no `d1_migrations` table. These checks establish the relevant schema and active wiring, not a complete queue-backlog or migration-history audit.

## Does indexing advance?

**No advancement was observed across the eight-minute D1 sample window.** This statement concerns chain 4663; successful legacy Arc cycles are excluded.

| Pons metadata | First sample, ~22:05 UTC | Second sample, ~22:13 UTC |
| --- | --- | --- |
| Production checkpoint | 83573396 | 83573396 |
| Candidate checkpoint | 83573282 | 83573282 |
| Production publication | version 25, block 80368666 | unchanged |
| Candidate publication | version 5523, block 83571234 | unchanged |

At 22:24:56 UTC the candidate public status still exposed that same publication, hash, and digest with `STALE_VERIFIED` and `SYNC_UNKNOWN_ERROR`. Failure writes retain the previous runtime head/target, so those columns do not describe the current upstream head during repeated failures. This local diagnostic patch has not run in either deployed Worker.

## Smallest correction and verification

Branch: `fix/pons-rpc-limit-diagnostics-v1`, based on reverified PR #169 head `cd889687c97f21b62fb166a7f72ded28df4243fb`.

The correction adds only the known numeric -32005 mapping to `RPC_LIMIT_EXCEEDED` and allows the fixed `LIMIT_EXCEEDED_RPC_ERROR` name. Existing code then persists `SYNC_RPC_LIMIT_EXCEEDED` for both direct live-sync errors and wrapped Pons bootstrap transport errors. It neither retries more aggressively nor changes providers, batching, leases, authority checks, checkpointing, or publication rules. Provider messages and URLs remain excluded from diagnostics.

- Before the patch: all three new regression tests failed on the reproduced misclassification.
- After the patch: **43 tests passed, zero failed** across `ponsRpcLimitDiagnostic`, `cloudflareSyncQueue`, `ponsSource`, and `sync`.
- `pnpm exec tsc -p tsconfig.json --noEmit`: exit 0.
- The queue integration test verifies the existing 30-second retry, failed runtime readiness, unchanged checkpoint/snapshot, stale status, safe diagnostic fields, and absence of sensitive provider text. Explicit authority errors retain precedence.
- Fresh-worktree setup initially lacked ignored generated backend metadata. The normal generator was run with its `web/release.json` write suppressed; only ignored backend metadata and local receipts were generated. The checks above then passed. No frontend files were edited.

This is an **observability fix**, not proof that a provider rejection has been repaired. A code-only indexing recovery correction is not supported by the evidence collected.

## Future activation gate — not executed

1. The owner must authorize and establish a working upstream log source. Before choosing it, verify 4663 chain ID, the pinned factory code hash, canonical hashes, the blocked historical range, and a recent range. Provider-side remediation or endpoint/secret changes require separate authorization. Do not infer a working fallback from these tests.
2. With separate approval, build the reviewed source commit and deploy only an isolated candidate with its existing D1/queue bindings. Record the exact source, build/module digest, active deployment/version, bindings, and retained rollback identity. Re-read active provider identities immediately before any action; this receipt is time-bound. No migration is indicated by the evidence.
3. Let the existing schedule run naturally. Require **two distinct advancing `FRESH_VERIFIED` publications**, separated by at least the actual 60-second publication interval. For each, bind status, latest feed, and D1 to the same chain 4663 checkpoint, canonical block hash, feed digest, verification timestamp, and publication version. The second checkpoint and publication version must advance; repeated cached responses do not count. Respect the observed 5-second status TTL, 60-second shared feed TTL, and 180-second freshness limit, and confirm those values on the newly built candidate.
4. In an authorized isolated test, inject a failed log read and advance the test clock beyond the 180-second freshness window. Confirm no checkpoint/publication advancement and `STALE_VERIFIED`, never a fresh label. The candidate may continue returning a valid retained snapshot with HTTP 200; expiration alone must not be mistaken for a missing snapshot. Separately test a missing snapshot (`/api/launches/latest` must return 503 `NO_VERIFIED_SNAPSHOT`) and a digest-invalid snapshot (503). These controls belong in local/isolated fixtures, without changing production RPC configuration or data.
5. Stop with candidate evidence for owner review. Production cutover, rollback execution, signing, launch, trading, and marketing each remain unauthorized.

## Bounded hostile review

One local hostile review covered the complete correction, regression tests, and evidence claims. It checked authority-error precedence, numeric-code allowlisting, sensitive-message exclusion, retry/lease/checkpoint/publication invariants, and whether the proposed change actually restores upstream availability. No code defect was found. Recovery remains blocked, and the diagnostic patch must not be presented as a service restoration.

One documentation finding was corrected: snapshot expiry alone does not make the candidate's retained-feed endpoint return 503. The negative-control plan now distinguishes explicit stale status from missing/corrupt snapshot rejection. A targeted rereview against `publicStatus` and the Worker route handlers confirmed the corrected expectations. The receipt's module/source hashes, zero-write SELECT metadata, stationary checkpoints/publications, and public status binding also passed local invariant checks. No second broad review was run.

## Required verdict fields

- `PRODUCTION_DEPLOYMENT_IDENTITY`: confirmed above; production still serves the older Worker.
- `SYNC_FAILURE_PHASE`: confirmed `LIVE_SYNC`, at the log read; sporadic bootstrap failures separately observed.
- `D1_QUEUE_READINESS`: relevant schema and wiring present; invocations active; Pons advancement failed.
- `ROOT_CAUSE`: confirmed upstream JSON-RPC -32005 rejection of required log reads, masked by the diagnostic allowlist; provider internal cause unverified.
- `SMALLEST_FIX`: bounded RPC-limit diagnostic classification, prepared locally. No proven provider-availability fix.
- `TEST_VERDICT`: local diagnostic regression/compatibility PASS; live indexing recovery BLOCKED.
- `NEXT_PERMISSION_NEEDED`: owner-authorized upstream remediation and, separately, isolated candidate activation/verification. No permission is requested or presumed by this report.
- `PRODUCTION_AUTHORIZATION=FALSE`; token/trading/marketing authorization remains FALSE.
