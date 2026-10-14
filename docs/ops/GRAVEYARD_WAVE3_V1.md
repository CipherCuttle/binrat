# Graveyard Wave 3 — exact local closure preparation

STATUS: AWAITING_OWNER_GRANT  
DOMAIN: repository archaeology / archival PR closure  
SOURCE_BRANCH_SHA: main `d93defb8b59be5c5a9fd9f7f5733b766567c4b10`  
AS_OF: 2026-10-14T02:18:15.171763+00:00  
AUTHORIZATION_EFFECT: NONE

The 18 specified PRs remain open and unmerged, and all 18 original remote heads match the refreshed inventory. No PR comments, closures, merges, remote ref changes or deployment actions were performed. This is a closure-ready proposal subject to a fresh recheck and exact owner grant; executed-closure acceptance is still pending.

[Canonical authority](../CANONICAL_AUTHORITY.md) remains the sole routing index. [Machine manifest](GRAVEYARD_WAVE3_CLOSURE_V1.json) carries every exact base/head SHA, activity time, dependency, changed file/blob comparison, comment path and permission gate. [Snapshot](GRAVEYARD_SNAPSHOT_V1.json) is the bounded current inventory. The October 2 manifest at `origin/ops/binrat-repo-cleanup-manifest-v1:docs/ops/BINRAT_REPO_CLEANUP_V1.md` is historical input only: its assertion that offline entitlement billing was superseded by #103 confuses two different funding domains and is not adopted.

## PLAN → CHANGESET

Purpose: retire obsolete draft tracking while preserving source, original art, dated operational receipts and future donor value. Kill condition: changed SHA/state/dependency, inaccessible donor evidence, missing branch, attempted deployment, or missing exact owner grant.

Prepared 18 individual archival comments under [graveyard-wave3-comments](graveyard-wave3-comments/), exact SHA closure manifest, dependency proof and original donor artifact hashes. No historical source files were edited.

| PR | Primary disposition | Exact head | Direct open PR-base children | Changed paths from declared base |
|---|---|---|---|---|
| #11 | `DONOR` | `de06b9cb4cd5b0c4de1d007c00a4d8466af21f0e` | #12 | 25 |
| #12 | `DONOR` | `69793aef3ac6c152e0a91d8c914a6f71c5a4f0f3` | #14 | 27 |
| #14 | `GRAVEYARD` | `4c956acaa062fc2196096dab3a73057f3fd042bf` | #18 | 65 |
| #18 | `GRAVEYARD` | `b5755fef349a4badc153fee9e9811461cac1a919` | #19 | 16 |
| #19 | `DONOR` | `b1b25e3bbd08189e7e913ef16768841ba7cb5296` | #20 | 76 |
| #20 | `GRAVEYARD` | `5b38cdf00e7e170af7c1f1cc18f9d1a24160c928` | #26 | 6 |
| #26 | `GRAVEYARD` | `614363b77ce288384ac27f5a7dc1aa018076a8d3` | #27 | 5 |
| #27 | `GRAVEYARD` | `5e7d8fa0e37b007d7d58d0acc9cc223b27c79095` | #28 | 3 |
| #28 | `GRAVEYARD` | `1479adc08e3b171d47b171e51867d8d0c607a86e` | #29 | 6 |
| #29 | `GRAVEYARD` | `eefda7326c283b54ec415c8abd948a274a9df674` | #30 | 10 |
| #30 | `GRAVEYARD` | `462d70b8d00adafdd69adfd01ddf9f904ede01fa` | #32 | 7 |
| #32 | `GRAVEYARD` | `f1411ab83eddb25ed18c88584b6e26e75e86f163` | #35 | 13 |
| #35 | `DONOR` | `54825038129d9bf4c9730664919cb7e83dd74211` | #37 | 7 |
| #37 | `DONOR` | `114b0572de3f3d153d24a155b8cfbbea07f38670` | #38, #39 | 11 |
| #38 | `DONOR` | `a6f03dd3191dbeb9309d1af5d49608dfcc965fc2` | #40 | 3 |
| #39 | `DONOR` | `1e043cda038ed8b94ee7694416385ce807727964` | #42 | 4 |
| #40 | `DONOR` | `55af899617fc38af71b746e3e90a9f2de3e6e53a` | none | 11 |
| #42 | `DONOR` | `c8f55a221e88b3f7cab4cacf6302c5d171f75a48` | none | 4 |

## Dependency and preservation proof

Leaf-first closure order: **#40, #42, #38, #39, #37, #35, #32, #30, #29, #28, #27, #26, #20, #19, #18, #14, #12, #11**. The complete 151-open-PR inventory yields **zero outside-family direct or transitive PR-base descendants**. The ordinary chain runs #11 → #12 → #14 → #18 → #19 → #20 → #26 → #27 → #28 → #29 → #30 → #32 → #35 → #37, then splits #38 → #40 and #39 → #42. Here arrows mean parent/base → child.

Outside-family textual citations were inspected, not ignored: #43 documents #39/#40 proof boundaries; #56's exact-source extraction matrix preserves earlier Watch/Radar/SIWE/entitlement concepts and says no old stack was merged; #57's historical extraction matrix labels old Pons observations as reread expectations. Closing a tracking PR does not sever these citations because every original ref and immutable SHA remains. None is an outside-family PR-base edge. This does not qualify any branch for deletion.

Heads #11/#12/#14/#18/#19 are mechanically ancestors of current integration `160ab9c4fbb2f9cebd4a45cc20f5e75d85f57302`, production-release source `8a2245176889e5e75aeb3695661e8dc834e2cac6`, and Tripwire `216647d214a7df05d1eb48e99d8af27dc4262392`. They are not ancestors of current main. #20 onward heads are not ancestors of those four selected current heads; useful content is **not assumed integrated**. Every changed path is compared by exact Git blob with the four selected current trees in the manifest, including a same-blob-anywhere check. This is tree comparison, not proof of exhaustive semantic uniqueness or license clearance.

## Special donor #40 — historical chain evidence

Preserve `feat/binrat-g2a-a1-pons-receipt-proof-v1` at `55af899617fc38af71b746e3e90a9f2de3e6e53a`. The original manifest records three distinct 4663 Pons V2 factory receipts at blocks **72448839, 72448843, 72448913**, factory `0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e`, source `ponsdotdev/pons-labs@162310fbd1217717e2f5e4cde794d6a11322b469`, deployment block **26841846**, and runtime code hash `0x89a27da6f703e0a7cdd4f233e7cb57604ff75b164530962d3ff7cf8483a67d84`.

The saved SolidRPC/Tenderly evidence agrees on receipt core SHA-256 `082a632ee2af45a7ec0ef0fac80d5adf3a49d09f1ca304da195d5109125f3fba`; the manifest records independent Robinscan observations. No explorer or RPC was contacted during this sprint. The original verifier revalidates the recorded package's provider bindings, raw ABI data and digest offline; it cannot independently reproduce the historical network observations today. Preserve the Blockscout indexing disagreement and negative provider results.

The original capacity document still says live verification was pending, whereas the later evidence package and historical review record the three-receipt collection. Preserve both as dated stages, and use the later package only for its historical sample. `originalDeployer` does not establish human identity; creator fee recipient remains null; curve trades, graduation, V4 state, current provider availability, production ingestion/alerts and finality are unproved. Original source adapter `src/pons/source.ts` remains at the same head (inherited from #38).

## Special donor #42 — offline billing ledger

Preserve `feat/binrat-g2b-funding-ledger-v1` at `c8f55a221e88b3f7cab4cacf6302c5d171f75a48`. This is **signed offline billing-event evidence**, distinct from #103's onchain funding provenance. Preserve `OFFLINE_SIGNED_FIXTURE`, account/period/funding identities, revision/action/payload digest, append-only SQL triggers, `AUTHORIZED`/`REFUNDED`/`CHARGEBACK`/`REVOKED`, replay/conflict fences and **`grantAuthority:false`** for known and unknown status. It never creates or extends entitlement periods.

Original tests cover disabled recording, authorization, replay, out-of-order refund, chargeback, invalid signature, event/revision conflicts, API-level and direct-SQL identity rebinding, and delete immutability. REVOKED is supported in code/schema; its original test occurrence is a rejected identity rebind, not proof of a successful revocation lifecycle. No new coverage claim is made. Real provider authentication, merchant/legal acceptance and distributed D1 contention remain unproved.

All following original donor paths/blobs are absent from the four selected active trees, both at the same paths and as identical blobs elsewhere in those trees. Retaining only integration would lose this recoverability.

| Donor | Original path | Git blob SHA-1 |
|---|---|---|
| #40 | `docs/capacity/G2A_A1_PONS_RECEIPT_PROOF.md` | `0e2884e5ec8b35497c002f44404fb452627ee579` |
| #40 | `docs/reviews/PONS_EVIDENCE_HOSTILE_REVIEW_2026-09-25.md` | `3df6b4fbdc146a481c67b3753af845758596bc36` |
| #40 | `evidence/pons/4663/2026-09-25/README.md` | `031a7e49670ae23b4a9adddfef823bc98636b09f` |
| #40 | `evidence/pons/4663/2026-09-25/manifest.json` | `19836903210923ff89fc0b4774f6ba3cd46654f9` |
| #40 | `evidence/pons/4663/2026-09-25/solidrpc.receipt-proof.json` | `361f18da0ff8da8f523d1d66d72e921b80fc2df4` |
| #40 | `evidence/pons/4663/2026-09-25/tenderly.receipt-proof.json` | `ad66a9117b559ee1703fe78f06991e5073c93b57` |
| #40 | `scripts/pons-proof.ts` | `f9d5d4001716436471ffaeaed34549be75adf419` |
| #40 | `scripts/verify-pons-evidence.mjs` | `0466800741d0494b3fca5530e294f2b1018f9318` |
| #40 | `src/pons/liveEvidence.ts` | `be5cbeb1c1dabb7165ba2eddc92228bc2893e4a2` |
| #40 | `test/ponsLiveEvidence.test.ts` | `0bbf8600813991c2c4c6e8a3bac07ee35257051e` |
| #42 | `docs/capacity/G2B_PREPAID_CANDIDATE.md` | `f3fe87e7a9bcd5ffacf2dc1744018b1449a3d6ed` |
| #42 | `src/entitlements/fundingEvents.ts` | `dba9853b4d3fe6f0676fe24692f6459f62754421` |
| #42 | `src/entitlements/schema.ts` | `b2232c80b38ea5e97aac6e405026696abf24ebb8` |
| #42 | `test/fundingEvents.test.ts` | `2eb685db7d2f66254d192b41d3a7398fa7be299b` |

## VERIFY → VERDICT

- All 18 supplied head SHAs match GitHub branch inventory and local fetched origin refs; all remain OPEN with `merged_at=null`.
- Full open-PR graph rechecked: 18-member family; outside-family descendants 0; proposed order places every child before its parent.
- Original #40 verifier: exit 0; `ok:true`, receiptCount 3, matching core digest above. Original mocked collector suite: **7 passed / 0 failed**.
- Original #42 funding-event suite: **3 passed / 0 failed**. Executed original files in isolated `/tmp` with Node v24.20.0 and existing dependencies; no installation or network calls. Initial #40 scratch setup omitted `src/evidence/canonical.ts`; adding that original imported file resolved MODULE_NOT_FOUND without editing source.
- License and deployment reuse remain separate gates: #11 contains font licensing and historical approved assets; candidate deploy workflows can target live Cloudflare/D1. Closure is harmless to refs; blindly pushing/restoring old branches is not authorized.
- Bounded hostile review is recorded in the execution dashboard; this report does not claim independent review before that receipt exists.

**AWAITING_OWNER_GRANT:** post exactly the 18 prepared comments and close exactly these 18 PRs in manifest order, while retaining every branch/head. Owner grant must explicitly cover those remote writes. Before execution, re-fetch state/head/base and the complete dependency graph; any drift stops the batch for a refreshed manifest. After each closure verify CLOSED/unmerged, unchanged PR head and remote branch SHA. Do not use branch-delete options.

Before: **151 open PRs / 242 remote branches**. After this preparation: **151 / 242**, **0 closed**. If only the authorized 18 closures later occur, expected count is **133 / 242**; actual final state must be independently counted. No branch is safe to delete under this sprint.
