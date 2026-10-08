# BINRAT — two-case source audit: Base vs zkSync Era; Neon as date-trap

Date: 2026-10-08.
Parent: draft PR #160. Scope: ONE bounded evidence pass, then STOP.
Rule provenance: PR #158 is frozen; no threshold/rule tuning is authorized.

## Research question

Can we **actually verify** a historical explicit blocker -> closure ->
post-closure production execution sequence sufficiently early to warn of
broad public network availability, AND find a comparable L2 production-ready
episode without broad public launch for >=90 days?

**Do not call this an independent holdout. All three project outcomes were
known to the researcher.** This is a *source-admission diagnostic*, not
efficacy validation.

## Candidate A: Base (timely general availability)

**Exact target:** Base first broadly public *application* availability
2023-08-09. Do not confuse it with July 13 developer deployment access or
Aug 3 permissionless bridging. Target-phase equivalence is not settled.

### Chronology from contemporaneous or official sources

1. **May 24, 2023 — explicit prerequisites.**
   Base identified five launch criteria in its official path-to-mainnet
   announcement: Bedrock upgrade, internal/external security review without
   critical issues, testnet stability, and two already complete prerequisites.
   Blog: https://blog.base.org/path-to-base-mainnet
   Date corroborated by May 25 contemporary reporting:
   https://www.theblock.co/post/232158/coinbase-backed-base-targeting-mainnet-launch-after-optimisms-bedrock-upgrade

2. **July 13 — explicit umbrella closure, 27 days before GA.**
   Base said all its launch criteria were met and builder-only mainnet
   deployment access began. This is strong closure *language*, but closure
   of each concrete blocker and independent fix-review artifacts are not
   fully reconstructed.
   https://blog.base.org/base-mainnet-is-open-for-builders

3. **August 3 — verifiable network action candidate, 6 days before GA.**
   Base announced bridge access was live, and announced broad GA for August 9:
   https://blog.base.org/its-onchain-summer-%F0%9F%9F%A1-and-base-is-open-for-bridging

   A distinct explorer-origin Base mainnet receipt shows a successful
   **Bridge to Base NFT mint**, Base block **2143911**, timestamp
   **2023-08-03 15:39:29 UTC**, txn:
   https://basescan.org/tx/0x0ab001315b6ac3504da55224f60e59b6ec9d63924d07d2bf06c32e49264087dc

   The explorer result was discoverable in public indexing, but direct
   explorer open returned HTTP 403 here; independent RPC confirmation,
   raw receipt, block hash, and immutable historical source-body hash are
   **not yet verified**.

   **Hostile interpretation:** a retail NFT mint proves transactions
   were working, *not* that the project performed its own irreversible
   production deployment or activated the system. Moreover, Base was
   already publicly bridge-accessible on August 3. If `PUBLIC_LAUNCH`
   is defined as *first any public usage*, this phase may be POSTLAUNCH
   and ineligible. Do not relabel after scoring to rescue the hypothesis.

4. **August 9 — general app availability.**
   Official source: https://blog.base.org/base-is-open-for-everyone

### Admission verdict

- Real public blocker and closure statements: **YES, qualitatively**.
- Chronology closure -> candidate chain use: **YES, July 13 -> Aug 3**.
- Independent raw on-chain production **commitment** tied to the exact
  target phase (not any transaction): **NOT PROVEN**.
- Exact phase boundary: **AMBIGUOUS** under first publicly usable network.
- Complete timestamped source perimeter + immutable provenance: **NO**.
- **Coverage: PARTIAL; V1 efficacy score: INELIGIBLE.**

**Extra warning:** the official Aug 3 bridge announcement already contained
the exact Aug 9 GA date. Therefore an explicit-date baseline gives the
same six-day warning in this historical example; there is **no observed
incremental predictive information** established for closure analysis.

## Candidate B: zkSync Era (matched L2 hard-delayed control)

**Exact target:** March 24, 2023 broad-public access to Era Alpha, not
October 2022 restricted Baby Alpha.

1. **October 28, 2022**: mainnet system deployed in a restricted Baby Alpha,
   as contemporaneously documented:
   https://www.theblock.co/post/180846/matter-labs-releases-first-phase-of-zksync-2-0-mainnet-called-baby-alpha
2. **December 13, 2022**: published OpenZeppelin L1 diff audit, 16 findings,
   15 resolved, including the critical finding. Scope covered already
   deployed contracts and proposed changes. This is strong V0 P4-style
   audit evidence but **not** proof *every* remaining go-live blocker closed:
   https://www.openzeppelin.com/news/zksync-layer-1-diff-audit
3. **March 24, 2023**: mainnet first opened more widely to public users:
   https://www.theblock.co/news/ecosystems/2023-03-24-zksync-era-first-zkevm-goes-live-in-major-development-for-ethereum-222596

The December 13 audit occurred **101 whole calendar days before**
general-public access (as recorded in the existing hard-negative cohort).
**No independently verified post-closure irreversible production action
within 30 days of that audit has yet been established**, which is NOT a
claim that none occurred. Absence of source search success is NOT a negative
execution observation.

### Admission verdict

- Similar chain category: Ethereum L2 / rollup: **YES**.
- Source-literal production preparation well before public access: **YES**.
- 90+ day historical delay at Dec 13 cutoff: **YES**.
- Independent first-trigger/frozen complete V0 perimeters: **NOT PROVEN**.
- V1 negative prediction justified as no execution: **NO; PARTIAL**.
- **Coverage: PARTIAL; matched-control efficacy score: INELIGIBLE.**

Causal contrast is promising, but a *sample of two chosen with known
outcomes* cannot prove specificity or clock-calibration performance.

## Adversarial date-only sanity check: Neon EVM

This case further falsifies the view that an official scheduled date is
automatically a reliable launch clock.

- **Nov 7, 2022:** official `Dec 12, 2022` launch commitment:
  https://medium.com/neon-labs/neon-evm-set-to-go-live-on-mainnet-welcome-to-a-new-era-of-ethereum-scalability-on-solana-63b25bcc77a3
- **Dec 12:** Neon stated code and production infrastructure were ready,
  but third-party/foundation documentation and arrangements delayed
  actual public launch:
  https://medium.com/neon-labs/neon-evms-mainnet-launch-community-update-eeef3aea02a2
- **July 17, 2023:** eventual mainnet:
  https://www.neonevm.org/blog/2023-was-a-big-year-for-neon-evm

An as-of **Nov 15** date-only replay would consider Dec 12 within 30
days. It would have been a **false 30-day alarm**; the cancellation
was not public until Dec 12. Outcome-first historical diagnosis only,
not a preregistered held-out false-positive-rate statistic.

## One hostile review and stop rule

High-risk failure modes caught:
1. **Action substitution:** Base's independent NFT mint is a real tx but
   does not prove the specific execution-commitment type in V1.
2. **Phase ambiguity:** August 3 bridging vs August 9 general-access
   are different public access levels; avoid cherry-picked launch labels.
3. **Missing-as-negative:** zkSync no documented post-closure action
   does not prove no such action existed.
4. **Retrospective contamination:** cases discovered and assessed with
   future outcomes known are explanatory, never independent validation.

**Result: TWO-PROJECT RESEARCH PASS COMPLETED; VALIDATED PAIR = 0/1.**

No V1 gate or cohort-level metric is evaluated. The exact next evidence
demand is a project-controlled protocol production tx or finalized
genesis with immutable source and independent chain receipt, and a
separate independently source-collected delayed risk-set episode.

Do not build another model to patch the missing facts. Prioritize the
launch product over indefinitely expanding prediction experiments.

No change to V0/V1 live runtime, CI schedule, public feed, token,
wallet, trading, signing, deployment or merge permissions.
