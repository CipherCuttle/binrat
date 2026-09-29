# Autonomous Rat V1 — frozen product and engineering contract

Status: S1 implementation contract, frozen 2026-09-29 before implementation.
Authority: isolated branch, push and one draft PR only. No deployment, remote migration,
merge, payments, token launch, signing or broadcast. Public frontend remains frozen.

## Production foundation

- Branch `feat/binrat-autonomous-rat-v1` starts at exact deployed code
  `b286f68f09494e58ecbba113c393679210eb2af1` in a separate worktree.
- Public `/health` read on 2026-09-29 returned that releaseSha and `ok:true`.
  Owner-supplied Worker version: `f2bc0c47-d9b8-4a5d-a72c-f0b60a199843`;
  no authenticated deployment query or mutation performed.
- Release documentation head `5cbedcc2704ca29bf66b749c1f46f4198ce8a6b0`
  descends from the code SHA; their diff is only the release record.
- Production already includes legacy Watch, Radar, private conversation and feedback.
  Do not merge candidate stacks or their workflows. Transient `/api/feed` 503 remains
  an observation item unless reproduced as a direct blocker.

## Product and command contract

BINRAT is autonomous evidence-first launch intelligence, independently useful without
a token. The retention loop is DIG → explain → explicit WATCH → future observation
→ attention decision → selective alert → receipt → share → new-user DIG/WATCH.

| Stage | Scope |
|---|---|
| NOW / S1 | `/dig`, `/watch`, `/unwatch`, `/watches`, evidence action `/why <caseId>`; conservative creator recurrence |
| NEXT | `/rats`, receipt deep links/share artifacts, `/brief` |
| LATER | opt-in Rat Den, Pons research, holder capacity, Dumpster Raids |

Input grammar: bare EVM address means Arc CREATOR; bare 64-hex launch ID means Arc
LAUNCH. Explicit `<chainId>:<CREATOR|WALLET|TOKEN|LAUNCH>:<id>` removes ambiguity.
Addresses normalize to lower-case 20-byte hex; IDs are 64-hex. Unknown chain, malformed
input, wrong chain and unsupported entity fail explicitly. S1 DIG supports indexed
Arc CREATOR, TOKEN and LAUNCH. Arbitrary WALLET is unsupported in S1: existing Radar
observes a pool recipient role, not the complete wallet history. No empty invented
analysis. WATCH supports only CREATOR recurrence; token/launch DIG suggests its exact
reported creator as a separate explicit watch command. Reply-to-DIG watch is deferred
until authoritative bot-message binding exists. No parsing quoted text as authority.

`/rats [chain] [filters]` will return bounded evidence-ranked discovery with reasons,
coverage and exact observed roles, never skill/profitability scores. `/brief` will
aggregate unsent REMEMBER/BRIEF items since the user's cursor, without relabeling old
events as new. Natural-language aliases must call these same operations. Existing
legacy bot features remain available; S1 adds no AI factual path.

## Identity and evidence

Canonical entity = `{chainId, entityType, entityId}`. Arc=5042; future Robinhood=4663.
Typed IDs, watches, cases, observations and delivery keys include chain. No naked
address is a global entity; address equality is never human identity or coordination.
Preserve historical Arc launch/event digests. A future Pons adapter has its own source
namespace, exact emitted roles, finality and coverage; Pons intelligence is not live.

Normalized receipt envelope:
`{findingId, caseId, chainId, subject, timestamp, epistemicClass, claim, evidenceRefs,
coverage, source, createdAt}`. Timestamp is explicitly block position plus ingestion
time in S1, NOT a fabricated launch wall-clock timestamp. Source refs bind launch ID,
event ID, block/hash, transaction/log, provenance fact ID/digest. Cases are immutable
evidence snapshots with content-derived IDs; repeated DIG at the same evidence yields
the same case. Findings for recurrence are shared across users; private delivery joins
explain why a user's watch caused attention. Public facts contain no Telegram identity.

Epistemic vocabulary:

- OBSERVED: canonical indexed source event and its exact reported fields.
- DERIVED: deterministic equality/count/relation from referenced observed facts.
- PATTERN: explicitly labelled hypothesis, not emitted by S1.
- UNKNOWN: missing coverage, control, intent, coordination, safety and future outcome.

WHY reconstructs structured facts, verifies referenced canonical rows/hashes/digests,
and fails closed when missing/reorged. It never asks an LLM to justify a conclusion.
History is bounded and explicitly partial; no safety/rug verdict, BUY/SELL advice,
opaque smart-money score, inferred human identity or future-return claim. Tier cannot
change facts, derivation or receipt access. LLM summaries, if added later, consume only
verified facts and cannot create evidence.

## Watches, observations and attention

Durable watch fields: owner user/chat, chain, entity type/id, createdAt, enabled,
start block/hash, policy `CREATOR_RECURRENCE_V1`, generation ID.
Private DM authority requires authenticated webhook and sender ID equal to private
chat ID. Groups do not create private watches. Unique active subject per owner;
atomic quota conditional insert; duplicate command is idempotent. Removed watches
remain disabled so old queue work cannot revive them. Re-watch gets a new generation.

Future-only boundary: read a fresh source head after explicit opt-in; verify Arc source
authority and record head hash. Require event block strictly greater than that head,
event ingestion after watch creation, and canonical confirmed checkpoint coverage.
Before delivery also require the canonical event block timestamp strictly after watch
creation (and not more than 15 seconds ahead of server time); missing timestamps fail
closed. This catches delayed historical ingestion above a recently stale RPC head.
Persist verified event time and watch creation in the private delivery receipt.
Do not use the lagging index checkpoint or ingestion timestamp alone as the boundary.
Historical/backfilled rows at or before head cannot alert. Reorg checks verify boundary
and event hashes before sending; changed boundary suspends the watch (re-arm required).
Source unavailable, stale runtime, incomplete evidence or checkpoint disagreement
means no alert. No claim of absolute finality after Telegram has received a message.

Observation is shared indexed evidence. Attention interface returns IGNORE / REMEMBER /
BRIEF / ALERT with rule version and reason. S1 creates ALERT only for eligible explicit
future creator recurrence; other valid evidence is REMEMBER, invalid is IGNORE. BRIEF
aggregation and creator/wallet reactivation, funding, convergence, launch appearance,
narrative acceleration are future rule implementations requiring their own evidence.

## Outbox and Telegram delivery

Use existing Queue scheduler, with a distinct gated S1 path in its Watch cycle. D1
is the durable authority; queue messages are wakeups, never permission to send.
Outbox fields include observation ID, finding/case, owner chat/user, watch generation,
state, attempt count, last attempt and returned Telegram message ID. Unique
`owner + chain + observation` prevents event replay and re-watch duplication.
Canonical finding and bounded fan-out persist idempotently; pending work is reclaimed
through later cycles. Fan-out queries and delivery batches are bounded.

State: PENDING → SENDING → SENT. Known rejection → FAILED; uncertain send/response or
crash after claim → UNKNOWN (or durable SENDING pending reconciliation), never automatic
resend. Replays atomically fail the send claim. Revalidate active watch and evidence at
claim time. Unwatch suppresses unsent work immediately; a request already handed to
Telegram cannot be recalled. This is the linearization boundary, not an absolute
distributed cancellation claim.

Exactly-once successful-path UX is tested. Telegram `sendMessage` has no documented
idempotency key; exactly-once delivery across lost acknowledgments is not achievable
with a D1 transaction. Prefer a possibly missed alert over a duplicate; never silently
retry ambiguous attempts. Reconciliation is operator work, not permission for automatic
resends. Webhook update IDs additionally fence command effects; persist completed
mutation results atomically so a stale update cannot re-arm after a newer unwatch.

References checked: [D1 transactions](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch),
[Queue delivery](https://developers.cloudflare.com/queues/reference/delivery-guarantees/),
[Telegram sendMessage](https://core.telegram.org/bots/api#sendmessage).

## Sharing, privacy and groups

Each case has stable caseId and opaque shareId. Target:
`t.me/BinratBot?start=receipt_<opaque-id>`. S1 stores share-ready identifiers and exposes
WHY; S3 implements recovery or honest unavailable state and graphical artifacts.
Links carry no chat/user/watch IDs, wallet-control claims or transcript. Only public
source evidence may be shared. Private watch relationship stays in the owner-only
delivery receipt. No raw conversation transcript added; preserve existing TTL memory.
No automatic group scans, unsolicited DMs or referral spam. Group intelligence and
automatic CA scanning require explicit admin opt-in, scoped group authority and a
privacy review. Wallet authentication never publishes user-wallet linkage by default.

## Capacity and token utility

One neutral `EntitlementProvider.resolve(principal)` returns capacity policy:
profile FREE / PRO / HOLDER, watchLimit, dig quota, history depth, alert policy/latency,
filter/group/deep-dig allowances. S1 production resolver always returns FREE, 25 watches,
30 research admissions/user/UTC day, 1000 global/day, bounded latest evidence. DIG and
WATCH share this budget because WATCH verifies evidence and reads a fresh RPC head.
UNWATCH and WHY remain available at exhaustion. A duplicate update is metered once.
Atomic metering is separate from evidence generation; duplicate update cannot spend
again. No payment, balance or wallet-session logic inside handlers. PRO/HOLDER are type
slots only, without runtime grants or configurable activation. Existing legacy holder
code is not authority for this interface.

`$BINRAT = capacity in the BINRAT intelligence network` (intended, disabled).
HOLD: extra watch slots, faster intelligence, deeper investigations, advanced `/rats`
filters, group/Rat Den capacity and custom triggers. Optional later SPEND: Deep Dig,
burst monitoring, expensive graph expansion, large Dumpster Raid processing.
Never yield/APR, revenue share, fake governance, token-weighted truth or promised
trading returns. Eligibility requires verified control of a Robinhood 4663 wallet and
fresh canonical real-token balance. Activation requires official address, verified
launch, reverified probe, policy/finality decisions and production entitlement tests.
No token address is invented here. Fiat and holder funding independently feed the
same capacity resolver through separate reviewed authorities.

## Data and cost architecture

Existing chain index → shared D1 launches/provenance → bounded investigation receipts
→ user attention join → durable outbox → Queue consumer → Telegram.
Worker webhook authenticates, meters and invokes primitives; no per-user history scan.
Worker Queue batches source validation and fans out shared findings. D1 stores typed
watches, receipts, command-effect dedupe, quota buckets and delivery receipts.

Cheap: indexed DIG (bounded latest 5 facts), WHY, watch list/mutations, equality joins.
Moderate: fresh watch-head verification, per-cycle canonical block verification,
bounded fan-out and Telegram network delivery. Expensive: historical archive scans,
graph expansion, narrative ingestion and AI; excluded from S1. S2 materializes shared
discovery snapshots; S4 aggregates attention rather than polling history per user.
No claimed 10K capacity proof. Add operational lag/UNKNOWN delivery metrics before
scale rollout; optional work sheds load before factual source health.

## Extraction matrix (source heads inspected, no wholesale integration)

| PR / head prefix | Useful primitives | Dangerous assumptions | Tests worth porting | Schema / code decision | Final decision |
|---|---|---|---|---|---|
| #18 b5755fe | future recurrence, outbox, rewind | chainless chat+creator; checkpoint lags head; send-before-record ambiguity; quota race | future boundary, replay, remove/rewind | keep legacy tables/path while flag off; new typed watch/outbox; scheduler integration | REIMPLEMENT SMALLER / PORT TEST |
| #19 b1b25e3 | canonical swap receipts, role-based recurrence | recipient is not human/buyer/skill; free/holder projections differ in capacity | chain/coverage, no swap evidence | already inherited evidence code retained; no ranking import in S1 | REUSE AS-IS inherited / PORT CONCEPT S2 |
| #34 2f54abb | scoped TTL context, deterministic fallback, quota gate | newer branch adds raw smalltalk turns; cannot import transcript retention or deploy workflows | user isolation, expiry, concurrent quota | preserve production memory/feedback; new commands bypass AI | REUSE AS-IS production / REJECT candidate transcript additions |
| #36 d433f0d | deterministic source-time 14d creator discovery | ingestion time != event time; Scout lacks arbitrary-wallet evidence; untrusted symbols | cutoff/missing timestamps, role/chain, caption injection | no media/progress schema now; bounded snapshots later | PORT CONCEPT / PORT TEST S2 |
| #27 5e7d8fa | pinned balance probe, freshness and reorg checks | candidate threshold hit grants no rights; token authority absent | wrong chain, stale/future, reorg, FREE always | no schema/import now; reverify source before S7 | PORT CONCEPT / PORT TEST |
| #28 1479adc | nonce/purpose/origin/chain-bound SIWE | EOA-only candidate, old Arc session must not grant Pons | replay, concurrency, expiry, realm isolation | candidate FREE CHECK schema useful later, not copied now | PORT CONCEPT / PORT TEST |
| #29 eefda73 | dual route gate, bounded request/rate controls | env alone must not activate auth; candidate is not entitlement | origin, migration missing, cross-realm | no routes copied; production remains disabled | PORT CONCEPT / PORT TEST |
| #39 1e043cd | conditional reservation, trusted-clock expiry | OFFLINE_FIXTURE is not funding; duplicate expired grants | atomic quotas, expired/revoked replay | smaller FREE meter now; no prepaid schema imported | REIMPLEMENT SMALLER / PORT TEST |
| #42 c8f55a2 | immutable funding receipts and identity fence | receipt cannot grant entitlement; fixture signatures not provider proof | revision replay, identity rebind | defer append-only funding schema and provider integration | PORT CONCEPT later |

Additional inspection: #26 selection separates token 4663 from research 5042; #30
blocked successor retains historical digests; #32 discovery remains unpublished and
unverified. PORT CONCEPT only. #31's latest head is a frontend deletion/reset, not a
safe donor for today's frozen production: REJECT. #35 dual-chain/cost/economics research
provides capacity/truth separation and shared-cost doctrine: PORT CONCEPT, no synthetic
revenue assumptions adopted. Source extraction evidence includes PR descriptions,
file lists, implementation modules, test invariants and planning documents.

## Rollout / migration boundaries

One additive idempotent migration, tracked/runtime schema parity; no remote application.
`BINRAT_AUTONOMOUS_RAT_ENABLED=true` is required for S1 commands and Queue path, default
off. Legacy Watch remains untouched while off; when on its consumer is replaced by
S1 so it cannot double-send. Do not auto-migrate chainless/group subscriptions or replay
their backlog. Existing users re-arm with `/watch` after cutover; `/watches` discloses
legacy subscriptions requiring re-arm. Rollback flag alone resumes legacy subscriptions,
so a future deployment runbook must retire/snapshot old pending work before rollback.
No schema initialization on webhook/request. Missing migration fails closed.

## Plan acceptance — one review, passed before implementation

| Question | Resolved contract |
|---|---|
| Useful without token? | complete FREE DIG/WATCH/ALERT/WHY loop |
| Utility without changing truth? | capacity resolver never enters factual renderer |
| Exactly one future alert? | fresh-head and source-time boundary, unique outbox, atomic send claim; ambiguity held |
| Every alert answers WHY? | immutable refs + canonical reconstruction required before send |
| Chain scoped? | entity/watch/finding/outbox identities and joins carry chain |
| Telegram retries safe? | update effects + quota dedupe, outbox CAS before network |
| Pons extensible? | source adapter + typed chain identity; no Arc namespace rewrite |
| Independent fiat/holder entitlement? | common capacity interface, separate grants |
| Sharing private-safe? | public-only evidence envelope, opaque ID; owner relation separate |
| Shared scaling? | shared index/findings, bounded attention fan-out; no user history scans |

Resolved tensions: API cannot guarantee exactly-once through uncertain send; document
possible loss and no automatic retry. Source lacks event wall time; use block boundary,
not ingestion-as-event-time. Legacy keys lack user/chain authority; re-arm explicitly.

## Verification and bounded closure

Test malformed/unsupported/mismatched targets, partial/missing evidence and epistemic
rendering; owner/chain isolation; concurrent quota/add/remove/replay; delayed historical
ingestion; queue duplicate/concurrent delivery; ambiguous sends; unwatch before claim;
reorg and WHY revocation; missing migration; disabled holder; evidence tier independence.
Deterministic isolated fixture drives real webhook → D1 → Queue → fake Telegram, replay
and unwatch. Run full existing suite and repository checks. One hostile review, fix
Critical/High only, one targeted rereview. Medium/Low go to backlog. No broad re-review.

## Next slices (priority, no date promises)

| Slice | Objective | Dependencies | Smallest acceptance | Effort |
|---|---|---|---|---|
| S2 RATS | autonomous evidence-ranked discovery using #19/#36 roles | shared source snapshots, coverage/time correctness | same fixture/coverage yields same explained candidates, zero skill claim | M |
| S3 SHARE | stable deep-link recovery + graphical Telegram receipt | immutable public case/share IDs | new user opens receipt, sees same evidence or unavailable, no private state | M |
| S4 BRIEF | REMEMBER→BRIEF aggregation and attention preferences | finding cursor, dedupe and quiet hours | missed interval aggregates once without old-as-new alerts | M |
| S5 GROUP / RAT DEN | admin opt-in group intelligence | scoped authority, group policy/privacy review | non-admin cannot enable scan; opt-out immediately silences it | M |
| S6 PONS 4663 | current verified Pons source and launch intelligence | fresh ABI/factory receipts, independent finality/index | real supported launch receipt, same hex on Arc stays separate | L |
| S7 HOLDER UTILITY | signed wallet + real balance → extra capacity | verified token launch, #27–29 revalidation, resolver tests | eligible 4663 proof adds slots, stale/replayed proof denied, same facts | L |
| S8 DUMPSTER RAIDS | live evidence rooms around unusual activity | S2–S5, room budget/moderation | opt-in room reconstructs one finding and shares receipt without spam | L |

Future degen layer: non-transferable investigation/receipt reputation; WAKE THE RAT
for evidenced dormant activity; CONVERGENCE for independently observed entities at one
launch (not coordination proof). Discovery, speed and sharing provide excitement.
Trading/signing/sniping, gambling, staking/burns and payment activation are excluded.
Open later decisions: actual holder threshold, prices, retention policy at scale,
Pons finality/adapter, reconciliation UI, group admin model and share art. None blocks S1.
