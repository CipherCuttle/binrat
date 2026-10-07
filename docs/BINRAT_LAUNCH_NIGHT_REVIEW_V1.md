# BINRAT launch-night integration review V1

This is one bounded hostile self-review, not an independent third-party approval.
Scope: integration-created seams only. No product sprint or external gate was opened.

Inputs: C1 `415b988605ef4aaae85a24db4bd88f2b9f263499`, C2
`4fbd2d71317ce99d0d96b42bc82b1b299afbe99f`. Merge base:
`9e8b37ec0a643aadf8aaf789e9ab6c4ae4b85cb3`.
Merge commit `3de4590121812d8e33aa40c2c353c43d10585c96` has those exact two
parents. Documentation donor `0921ecbcb565ebb2fdb826fcb7a05056955f4666` is
not an ancestor. Complete file sets, conflicts and semantic JSON resolutions
were recorded before resolving in `BINRAT_LAUNCH_NIGHT_COMPOSITION_V1.json`.

## One hostile review

Reviewed composed head: `fdd6648109d8022d40bde04308b469e08587986c`.
Before this review: 538/538 tests, C1 50/50 acceptance, C2 5/5 mechanical groups,
V2 check/build, web/share/launch invariants, native browser and pinned Wrangler
dry-run passed. Generated modules, release JSON, bundles and browser outputs
were untracked. Deployment workflow predicates exclude this integration branch.

| Finding | Severity | Evidence | Repair |
|---|---|---|---|
| H1: public projection did not bind C2's newly authoritative nested entitlement/Staking facts; public copy weakened required Staking into optional Staking | High | A canonical manifest mutated to `currentPonsLaunchConfiguration.productionEntitlementActive=true` was rejected by C2 strict validation but C1 still projected PLANNED/inactive. `workingRatStatus=ACTIVE` and `stakingRequired=false` were also omitted from the projection condition. Projector, Telegram and web said Staking "may exist". Two executable probes failed, while the gate/transport control passed. | Require `stakingRequired=true`, `workingRatStatus=PLANNED`, `productionEntitlementActive=false` in C1's public support condition. Contradictions revoke Working Rat to UNVERIFIED with no action. State required launch Staking and its independence from Working Rat entitlement consistently in projector, Telegram and web. |

Critical: 0. High: 1. Repair scope: only H1 and its regression coverage.
`test/launchNightIntegration.test.ts` retains the negative probes and a positive
control covering C2 phase/legal gates plus deterministic transport/Telegram.
Repair verification: 3/3 new regressions and 541/541 full tests, including web,
share-card and launch-presentation invariants. No gate, economics, transaction,
activation or authorization mechanism was changed by the repair.

Other reviewed seams: exact C2 plan/matrix digests and phase applicability;
future execution versus PRE-ARM; inactive Working Rat versus required Staking;
historical Arc isolation; C1 snapshot binding, stale/unknown presentation and
bounded reads; Telegram/web stages; retained launch protections; script union;
CI predicates, generated release/build provenance and no deployment authority.
No additional Critical/High integration finding was identified.

## One targeted rereview contract

After committing H1, execute one targeted rereview of H1, its positive/negative
regressions and the original acceptance gates. The exact committed head and
results are recorded in the draft PR body and local acceptance receipts; this
file does not assert an unexecuted exact-head rereview result. No second broad
hostile review or further feature work is authorized.

## Production and external gate separation

A bounded GET-only diagnostic on 2026-10-07 reproduced `/api/status` HTTP 503 /
Cloudflare 1102 after approximately 6.4 seconds, CF-Ray `a4690a5a0e784e58-ARN`.
Sampling stopped at that first nonretryable error. `/health` reported old source
`53325fd0806765578ed6921428ad55f15a9728f1`, without the candidate build identity.
This does not prove active deployed provenance or diagnose CPU versus memory.

Still required: exact deployed artifact/version/manifest mapping, two bound
healthy advancing publications across resolved cadence, real fresh Pons → Case,
deployed browser/Telegram smoke and independent reader comprehension.

Owner values, measured freshness/providers, operator approval/revocation/envelope
store and durable journal configuration remain unresolved. Upstream critical
behavior, source/runtime or reproducible trace evidence, assets, payout/lock,
principal/recipient/controller semantics remain blockers. Legal remains
BLOCKED_LEGAL for counsel-reviewed final EU/Swedish classification, obligations
and scoped execution/publication authorization.

Working Rat threshold/binding/capacity activation are deferred; treasury is
conditional on a verified launch role. Neither blocks token execution merely by
remaining PLANNED. No deploy, arm, real signing, broadcast, live Telegram message,
marketing publication, token launch or Working Rat activation occurred.
