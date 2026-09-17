# BINRAT code plan

Operate using `PLAN -> CHANGESET -> VERIFY -> VERDICT`.

Bounded completion:

`IMPLEMENT -> TEST -> ONE independent hostile review -> fix Critical/High -> ONE targeted rereview iff required -> MERGE ONLY WITH EXPLICIT OWNER AUTHORITY -> MOVE FORWARD`

## PR 0 — plan/binrat-v0

Planning docs, brand contract, donor provenance, Node/TypeScript scaffold, mascot asset, and CI. No chain calls.

Acceptance: dependency install, build, and scaffold test pass.

## PR 1 — agent/arc-launch-ingest-v0

Implement:

- Arc mainnet chain definition;
- ArcPad event adapter;
- deterministic launch/event identity;
- SQLite launch/provenance/checkpoint store;
- confirmed-range sync;
- bounded reorg rewind;
- deterministic provenance projection;
- `backfill`, `watch`, `inspect` CLI.

Acceptance:

- restart-safe;
- replay-idempotent;
- conflicting duplicate identity fails closed;
- reorg repair removes orphaned facts;
- provenance projection independent of input order;
- no trading/signing code.

## Experiment — experiment/72h-hot-garbage-v0

Run observer for 72 hours. Measure launch volume, unique/repeat creators, latency, duplicates, identity conflicts, reorgs, RPC failures and reconciled completeness.

Only after this gate do we authorize web UI.

## Later PRs

1. historical 5m/1h/24h observations + creator-history receipts;
2. web product (`HOT GARBAGE`, `TRASH TRAIL`, `RECEIPTS`);
3. deterministic autopost layer;
4. concurrent workers using REKT H5 semantics if needed;
5. separate explicit `$BINRAT` launch gate.
