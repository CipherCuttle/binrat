# Bounded indexed funding observation V1

Registered before outcome on top of draft #140. Its earlier one-range capture is
closed and remains unchanged: 8 complete attempts, an empty provider enumeration
over blocks 81,626,509–81,627,098, and no handoff or finding.

The remaining experiment is **funding observed → bounded recipient history →
saved research handoff → strictly later Pons launch**. That deterministic path
already exists in #135/#138. This slice adds its finite runner policy, not a new
investigation engine, synthetic success relabeled as real, or production worker.

The separately sealed registration uses the same V3 manifest, frozen funder,
existing named archive secret, transport, canonical-read gates and 48-reservation
allowance. The policy is fixed in `INDEXED_OBSERVATION_V1` before live execution:

- Wait 60 seconds after the initial head; observe at 60-second boundary intervals.
- Confirm at most four future indexed discovery ranges. Each range remains bounded
  by 4,096 blocks, three pages and five transfers/page.
- Require at least 28 remaining reservations before starting another discovery
  range: up to 21 for a third-page candidate through handoff, and seven for an
  immediate positive later-launch verification. Waiting/empty later-launch reads
  still consume this same allowance; the reserve guarantees no eventual outcome.
- Stop on the first selected candidate's ineligibility, failure, expiry, exhaustion
  or supported finding. Never switch subjects or skip inconvenient candidates.
- Save the handoff audit/raw prefix before any later-launch observation. After
  a handoff, continue the existing future-only canonical Pons log/receipt gates.
- Twelve-minute local bound; 15-second one-attempt HTTP limits remain unchanged.
  A reservation whose transport is prevented by the time bound is counted and
  failed. A time limit reached at an observation boundary stops without a new call.
- No retries, replacement journals, fresh-budget continuation or workflow reruns.
  This is a separately authorized experiment, not continuation of the closed #140
  run. Both recordings retain their original registrations and outcome.

The selected subject was taken from the earlier known retrospective example;
this is not a blind holdout. An empty result is **inconclusive for the positive
path**, not proof of no funding or a failed implementation. Index freshness is
unmeasured and a lagging provider may omit candidates when an empty cursor advances.
Eight-block recipient absence never means global wallet freshness. A finding must
bind a launch strictly after the saved handoff block and local wall-clock receipt.

The dedicated workflow injects the existing secret only after frozen installation
and offline checks. Publish/verify source before the one exact trigger commit.
Reruns are rejected. Final and checkpoint audits, raw receipts, SQLite and hashes
are retained; an active-looking replay phase does not imply a running service.

Acceptance: the synthetic control must pass all the way through a saved handoff
and supported later launch; empty ranges must stop with unused verification
capacity; failure/uncertainty and old-journal continuation must make no retry.
The live result is reported separately, including coverage, counts, uncertainty
and provider-reported cost only when present. No inference occurs. Nothing is sent,
merged, deployed, signed, broadcast or activated in production. Public Rat status,
token economics and historical model failure verdicts remain untouched.

Rollback: revert this policy/runner/workflow addition; retain all captured raw
receipts. Earlier code can still inspect/export/audit the unchanged V3 journal.

One hostile self-review tightened the checkpoint/reporting boundary: the first
handoff prefix is saved once and hashed, callbacks receive a clone of replay state,
and a zero-attempt configuration failure is `NOT_STARTED`, not an empty enumeration.
The targeted rereview checks these boundaries and the full-path budget controls.
No independent reviewer or subagent is claimed; historical reviews stay closed.
