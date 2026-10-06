# Local Rat job V1

This slice implements **start → leave → return** with a dedicated durable SQLite journal and a local CLI. A synthetic funding-watch job keeps its original subject, block deadline, source tape and budgets across process exits. It can be cancelled, expire, exhaust its budget, halt on invalid evidence or return a supported Case diff and a prepared notification.

It is an offline lifecycle proof. Progress requires an explicit `advance` command against an immutable synthetic replay tape. There is no background scheduler, live collector, provider call, production route, Den UI, Telegram send or capital authority. Tripwire and Sniffer availability on the homepage does not change. AI competence remains unproven; the historical failed model and dataset verdicts remain intact.

## Try the existing fixture

From the repository root, with Node 24 and the pinned dependencies installed:

```sh
pnpm build
node scripts/local-rat-job.mjs create --db /tmp/binrat-local-proof.sqlite --fixture test/fixtures/workforce/sniffer-funding-to-pons-v1.json
node scripts/local-rat-job.mjs advance --db /tmp/binrat-local-proof.sqlite --job-id offline-sniffer-job-1 --through-block 101
node scripts/local-rat-job.mjs inspect --db /tmp/binrat-local-proof.sqlite --job-id offline-sniffer-job-1
node scripts/local-rat-job.mjs advance --db /tmp/binrat-local-proof.sqlite --job-id offline-sniffer-job-1 --through-block 125
node scripts/local-rat-job.mjs inspect --db /tmp/binrat-local-proof.sqlite --job-id offline-sniffer-job-1
node scripts/local-rat-job.mjs export --db /tmp/binrat-local-proof.sqlite --job-id offline-sniffer-job-1
```

Each command is a new process. At block 101 the job is waiting with two logical tool calls and one typed handoff. At 125 it returns `FOUND`, five logical calls, a synthetic Case diff and a `PREPARED_ONLY` notification with no delivery permission or recipient. Repeating a boundary or advancing a terminal job does not append another checkpoint or notification. `cancel --db ... --job-id ...` durably stops a nonterminal job.

The recorded [CLI proof](RAT_LOCAL_JOB_PROOF_V1.json) contains the fixture hash, separate-process steps and the complete returned receipt, Case diff and notification. It is reproducible synthetic evidence, not a live job result.

`pnpm rat:job <command> ...` builds and invokes the same CLI. An explicit separate DB path is mandatory. Inspection and export are read-only and cannot create a missing database. The controller rejects databases without its application/version marker before applying pragmas or writing tables; it never uses the production store or schema.

## Lifecycle and limits

| Phase | Meaning |
| --- | --- |
| READY | Created; no receipt has been processed. |
| WAITING | A verified prefix is saved; further replay input may be examined. |
| FOUND | An alert and Case diff were supported by the replay rules; notification is only prepared. |
| EXPIRED | Declared block deadline reached. Outcome distinguishes no finding in this fixture window from incomplete coverage. |
| EXHAUSTED | Original tool/handoff budget or the separate 32-advance local limit stopped work. |
| CANCELLED | Owner cancellation; no later work or artifact is admitted. |
| HALTED | Visible source evidence failed replay validation. Prior completed receipt and rejected source tape remain available. |

All phases except READY and WAITING are terminal. There are no automatic retries. Expiry is a simulated **block deadline**, not a wall-clock timer. Empty tape means no finding in that declared synthetic tape; it does not establish that a wallet had no real activity. Missing history after funding yields incomplete coverage. Every output remains scoped to synthetic fixture evidence, never current chain health.

The existing kernel is unchanged: one funding recipient, first matching history and one finding. Source schema bounds are inherited. Expected evaluation answers are normalized away before storage and cannot influence identity or outcomes. Future receipts are stored in the tape but only visible receipts enter replay decisions; explicit raw export contains the whole tape and is not an admitted claim output.

## Durability, integrity and accounting

Checkpoint, Case and prepared notification are one SQLite transaction with a revision compare-and-swap. A stale concurrent advance cannot overwrite cancellation or append a notification. The journal is contiguous and hash-linked. Reopening recomputes transitions and receipts from the saved source, rejecting edited or re-sealed false facts/counters. This protects local checkpoint integrity; it is not external authentication against an actor able to rewrite the entire file. Keep the DB and its WAL together while a process is running.

The receipt reports **logical replay tool/handoff reservations from the original job budget**, not actual RPC calls. Each advance and inspection physically recomputes saved prefixes; this CPU work is repeated and is not a fresh logical tool charge. Work is bounded by the 64-receipt source schema and 32 advances. Model calls and model cost are zero. On a source halt the retained receipt describes the last completed prefix; attempts inside the failed replay are not individually captured by the unchanged kernel. These counters are not production billing or pricing evidence.

Raw `export` stays available if checkpoint verification fails and labels the output `UNVERIFIED_LOCAL_JOURNAL_EXPORT`. No source or original receipt is overwritten to make a halt pass. Operator mistakes such as backward boundaries fail without changing the journal. Terminal jobs remain inspectable.

## Roadmap decision

This closes only the local durable job proof. Next, inspect these local artifacts and decide whether the return experience is useful enough to expose in a local Den prototype. Live adapters, durable scheduling, notification delivery, paid work and capacity economics require separate slices and explicit activation decisions. Do not resume paid model comparisons using the known index-proxy dataset.

Rollback is one branch commit revert. No production database migration or deployment is included.

## Bounded review

One hostile self-review checked concurrent cancellation, terminal transitions, receipt rebinding, journal tampering, database ownership, budget resets and synthetic/delivery labels. It found one Medium issue: re-sealed unknown action kinds or extra action fields could be accepted while reconstructing otherwise valid facts. Strict action validation now rejects them, and a regression reproduced the issue before the fix. No Critical/High finding was identified. One targeted rereview verified this fix and its boundary checks; review is closed.

Local verification: TypeScript build, 545/545 repository tests, web invariants and isolated Product Surface V2 passed. The repository tests used Node's `tsx` import hook because this environment restricts the normal `tsx` IPC socket. Twelve added tests cover reopening, real CLI process exits, cancellation races, expiry coverage, budget retention, source halts, boundary validation, step limits, foreign database rejection and checkpoint/action tampering. Exact published-head canonical CI is recorded in the draft PR.
