# Funder recipient cohort V1 — preregistration

Date 2026-10-06. Stacked on draft #145. Capture `funder-cohort-20261006-v1`. **SMALL EXPERIMENT**, retrospective and exploratory. Freeze before launch outcome retrieval. No older journal is continued. No subject substitution, additional live observation, model, delivery, capital, production job, merge or deployment.

Two prospective runs supported funding and research handoff but no later launch in their registered windows. The immediate question is whether this previously selected funder has useful short-window Pons launch yield at all. A functioning detector does not answer that. This pilot does not test causal effects, predictive lift against other funders, profitability, willingness to pay or model competence.

## Frozen selection and outcomes

Funder remains `0x9bc462bce2acd6fbe2ef5470d55b439453451083`. Funding locator interval is **81,504,001–81,704,000**, the recent historical interval already registered in #143. Its first page/funding candidate was inspected for retrieval calibration, but later launch outcomes were not examined for cohort selection. The known Oct 2 positive at block 77,795,399 is outside this interval. The funder and interval are deliberately selected investigation context, not a random population or untouched holdout.

Select the first **20 distinct non-self recipient addresses** from ascending provider-returned external positive native transfers. At most **eight pages of five rows**, hence forty returned rows. Repeated recipient addresses retain their first returned transfer; self transfers are excluded. Selection never uses a launch, amount ranking, discovered success or outcome-dependent replacement. Validate every returned row, repeated hash, ascending block order and pagination cursor. Ties within a block remain provider order. Stop at the recipient cap, page cap or provider end marker; report capped coverage. Provider pagination termination does not independently establish indexing completeness or freshness.

Write a selection digest binding the protocol and selected transfer hash/recipient/block/value, plus a saved raw/audit prefix **before any launch query**. Canonically verify every selected funding transaction's full-block membership, chain/from/to/value/index, successful receipt and same-number block hash recheck before outcomes. Any invalid selected candidate halts the experiment; do not drop it and replace it with a different recipient.

Outcome ceiling is fixed at **81,756,562**, #145's initial canonical head, which was recorded before this experiment. The ceiling timestamp must not be in the future relative to its receipt clock. Headers must establish at least sixty minutes between the last funding-window block and that outcome ceiling. An immature or unavailable ceiling is a halt, never a negative. Scan the entire fixed interval **81,504,001–81,756,562** in sixty-two contiguous chunks of at most 4,096 blocks. Filter the pinned Pons V2 factory/TokenLaunched event by the frozen recipient list. Each chunk has an end header before and after the log query; number/hash/parent/timestamp fields must agree. The final header must agree with the original ceiling and its final recheck. No dynamic head or future outcome extension.

For each recipient, select the earliest returned Pons launch strictly after its selected funding block. Verify canonical launch header/transaction membership, strictly later block timestamp, successful receipt containing the exact returned event, and a same-number header hash recheck. Report launch delay from provider block timestamps. Primary outcome is **0 < delay ≤ 600 seconds**; secondary is **0 < delay ≤ 3,600 seconds**, inclusive upper boundaries. A verified later launch beyond sixty minutes is reported but excluded from both numerators. Same-block launches are excluded. Prior/same-block returned logs are reported separately as **unverified locator counts**, not admitted prior-launch facts.

Denominator is the complete selected, canonically verified recipient cohort. A complete provider log scan without a returned later event supports a bounded provider-reported negative for the explicit subject/block/time interval, not global chain absence. Any incomplete/failed/pending coverage keeps aggregate denominators and launch counts **null**. No inferred zeros. No eight-block recipient-history eligibility check is added here: this broader cohort measures funder relevance and cannot establish prospective Sniffer eligibility or global wallet freshness.

## Prespecified decision rules

This is an operational pilot threshold, not statistical significance or a validated commercial requirement:

- Fewer than ten completely scored recipients: `INCONCLUSIVE_SMALL_COHORT`.
- At least ten, and at least 20% have a verified later launch within ten minutes: `SMALL_EXPERIMENT_10_MINUTE_RULE`. Register an independent prospective follow-up before collecting it; do not activate a worker.
- Ten-minute yield below 20%, sixty-minute yield at least 20%: `DEFER_10_MINUTE_CONSIDER_LONGER_WINDOW`. The short observation window is unsupported for this pilot; no automatic longer run.
- Both yields below 20%: `DEFER_FUNDER_PRELAUNCH_STRATEGY`. Stop extending this funder's short-window launch chase. This does not kill funding provenance, Sniffer generally, or investigation value.
- Any halt/incomplete coverage: `INCOMPLETE_NO_YIELD_DECISION`.

Report exact counts, selected recipient/transfer list, observed delays, capped/ended pagination, all canonical verification reads and confirmed scan intervals. Twenty addresses from one funder are correlated, selected observations; no general precision, false-alert rate, recall or causal claim follows. The earliest-transfer anchoring rule is fixed; do not relabel a recipient using a later funding transfer to improve delay.

## Authority, limits and receipts

Maximum **384 original single-attempt reservations** and **ten minutes** from registration; no retry, workflow rerun, resume, copied-journal dispatch or replacement allowance. A worst-case twenty-recipient positive path needs at most 321 calls: five initial chain/code/headers, eight locator pages, one funding-window recheck, sixty funding checks, 186 chunk checks, sixty launch checks, one outcome-ceiling recheck. This reserves capacity, not completion within time. Each request remains fifteen-second/one-megabyte bounded through the unchanged credential-safe transport. Audit export is capped at 48 MB; individual chunks at 128 logs. Limit/transport/HTTP/parse/binding/reorg/uncertainty halts once. A late returned body is retained as a failed counted attempt and admits no outcome. Pure replay independently enforces the registered deadline.

Only the existing named archive Actions secret is injected after frozen dependency installation and offline checks. Never print/store it or put it in arguments. Registration binds exact source SHA, protocol and a local digest before requests. Atomically sync the pending reservation before transport and preserve raw/audit/summary/selection prefix/checksums on halt. Pure replay recomputes every request and score. Local hashes, block samples and provider-reported headers are not external consensus attestation or proof of every parent link. RPC cost remains unknown without billing evidence. Model, delivery and capital calls remain zero. Historical `SPECIALIST_FAILED_SAFETY_GATES` remains intact.

## Engineering acceptance and rollback

Keep the implementation isolated: a pure cohort auditor, one-shot collector, synthetic controls, preregistration and exact-message gated workflow. No old contract, parser, transport, lockfile or receipt edits. One hostile self-review identified missing replay deadline enforcement and same-hash header field contradictions; both were fixed. The single targeted rereview passed nine controls and closed the review. Verify selection-prefix stability, canonical positive and provider-limited negative controls, horizon boundaries, repeat/self handling, finite pagination/scan, maturity and reorg gates, malformed/duplicate JSON, incomplete scoring and secret-free zero-attempt CLI behavior.

IMPLEMENT → TEST → one hostile self-review → fix Critical/High → one targeted rereview → STOP. Canonical frozen pnpm 10.15.0 CI must pass on the exact published tree before the single trigger commit. Review/CI closure does not confer activation authority. Roll back the preparation commit as a unit, retaining all original artifacts; replay requires the matching cohort reader. Do not retarget or collapse the draft stack.
