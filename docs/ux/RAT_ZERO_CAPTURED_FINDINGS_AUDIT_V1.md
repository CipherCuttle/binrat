# RAT ZERO — CAPTURED PONS FINDINGS AUDIT V1

**Source:** `docs/receipts/sprint-a1/public-feed.json` at the frozen Investigation V2 / Case Value V1 base. This is a historical published, source-bound *fixture* (checkpoint in October 2026), not a live feed. The frontend may only make claims grounded in the validated `PonsCase` projection.

## What the 20-launch capture contains

- Chain: Robinhood 4663, Pons launch facts.
- **20 exact launch IDs**, **19 distinct reported deployer addresses**.
- **0 nonempty token names; 0 nonempty symbols.** Do not manufacture labels, trends or popularity.
- **4 launches** have `priorLaunchCount > 0` (counts 38, 2, 1, 43). These are historical index counts with partial coverage, **not** observed in-window overlaps and **not** ratings.
- **Exactly one deployer address appears on two distinct launch IDs in the captured 20-record window**: `0x4e0561054f4fabbaa183a8c16ef1f4e125881eaf`. The two launch IDs are `ea2e848582...` (block 84242495) and `37bbe331d...` (block 84240922), and must be verified by exact ID through the read adapter.
- The overlap is the most directly inspectable relationship available **within this preview**. It is not necessarily unusual or economically interesting. Do not imply shared humans, wallets, funding provenance, rug risk or trading profitability.

## UI choice

A narrow factual banner highlights the shared-address relationship and routes to Trails scoped to the exact address. The user can inspect both Cases. If a different verified publication has **no visible overlap** but has earlier index matches, the banner offers the weaker historical-record observation instead. If neither observation exists, the banner is absent; do not invent a finding.

No new endpoint, ranking algorithm, freshness claim, AI interpretation, Watch, alert, token or financial recommendation is introduced.

## Stop rule

Success = the user can click from the observation to the exact two Cases with no additional network request or loss of source verification. Failure = a fake premium insight, a claim based on history counts as if window matches, or moving the first Case outside a mobile viewport. Current evidence remains insufficient for a trading strategy or meaningful inferred `alpha`.
