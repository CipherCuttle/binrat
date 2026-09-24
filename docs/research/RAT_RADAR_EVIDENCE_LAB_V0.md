# Rat Radar Evidence Lab V0 — isolated falsification

Status: **synthetic fixture experiment, not a live evaluation**.
Branch: research/rat-radar-evidence-lab-v0.
Frozen parent: 5f1766a165a3755d620a952b3a1fec20e9206206
Scope: test/fixtures/rat-radar-evidence-lab-v0.json and test/ratRadarEvidenceLab.test.ts.
Authority: no production source edits, no frontend/TG edits, no D1 writes, no merge, deploy, wallet action, token launch or marketing.

## Hypothesis and first falsification

The current V0 public watchlist sorts observed **V3 swap recipients** by distinct
indexed launches, median first recipient-side entry block delta, and acquisition
receipt count. Those are protocol-role observations, **not recovered human traders**,
wallet ownership, realized P&L, skill, safety or recommendations.

H0: recipient recurrence by itself is not sufficient to identify a distinct
recurring participant. Shared router/contract recipients can dominate a recurrence
watchlist without representing a single ultimate beneficiary.

The synthetic fixture contains exactly three launches and eight acquisition
receipts. Its evaluator-only labels designate (a) an explicitly verified shared
intermediary, (b) an intermediary deliberately held out from the filter, and
(c) two unclassified recipient addresses. This is a controlled *fixture*, not
on-chain verification of any actual address or population.

### Registered synthetic acceptance checks

| Check | Frozen expected outcome | What it means |
|---|---|---|
| Baseline top recipient | known intermediary, 3 launches | recurrence alone permits contamination |
| Remove independently known intermediary only | held-out intermediary, 2 launches, remains first | perfect removal of known labels is insufficient |
| Oracle removes BOTH synthetic intermediaries | unclassified recurring recipient, 2 launches, becomes first | evaluator upper bound only; do not apply oracle in production |
| Early snapshot 150 | 1 launch, 4 receipts; unchanged by later evidence | no lookahead in this bounded projection |
| Snapshot 250 | 2 launches, 7 receipts | maturity and coverage are time-bounded |
| Duplicate same receipt | acquisition count and digest change | direct projection trusts upstream deduplication |
| Excluded pool-only recipient | 0 candidates, status PARTIAL | PARTIAL is not evidence of a useful watchlist |
| Bad as-of block hash, direct fixture injection | still projected | canonical-chain validation is an upstream invariant |

These checks intentionally document the CURRENT projection's failure modes.
If the implementation changes, update this versioned lab rather than silently
turning synthetic assertions into live claims.

## Reproduce

From this branch, with Node >=20 and pnpm 10.15.0:

    pnpm install --frozen-lockfile
    pnpm exec tsx --test test/ratRadarEvidenceLab.test.ts
    pnpm check

The first test emits one structured RAT_RADAR_LAB_V0 line to CI logs. All data
come from the committed JSON fixture and the unmodified, imported production
receipt/Watchlist projection. No RPC, provider, key, database or real purchase is
used. Running a synthetic unit test is NOT a completed prospective cohort.

## Next measurement: real prospective holdout, separately authorized

1. Export read-only canonical activity receipts from real indexed launches into
   a redacted/versioned, block-pinned cohort. Identify completeness by launch,
   pool, timestamp, observed recipient and canonical hash. Do not copy any keys.
2. Pre-register an observation cutoff for each launch. At time t, features may
   use ONLY receipts canonical at or before t. Freeze expected 5m/1h/24h maturity;
   an immature or missing horizon stays missing, not a negative outcome.
3. Resolve intermediary labels using independent **as-of-time** bytecode and
   publicly verified contract evidence, with UNKNOWN for unresolved addresses.
   Never infer EOA = one person; assess whether the observed role is plausible,
   not who controls it.
4. Compare baseline recurrence ordering, externally verified intermediary
   exclusion, and a frequency-matched null ordering on the SAME eligible
   launches. Report known-intermediary share in the top five, coverage, duplicate
   sensitivity, top-five stability and unresolved-contract share. The fixture
   oracle must never become a real-world feature.
5. Add later independently observed liquidity/launch outcomes only where the
   source supports them. Existing V3 liquidity scalar is not USD liquidity,
   and a swap recipient receipt is not executed P&L. If richer claims are
   unsupported, evaluate evidence retrieval utility rather than alpha.
6. Run chronological held-out launches and at least one prospective collection
   window. Freeze code, cohort hash, source completeness, label procedure and
   exclusions before inspecting holdout outputs.

### Kill gates

- If a substantial portion of prominent addresses remain unclassifiable
  intermediaries under independently verifiable rules, do not present the
  results as "smart money" or identity-based rankings.
- If deduplication or canonical reorg checks fail in the real input path,
  stop before using the projection as a research signal.
- If source freshness/coverage differs across compared snapshots, withhold
  any claimed improvement and report missingness explicitly.
- If held-out evaluation shows no reliable improvement over the matched
  baseline, do not invest in richer ranking or holder-gated predictive claims.

## Production handoff

No source edit or change to LIVE semantics is authorized by this lab. The
frontend may continue to show truthful observed-address recurrence and link to
public receipts. Telegram must not promote fixture statistics to real signal
quality. PR #31 (owner's bento) and the separate Telegram stream remain
independent. Any eventual ranking change needs its own evidence-backed spec,
reorg/duplicate guard, public wording review and a separate implementation PR.
