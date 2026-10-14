# S3 — complete graveyard classification

STATUS: EXACT_VERSION_RECEIPT / LOCAL_RECOMMENDATION. DOMAIN: repository maintenance. AUTHORIZATION_EFFECT: NONE. Use [the existing authority router](../CANONICAL_AUTHORITY.md).

PLAN: classify the complete current graph while keeping unique implementation, assets and negative research results reachable. PASS: one primary disposition and exact Git evidence or explicit unresolved blocker for every PR/branch. KILL: uncertain replacement or uniqueness blocks cleanup; never guess from a title or a zero direct-dependent count.

CHANGESET: [inventory](GRAVEYARD_INVENTORY_V1.json) covers **182 PRs, 242 remote branches, and 78 local branch identities across independent clones**. Every GitHub record contains head/base SHAs, activity timestamp meaning, exact graph dependents, reason, preserved authority, source/asset/evidence delta, security/license/deployment concerns, permission flags and evidence pointer. Local branch bases are explicitly unknown where Git stores no intrinsic base; local names do not imply their unpublished heads are remote.

[Git comparisons](GRAVEYARD_GIT_EVIDENCE_V1.json) contain merge-base deltas, exact path/mode/blob differences against integration, commit reachability and tree IDs. Orphan history has a null merge base and a full-tree inventory. These are exact historical comparisons, not semantic or license equivalence. [S3 family evidence](GRAVEYARD_S3_FAMILY_EVIDENCE_V1.json) adds the inspected frontend/research deltas and their retained limits.

## Open PR dispositions

| Primary disposition | PRs |
| --- | ---: |
| ACTIVE | 1 |
| ACTIVE_ANCESTOR | 5 |
| DONOR | 53 |
| GRAVEYARD | 9 |
| MERGED_REDUNDANT | 26 |
| OPS_RECEIPT | 9 |
| QUARANTINE | 48 |

## Family decisions

- **Wave 3:** 18 exact PRs, individually reasoned in [the closure manifest](GRAVEYARD_WAVE3_CLOSURE_V1.json), with donor preservation and leaf-first dependencies. This is the only closure-ready batch. Permission remains AWAITING_OWNER_GRANT.
- **Historical frontend #21/#22/#23:** exact heads are ancestors of integration. Preserve their original tests/history and stacked base refs. **#24 is QUARANTINE:** its current head is a backend-only reset despite its old mobile-M1 title; #34 used an earlier historical base. A title-based retirement would misdescribe source.
- **Old AI/Telegram #34/#36:** DONOR; original schema, Scout progress/media and tests remain distinct. No live activation was established. The #34 candidate workflow can mutate resources and post PR comments.
- **Design #48/#50:** DONOR Svelte world/effect mechanics, not the selected React V3 frontend. **#49/#53:** QUARANTINE for exact license/reuse scope and absent art/approval evidence respectively. Keep original manifests and notices; do not copy licensed commercial source based on visual similarity.
- **Funding/Case:** continue #81/#88/#103/#104 through integration. #91 remains protected evidence although its current head is not a selected-source ancestor. #93 is a superseded donor with #94 still dependent. Reconstructed #94/#98–#102 work is not declared equivalent just because #104 has a similar feature. Unresolved reconstruction and stack semantics remain quarantined.
- **Telegram #68/#69 and outcomes #73/#74:** actual source differences are recorded in [the source map](GRAVEYARD_SOURCE_MAP_V1.md). #68/#73/#74 are donors; chosen Telegram history uses #69. No probe is restarted.
- **Workforce/research #123–#147:** preserve offline contracts, jobs/Den, evaluations, raw failure/negative receipts and bounded research as donors. None is automatically a live Rat, production dependency, renewed provider allowance or permission to publish messages.
- **Prelaunch research #152–#162:** preserve original protocols, benchmarks and prospective receipts. The hard-delayed-control falsification, 0/12 insufficient-data replay, 0/1 partial pair and zero-verified prospective captures must remain searchable. No performance/prediction claim or new experiment is authorized.
- **Authority/ops #180/#181:** #180 is quarantined until branch-local entrypoint reconciliation; merged #182/#183 govern routing. #181 is an operations receipt/donor with stale NOT RUN prose relative to later owner-reported freeze; preserve both dated records and do not rerun containment.
- **Brand/token/launch:** protect all original exact asset/source authorities and gated launch contracts. Unknown art rights, current legal/upstream facts and unchosen identity history remain blockers, never inferred from test success.

## Closure and unresolved set

No additional family is promoted to a closure-ready batch without the missing semantic/dependency/approval evidence. Every QUARANTINE record names its blocker and exact delta evidence; safeToClosePR and safeToDeleteBranch are false. 48 open PRs remain quarantined. Closing tracking would not include their code in another source. Every branch deletion flag remains false, including contained history, because deployment/reference and permanent custody gates are independent.

VERIFY: `python3 scripts/audit/graveyard_check.py` checks exact complete snapshot coverage, classification/schema, graph edges, comment paths and owner gates; its adversarial tests exercise drift, unsafe deletion, merged state and new outside-family children. The dashboard records the final outputs and one bounded hostile review. VERDICT: classification coverage complete; remote closures remain gated and unresolved source questions are preserved explicitly.
