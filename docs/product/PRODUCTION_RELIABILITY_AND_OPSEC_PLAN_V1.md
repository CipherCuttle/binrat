# BINRAT Production Reliability & OPSEC Plan V1

**Date:** 2026-09-30  
**Status:** frozen planning contract  
**Integration target:** PR #63 / `codex/telegram-as-code-private-v2`  
**Incident evidence:** PR #64 (launch identity), PR #65 (Pons catch-up/retry)  
**Merge authority:** NONE  
**Public Rat authority:** NONE  
**Token/Holder/payment/trading authority:** NONE

## 1. Decision

Freeze the proven Pons recovery design while it is making net progress and no integrity invariant is violated.

The critical product path stays bounded:

```text
Pons full health
→ port proven #64/#65 permanent changes into #63
→ full #63 regression
→ private Telegram UX V2 deploy
→ owner mobile acceptance
```

Do not require the later public-reliability work to finish before the private owner test.

After private acceptance, complete one bounded Production Reliability + OPSEC sprint before broad public beta.

## 2. Frozen invariants

1. **One Pons writer.** Exactly one authority may advance the Pons checkpoint.
2. **Canonical before derived.** Launch/block/event truth is committed before provenance, Radar, WATCH or UI projections can claim it.
3. **Integrity != availability.**
   - integrity failure: stop mutation;
   - transport/availability failure: retain the last canonical checkpoint, mark health degraded/fail-closed, and retry within a bounded policy.
4. **At-least-once is assumed.** Queue messages may be redelivered; persistence and delivery actions must remain idempotent.
5. **No checkpoint skip.** A checkpoint advances only through a fully verified contiguous range.
6. **Batch-scoped RPC authority.** A committed canonical batch uses one selected provider authority. Mid-batch provider failure aborts the uncommitted attempt.
7. **Freshness is evidence.** Stale/catching-up data cannot masquerade as current.
8. **Recovery has narrow authority.** Recovery code cannot enable public Rat, Holder gate, wallet authority, payment/trading or token launch.
9. **Release provenance is exact.** Exact reviewed SHA → dark candidate → binding/schema/integrity verification → promotion or rollback.
10. **No infrastructure expansion without evidence.** Prefer the bounded Worker/D1/Queue architecture until measurement proves it insufficient.

## 3. Literature-backed design principles

These references are guidance, not BINRAT runtime authority.

### Retry and overload

Google SRE, *Addressing Cascading Failures*:
https://sre.google/sre-book/addressing-cascading-failures/

Use:
- bounded retry;
- classify retriable vs non-retriable failures;
- exponential backoff and jitter;
- avoid retry amplification across layers.

AWS Well-Architected, *Limit retries*:
https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_mitigate_interaction_failure_limit_retries.html

Use:
- small low-level retry count where higher layers also retry;
- exponential backoff/jitter;
- explicit retry limits.

### Tail latency / redundant reads

Dean & Barroso, *The Tail at Scale*:
https://research.google/pubs/the-tail-at-scale/

Use targeted redundant/witness reads for cheap head/health probes. Do not indiscriminately duplicate large historical `eth_getLogs` requests.

### Queue semantics

Cloudflare Queues delivery guarantees:
https://developers.cloudflare.com/queues/reference/delivery-guarantees/

Assume at-least-once delivery and design every critical consumer for duplicate execution.

Cloudflare Queue retries:
https://developers.cloudflare.com/queues/configuration/batching-retries/

Use attempt-aware delayed retries rather than one fixed retry interval forever.

Cloudflare dead-letter queues:
https://developers.cloudflare.com/queues/configuration/dead-letter-queues/

Terminal failures must remain inspectable/replayable rather than disappearing after max retries.

### Durable message publication

AWS transactional outbox pattern:
https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html

D1/outbox state remains authority; queues wake processors. Do not make a critical user delivery depend on a fragile DB-write + independent direct-message-send dual write.

### Robinhood RPC

Robinhood Chain connection guidance:
https://docs.robinhood.com/chain/connecting/

Use managed production infrastructure/archive capability for indexing workloads. Public RPC is a diagnostic/fallback witness rather than the sole production dependency.

### D1 recovery

Cloudflare D1 Time Travel:
https://developers.cloudflare.com/d1/reference/time-travel/

Record pre-mutation recovery coordinates. Do not automate destructive restore.

Cloudflare D1 batch transactions:
https://developers.cloudflare.com/d1/worker-api/d1-database/

Use transactional batches when several mutations form one logical unit.

### CI/CD and supply chain

GitHub Actions secure use:
https://docs.github.com/en/actions/reference/security/secure-use

Pin third-party Actions to full commit SHAs and minimize workflow token permissions.

OWASP CI/CD Security Cheat Sheet:
https://cheatsheetseries.owasp.org/cheatsheets/CI_CD_Security_Cheat_Sheet.html

Treat CI/CD as privileged production infrastructure.

NIST SSDF SP 800-218:
https://csrc.nist.gov/pubs/sp/800/218/final

Treat build/release integrity as part of the product's software supply chain.

## 4. Failure taxonomy

### 4.1 Integrity — immediate hard stop

Examples:

```text
PONS_CHAIN_ID_DRIFT
PONS_FACTORY_AUTHORITY_DRIFT
canonical block/hash mismatch
LAUNCH_IDENTITY_CONFLICT
checkpoint regression
unverifiable/deep reorg
D1 invariant failure
binding target drift
release SHA mismatch
```

Required behavior:

```text
do not advance checkpoint
do not serve affected evidence as current
do not automatically downgrade the error into a transport retry
surface operator-visible failure evidence
```

### 4.2 Availability — bounded retry/degradation

Allowlist examples:

```text
timeout / ETIMEDOUT
HTTP 429
HTTP 502
HTTP 503
HTTP 504
temporary provider/Queue availability
```

Required behavior:

```text
checkpoint remains at last canonical commit
runtime readiness fails closed
bounded transport retry
Queue retry with attempt-aware backoff/jitter
persistent failure → DLQ/operator state
successful retry → clear transient failure and continue
```

Unknown errors are never implicitly retryable.

## 5. Target architecture

```text
                 ROBINHOOD CHAIN
                       │
          ┌────────────┴─────────────┐
          │                          │
  managed/archive primary    independent secondary
          │                          │
          └──── cheap head witness ──┘
                       │
                       ▼
                PONS INDEX QUEUE
                exactly one writer
                       │
                canonical batches
                       │
                       ▼
                      D1
       ┌───────────────┼────────────────┐
       │               │                │
 canonical launches   provenance     durable outbox
       │               │                │
       ▼               ▼                ▼
   public API      intelligence queue   delivery queue
                                        │
                                        ▼
                              Telegram / Mini App

terminal asynchronous failures
                ↓
            OPS DLQ
```

## 6. Execution phases

### F0 — Current recovery

**Rule:** do not retune the proven catch-up loop while all are true:

- checkpoint advances across expected Queue opportunities;
- backlog trend is down;
- no integrity failure;
- source authority remains verified;
- runtime freshness is current.

Final acceptance requires two consecutive samples:

```text
chainId = 4663
sourceVerified = true
lastSyncError = null
indexReady = true
liveCaughtUp = true
checkpoint >= target
runtimeFresh = true
```

Then perform the existing row-count/uniqueness/cross-chain/invariant checks.

### F1 — Release consolidation

PR #64 and #65 remain incident evidence.

Do not merge them sequentially into the product stack.

Port onto PR #63 only the permanent proven changes:

- timestamp-safe launch identity authority;
- Pons transport hardening;
- bounded catch-up mode;
- Pons lease fencing/duration fix;
- canonical verification concurrency;
- deferred-but-equivalent provenance projection;
- runtime configuration required by the proven algorithm;
- permanent correctness/resilience tests.

Do not port unless independently justified:

- incident-specific launch IDs;
- frozen historical checkpoint constants;
- one-off recovery confirmation strings;
- temporary incident deployment scripts/classifiers.

PR #63 becomes the canonical release candidate.

### F2 — Private Telegram product

Run full:

- `pnpm check`;
- TypeScript/build;
- web and Mini App checks;
- Cloudflare dry-run;
- Pons regression suite;
- Telegram auth/callback/idempotency tests.

Update the exact reviewed-SHA deployment gate.

Deploy only:

```text
BINRAT_AUTONOMOUS_RAT_ENABLED=true
BINRAT_TELEGRAM_UI_V2_ENABLED=true
BINRAT_TELEGRAM_MEDIA_ENABLED=true
BINRAT_AUTONOMOUS_RAT_PUBLIC_ENABLED=false
controlled tester only
```

Verify webhook unchanged, Mini App auth server-side, forged identity rejected, media/cards working and smoke receipt created.

### F3 — Owner mobile acceptance

Exercise on real Telegram/mobile:

```text
HOME
→ RATS
→ DIG
→ WHY / FULL RECEIPT
→ WATCH
→ WATCHES
→ SHARE
→ OPEN RADAR / OPEN CASE
```

Verify:

- correct Rat image/state;
- edit-in-place card behavior;
- ForceReply isolation;
- duplicate WATCH/SHARE idempotency;
- stale callbacks fail closed;
- complete evidence remains accessible;
- Mini App locked outside authenticated Telegram context where expected.

Fix Critical/High product defects only; one targeted re-review.

## 7. Public reliability hardening

### F4 — RPC authority

Introduce:

- managed archive-capable primary;
- independent secondary/witness;
- public Robinhood RPC for diagnostic witness only.

Policy:

1. cheap head/chain/factory verification;
2. select one provider authority for the work unit;
3. perform canonical reads using that authority;
4. failure before commit aborts the batch;
5. later attempt may select the secondary.

Never use "largest reported head wins" as truth.

Acceptance test: kill/fail primary; no bad checkpoint; later secondary cycle can continue safely.

### F5 — Queue isolation

Split scheduling/failure domains while preserving handlers:

```text
binrat-pons-index-v1
  PONS_SYNC_CYCLE
  concurrency/write authority = 1

binrat-intelligence-v1
  Arc / observations / Radar enrichment

binrat-delivery-v1
  WATCH/outbox/Telegram delivery
```

Pons backlog must not materially delay delivery jobs.

D1 remains authority. Queues schedule work.

### F6 — Retry + DLQ + idempotency

Create explicit retry class helpers.

Queue retry should be attempt-aware with exponential backoff + jitter and a hard maximum.

Add a DLQ with sanitized envelopes only.

DLQ requirements:

- count visible;
- oldest item age visible;
- error class visible;
- manual/bounded replay path;
- replay passes normal authority/idempotency checks.

Audit every critical Queue handler under duplicate redelivery.

### F7 — Observability / service state

Keep platform-native observability initially.

Track:

```text
release SHA
checkpoint
target
block backlog
checkpoint velocity
head velocity
catchup/head ratio
last canonical commit time
consecutive transport failures
Queue backlog
oldest Queue item age
DLQ count
current derived state
```

Derive states:

```text
LIVE
CATCHING_UP
RETRYING
DEGRADED
STALE
INTEGRITY_FAILURE
```

Endpoints:

- `/health` = liveness;
- `/api/health` = diagnostic truth;
- optional `/api/ready` = explicit product-readiness projection.

Do not add a D1 migration solely to store the enum if it can be derived from existing canonical fields.

### F8 — D1 disaster recovery

For every mutation-bearing deployment:

1. capture pre-mutation D1 Time Travel bookmark/recovery coordinate;
2. record current Worker version and release SHA;
3. record exact migration ID/hash;
4. apply only the intended migration;
5. verify resulting schema/state;
6. record candidate/promoted Worker version.

Normal rollback should prefer backward-compatible code rollback.

D1 Time Travel restore is explicit incident authority only; never automatic.

### F9 — CI/CD OPSEC

- pin GitHub Actions to full immutable commit SHAs;
- retain minimum workflow permissions;
- narrow Cloudflare deployment token/resource scope;
- retire interactive/device-login production deployment paths;
- maintain one canonical candidate/promote/rollback path;
- keep secrets out of logs/artifacts;
- require exact reviewed SHA for privileged production actions;
- retain separate explicit authority for public activation.

### F10 — Permanent resilience gate

Build one durable fault-injection suite.

Minimum cases:

| Injected failure | Required result |
|---|---|
| same launch, later observedAt | DUPLICATE |
| canonical launch field mutation | hard fail |
| Queue duplicate delivery | no duplicate mutation/delivery |
| RPC timeout once | retry/degraded, checkpoint unchanged |
| 429/503 once | retry/degraded |
| persistent transport failure | bounded retry → DLQ |
| provider head disagreement | no mutation |
| chain/factory drift | hard fail |
| reorg inside range | no invalid checkpoint |
| worker failure after DB commit before ACK | redelivery safe |
| lease expiry/stale owner | stale owner cannot mutate/release replacement |
| D1 write failure mid-unit | checkpoint not advanced |
| deferred provenance | exact final equivalence |
| large Pons backlog | delivery scheduling unaffected after queue split |

Run this gate for release candidates that modify chain truth, persistence or queue semantics.

### F11 — Public canary

Use a bounded public cohort/feature gate.

Acceptance should measure observed behavior, not arbitrary vanity SLOs:

- canonical freshness stable;
- WATCH delivery acceptable;
- Queue/DLQ behavior healthy;
- no Critical/High incident;
- no hidden public activation drift.

### F12 — Public beta

Open more broadly only after F4–F11 pass.

Token launch, Holder utility, payment/trading and legal authorization remain a separate control plane and are not implicitly advanced by public product readiness.

## 8. Red-team decisions frozen into the plan

### Provider failover attack

**Risk:** mixed-provider canonical batch.

**Decision:** batch-scoped authority; abort uncommitted work before provider switch.

### Queue split attack

**Risk:** DB mutation succeeds but message publication fails.

**Decision:** D1/outbox is authority; queues wake processors. Preserve transactional-outbox semantics for critical delivery.

### DLQ attack

**Risk:** DLQ becomes invisible graveyard.

**Decision:** DLQ count/age/reason are operational health inputs and replay is tested.

### Retry attack

**Risk:** layered RPC × Queue retries amplify outages.

**Decision:** one bounded transport retry, bounded attempt-aware Queue backoff/jitter, hard terminal limit.

### DR attack

**Risk:** automatic Time Travel rollback destroys valid newer data.

**Decision:** record recovery coordinates automatically; restore requires explicit incident authority.

### Scope attack

**Risk:** infrastructure hardening blocks product validation indefinitely.

**Decision:** F0–F3 private product finish line is separate from F4–F12 public reliability finish line.

### Complexity attack

**Risk:** solve a small Worker product with an unnecessary distributed platform.

**Decision:** explicitly reject Kubernetes/Kafka/Redis/self-hosted archive infrastructure until measurement proves the bounded architecture insufficient.

## 9. Release/PR policy

- #63: intended integrated private release candidate.
- #64: identity incident evidence.
- #65: throughput/retry incident evidence.
- Do not merge #64/#65 as a shortcut.
- Port verified permanent changes onto #63.
- Keep incident receipts available for audit/history.
- Close superseded incident PRs only when explicitly authorized.
- No merge, public activation or token action is authorized by this document.

## 10. Completion criteria

### Private owner test ready

```text
Pons full health
#63 contains permanent incident fixes
full tests/dry-run green
private Telegram deployment green
public Rat false
owner can use cards/media/Mini App on phone
```

### Public beta architecture ready

```text
managed RPC authority policy tested
queue failure domains isolated
DLQ + retry/idempotency tested
operational state observable
D1 recovery receipt/runbook verified
CI/CD supply-chain hardening complete
permanent resilience suite green
bounded public canary green
no open Critical/High
```

## 11. Verdict

The architecture is frozen around a small number of durable ideas:

**one canonical writer, explicit evidence authority, idempotent at-least-once processing, bounded transport recovery, isolated failure domains, reversible releases and exact provenance.**

Do not add another infrastructure category before public beta unless new evidence demonstrates a concrete blocker.
