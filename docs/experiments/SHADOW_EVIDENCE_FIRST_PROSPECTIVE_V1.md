# BINRAT — independent evidence track / prospective seed (2026-10-08)

Parent draft: PR #159 (launch convergence evidence inventory).
This is a research-only continuation. No V0 mutation, V1 preregistration tuning,
token action, marketing promise, runtime crawler, autonomous scheduler or deploy.

## Problem found in hostile review

The retrospective PR #159 inventory read outcome dates **before** locking
cutoff-indexed prelaunch receipts. Its 12 projects are also launch-selected,
not a sampled at-risk population. Even perfect replay code cannot cure human
outcome exposure or selection bias.

**Do not assert an independent blinded benchmark was run.**
Instead, establish new forward-registered projects and a comparator rule with
distinct source and outcome channels.

## Strong, simple competing baseline

An explicit first-party, dated public mainnet announcement can be an
earlier / stronger event than a complicated blocker-closure reconstruction.

Primary historical illustration (NOT score):
- Arc dated its public mainnet for **September 16, 2026** in a public
  **August 5, 2026** announcement:
  https://www.arc.io/blog/arc-mainnet-goes-live-on-september-16-2026
- Arc later confirmed it was live **September 16**:
  https://www.arc.io/blog/arc-economic-os-internet
- At a hypothetical September 2 as-of, a truly point-in-time captured
  announcement would signal a launch within **14 days**.
- Publication labels are taken from today's public pages. We have **not**
  proven an immutable historical capture or complete retraction history.
  Therefore this is **illustration, not VERIFIED historical efficacy**.
- Never send this later launch confirmation to the as-of detector.

The experimental dated-announcement baseline is separate from frozen
Pressure V0 and blocker-closure V1. New rule is **exploratory** and cannot
retroactively count toward PR #158's preregistered success criteria.

Rule: accept first-party explicit YYYY-MM-DD for the exact public-network
phase, available at/before cutoff; respect date changes and cancellations;
suppress unknown coverage, future publication, expired dates and conflicting
same-day announcements. Trigger at 1–30 whole UTC calendar days before
the scheduled date. It does not claim the date will actually be met.

## Prospective target enrollment — no post-hoc backfill

Seed freeze date UTC: **2026-10-08**.

| Project | Exact target | Public source | Status |
| --- | --- | --- | --- |
| Logos | first publicly usable Logos mainnet | https://logos.co/roadmap | PARTIAL: roadmap shows testnet v0.3 live, mainnet planned H1 2027 |
| Miden | first broadly publicly usable Miden mainnet | https://github.com/0xPolygonMiden | PARTIAL: GitHub org still advertises public testnet; current mainnet status not exhaustively verified |
| Rialo | first broadly publicly usable Rialo mainnet | https://rialoscan.org/ | PARTIAL: explorer says mainnet not live, but canonical origin and timestamp need verification |

**This three-project pilot is a feasibility seed, not the 8+4 project
efficacy sample or a statistically meaningful balanced holdout.** No
assertion that a source proves absence of launch without a complete
source perimeter. The registry is frozen before any future outcome
is observed. No project will be replaced just because it launches late
or source evidence is inconvenient.

## Source-first daily snapshot protocol (NOT activated)

For each frozen project and each observation date:
1. Capture raw first-party page, GitHub commits, releases, governance and
   public explorer/chain responses with `retrieved_at`, `content_sha256`,
   stable reference, response status and exact target.
2. Store source bytes and hashes *before* adding any semantic labels.
   Current tool results alone do not establish immutable historical content.
3. Derive possible P1–P6, OPEN/CLOSED/ACTION or dated-schedule claims with
   direct source-literal spans and independent reviewer confirmation.
4. Record coverage limitations, negative source searches and target-phase
   ambiguity. `PARTIAL` cannot become "no launch within 30d".
5. Freeze evidence and scorer outputs for each observation date **before**
   observing a future launch. Record prediction as hashable append-only
   event. Do not overwrite previous snapshots as pages evolve.
6. After 30 days label 30d outcome; after 90 days label longer delays
   and V0-positive false clocks. Include cancelled and delayed launches,
   not merely winners.
7. Compare frozen V0, preregistered V1 and exploratory date-only baseline
   **on identical source perimeters** and project-level units. Treat
   ambiguous/censored episodes separately. Report missing coverage.

No automated monitoring, CI schedule, production service, or public alerts
are enabled by this PR. One bounded external collection/pilot can be
authorized separately; no inference of broad runtime authority.

## Admission / kill gate

For immediate value, the next *manual* test should establish **one**
project with a real, source-hashed OPEN -> CLOSED -> production action
sequence strictly *before* public launch, and **one** appropriately matched
delayed control using the same source-collection protocol.

If no such positive is found after bounded review, record the source
availability bottleneck. Do **not** create another scoring engine or
broaden V1 P4/closure definitions to rescue recall.

The 14-day recall >=60%, delayed alarm reduction >=50%, and minimum verified
cohort counts remain exactly the frozen PR #158 gate. This exploratory
baseline makes no changes to those registered thresholds.

## Verdict

- Historical Arc case: **ILLUSTRATIVE** explicit-date signal, no blinded efficacy.
- Prospective registry: **3 seeded / 0 coverage-VERIFIED**.
- V0 vs V1 causal performance: **UNKNOWN**.
- The unobserved question: does closure + verified production execution
  contribute information beyond public official launch-date commitments?
- Production or investing use: **NOT AUTHORIZED**.
