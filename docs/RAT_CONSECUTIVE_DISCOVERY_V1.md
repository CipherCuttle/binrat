# Bounded consecutive discovery V1

## Problem and smallest change

The #135 capture ended `EXPIRED / PARTIAL_DISCOVERY_WINDOW_ENDED` after seven complete public RPC responses, with no funding selection, handoff or finding. It was inconclusive: occasional latest-block samples left gaps. The historical result is retained, not promoted to a negative finding or repaired retrospectively.

This slice adds an explicit `binrat.prospective-capture/2` manifest to the existing manual recorder. V1 keeps its original schema, request plan, state shape and frozen audit digests. There is no migration of an existing journal. The V2 change is eight consecutive numbered discovery blocks after the initial captured head. Eight is a small offline proof interval, not an adequate production observation service or an estimate of how long finding funding will take.

## V2 protocol

The funder, endpoint, Robinhood chain 4663, pinned Pons factory, eight-block recipient-history scope, 48-attempt budget and 24-hour/200,000-block outer horizon are unchanged. Manual steps remain limited to 16 attempts. Failures and unresolved reservations consume the original allowance; they are never retried automatically.

Each discovery step:

1. Reads a current head, but never uses `latest,true` for funding discovery. Waiting at the cursor consumes one head read and returns. Head regression or an observed changed hash/timestamp at the cursor halts.
2. Rechecks the saved cursor block by number and hash. The initial head is the cursor until the first block is confirmed.
3. Reads **exactly cursor + 1** with full top-level transaction objects. Number, transaction membership fields, chain, parent hash and monotonic timestamps must agree. A hash repeated from the initial anchor or any confirmed block is rejected.
4. Reads the same numbered block again with transaction hashes. Header fields and the complete ordered hash list must match the full response. Only then advances the confirmed cursor and adds a coverage receipt with read/confirmation sequence references.
5. If a positive-value, nonself top-level transfer from the frozen funder is present, the first such transaction is selected deterministically and enters the existing successful-receipt/history/handoff/strictly-later-launch pipeline. Otherwise it returns after one confirmed block. Confirmation of all eight blocks without a candidate terminates discovery.

The interval is fixed once the initial head is captured: `[initial + 1, initial + 8]`. A later head does not move the cursor forward, skip missed blocks or extend this interval. Reopening or restoring reconstructs exactly the next request from the original manifest and receipts. The same SQLite application ID and request reservation/CAS mechanisms are reused. Existing V1 manifests conflict with V2 registration rather than upgrading in place.

## Coverage and verdicts

V2 emits `CONTIGUOUS_NUMBERED_BLOCK_PREFIX` and a typed `discovery` object containing the declared endpoints, confirmed through-block, block hashes, receipt sequence references, validity and completion. No unconfirmed full response advances this object. An observed discovery fork/inconsistency invalidates coverage and halts. Transport failure, expiry or exhaustion retain the confirmed historical prefix without claiming completion.

`DISCOVERY_COMPLETE / NO_QUALIFYING_TRANSFER_IN_DECLARED_TOP_LEVEL_INTERVAL` means the eight declared blocks were read and confirmed as reported by the fixed provider, with no matching candidate in their top-level transactions. It does not mean no funding elsewhere, no internal transfer, complete wallet history, global freshness, independently authenticated consensus or permanent finality. Hash-list agreement detects inconsistent responses; a provider consistently omitting or fabricating data is outside this trust boundary. The existing trust label remains `PROVIDER_REPORTED_LOCAL_CLOCK_NOT_EXTERNALLY_ATTESTED`.

Discovery coverage can be complete even when a candidate in the last block subsequently exhausts the investigation budget. Coverage completeness is not job success. A late candidate must never receive an automatic allowance increase. A valid handoff with zero remaining calls cannot produce a launch finding or notification. The same distinction applies to a partial prefix ending at an early candidate: supported handoff/finding facts do not imply discovery of the entire declared interval.

## Offline verification

All new transport controls are synthetic. They cover eight-block completion while the head is ahead, an intermediate funding block that latest-only sampling would miss, restart/restore, wrong block, parent fork, changed confirmation, full-response transaction omission, cursor reorg, same-height head reorg, repeated initial/prefix hashes, failed confirmation, pending crash reservation, deadline expiry, waiting-head exhaustion, late-funding exhaustion, protocol/authority mutation and explicit CLI registration.

The synthetic no-candidate control completes eight blocks in **35** RPC attempts. The block-102 synthetic candidate control prepares a handoff at attempt **24** and admits a strictly later synthetic launch at **31**. Waiting or late-funding controls exhaust at **48** without a finding or notification. These are deterministic pipeline checks, not real-world detection rates or model competence scores.

The four-call V1 prefix snapshot remains `de1a8d0d49dc3c38a0cd17034a7d18a4f7dddda7319ad084f03c64c88019c236`. The newly archived seven-call terminal V1 export reproduces the original expired snapshot `0fd4f00a26c2e7bd8ffc05e5e0d6617f337d39c111d9323fa0ee09ec535b7778`. Its raw SHA-256 is `37a83a000e36c21951ca4175ec9d5859d1b38b1d3cca904a27b6b2724dd0fd1b`. Existing frozen evidence and lockfile bytes are unchanged.

One hostile self-review found HIGH repeated-hash acceptance and MEDIUM same-height cursor-fork detection gaps. Both were fixed. One targeted rereview passed; review is closed. Local verification: TypeScript build, **580/580** tests via Node's tsx import hook, npm execution of the existing web checks, and Product Surface V2 evidence/build checks. Cached dependencies were linked temporarily; no dependency or lockfile edits. Canonical CI uses pnpm 10.15.0 and a frozen install separately.

## CLI and boundaries

For a separately authorized fresh capture, `init-consecutive --db NEW_PATH --capture-id NEW_ID` explicitly registers V2. `step`, `inspect`, `export`, `audit` and `restore` are unchanged. Registration makes no RPC call. The old `init` continues to register V1. A repeated initialization is not a continuation mechanism. Keep one active journal copy; local export restoration does not enforce a global quota across copied databases.

This implementation did **not** start a fresh live experiment. New public RPC calls: **0**. New model calls and cost: **0 / $0.00**. No scheduler, production import, public UI/Den activation, Telegram/webhook send, wallet action, merge or deployment. Public Rat statuses remain unchanged. The original model safety failure remains unchanged and model competence remains unproven.

Next evidence: one explicitly registered V2 capture can establish whether this finite interval was covered and whether it happened to contain a qualifying candidate. It may complete with a scoped negative or be inconclusive. Persistent coverage and adequate event yield would require a separately bounded collection design; they are not established by this eight-block proof.

Rollback: revert this changeset as a unit on its branch; the parent retains #135 and the historical expired capture.
