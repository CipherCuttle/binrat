# BINRAT — Launch Convergence V1 preregistration

Date frozen: 2026-10-08
Branch: `experiment/binrat-launch-convergence-prereg-v1`
Parent: PR #156 (`experiment/binrat-hard-delayed-controls-v1`)
Authority: **research contract only — no Pressure V1 evaluator or runtime integration**.

## Decision motivating this experiment

Pressure V0 distinguishes engineering maturity but fails as a general launch clock:
- 45-day recall was 2/7 in the coverage-verified historical cohort.
- Five *adversarially selected* delayed controls triggered V0 `PRODUCTION_PREP` but did not publicly launch for 100–509 days.
- Those five controls are **development examples only** and MUST NOT be reused to estimate V1 success.
- Neither benchmark establishes an unbiased market false-positive rate, real-time precision, token profitability or launch prediction.

**Hypothesis H1:** explicit closure of previously documented, launch-target-specific blockers *followed by* independently verified production execution is more selective for a public launch within 30 days than V0's two-family maturity rule, while retaining useful 14-day recall.

**Null / kill hypothesis:** the sequence is too rare, too late, unverifiable, or also appears months before launch, offering no useful improvement over V0.

## Frozen evidence categories (do not widen after outcomes)

- `READINESS`: testnet, code freeze, audit, RC, generic mainnet configuration, genesis draft, or production infrastructure prepared. Never enough alone.
- `OPEN_BLOCKER`: an explicitly stated and still outstanding requirement for **this public launch target**. Allowed classes: security remediation, governance approval, release operations, validator/genesis coordination, production infrastructure, external integration, distribution readiness.
- `BLOCKER_CLOSED`: dated **explicit** closure of a previously observed OPEN_BLOCKER for the same target/blocker ID. "Audit is complete", generic bug-fix commits and silence do not count.
- `EXECUTION_COMMITMENT`: a target-specific production event with independent external verification (canonical finalized genesis/validator set, on-chain funded/deployed production contract with chain/tx/addresses, live production activation restricted before public access). Configuration files, dry-runs, placeholders, unsigned plans and testnet deployments do not count.
- `PUBLIC_LAUNCH`: separate outcome label **never** available to the predictor. Token listing / TGE or restricted internal alpha is not automatically the public usable network; phased launches require one predeclared user-facing target.

All evidence must contain: `projectId`, `targetId`, `observedOn`, `publishedOn`, `kind`, `sourceRef`, `sourceOrigin`, `sourceHash`, and for closures `blockerId`, for execution `executionKind` with transaction/chain or immutable artifact coordinates. Every purported receipt must be inspectable as-of the observation date. For commits and web pages, publication time is not assumed equal to internal authored timestamp.

## Frozen prototype decision rule — specification only

At cutoff T, predict **CONVERGENCE_CANDIDATE** for 30-day public launch *only if all are true*:

1. Source-literal, target-matched OPEN_BLOCKER exists at or before T; every publicly documented blocker known by T has an explicit corresponding BLOCKER_CLOSED receipt by T. **No blocker found is UNKNOWN, not closed.**
2. The most recent required blocker closure occurs **strictly before** a qualifying EXECUTION_COMMITMENT; closure-to-execution lag is at most **30 calendar days**.
3. Execution is verifiable by an authoritative artifact **and** at least one independent source origin; do not count two mirrors of the same announcement as independence.
4. Execution is no older than **30 calendar days** at cutoff T. No intervening reopened blocker is still unresolved at T.
5. Execution is for the **same targetId and public-launch phase**, not a predecessor production chain, migration, devnet, testnet, or unconnected token TGE.
6. The target was **not publicly launched** at or before T; launch-day or later evidence cannot enter the prediction.

Otherwise record `NO_CONVERGENCE_SIGNAL` when evidence coverage is VERIFIED, or `INSUFFICIENT_EVIDENCE` when coverage is PARTIAL. Never turn missing public-source coverage into a true negative. This is deliberately a narrow candidate. Its recall might be near zero, which would kill the claim.

"Execution commitment" is **costly to reverse**, not literally physically irreversible. Retrievable code without a public on-chain action is insufficient.

## Holdout freeze and leakage controls

The exact **12 named project targets** are sealed in `test/fixtures/launchConvergenceHoldoutV1.ts` and guarded against duplicates and overlap with the prior benchmark cohorts. The roster contains only identity/target class/target label; it contains **no launch date, outcome, pressure scores, or signal receipts**.

This is a **curated, project-disjoint historical holdout**, NOT a random market sample and NOT genuinely blinded to general public knowledge that some named projects launched. Only the *new V1 evidence coding* and score must be outcome-masked.

Collection protocol:
1. Freeze roster, rule, thresholds, and protocol before looking up new target-specific blocker/action evidence.
2. For each project, define its public-usable-network target and evidence-source perimeter without changing the target after seeing scoring.
3. Two-pass collection: (A) collect timestamped evidence up to each cutoff without viewing outcome-label fields; lock receipts and coverage; (B) separately verify first public launch or observation-through date from authoritative sources, then join labels.
4. Only accept public information available by each cutoff. Backdated commits, updated articles, republished audits, and later GitHub tags cannot be backfilled into historical decisions.
5. Cases with ambiguous phased activation, target substitution, deleted/inaccessible records, or insufficient evidence are marked PARTIAL and remain in the frozen roster.
6. Record all exclusions and source searches, including failed searches. Never replenish weak cases with newly discovered winners without a **new preregistration**.
7. Evaluator and outcome labeler must be logically separated; replay uses date-filtered evidence, not the project's future outcomes.

This protocol needs independent held-out delayed **project episodes** in addition to historical launchers. Within the sealed roster, freeze at most one 90-day delayed-control anchor per project: first qualifying V0 `PRODUCTION_PREP`/ `ARMED` observation strictly before the public launch, if any, followed by >90 days of non-launch; or first qualifying anchor on a still-unlaunched verified project. An anchor is chosen **by first V0 trigger**, not by inspecting whether the V1 rule fails. If fewer than five V0-positive delayed anchors are available, the claimed false-clock reduction is `INSUFFICIENT_DATA`.

The 12-target pool is mostly rollups (10 rollup targets, 2 other chain/appchain targets). Conclusions may not be transported to L1s or token launches.

## Scoring points and outcomes

For VERIFIED historical launch targets, replay at `launchOn - [180,90,45,30,14,7]` UTC calendar days. The receiver sees only evidence available up to each cutoff. A prediction is a 30-day forecast: launch within **0–30 days** after cutoff counts as a positive outcome; >30 days is negative. Never censor 31–89 day delays to make precision look better.

At each delayed-control trigger, label false clock only if >=90 complete days of subsequent public non-launch are verified. Unresolved right-censored projects require verified observation-through date; less than 90 days => PARTIAL. Report the 31–89 day subgroup separately. Count projects, not individual correlated replay snapshots, as the primary unit.

**Baseline**: run frozen Pressure V0 on precisely the same receipts-as-of-T and targets; NEVER modify V0 on this branch.

Publish at minimum:
- 14-day recall per VERIFIED launcher project: convergence candidate at T=launch-14.
- 30-day recall per VERIFIED launcher project: T=launch-30.
- delayed-control false clocks: counts for V1 and V0 on the exact same preregistered anchors.
- reduction in false clocks relative to V0, along with exact numerator/denominator.
- source coverage VERIFIED/PARTIAL for every case, failure-mode table, median advance warning among true positives.
- episode-level examples, never pseudo-independent case confidence intervals from six snapshots per project.

## Frozen decision gates and STOP criteria

Do not market/promote the model or implement production integration unless all conditions hold:

1. >=8 / 12 holdout launchers VERIFIED; >=4 distinct VERIFIED delayed project controls and >=5 V0-positive delayed anchors.
2. V1 14-day recall >=60% **and** no more than 10 percentage points below V0 14-day recall on the identical holdout.
3. V1 false-clock count >=50% below V0 at the same delayed-control anchors.
4. No point-in-time leakage, ambiguity relabeling, target mismatch, future-date access, missing-source-as-negative, or retroactive threshold tuning.
5. A second independent forward or genuinely prospective cohort will still be required before claiming real-world precision or launch predictive power.

Failure of (1) => `INSUFFICIENT_DATA`, not `PASS`. Failure of (2) or (3) with adequate verified evidence => `FAIL`. Passing gates gives only `PROMISING_OFFLINE`, **not production authorization**.

If the strict closure+execution rule yields zero or very few alerts, report its failure. Do not rescue it by weakening closure, reducing independent-origin requirements, or substituting launch-day actions.

## Current scope, stop, and authority

This PR **only** freezes the rule, project roster and validation of roster boundaries. It deliberately contains:
- no historical V1 receipts or labels,
- no scoring engine,
- no detector threshold tuning,
- no public predictions,
- no production crawler or bot integration.

Workflow: PLAN -> CHANGESET -> VERIFY -> VERDICT.
Implementation: IMPLEMENT -> TEST -> ONE hostile review -> fix Critical/High -> ONE targeted rereview -> STOP.

No merge, deploy, signing, broadcast, token launch, wallet action or public claims without explicit owner authority.
