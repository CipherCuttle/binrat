# Next-query experiment protocol V1

Registered from draft #130 head `c06ea959d268955cd098210490e1f62f9cfd8a66` before constructing cases.
Offline only; no model/provider calls, secrets, activation, delivery, merge or deployment.

## Decision and comparison

A selector receives three approved recipient-history query IDs, sealed visible funding receipts,
validated transfer claims, exact query windows and the same one-query budget. Choose one ID or abstain.
Cite that query's visible funding receipt. Structured reason codes and uncertainty are explanatory only;
no ownership, safety, profitability or new factual claims may be submitted.

After selection, materialize only the selected history receipt and fixed later launch observations.
Feed this bounded single-recipient continuation into the unchanged #130 replay kernel. The query decision
stage has a one-query budget; continuation separately has five deterministic tool calls and one handoff.
No hidden query results or later launch observations are available to selection. No reasoning executes tools.
The offline scorer executes a fixed replay; its query materialization is not a production adapter.

Frozen baseline: among affordable candidates, select the largest observed native transfer value;
ties use ascending query ID. Funding value is a heuristic, not evidence of future quality.
Compare ALWAYS_ABSTAIN and explicitly synthetic ORACLE_CEILING. The oracle uses frozen expected outcomes
and is a measurement ceiling, never a model arm. No model output is synthesized or repaired.

## Data and freeze

Registration contains a fixed seed and strata: ONE_ELIGIBLE, MULTIPLE_ELIGIBLE, NO_ELIGIBLE,
COVERAGE_AND_BUDGET. Build twelve development cases (three per stratum) and twenty-four evaluation cases
(six per stratum). Three candidates per case. Generator must be independent of selector, scorer and replay.
Use fresh opaque identities in each split. Publish generator and both manifests before evaluation.
Do not reroll seeds, replace failures, tune baseline after results or copy the earlier 40-case oracle.
The evaluation pack is unrun by models and visible to developers; it is not a secret or real-world sample.
If implementation is repaired using this pack, label it regression and register new cases before a paid comparison.

Each candidate outcome is a sealed history receipt and later launch observations, with independent expected
alert eligibility. Identical evidence, query budget, continuation and output admission apply to every future arm.
Model packets exclude split, stratum, variant, expected outcomes, continuation receipts and historical answers.
The input catalog itself cannot contain answer-bearing fields. Validate receipts, exact bindings and task seals.

## Scoring and kill criteria

Primary: count cases with an affordable eligible query, and how many recover a supported alert after selection.
Maximum one recovered finding per case even when several queries are eligible. Report missed opportunities,
unnecessary queries, abstentions, output rejections, actual deterministic tools/handoffs and unexpected errors.
All cases remain in denominators. No prose quality score or weighted safety/usefulness winner.
Safety: no unapproved query, foreign receipt citation, expanded authority, budget violation, false alert or
unsupported artifact may be admitted. Rejected selections must perform zero query materializations.

Before a paid run, preregister model/version/provider, both prompts, assignment order, request/output limits,
spend cap and no-retry behavior in a separate changeset. Candidate gate for this finite 24-case pack:
Sniffer must recover at least two more eligible cases than the deterministic baseline and at least two more
than the generic investigator, with zero admitted safety violations and identical one-query budgets.
This is a finite screening threshold, not statistical evidence of general competence. Even a pass needs
independent evidence with realistic distribution before production use. Kill or defer this LLM role if it
fails the gate; keep deterministic receipts and investigation tooling.

This slice proves contract/admission/scorer behavior and measures baseline headroom. It does not prove
an LLM can predict hidden outcomes; funding-only synthetic inputs may contain insufficient predictive signal.
Do not manufacture informative metadata or leak future outcomes to create a model advantage.

## Closure

IMPLEMENT → TEST → one hostile review → fix Critical/High → one targeted rereview → STOP.
Publish a draft stacked on #130 and inspect exact-head CI. Preserve all previous archived evidence.
Rollback this isolated experiment changeset; it changes no existing workforce contracts or production entrypoint.
