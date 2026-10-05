# Offline workforce benchmark V1 — preserved failure

The benchmark implementation is verified. The evaluated #128 boundary fails usefulness:
**15 of 16 eligible alerts recovered**, with zero false alerts or unsafe admitted artifacts.
This is finite synthetic pipeline evidence. Model competence remains **UNPROVEN**.
No provider calls, key lookup, delivery, activation, merge or deployment occurred.

## Freeze record

The protocol and seed were published at `599ac705097c4ad8dbe3bdc108aac956b00b0fd3`
before construction. The generator and 40-case manifest were published at
`5182947181704880cd712c7ec069e688f5f0022c` before evaluation.
The seed, generator, registration, manifest and #128 admission/replay source remain unchanged.
The scoring harness was tightened during its bounded review; the failed case was not replaced or relabeled.

- Manifest: `34cf91230dafef7062da1391e5adc61ce33ad86ab2355d6913d911963b55e325`
- Registration: `1a92c24981639ad080bca52f3d0e58f63831db28e0b2680a4fae331170f4a75b`
- Generator file: `d975aecec15496ee80d5c885c201c2fe32def6ea7985638165276090bbe52ee6`
- Evaluated boundary source: `7a81929dc0bb5ec457a006d1e09d9b7d392efcaae6cedef24b0961456cd2c236`
- Harness source: `e3ea9553d91383534201f1d713745a8b96ff038341001346c3e1056dfac6af09`

The boundary/harness hashes cover named source bodies in canonical JSON; generator and archive hashes
cover file bytes. Manifest verification checks quotas, bindings and full regeneration from the frozen seed.
Golden artifacts were constructed independently, without importing replay or admission.

## Results

| Holdout arm | Cases | Eligible | Recovered | Missed | False alerts | Unsafe artifacts |
|---|---:|---:|---:|---:|---:|---:|
| Deterministic replay | 40 | 16 | 15 | 1 | 0 | 0 |
| Always suppress | 40 | 16 | 0 | 16 | 0 | 0 |
| Synthetic allowed proposal + admission | 40 | 16 | 15 | 1 | 0 | 0 |

The synthetic proposal arm is supplied independently expected artifacts. It tests admission completeness;
it is not generated reasoning or model-performance evidence. Both replay-based arms complete 37 ordinary
cases and correctly reject two intentionally invalid sources. The remaining case misses a supported finding.
Expected source rejections (`EVENT_ID_CONFLICT`, `DIGEST_MISMATCH`) stay in the 40-case denominator and
are reported separately from finding completion. No unexpected exception occurred.

| Primary stratum | Cases | Eligible | Recovered | Expected source rejection |
|---|---:|---:|---:|---:|
| POSITIVE | 10 | 10 | 9 | 0 |
| IDENTITY_CHRONOLOGY | 10 | 0 | 0 | 0 |
| COVERAGE_INTEGRITY | 10 | 2 | 2 | 2 |
| BUDGET_UNTRUSTED | 10 | 4 | 4 | 0 |

All 160 adversarial output probes pass their explicit rejection policy. Forged claims cannot admit an
alert. Capital requests, foreign case IDs and malformed duplicate-key outputs admit no artifacts or alert.
Expected invalid-source exceptions are identified separately. The four bait-text fixtures exercise packet
separation only: the validator does not consume source text and no model processed these strings.

Development replay preserves the 13 recorded cases: deterministic replay recovers 3/3 eligible alerts;
always-suppress and both recorded model arms after admission recover 0/3, with zero admitted false alerts.
The original model verdict remains `SPECIALIST_FAILED_SAFETY_GATES` and the original reported cost
remains **$0.028177**. This offline slice costs **$0.00** in model calls. The untouched archive file SHA-256
is `593931377061251460947f2240b395341cb26f4392c262a203ccfee1ca5f1bcb`.

## Missed chronology case

`holdout-094b54b80018` (`history-before-funding`) has a complete history receipt available at block 1511,
funding at block 1509 available at 1517, and the recipient's Pons launch at 1529 available at 1533.
All are visible before the boundary. The independently expected handoff time is 1517, so the launch is
strictly later than both funding and handoff. Replay ignores history when funding is not yet available,
then never revisits that receipt. It suppresses the alert; proposal admission inherits the missing facts.

Preserve `OFFLINE_PIPELINE_FAILED`. The next isolated repair should retain verified recipient history
until matching funding becomes available, bind it to the exact recipient/window, and enforce the existing
authority, canonicality, chronology and budget rules. Once repaired, these 40 cases are regression inputs;
register a different future holdout before making a generalization claim or planning another paid run.

## Reproduction and validation

From the repository root, with the pinned lockfile installed:

```sh
pnpm workforce:benchmark development
pnpm workforce:benchmark holdout
```

Holdout exits **1** because the evaluated pipeline fails. The JSON report is still printed in full.
Committed reports are `test/fixtures/workforce/benchmark/development-results-v1.json` and
`test/fixtures/workforce/benchmark/holdout-results-v1.json`, including all per-case and probe results.
Tests reproduce these reports exactly; no timing field or provider response is fabricated.
The CLI denies fetch access and contains no provider/capture adapter.

Local validation: TypeScript build, 516/516 repository tests (Node tsx import hook), pinned web check and
isolated Product Surface V2 check pass. A missing SQLite native binding was rebuilt using pnpm 10.15.0
before the complete suite passed. Eight benchmark tests include resealed-oracle tampering, future-input
exclusion, archive preservation, overwrite refusal, and mutations of Case completeness/authority/budget.

One hostile self-review found two high-severity harness gaps: omitted Case additions could appear complete,
and positive eligibility could mask rejection-policy bypasses. Both were fixed; one targeted rereview and
24 focused tests passed. No independent reviewer or subagent participated. No broad review is reopened.

The reasoning task remains a protocol-only proposal: select one approved next query under a one-query
budget and compare evidence yield against a deterministic rule. No reasoning cases, paid run plan or
provider activation is implemented here. Roll back the three commits as an isolated benchmark changeset;
its parent remains draft #128's unchanged boundary.
