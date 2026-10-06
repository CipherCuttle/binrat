# Next-query experiment V1

**Engineering: PASS. Dataset qualification: FAILED_INDEX_PROXY. Model competence: UNPROVEN.**
The offline contracts, selection admission, replay scorer and fixture integrity checks work. The synthetic
evaluation pack is unsuitable for a paid model comparison: an input-only construction shortcut recovers
every eligible finding. No provider calls, secret access, production activation, delivery, merge or deployment.

## Scope and freeze

Base: draft #130, `c06ea959d268955cd098210490e1f62f9cfd8a66`.
Protocol and seed published before construction at `91bd921b6f3542684ee3b910bbfec6880c0dc741`.
Generator and manifests published before evaluation at `966267b5c38240eba7585b3e26482c8331bfc5e3`.
No seed reroll, case replacement, expected-outcome relabeling or existing replay/admission change occurred.

- Twelve development tasks: three per registered stratum.
- Twenty-four evaluation tasks: six per stratum.
- Three approved history queries per task; one query or abstention. Two evaluation tasks have exhausted budgets.
- Strict input/output schemas and exact task-snapshot, query and receipt bindings.
- Reason codes and uncertainty only; no ownership, safety, profit or factual-output channel.
- Query selection receives supplied sealed funding receipts. Their acquisition is outside this synthetic experiment.
- Query materialization reveals only the approved query's history and fixed later observations.
- The existing single-recipient #130 continuation remains bounded to five deterministic tools and one handoff.

The selection-query budget and continuation-tool budget are separate and reported. No other recipient's
history is materialized after a selection. Invalid outputs execute zero queries/tools/handoffs.
Input packets contain no direct oracle, stratum, variant or future-receipt fields; semantic and digest checks
reject unsupported additions. This direct field separation does not eliminate the structural proxy below.

## Results

| Evaluation arm | Cases | Available finding opportunities | Recovered | Missed | Queries | Unnecessary queries |
|---|---:|---:|---:|---:|---:|---:|
| Largest funding | 24 | 16 | 11 | 5 | 22 | 11 |
| Always abstain | 24 | 16 | 0 | 16 | 0 | 0 |
| Synthetic oracle ceiling | 24 | 16 | 16 | 0 | 16 | 0 |

The oracle sees expected outcomes and is only a measurement ceiling. It is not generated model output.
Largest funding recovers 4/8 development opportunities; the oracle recovers 8/8; abstention recovers none.
No false alerts, unsafe artifacts, incomplete selected continuations or unexpected errors occur.
All 180 rejection probes pass (60 development, 120 evaluation): foreign queries, foreign receipt citations,
capital requests, stale task snapshots and duplicate-key JSON. Rejections stay visible in denominators.
Unnecessary means the selected frozen outcome has no eligible finding, even if it produces valid prefix facts.

## Dataset failure and kill result

The generator assigns decision blocks as `10000 + caseIndex * 100`, with contiguous strata and fixed
variant positions. Funding blocks expose candidate slots. These synthetic chronology fields encode fixture
construction. `selectIndexShortcut` uses only the packet and the registered per-stratum quota, not hidden
query outcomes. It recovers **16/16 evaluation** and **8/8 development** opportunities with no unnecessary
queries. It is a dataset audit, never a product selector or competitive model arm.

Funding values and hashed identities were generated independently of eligibility. Their causal relevance
to the assigned future outcome has not been established. The five-case gap between largest funding and
the oracle is theoretical headroom, not evidence that an LLM can extract useful predictive information.
A successful model could exploit fixture layout or luck. It would not establish investigation competence.

Reports therefore emit `paidComparisonReady: false`, `datasetQualification: FAILED_INDEX_PROXY`, and the
explicit readiness reason. The frozen pack is retained as contract/scorer regression evidence. Do not run
a paid comparison against it or tune the existing baseline to the leaked layout.

The next slice should independently register realistic decision tasks with documented, visible evidence
that can affect query yield: for example a receipt-backed graph ambiguity resolved by one of several
approved queries. Construct query results independently, avoid split/case-position identity and chronology
proxies, and test input-only shortcuts before registering a paid plan. Keep realistic uncertainty: do not
invent informative hints to guarantee a model win. The future two-case gain threshold in the protocol is
only a proposed finite screen; dataset qualification must pass first and it is not a generalization claim.

## Reproduction and provenance

```sh
pnpm query:score development
pnpm query:score evaluation
pnpm query:prepare evaluation
```

Scoring prints full JSON. Preparation prints input-only JSONL; it sends nothing. The CLI denies fetch access
and imports no capture/provider adapter. `QUERY_PIPELINE_PASS` means scorer/admission correctness, while
the separate dataset qualification remains failed. No model prompts or provider settings are created.
Committed reports include every case, chosen query, resource count, rejection probe and shortcut audit.
Tests reproduce both reports exactly. All strata and zero-budget cases remain in denominators.

- Development pack: `8ee4b2ec4e7c38c4f258332bdd95bdaea82e450d205a337e4a65ad775a4fabd9`
- Evaluation pack: `af25f8cd40b26dde06174366c9a1e8f01f0e772278486f9797964837c0372809`
- Actual scorer/schema/CLI/replay source digest:
  `be82d808215346a20cae78ae1aa1c0461cfa857a9c69ada9c7ca012b7ad14dbb`

Reports additionally bind registration and generator digests. The loader verifies quotas, IDs, receipts,
case/pack seals and exact regeneration. Resealing fabricated outcomes cannot bypass regeneration.
All existing workforce contracts, the #130 replay/proposal/benchmark sources, original archived evidence
and lockfile remain unchanged. New model calls: **0**. New model cost: **$0.00**.

## Verification and rollback

TypeScript, 533 repository tests via Node's tsx import hook, pinned web check and isolated Product Surface
V2 check pass locally. Ten new tests cover snapshot binding, future evidence, forged claims, windows,
ties/catalog permutations, zero budgets, wrong authority/query/citations, selected-only materialization,
safe incompleteness, resealed oracle tampering, overwrite refusal and complete report reproduction.

One hostile self-review found high-severity snapshot-binding and safety/completeness reporting gaps.
Both were fixed, and one targeted rereview passed. The dataset audit additionally demonstrated the index
proxy; paid readiness is blocked and the frozen evidence is preserved. No independent reviewer or subagent
participated. No further broad review is required for this slice.

Revert this isolated three-commit changeset to restore #130. No persisted jobs or production state need
rollback. The experiment's dataset failure remains documented as evidence, not hidden behind green tests.
