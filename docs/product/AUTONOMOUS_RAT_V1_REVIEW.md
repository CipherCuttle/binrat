# Autonomous Rat V1 — one bounded hostile review

Reviewed head: `4b98ace` (production ancestor `b286f68`). Review performed by the
implementing agent as a distinct hostile pass; not represented as an independent
human or second-agent audit. Baseline: 19 targeted / 232 full tests passed, root and
V2 checks passed. Scope: entire S1 diff and its production integration boundaries.

## Findings

| ID | Severity | Evidence / impact | Disposition |
|---|---|---|---|
| H1 | High | `/watch` calls the shared investigation and RPC head path without the DIG budget. Reproduction: 31 duplicate watch commands made 31 head reads, zero quota rows. Per-chat minute limits do not cap global RPC work. | Fix before closure: meter WATCH admission through the same independent capacity boundary; UNWATCH/WHY remain available. |
| H2 | High | A source head may be up to 60 seconds old. A later-indexed block above that stale head may still predate the user's opt-in; ingestion-after-watch does not establish event-after-watch. | Fix before closure: verify canonical event block time after watch creation before send, capture the verified time in the delivery receipt, reject absent/malformed time. |
| M1 | Medium | UNKNOWN/SENDING/FAILED delivery reconciliation has no operator UI; ambiguous sends intentionally never retry. A successful send with lost acknowledgment may remain unresolved. | Backlog S4/operations. This is the documented external API limitation, not a claim of guaranteed delivery. |
| M2 | Medium | D1-compatible SQLite tests prove SQL/transaction behavior locally, not distributed D1 contention or production-scale fan-out. 50 candidate joins / 5 sends per five-minute cycle is deliberately conservative. | Backlog isolated staging/load qualification before scale rollout; no production capacity claim. |
| M3 | Medium | Case/command/quota/delivery retention and archival are not yet automated; permanent dedupe tombstones and evidence receipts trade bounded admission for growing lifetime storage. | Backlog retention policy preserving replay fences and honest unavailable receipts. |
| M4 | Medium | Missing evidence among the earliest bounded candidates can delay later work; incomplete evidence must not be promoted to a finding. | Backlog fair observation cursor/dead-letter accounting in S2. Source repair remains necessary; no false alert emitted. |
| L1 | Low | Reply-to-DIG, callback buttons, share-link recovery and graphical artifacts are absent; textual `/why` and explicit creator watch commands work. | Planned S3. No untrusted callback or quoted-message authority introduced. |
| L2 | Low | Suspended watches after a boundary reorg require explicit re-arm; no proactive administrative explanation is sent. | Backlog watch-status UX. Avoid an extra unsolicited message in S1. |

## Other reviewed boundaries

- No BUY/SELL/safety/skill claims; no untrusted symbol/name rendered as an instruction.
- Exact source-reported creator relation; never human identity or coordination.
- Typed chain keys and Arc-only runtime gates; no Pons adapter or token authority.
- Owner user equals private chat; webhook authentication precedes command handling;
  no callback actions, group writes, raw transcript or public user-wallet mapping.
- Conditional quota insert and transactional mutation receipts; newer unwatch fences
  stale updates. Outbox CAS before network, terminal sent/uncertain states, canonical
  evidence and active-watch checks at claim. Rewind trigger suppresses pending work.
- Migration is additive and unexecuted remotely. Default-off flag keeps old behavior;
  cutover/rollback requires legacy subscription handling, documented in the plan.
- Existing conversation/feedback/Radar and all frontend assets are preserved.

Critical: 0. High: 2 requiring fixes. No further broad review is authorized by this
workflow; after fixes perform one targeted rereview of H1/H2 and regression checks.

## Targeted rereview — completed once

H1 fixed: WATCH reserves the same atomic per-user/global research admission as DIG,
before evidence/RPC work. Existing update receipts avoid repeat mutation; quota
rejection happens before RPC. UNWATCH and WHY do not consume that budget. Source
read failure returns an honest unavailable response. Regression: 30 admitted reads,
31st rejected; 8 concurrent principals against a cap of 2 produce exactly 2 reads.

H2 fixed: delivery fetches the event's canonical block/hash/time and requires time
strictly greater than watch creation, rejects malformed/equal/old/future-clock times,
and stores event time plus watch creation in the private outbox receipt. WHY exposes
that relation only to its owner; public case evidence contains no watch timing.
Regression: delayed historical event above the head is cancelled without a send;
genuine future event records and reconstructs the time comparison.

Targeted rereview also checked the fixes' integration edges: ambiguous send and
crash-after-Telegram-before-D1-completion cannot retry, group/callback authority stays
closed, source reorg invalidates work, and five-reference receipts fit Telegram.
All 26 targeted tests and TypeScript pass. Critical/High remaining: 0 in this bounded
scope. Medium/Low remain backlog. No second broad hostile review performed.
