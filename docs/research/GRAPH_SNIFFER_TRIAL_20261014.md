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

## Second bounded trial — real October 2 provenance pair

**Scope/date:** follow-up on 2026-10-14 using *preexisting* 2026-10-02 GitHub source documentation, zero live RPC/model/provider requests and zero production writes. This is **not** a prospective run. The original first trial above remains unchanged.

**Pinned source:** `docs/product/PONS_FUNDING_PROVENANCE_V1.md` on PR #91 at commit `95968749eac6691d2645344bf8cb7b2a0a227ade`, blob `d78999e5c8532f5c2f25f4774999db68cb8fc3ab`. That report describes an eight-launch chain reconnaissance with 8/8 observed prior non-self direct native inbound transfers. It names two launch transactions `0x259bd408520b99864a7a069896dcf6868fe0ed18a3bbce95ff32f02fd9ab06d7` and `0x800584ff77c8362c62ebbfe9a69ff319fa2fa960e20e093fc62b407b051d756a`, and two transfer transactions `0xcb29fa5271340288f12d79fba9adcd783a6d789e4dc043bd299812620511e9e2` and `0xd39de406f8f67197ab5a035d3969efec28db554290a6e8c3242c069f702e9df4`. All four transactions were **reported** to have been canonically checked by the original investigators; this chat could not independently retrieve/replay the raw launch-event and transaction receipts, and the 2026-10-02 reconnaissance was explicitly **not persisted as BINRAT evidence**.

**Documented observed relation:** one source address `0x9bc462bce2acd6fbe2ef5470d55b439453451083` funded two distinct reported deployers `0xaf70c00d8d252fc9fe68f00525b8df4e4fdcfcb8` and `0x720da24e4d6193d8618f2e1d79e7ece34628e3c2`; each recipient later launched via Pons, by reported strictly increasing block numbers. The two funding → launch gaps are 1,395 and 4,728 blocks (no wall-clock lead time inferred here). This establishes a **documented retrospective same-funder pattern only**. Funding does not establish a common team, owner, causality, predictive signal, or token outcome.

**Isolated calculation:** NetworkX 3.6.1 in the assistant's disposable Python environment built a directed source → two recipients → two launch transaction nodes graph: **5 nodes, 4 edges, 2 two-hop paths**. A simple pure-Python deterministic recurrence predicate returned the same positive relation; 10/10 targeted synthetic/adversarial controls passed (one source report positive; same deployer; same launch; different funder; self-transfer; wrong chronological order; same block; wrong chain; missing transfer verification; missing launch verification). Flags in the one real-source positive were accepted from the dated written report; these tests **do not re-verify the original chain facts or actual production validator**.

**Baseline:** `src/cloudflare/ponsFundingRecurrenceReadModel.ts` on PR #147, Git blob `a8143744c284617a334ccd296f6eff50829d83`, already implements the exact `SAME FUNDING SOURCE` criterion: same verified funding-source address, at least two distinct deployers, at least two launches. Thus the graph finds **0 additional verified actionable relationships** beyond the pre-existing deterministic implementation. An earlier documented 8/8 basic prior-inbound result warns that the mere presence of a prelaunch transfer is not a discriminative signal.

**Representative cohort status:** `BLOCKED_SOURCE_COVERAGE`. PR #147's preregistered 20-recipient historical cohort failed on its second request because public RPC did not support `eth_getCode` at a historical block; **zero recipients were selected and yield remains unknown**. PRs #144/#145 recorded real prospective funding/handoffs but no later launch in their bounded windows. Do not relabel those as negatives or claim sample-level significance. Independently replayable, time-correct source receipts for a representative set of funders, recipients and later Pons launches were not available in this pass.

**Second-trial verdict:** `DOCUMENTED_REAL_POSITIVE = ONE_RETROSPECTIVE_SHARED_FUNDER_PAIR`; `NEW_GRAPH_VALUE_OVER_EXISTING_READER = ZERO`; `RAW_RECEIPT_INDEPENDENT_REPLAY = NOT_DONE`; `REPRESENTATIVE_COHORT = BLOCKED_SOURCE_COVERAGE`; `NETWORKX_PRODUCTION_ADOPTION = NO`.

**Single next action:** repair the **existing #147 historical-state transport routing** in a bounded *offline-only* test so that archive-eligible historical-code reads use the previously authorized archive-capable transport instead of public RPC, while remaining fail-closed on unsupported/unauthorized access. Do **not** rerun the stopped cohort, activate paid calls or expand the denominator without a separately registered and authorized new experiment. If the archive capability is still unavailable, defer the funder-yield hypothesis rather than building more graph machinery.

## Verdict and single next action

`OFFLINE_GRAPH_LOGIC = PASS_10_OF_10_SYNTHETIC_CONTROLS`

`GRAPH_SIGNAL_PROMOTION = NOT_YET`

`NOVEL_REAL_FINDINGS = 0`

`PRODUCTION_ADOPTION = NONE`

`WTP_EVIDENCE = NONE`

**CURRENT NEXT (after the second trial):** perform one bounded offline repair of #147's historical-state routing, using the already defined archive-capable transport in a mocked/tested read-only path. Do not dispatch RPC or reuse a stopped capture. Only a separately authorized future experiment with verified archive capability could attempt representative cohort collection; otherwise defer as `BLOCKED_SOURCE_COVERAGE`. Graph engine adoption stays blocked pending incremental evidence value.

**STOP:** draft roadmap change only, with no merge/deploy/provider grants, token action, local worktree changes or production mutation.
