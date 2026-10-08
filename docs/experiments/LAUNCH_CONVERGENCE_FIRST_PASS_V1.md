# BINRAT launch convergence — frozen holdout first-pass evidence inventory

Date: 2026-10-08.
Base: launch-convergence preregistration PR #158.
Purpose: historical outcome-source inventory and **synthetic rule-replay tests**.
This is not a completed performance benchmark; it cannot establish model effectiveness.

## Source perimeter and exact findings

The 12 project identities were already frozen. Research then located **nine candidate public launch days** and found **three phase-ambiguous target labels**. The nine dates are historical **candidate outcomes**, NOT as-of-T prediction evidence or proof of complete prelaunch evidence coverage.

| Target | Candidate public launch date | Label status | Authority/source |
|---|---|---|---|
| Linea | none | PHASE_AMBIGUOUS | restricted partner rollout 2023-07-11; broader ETHCC access; completed mainnet launch 2023-08-16. https://linea.build/blog/linea-completes-its-alpha-mainnet-launch |
| Polygon zkEVM | 2023-03-27 | DATE_CANDIDATE | permissionless public mainnet beta. https://polygon.technology/blog/polygon-zkevm-mainnet-beta-is-live |
| Mantle | 2023-07-17 | DATE_CANDIDATE | official Mainnet Alpha open to everyone. https://www.youtube.com/watch?v=wFcujtseUoE |
| Base | 2023-08-09 | DATE_CANDIDATE | public network availability; prior restricted developer mainnet. https://blog.base.org/base-is-open-for-everyone |
| opBNB | 2023-09-13 | DATE_CANDIDATE | official BNB Chain mainnet. https://www.bnbchain.org/tr-TR/blog/opbnb-mainnet-is-live |
| Blast | 2024-02-29 | DATE_CANDIDATE | independent production oracle confirmation, not earlier deposit campaign. https://www.pyth.network/blog/pyth-price-feeds-launch-on-blast-mainnet |
| Mode | 2024-01-31 | DATE_CANDIDATE | official Mode Sunrise Mainnet. https://paragraph.com/@modenetwork/4dM0wUGlxyS0Um45yLv8 |
| Zora Network | 2023-06-21 | DATE_CANDIDATE | contemporary Zora L2 public launch reports. https://nftnow.com/news/zora-launches-its-own-layer-2-chain-zora-network/ |
| World Chain | 2024-10-17 | DATE_CANDIDATE | official broad public launch. https://world.org/blog/announcements/world-chain-now-open-every-human |
| Unichain | 2025-02-11 | DATE_CANDIDATE | official public mainnet availability. https://blog.uniswap.org/unichain-mainnet-is-here |
| dYdX Chain | none | PHASE_AMBIGUOUS | mainnet genesis 2023-10-26 but full trading authorized 2023-11-28. https://www.dydx.foundation/blog/new-trading-pairs-permissionless-markets-on-the-dydx-chain |
| Hyperliquid L1 | none | PHASE_AMBIGUOUS | 2023-02 closed alpha; subsequent gradual access; no defensible first broad-public day yet. https://hyperliquid.medium.com/hyperliquid-q2-update-7c39c726c45b |

## Prelaunch receipt coverage — PARTIAL for all 12

A valid point-in-time scorer needs:
1. dated **explicit OPEN_BLOCKER** evidence for the same launch target and phase;
2. dated explicit closure of every known blocker by cutoff;
3. a **strictly later** externally verifiable production action with chain/tx/artifact coordinates and independent provenance;
4. publication/observation times, content hashes, source origin, and complete negative search coverage;
5. exactly the same historical primary-source corpus independently typed under frozen Pressure V0;
6. preselected delayed-control anchors chosen on first V0 trigger *before* learning their outcomes.

This first pass researched launch-date/phase evidence and sampled blockers; it **did not** freeze a full point-in-time evidence record for any project. Therefore **all 12 are PARTIAL for the actual causal detector**, regardless of whether a launch date is well documented.

Some useful qualitative case notes:
- Base explicitly published launch criteria (Bedrock upgrade, audits, stability) and later publicly reported their completion, but a matching earlier-than-action closure plus independently verifiable production coordinates have not been frozen. https://blog.base.org/path-to-base-mainnet and https://blog.base.org/base-mainnet-is-open-for-builders
- dYdX had September governance approvals; later network genesis, after which full trading permissions were handled in stages. A governance vote is not automatically proof that **all** blockers were closed. https://www.dydx.foundation/blog/dydx-token-mechanics
- Linea's partner-only mainnet rollout should not be confused with a fully public network launch. https://linea.build/blog/the-next-step-in-lineas-journey-mainnet-alpha-is-here

No fabricated negative receipt or "never saw an action" is scored as a true negative.

## Deterministic replay harness

`src/intelligence/launchConvergenceReplayV1.ts` applies the **frozen prereg rule** to typed evidence (no network calls). Unit tests use clearly synthetic evidence only. It rejects unmatched closures, unresolved/reopened blockers, future publications, same-day ordering, target drift, correlated evidence origins, and stale commitments.

The separate inventory summary deliberately returns `INSUFFICIENT_DATA`. It reports:
- roster 12;
- launch date candidates 9;
- phase/date unresolved 3;
- fully coverage-VERIFIED prelaunch projects 0;
- prelaunch evidence PARTIAL projects 12;
- VERIFIED delayed V0-positive negative anchors 0.

**No real-world V1 recall, V0-vs-V1 false-clock reduction, or live precision is computed.** Zero verified cases does not mean zero real signals or zero false positives.

## Protocol deviation — outcome data seen before receipt freeze

**Important: this first pass violated the ideal two-pass outcome-masking order in PR #158.**
Historical outcome dates for nine projects were gathered before the complete
point-in-time V1/V0 prelaunch receipt corpora were archived and frozen.

This is logged as **OUTCOME_EXPOSURE_BEFORE_RECEIPT_LOCK**, not silently
treated as a compliant blind replay. Recording the labels in a separate
file prevents accidental *runtime* leakage; it does not undo the human
researcher's exposure to future outcomes and possible selection bias.

Consequences:
- No performance estimate from this investigator's subsequently coded
  12-target corpus should be called truly out-of-sample or blinded.
- A separate collector must process primary evidence using a source/cutoff
  manifest that does not reveal launch dates or these candidate labels;
  record all searches/rejections before an independent label join. Even that
  is only partially blinded when events are well-known.
- The only robust non-retrospective validation is genuinely prospective
  shadow observation of projects registered while still unlaunched.
- This draft remains a reproducible **research diagnostic and protocol
  failure report**, not the final 12-target efficacy verdict.

## Hostile methodological finding

The prereg holdout contains **12 projects known historically to have launched**, most on the OP Stack. It is not a representative cross-section of at-risk projects and does not automatically contain the required >=4 separate delayed project controls or >=5 outcome-blind V0-positive delayed episodes. Post-hoc substitution to rescue the benchmark is forbidden.

Even after receipt collection, the false-clock reduction gate could remain **INCONCLUSIVE** because of dataset composition. If it does, freeze a fresh *different* balanced/prospective cohort in a subsequent preregistration; do not quietly amend this cohort.

## Verdict and next stop

**INCONCLUSIVE / INSUFFICIENT_DATA.** Not a failure of the causal hypothesis; a failure to establish adequate coverage in this first-pass research.

To earn evidence:
- complete **as-of-T** source archiving for the predeclared targets, independent blocker/closure verification, actual chain action receipts and full V0-matched corpus;
- define and lock public-access phase labels without tuning scores;
- derive first eligible V0 trigger before opening outcome dates; quarantine failed/partial candidates;
- only then compute preregistered gates.

Research stays read-only. No merge, deployment, autonomous crawling, token action, wallet signing or public prediction claims.
