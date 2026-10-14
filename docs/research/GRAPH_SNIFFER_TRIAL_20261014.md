# BINRAT — Graph Sniffer first bounded offline trial

**Date:** 2026-10-14
**Track:** RESEARCH ONLY / no live capability
**Roadmap owner:** `docs/ROADMAP.md` on the React/Pons integration lineage
**Baseline ref:** `integration/binrat-a1-3-visual-gate` at `160ab9c4fbb2f9cebd4a45cc20f5e75d85f57302`
**Product policy:** `docs/CANONICAL_AUTHORITY.md` routes to Founder North Star and Engineering Stack North Star; this receipt does not override either.

## Mission and frozen hypothesis

> Does source-linked graph reasoning uncover a verified, useful funding-to-Pons-launch relationship that the existing Case/deployer-history baseline did not already show, without inventing owner identity or future knowledge?

**PASS:** at least one *real*, chronology-valid, new funding-to-launch relationship beyond the plain Case reader, with source receipt references and demonstrated user-consequence hypothesis; zero unsupported factual statements; bounded costs. **KILL/PARK:** none found or insufficient source coverage; do not interpret synthetic positives as live discovery.

**Test budget:** no provider/RPC/model/network requests beyond GitHub reads of preexisting public repository evidence; no external sends, cost $0 new spend; one frozen bounded analysis, ten synthetic adversarial controls. No repository application code, production resources, data schemas or dependencies changed.

## Exact captured evidence used

All three files were read from the pinned integration branch and checked against their Git blob SHAs (3/3 match):

1. `docs/receipts/sprint-a1-1/public-feed.json`, blob `1dd32cc861f4228b965ac655c659f8fc319366d7`: captured Pons 4663 latest feed with 20 launch records, `historyCoverage=PARTIAL`, selected earlier report rather than current live read.
2. `docs/receipts/sprint-a1-2-contract/old-case-envelope.json`, blob `ac4258f22bb32643b4829a699f7c5bf4720690ba`: selected historical Case envelope with 20 launches for the same reported creator/deployer; `archivedPublication=false`, `pointInTimeReplay=false`, `olderHistory=NOT_ENUMERATED`.
3. `docs/public-evidence/sniffer-prospective-confirmation-20261006-v1/audit.json`, blob `fe2bad897ca82fd6329118818134353715c7d43e`: one captured verified native funding observation on Robinhood 4663, with handoff but `finding=null`, `caseDiff=null` and `notification=null` after 48/48 recorded RPC calls. Its underlying original trial was exhausted. Do not rerun it.

A read-only analysis used a minimal in-memory adjacency map of reported-deployer -> launch IDs and funding sender -> recipient, with block-order and evidence gates. In a **second isolated parity check**, NetworkX **3.6.1** in the assistant's disposable Python container reconstructed the **20 actual latest-feed reported-deployer addresses** plus the separate real funding edge using row-index launch nodes: **40 nodes, 21 edges, 18 distinct feed deployers, 2 recurring address groups, and 0 matched funding-to-launch paths**. Parity against the plain grouping baseline **PASS**; additional useful findings **0**. The Python input was a manual projection of the captured fields, **not a new independent RPC/provider read**. No NetworkX installation in BINRAT, performance benchmark, actual live Python graph service, predictive model, RPC read or production endpoint test was performed.

## Results

| Measurement | Observed | Interpretation |
| --- | ---: | --- |
| Captured launch rows | 40 | Two deliberately selected source groups; **not** 40 independent randomly sampled launches |
| Distinct launch IDs | 40 | Within these captures only |
| Latest-feed reported deployers | 18 across 20 launches | Two addresses appeared twice |
| Latest-feed launches with `priorLaunchCount > 0` | 4 | Explicitly known to the old feed; graph did not discover these |
| Historical Case observations | 20 under one reported creator | A selected high-recurrence Case, not evidence of cohort prevalence |
| Confirmed funding observations | 1 | Separate October 6 trial |
| Source-linked, strictly later Pons launch matching that funding recipient | **0** | Only within the captured rows; chain-wide absence **not** established |
| Additional verified useful funding-to-launch findings over baseline | **0** | No incremental Graph Sniffer product-value proof |
| Synthetic evidence/chronology controls | **10/10 PASS** | Implementation sanity only, not model intelligence |

Ten synthetic checks: valid funding before later launch; reject funding after launch; reject same-block ambiguity; reject wrong chain; reject different recipient; reject missing funding proof; reject missing launch proof; reject hash disagreement; reject unresolved reorg; reject incomplete coverage. These tests were executed in an isolated, one-off read-only JS evaluator over data returned from GitHub. No persistent test harness has been merged or wired into CI. In particular, the synthetic positive **cannot be counted as a real new launch**.

## Hostile review / limitations

- The two launch sources span different historical captures; their combined address graph is **not** independently known contiguous coverage, and the selected 20-launch historical Case strongly biases recurrence statistics.
- Direct occurrence of the same Pons-reported address across launches supports **address recurrence**, not common ownership or trader identity. The graph provides no new causal inference.
- The Sniffer trial's recorded funding recipient has no verified corresponding launch in these 40 observations; that is not evidence the recipient never launched.
- This evaluation compared simple adjacency grouping against already displayed launch counts. It did **not** measure latency, graph algorithm overhead, wallet PnL, anomaly detection, source completeness, relevance from real users, or willingness to pay.
- Ten manually authored synthetic controls test logical gates but cannot validate their integration with BINRAT's production receipt validator or catch adversarial provider omissions. The isolated NetworkX parity check tests graph construction over captured address fields only; it does not validate on-chain evidence or chain-wide coverage.
- Graph object labels, model output and token metadata must remain untrusted inputs. Future observations must not be laundered into earlier decisions.

**Hostile verdict:** no factual signal improvement established. Avoid installing NetworkX/DuckDB/PyOD/River or a general agent framework into the live stack on this evidence; continue to prioritize real Tripwire persistence/delivery and operational custody.

## Verdict and single next action

`OFFLINE_GRAPH_LOGIC = PASS_10_OF_10_SYNTHETIC_CONTROLS`

`GRAPH_SIGNAL_PROMOTION = NOT_YET`

`NOVEL_REAL_FINDINGS = 0`

`PRODUCTION_ADOPTION = NONE`

`WTP_EVIDENCE = NONE`

**NEXT:** obtain a separately justified **representative, source-covered** real-Case cohort containing both verified funding edges and subsequent Pons launch receipts, then test whether a graph produces *at least one* supported and useful relationship absent from the deterministic Case baseline. Prefer existing indexed evidence at zero additional spend. If adequate coverage is unavailable, report `BLOCKED_SOURCE_COVERAGE`, not a synthesized positive. One bounded pass, no indefinite RPC/provider hunt.

**STOP:** draft roadmap change only, with no merge/deploy/provider grants, token action, local worktree changes or production mutation.
