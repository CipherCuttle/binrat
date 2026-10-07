# BINRAT Hard Delayed Controls V1

Date: 2026-10-07

## Question

Launch Pressure V0 calls a project pressure-imminent when the frozen evaluator reaches `PRODUCTION_PREP` or `ARMED`.

This adversarial benchmark asks:

> Can a project satisfy that unchanged V0 rule at time T and still fail to publicly launch for at least 90 days?

If yes, the simple interpretation

> pressure-imminent => launch within ~90 days

is falsified.

## This is not an FPR sample

Cases are selected **because** they are hard counterexamples.

The cohort cannot estimate:

- population false-positive rate;
- live precision;
- base-rate-adjusted launch probability;
- investment alpha.

It is an adversarial falsification set.

## Admission rule

A case is admitted only if:

1. every pressure receipt was public by trigger time T;
2. the unchanged V0 evaluator returns `PRODUCTION_PREP` or `ARMED` at T;
3. each receipt satisfies the already-frozen P1-P6 meaning literally;
4. the target launch is unambiguous enough to score;
5. the target does not publicly launch for at least 90 days after T.

No V0 threshold or family definition is changed.

## Target

Planned target: **10 strict controls**.

Final strict cohort after hostile review: **4**.

Target status: **NOT MET (4/10)**.

The missing six are not backfilled with weaker evidence.

## Frozen controls

| Project | Trigger | Active V0 families | Outcome lag |
| --- | --- | --- | ---: |
| Tari Minotari | 2023-12-14 | P4 audit remediation + P5 release candidate | 509d |
| ZetaChain | 2023-06-08 | P4 audit remediation + P6 genesis token distribution | 237d |
| Neon EVM | 2022-12-12 | P4 audit remediation + P3 production infrastructure | 217d |
| Namada | 2024-08-15 | P5 mainnet release candidate + P6 genesis distribution files | 110d |

Frozen lag summary:

- minimum: **110 days**
- median: **227 days**
- maximum: **509 days**

All four evaluate as `PRODUCTION_PREP` under the unchanged V0 rule.

## Why each case qualifies

### Tari Minotari

On 2023-12-14 Tari reported that base-node and wallet audit issues had been addressed and published its first release candidate, described as code believed to be what would run on mainnet while explicitly not being the mainnet release.

That is clean P4 + P5.

Genesis was not mined until 2025-05-06.

### ZetaChain

Public GitHub history shows:

- 2023-05-16: Zellic audit fixes;
- 2023-06-08: genesis token-distribution refactor.

That is clean P4 + P6.

Mainnet Beta did not launch until 2024-01-31.

### Neon EVM

Ackee Blockchain reported on 2022-11-04 that Neon supplied an updated codebase addressing the audit findings, with every finding fixed except one informational issue.

On 2022-12-12 Neon reported that the production environment and infrastructure needed for live dApps were technically ready, while explaining that organizational / external / market dependencies still prevented activation.

That is clean P4 + P3.

Production mainnet did not launch until 2023-07-17.

### Namada

Namada published its mainnet release candidate on 2024-07-09.

On 2024-08-15 the Anoma Foundation published the genesis balance and transaction files associated with the proposed genesis distribution, including tooling to build the full genesis block.

That is clean P5 + P6.

Mainnet launched on 2024-12-03.

## Combination result

Each admitted counterexample uses a different two-family combination:

- `AUDIT_REMEDIATION + RELEASE_CANDIDATE`: 1
- `AUDIT_REMEDIATION + TOKEN_DISTRIBUTION`: 1
- `AUDIT_REMEDIATION + PRODUCTION_INFRA`: 1
- `RELEASE_CANDIDATE + TOKEN_DISTRIBUTION`: 1

This matters.

The failure is not confined to one bad signal family.

> **Readiness artifacts are not the same as clock-closing artifacts.**

A team can have remediated audits, an RC, genesis distribution data, or technically ready infrastructure while another launch gate remains open.

## Hostile-review correction

The first draft admitted six cases.

Hostile review found a methodological High: several receipts were typed too loosely as P4.

Frozen P4 is:

> final audit remediation / fix-review closure

It is **not**:

- merely “audit completed”;
- a generic bug bounty;
- an old security fix with no closure evidence.

The following first-draft cases were therefore removed:

### QRL 2.0 / Zond

The 2026-04-03 source said two cryptographic-library audits were complete, but did not establish remediation closure at that date. Later remediation evidence exists, but it is too late to combine with the old code-freeze event under V0's 60-day window.

### Shardeum

The source said prior bounty programs had identified and rectified vulnerabilities, but that does not satisfy the frozen audit-remediation / fix-review meaning strongly enough.

### Namada P4 was replaced, not widened

A forum statement that two audits had completed was not retained as P4.

Namada remains admitted only because the independent genesis-balance publication is clean P6 evidence within 60 days of the mainnet RC.

### Neon P4 was strengthened

Generic “audits completed” wording was replaced by the auditor's own statement that an updated codebase addressed the reported issues and fixed all findings except one informational item.

No ontology was expanded to save a case.

## Other rejected / non-admitted candidates

### Sonic

Early “mainnet” genesis and bootnode artifacts are entangled with migration from the already-live Fantom/Opera network. Target provenance is ambiguous.

### Babylon

Launch semantics are phased: Bitcoin Staking mainnet phases predate the later Genesis-chain milestone. A single launch date would mislabel the target.

### Dusk

Audit-remediation evidence is clean, but early mainnet installer configuration contained placeholder infrastructure; the required independent hard family did not survive strict review.

### Avail

Early prepare-mainnet and dummy-mainnet chain-spec work are primarily one P1 family. Candidate telemetry/deployment evidence was test/dev oriented or otherwise not clean production evidence.

### Massa

Genesis preparation is clear, but the candidate second hard family did not survive source-literal review.

### Saga

A “Mainnet v1” change is release-oriented, but a second independent qualifying family was not established.

### Aleo

Audit work is clear, but the exact code-freeze completion date around the 90-day boundary was not strong enough for admission.

## Structural verdict

The following simple claim is falsified:

> Two sufficiently recent, distinct V0 pressure families imply launch within 90 days.

One valid counterexample would falsify that universal claim.

This benchmark contains four, spanning four different family combinations and delays from 110 to 509 days.

This does **not** erase Benchmark V1's observation that V0 clustered near the final two weeks for 5/7 coverage-verified launchers.

It means V0 currently mixes two states:

```text
READY-LOOKING
and
ACTUALLY CLOSING LAUNCH GATES
```

They are not equivalent.

## Pressure V1 hypothesis

Do not tune V0 on these four cases.

A future V1 should be preregistered around a different causal model:

```text
READINESS
  audit / RC / config / infra / genesis distribution
        ↓
OPEN BLOCKERS
  governance / ops / security / integrations / external dependencies
        ↓
BLOCKER CLOSED
        ↓
IRREVERSIBLE EXECUTION
  canonical genesis finalization
  funded production deployer
  production deployment
  activated validator set
  live production bridge / endpoint
        ↓
IMMINENT
```

Candidate V1 concepts:

1. **OPEN_BLOCKER / BLOCKER_CLOSED**
   Explicit unresolved gates should cap imminence even when positive readiness evidence is strong.

2. **Target provenance**
   Distinguish migration artifacts, placeholders, old-mainnet state, testnet state, and the actual launch target.

3. **Irreversibility after closure**
   Prefer a canonical production action that occurs after the last known blocker closes.

4. **Sequence direction**
   `audit remediated -> RC` is not enough.
   `last blocker closed -> canonical production action -> network activation` is a stronger causal sequence.

5. **Negative evidence**
   A public unresolved dependency should reduce or suppress the launch clock instead of being ignored.

## Verdict

- target of 10 strict controls: **NOT MET (4/10)**
- admitted evidence quality: **PASS FOR FALSIFICATION**
- V0 as a universal <=90d clock: **FALSIFIED**
- V0 as a late readiness alert: **STILL POTENTIALLY USEFUL**
- blocker/closure model: **NEXT PREREGISTRATION CANDIDATE**
- population precision / profitability: **UNKNOWN**
- production use: **NOT AUTHORIZED**

## Authority boundary

Offline deterministic research only.

No production crawler, deploy, signing, token action, fund movement, merge, or launch authority is granted.
