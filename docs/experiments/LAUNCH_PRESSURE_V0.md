# BINRAT Launch Pressure V0

Date: 2026-10-07

## Purpose

Prelaunch Scout V0 answers:

> Is this a serious project worth watching?

The paired 20-project benchmark showed that code + execution evidence + typed institutional backing often fires far too early to answer:

> Is launch actually getting close?

Launch Pressure V0 is a separate chronology-safe detector for **recent production preparation**.

It does not recommend investments and it does not use future launch outcomes as inputs.

## Preregistered signal families

- **P1 — PRODUCTION_CHAIN_CONFIG**: production/mainnet chain ID, genesis, validator or equivalent canonical production configuration.
- **P2 — PRODUCTION_DEPLOYMENT**: production contract/deployer/deployment activity.
- **P3 — PRODUCTION_INFRA**: production RPC, explorer, bridge, telemetry or equivalent infrastructure wiring.
- **P4 — AUDIT_REMEDIATION**: final audit remediation / fix-review closure.
- **P5 — RELEASE_CANDIDATE**: explicit release candidate, code freeze or mainnet-targeted release milestone.
- **P6 — TOKEN_DISTRIBUTION**: token genesis, distribution or TGE infrastructure.

Receipts from the same family collapse to the freshest receipt. Duplicate evidence never multiplies pressure.

## Frozen state machine

At replay date T:

- **BUILDING**: no signal family observed within 90 days.
- **HARDENING**: at least one distinct family within 90 days.
- **PRODUCTION_PREP**: at least two distinct families within 60 days, including at least one hard family.
- **ARMED**: at least three distinct families within 30 days, including at least two hard families and at least one irreversible family.

Hard families:

- P2 PRODUCTION_DEPLOYMENT
- P3 PRODUCTION_INFRA
- P5 RELEASE_CANDIDATE
- P6 TOKEN_DISTRIBUTION

Irreversible families for the ARMED rule:

- P2 PRODUCTION_DEPLOYMENT
- P6 TOKEN_DISTRIBUTION

A project is considered **pressure-imminent** only in `PRODUCTION_PREP` or `ARMED`.

## Real-evidence pilot

The first pilot is intentionally small and uses GitHub-native receipts only.

### Taiko

Public launch outcome: 2024-05-27.

Receipts:

- 2024-04-22: mainnet chain ID set to 167000 → P1.
- 2024-05-13: mainnet deployment updated → P2.

### Aptos

Public launch outcome: 2022-10-12.

Receipts:

- 2022-09-17: mainnet genesis plumbing → P1.
- 2022-10-04: deployment fixes for mainnet → P2.
- 2022-10-04: mainnet telemetry service URL → P3.

### Celestia

Public launch outcome: 2023-10-31.

Receipts:

- 2023-09-07: celestia-app v1.0.0 release candidate milestone → P5.
- 2023-10-13: mainnet chain ID added and set as default → P1.

## Pilot result

Using the same frozen receipts:

| Replay point | Recall | 180-day false-positive rate |
| --- | ---: | ---: |
| 45 days before launch | 0/3 | 0/3 |
| 14 days before launch | 2/3 | 0/3 |
| 7 days before launch | 3/3 | 0/3 |

This is not enough data for an efficacy claim.

It does falsify one tempting assumption: **the production-pressure layer should not automatically be treated as a 45-day detector.** On these three projects, the strongest production-specific evidence clusters much later.

## Interpretation

Current working architecture:

```text
SCOUT
serious project
    ↓
long watch window
    ↓
LAUNCH PRESSURE
recent production transitions
    ↓
PRODUCTION_PREP / ARMED
    ↓
TRIPWIRE
```

The early Scout and late Pressure detector solve different problems.

## Next falsification gate

Do not tune thresholds against this three-project pilot.

Next:

1. populate P1-P6 receipts for the frozen 20 historical launchers;
2. add a separate matched cohort of serious delayed/non-launch projects;
3. replay multiple **predeclared** horizons (45d, 30d, 14d, 7d);
4. measure recall and false-positive rate at each horizon;
5. reject any signal family that does not improve out-of-sample temporal discrimination.

The original target remains useful as a falsification criterion, not a promise:

- 45-day recall >= 80%;
- 180-day temporal false-positive rate <= 15%.

If the 45-day target fails while 14-day/7-day performance survives, treat Launch Pressure as a **late trigger**, not as a medium-horizon launch predictor.

## Authority boundary

Offline deterministic experiment only. No production crawler, deployment, signing, token action, fund movement, or merge is authorized.
