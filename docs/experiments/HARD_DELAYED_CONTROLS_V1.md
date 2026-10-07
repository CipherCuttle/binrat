# BINRAT Hard Delayed Controls V1

Date: 2026-10-07

## Question

Launch Pressure V0 treats a project as pressure-imminent when recent, distinct production-preparation families cluster strongly enough to reach `PRODUCTION_PREP` or `ARMED`.

This adversarial benchmark asks a deliberately hostile question:

> Can we find projects that satisfy the frozen V0 pressure-imminent rule at time T and still do not publicly launch for at least 90 days?

If yes, the simple interpretation

> pressure-imminent => launch within ~90 days

is falsified.

## Important: this is not a false-positive-rate sample

Controls are selected **because** they are counterexamples to the V0 timing hypothesis.

Therefore this cohort cannot estimate:

- population false-positive rate;
- live precision;
- base-rate-adjusted launch probability;
- investment alpha.

It is an adversarial falsification set.

## Admission rule

A case is admitted only when all of the following are true:

1. all pressure receipts were publicly observable by trigger time T;
2. the unchanged V0 evaluator returns `PRODUCTION_PREP` or `ARMED` at T;
3. the target launch is unambiguous enough to score;
4. no target public launch occurs for at least 90 days after T;
5. historical source wording supports the typed P1-P6 relation without upgrading vague marketing into technical evidence.

No V0 state-machine threshold is changed.

## Target

Planned target: **10 strict controls**.

Strict research pass admitted: **6**.

Target status: **NOT MET**.

The missing four are not backfilled with weaker evidence. A smaller clean falsification set is preferable to a larger contaminated one.

## Frozen controls

| Project | Trigger | Active V0 families | Outcome lag |
| --- | --- | --- | ---: |
| Tari Minotari | 2023-12-14 | P4 audit remediation + P5 release candidate | 509d |
| QRL 2.0 / Zond | 2026-04-03 | P4 audit completion + P5 code freeze | 187d observed, unresolved |
| Shardeum | 2025-01-15 | P4 prior vulnerability remediation + P5 code freeze | 110d |
| ZetaChain | 2023-06-08 | P4 audit fixes + P6 genesis token distribution | 237d |
| Neon EVM | 2022-12-12 | P4 completed audits + P3 production infrastructure | 217d |
| Namada | 2024-08-26 | P4 completed audits + P5 mainnet release candidate | 99d |

Frozen lag summary:

- minimum: **99 days**
- median: **202 days**
- maximum: **509 days**

All six evaluate as `PRODUCTION_PREP` under the unchanged V0 rule.

## Combination result

False-clock combinations:

- `AUDIT_REMEDIATION + RELEASE_CANDIDATE`: **4**
- `AUDIT_REMEDIATION + PRODUCTION_INFRA`: **1**
- `AUDIT_REMEDIATION + TOKEN_DISTRIBUTION`: **1**

The dominant failure is clear:

> **readiness artifacts are not the same thing as clock-closing artifacts.**

An audit can finish while governance, operations, economics, external integrations, market timing, validator coordination, legal work, foundation setup, or another launch gate remains open.

A release candidate or code freeze can exist specifically so those remaining gates can be tested.

Production infrastructure can be technically ready while an organization deliberately does not activate it.

## Structural verdict

The following simple claim is now falsified:

> Two sufficiently recent, distinct V0 pressure families imply launch within 90 days.

Multiple clean counterexamples survive far beyond 90 days.

This does **not** erase the earlier Benchmark V1 result that V0 clustered around the final two weeks for 5/7 coverage-verified launchers.

It means the current V0 state has two different meanings mixed together:

```text
READY-LOOKING
and
ACTUALLY CLOSING LAUNCH GATES
```

Those are not equivalent.

## Rejected / non-admitted candidates

Several tempting candidates were deliberately excluded.

### Sonic

Early public code contains mainnet genesis and bootnode-looking artifacts, but the evidence is entangled with migration from the already-live Fantom/Opera mainnet. Production-target provenance is ambiguous.

### Babylon

The project has phased launch semantics. Bitcoin Staking mainnet phases predate the later Babylon Genesis chain. A single “launch date” would mislabel the target.

### Dusk

Audit-fix evidence is clean, but early mainnet installer configuration used placeholder infrastructure. The frozen V0 hard-family requirement is not cleanly satisfied.

### Avail

Early “prepare mainnet” and dummy mainnet chain-spec work are primarily one P1 family. Telemetry/deployment evidence inspected in the same period was test/dev oriented or otherwise not clean production evidence.

### Massa

Genesis preparation is clear, but the second candidate family did not survive source-literal review.

### Saga

“Mainnet v1” is clear release-oriented work, but a second independent qualifying family was not established.

### Aleo

Audit work is clear, but the exact code-freeze completion date near the 90-day boundary was not established strongly enough for admission.

These exclusions are evidence that the cohort is intentionally conservative.

## What Pressure V1 should test

Do **not** tune V0 against these six cases.

A future V1 should be preregistered around a different causal model:

```text
READINESS
  audit / RC / config / infra
        ↓
OPEN BLOCKERS
  governance / ops / security / integrations / launch dependencies
        ↓
BLOCKER CLOSED
        ↓
IRREVERSIBLE EXECUTION
  canonical genesis
  funded production deployer
  production deployment
  activated validators
  live bridge / production endpoint
        ↓
IMMINENT
```

Candidate concepts for a separately preregistered V1:

1. **OPEN_BLOCKER / BLOCKER_CLOSED receipts**
   - explicit unresolved audit work;
   - delayed external dependency;
   - governance/validator ceremony outstanding;
   - launch gate explicitly reopened or closed.

2. **Canonicality / target provenance**
   - distinguish migration artifacts, testnet configs, placeholders, and old-mainnet state from the actual target launch.

3. **Irreversibility after closure**
   - require an expensive/canonical production action after the last known blocker closes instead of counting static readiness artifacts alone.

4. **Sequence direction**
   - `audit complete -> RC` is not enough;
   - `last blocker closed -> canonical production action -> production network activation` is a stronger causal sequence.

5. **Negative evidence**
   - an explicit open blocker should suppress or cap imminence even when several positive families exist.

## Verdict

- strict target of 10 controls: **NOT MET (6/10)**
- evidence quality of admitted controls: **PASS FOR FALSIFICATION**
- V0 as simple <=90d clock: **FALSIFIED**
- V0 as late readiness alert: **STILL POTENTIALLY USEFUL**
- V1 blocker/closure model: **WORTH PREREGISTERING**
- live precision / profitability: **UNKNOWN**
- production deployment: **NOT AUTHORIZED**

## Authority boundary

Offline deterministic research only.

No production crawler, deploy, signing, token action, fund movement, merge, or launch authority is granted.
