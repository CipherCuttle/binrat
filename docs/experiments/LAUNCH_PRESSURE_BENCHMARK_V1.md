# BINRAT Launch Pressure Benchmark V1

Date: 2026-10-07

## Question

Can the **frozen** Launch Pressure V0 rule distinguish recent production preparation from:

1. the same successful projects months earlier; and
2. serious projects that are still delayed / not publicly launched?

This benchmark does **not** change the V0 state machine or thresholds.

## Frozen rule under test

Signal families and transitions are inherited unchanged from `LAUNCH_PRESSURE_V0.md`.

Pressure-imminent means:

- `PRODUCTION_PREP`; or
- `ARMED`.

The benchmark does not score generic GitHub activity, funding, social announcements, or ordinary testnet work as launch pressure.

## Coverage gate

Historical absence is dangerous:

> no receipt found != no receipt existed.

Every project therefore has evidence coverage:

- **VERIFIED** — the searched public evidence surface is sufficient to score the frozen pressure rule.
- **PARTIAL** — evidence is incomplete or a candidate receipt requires interpretation beyond its source.

PARTIAL projects remain in the frozen cohort but are excluded from efficacy metrics.

This prevents crawler/search gaps from manufacturing true negatives or false negatives.

## Cohort

The original 20 historical launchers are retained.

Current coverage:

- 7 VERIFIED
- 13 PARTIAL

Verified launchers:

- Taiko
- Aleo
- Celestia
- Avail
- Movement
- Story
- Aptos

Two current unresolved controls are VERIFIED for the 90-day control cutoff:

- Fhenix / CoFHE
- Xeris

Converge is retained as PARTIAL because public delayed-launch evidence exists but no authoritative public code surface was frozen for P1-P6 coverage.

## Preregistered replay points

For each VERIFIED launcher:

- 180 days before launch — early negative
- 45 days before launch
- 30 days before launch
- 14 days before launch
- 7 days before launch

For each VERIFIED unresolved control:

- score at `observedThrough - 90 days`
- require public evidence that no launch occurred through `observedThrough`

This makes the control label chronology-safe: at least 90 days of future non-launch outcome is available for scoring, while the detector receives only evidence at or before the cutoff.

## Frozen result

| Replay | TP | FN | Recall |
| --- | ---: | ---: | ---: |
| 45d before launch | 1 | 6 | 14.3% |
| 30d before launch | 1 | 6 | 14.3% |
| 14d before launch | 5 | 2 | 71.4% |
| 7d before launch | 5 | 2 | 71.4% |

Early launcher temporal negatives:

- 180d false positives: **0 / 7**
- temporal FPR: **0%**

Verified unresolved controls:

- false positives: **0 / 2**
- external-control FPR: **0%**

## Important failure

The preregistered medium-horizon target was:

- 45-day recall >= 80%
- 180-day temporal FPR <= 15%

V1 result:

- 45-day recall = **14.3%**
- 180-day temporal FPR = **0%**

Therefore:

> **The frozen Launch Pressure V0 rule fails as a 45-day launch detector.**

Do not tune the threshold against this cohort.

## What survived

The rule remains much more selective than Scout:

- no verified launcher false-positive at 180 days;
- no verified unresolved control false-positive at the 90-day control cutoff;
- pressure clusters strongly in the final two weeks for 5 of 7 verified launchers.

The honest product interpretation is currently:

```text
SCOUT
months-early serious-project discovery
        ↓
WATCH
        ↓
PRESSURE V0
late production-transition evidence
        ↓
TRIPWIRE
```

Pressure V0 is better treated as a **late trigger** than a medium-horizon predictor unless a future out-of-sample rule earns otherwise.

## State decay finding

Movement is `PRODUCTION_PREP` 14 days before launch but decays to `HARDENING` 7 days before launch because an older signal family ages out of the 60-day window and no newer receipt in that family was frozen.

This is preserved intentionally.

It may mean either:

1. the state machine correctly models stale evidence; or
2. the evidence collector is missing refresh events and state decay is too aggressive.

Do not resolve that by forward-filling state after observing the outcome. It must be tested with better receipt coverage or a separately preregistered state model.

## Control weakness

The two VERIFIED external controls are useful but not yet hard enough:

- neither is `PRODUCTION_PREP` at its 90-day cutoff;
- therefore 0% external-control FPR does **not** establish strong specificity against projects that emit multiple production-like signals and still delay.

The next negative cohort should intentionally seek **hard delayed controls**:

```text
>= 2 distinct P1-P6 families at time T
AND
no public launch during T..T+90d
```

Historical delay episodes are acceptable and may be better than waiting for currently unfinished projects.

## Verdict

- evidence schema: **PASS**
- chronology / leakage controls: **PASS**
- 45-day imminence hypothesis: **FAIL**
- late-trigger hypothesis: **PROMISING, NOT PROVEN**
- population precision: **UNKNOWN**
- profitability / investment alpha: **NOT TESTED**

## Next falsification gate

Keep V0 thresholds unchanged.

1. improve evidence coverage for the 13 PARTIAL launchers without interpreting ambiguous artifacts;
2. build >= 10 hard delayed controls with >=2 pressure families and 90 days of subsequent non-launch;
3. rerun the same 45 / 30 / 14 / 7 horizons;
4. only after that, preregister a V1 state model if evidence falsifies V0 mechanics;
5. compare any V1 model out-of-sample against the frozen V0 baseline.

## Authority boundary

Offline deterministic experiment only.

No production crawler, deploy, signing, token action, fund movement, merge, or launch authority is granted.
