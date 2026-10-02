# BINRAT Repo Cleanup Manifest v1

- Repo: `CipherCuttle/binrat`  |  Generated: 2026-10-02T21:23:16.513589Z  |  Scope: 87 open PRs + 144 remote branches (231 records)
- Author of record: BINRAT repository-archaeology audit (read-only). **Nothing was closed, merged, deleted, or reconfigured by this audit.**
- Companion machine-readable manifest: [`docs/ops/binrat-repo-cleanup-v1.json`](./binrat-repo-cleanup-v1.json)

## 1. Methodology

1. Regenerated inventories: `gh pr list --state open --limit 200 --json number,title,headRefName,baseRefName,updatedAt,headRefOid` (87 PRs) and `git for-each-ref refs/remotes/origin` (144 real branches; the `origin` line is the `origin/HEAD` symbolic ref and is excluded).
2. Mechanical per-ref evidence (`scripts/audit/binrat_ref_inventory.py`): head SHA, last commit date, `git merge-base --is-ancestor origin/main`, unique commit count (`git rev-list --count origin/main..ref`), unique file count (`git diff --name-only origin/main...ref`), open PRs referencing the ref as head/base.
3. Targeted ancestry/content checks (`scripts/audit/binrat_targeted_checks.sh`): pairwise `merge-base --is-ancestor` between candidate superseder/superseded pairs, two-dot diffs for the controlled-rat workflow branches, `git grep` on `origin/main` docs for old-family keywords (all zero hits: autonomous, north-star, hybrid blueprint, prefigma, dumpster, radar, scout, rats-share, robinhood, prelaunch).
4. Classification per ref using mechanical evidence + the authoritative prior-phase funding verdict. Anything that could not be proven safe was classified G (UNKNOWN_REVIEW_REQUIRED) with `requiresOwnerDecision=true`.
5. Verification (`scripts/audit/binrat_verify_manifest.py`): uniqueness/coverage vs live inventory, safety invariants, protected-SHA spot-checks, schema completeness. **ALL CHECKS PASSED** (receipt in section 8).

## 2. Category definitions

| Cat | Meaning | safeToClose | safeToDeleteBranch |
|-----|---------|-------------|--------------------|
| A | ACTIVE - current work that must remain | false | false |
| B | ACTIVE_ANCESTOR - required because a live stack depends on it | false | false |
| C | DONOR - not mergeable as-is; assets/decisions retained for extraction | false | false |
| D | SUPERSEDED - a newer authoritative successor exists | true (PRs) | only if content is provably in main; otherwise false |
| E | HISTORICAL_EXPERIMENT - rejected/obsolete exploration retained in Git history | true (PRs) | false (keep ref so history stays reachable) |
| F | OPS_RECEIPT - deployment/inspection/preview receipt; not active development | false | false |
| G | UNKNOWN_REVIEW_REQUIRED - safety unproven; human/strong-model review needed | false | false |

## 3. Summary counts

| Category | Branches | PRs | Total |
|----------|----------|-----|-------|
| A | 18 | 9 | 27 |
| B | 18 | 16 | 34 |
| C | 1 | 1 | 2 |
| D | 52 | 30 | 82 |
| E | 25 | 18 | 43 |
| F | 17 | 3 | 20 |
| G | 13 | 10 | 23 |
| **Total** | **144** | **87** | **231** |

## 4. Per-family narrative

### 4.1 Funding (authoritative verdict honored)

- PR #103 `feat/binrat-pons-funding-storage-v1` @ `90296437d8846df71311f9523a4e7a29d9968798` is **CANONICAL** (A).
- PR #91 `feat/binrat-pons-funding-provenance-v1` @ `95968749eac6691d2645344bf8cb7b2a0a227ade` is **ACTIVE_ANCESTOR** (B): declared base of #93 and #103.
- PR #93 `feat/binrat-pons-funding-collector-v1` @ `1175423a864ed6ac28c5473a55b850443f65076e` is **D SUPERSEDED** by #103 (every valuable invariant ported and test-verified). `safeToClose=true`, `safeToDeleteBranch=false` until #103 closure + ancestry verification. Evidence note: `git merge-base --is-ancestor` shows the funding-collector head is **not** a commit-ancestor of the funding-storage head (both share base #91), which independently justifies the deletion gate.
- PR #94 `feat/binrat-pons-funding-recurrence-read-v1` is **B**: the Case stack builds on it, but it is currently based on #93's branch and must be rebased onto #103 (recorded in its reason).

### 4.2 Case / product stack (must not be treated as stale)

- Chain #97 -> #98 -> #99 -> #100 -> #101 -> #102 (`feat/binrat-case-model-v1` @ `9dbc44b9` ... `ops/binrat-case-surface-private-preview-v1` @ `f5934950011455061569075fc6111d0022a11629`) classified A/B. #94's base is #93's branch; the pending rebase onto #103 is noted in reasons. Protected.

### 4.3 Brand stack (protected)

- `design/binrat-brand-system-v1` @ `770c7aa`, `design/binrat-copy-library-v1` @ `91cee9f`, `design/binrat-social-production-v1` @ `568b0a3`, `design/binrat-motion-identity-v1` @ `0b96eea`, `design/binrat-export-pack-v1` @ `de0fa94`, `review/binrat-brand-v1-integration` @ `7452747` - all A. New during audit: `integration/binrat-brand-v1-composed` @ `0343d381` (contains brand-system-v1 as ancestor) - A.

### 4.4 Roadmap donor (C)

- PR #70 / `feat/binrat-roadmap-living-scenes-v1` @ `ab844e4814d553b4485b7d3351e176c8376712a6` is **C DONOR**. Its old visual/mascot implementation is **not** canonical. Extract list (in JSON `extract` field): scene sequencing; lighting/effect mechanics; transition logic; roadmap interaction patterns. Never delete.

### 4.5 Old Arc/Astra product chain (D)

- #11-#14 and their branches (live-read, intelligence, live-candidate, network-roadmap, frontend-astra, cloudflare-d1, telegram-rat-v0): pre-reset product surface. Superseded by reset commit `28c4553` 'reset(main): backend-only BINRAT, remove original frontend (#41)'. PRs safe to close; branch refs retained (content not in main).

### 4.6 Old frontend / mobile M1 / Dumpster OS (D)

- #21-#25, #55 and branches (frontend pr1-pr3, mobile-m1, dumpster-os-d1, product-surface-demo, prelaunch-hardening): removed by the reset; superseded by the current Mini App stack (#84/#86/#89).

### 4.7 Old Pons candidate chain (D)

- #20, #26-#32 and branches (launch-receipt, canonical-selection, holder-balance-probe, siwe-bound, candidate-worker(-routes), cutover, discovery-consistency): pre-reset SIWE/cutover candidates superseded by the current token-identity + funding rails (#88/#91/#103).

### 4.8 G0/G1/G2 capacity + funding-ledger candidates (D)

- #37-#42 and branches: offline capacity/funding-ledger candidate chain; funding functionality superseded by #103 funding storage.

### 4.9 G3/G4/Grain Wave visual experiments (E)

- #46-#53, #54 and branches (g3a/g3b/g3c, g4a x2, g4r x2, g4r2/r4/r5 grain wave, reactbits-license-probe, r5-approved integration, design-review-gallery, rive x2, hero-image-fidelity): labeled experiments/drafts; design authority moved to brand system v1. PRs safe to close; refs retained for history.

### 4.10 Old Telegram / Rat / UX generations (D/E)

- Old generations (#18/#19 rat-watch/rat-radar, #33 research lab, #34 conversation experiment, #36 telegram-scout, radar workbench/case-file/calibration/final): superseded by the Telegram-as-code stack (#63/#69) and current Rat Trap/Case intelligence. #34/#33 are E (labeled experiment/research).

### 4.11 Current-era candidate chains superseded by production convergence (D) + unknowns (G)

- #68 (parallel telegram-messaging duplicate) -> D, replacement #69 (active lineage builds on #69).
- #72/#83/#85 token-identity candidate/livebase/runtime variants -> D, replacement #88 'converge bounded Pons token identity rail on production base' (ancestry check: none are ancestors of #88; content containment unverified, so branch deletion stays false).
- #73/#74 unchosen outcome-probe siblings -> E. #75/#76 chosen outcome-capability line -> G (no successor, no rejection evidence). #77 miniapp-hierarchy -> G (not an ancestor of #86/#89; purpose overlaps #89 'restore Hot Garbage journey').

### 4.12 Autonomous-Rat / prelaunch stack (G)

- #56/#57/#58/#59/#60 and branches (autonomous-rat-v1, rats-share, release-autonomous-rat-v1-1, robinhood-live-rat, telegram-ux-v2, telegram-mood-art, prelaunch-release-a911c23, token-prelaunch-control): stranded on the dead pre-reset base `codex/binrat-prelaunch-release-a911c23`; zero references in main docs; no explicit rejection evidence -> G, owner decision required.

### 4.13 Hotfixes from pre-reset main (G)

- #64/#65 (pons-launch-identity-retry, pons-catchup-throughput): branched from pre-reset main (424/416 commits off current main); fixes not found on current main; target code may have been rewritten -> G.

### 4.14 Ops receipts, previews, githack, diag (F)

- 17 branches: githack snapshots x3, preview-binrat x3, diag observability, cloudflare-deploy-v0, o2 production base/rollout, pons provider-regression deploy, pons replay production inspect, provenance repair deploy, rat-trap production inspect, token-identity production rollout, miniapp preview v1/v2. PRs #78/#82/#95 are F. Recent (2026-10-01/02) receipts carry `requiresOwnerDecision=true`.

### 4.15 Resets, controlled-rat workflow, merged refs (D)

- reset/backend-only-main-20260925, reset/binrat-backend-only-20260925 (duplicate ref of mobile-m1 SHA `3ca6cf59`): reset executed on main via #41; refs retained pending owner confirmation.
- ops/fix-controlled-rat-workflow-yaml-20260930 (two-dot diff vs main: empty - content identical) and ops/register-controlled-rat-workflow-20260930 (differs from main only by main's newer quote fix `9fea1c8`): D, `safeToDeleteBranch=true`.
- 7 fully merged branches (0 unique commits, is-ancestor=true): agent/arc-launch-ingest-v0, agent/binrat-public-read-plane-v0, design/binrat-brand-assets-v0, design/binrat-dumpster-web-v0, design/binrat-launch-presentation-v0, design/binrat-share-cards-v0, plan/binrat-v0 -> D, `safeToDeleteBranch=true`.

## 5. Proposed later execution order (owner-executed; this audit performed NONE of these)

1. **Close obvious superseded PRs** (D/E with `safeToClose=true`): 48 PRs. Start with #93 (unblocks the #94 rebase onto #103), then the token-identity candidate chain (#72/#73/#74/#83/#85), #68, old-lineage chains, and experiment PRs.
2. **Preserve donor refs**: `feat/binrat-roadmap-living-scenes-v1` (#70) and its extract list; never delete.
3. **Preserve active ancestors**: all A/B refs, including every base of an open PR in the funding/Case/brand stacks.
4. **Delete remote branches only after** (a) their PR is closed and (b) ancestry verification confirms content preservation (`git merge-base --is-ancestor` against the successor or main). Initially deletable now: only the 9 branches whose content is provably in main (7 fully-merged + 2 controlled-rat workflow branches).
5. **Never touch** `main`, `gh-pages`, active release authorities, or any A/B/C ref.

## 6. Top 10 highest-value stale families to clean first

1. **#93 (feat/binrat-pons-funding-collector-v1)** - Authoritatively superseded by canonical #103; closing it unblocks the #94 Case-stack rebase onto #103.
2. **#72/#73/#74/#75/#76 (token-identity + outcome candidate chain)** - Five candidate PRs superseded by production convergence #88; largest single PR-count reduction.
3. **#83/#85 (token-identity livebase/runtime)** - Port/runtime variants superseded by #88 on the production base.
4. **#68 (feat/telegram-messaging-v1)** - Parallel duplicate of active #69; active lineage builds on #69 only.
5. **#26-#32 (old Pons SIWE/cutover candidate chain)** - Pre-reset candidate chain superseded by current token-identity/funding rails.
6. **#21-#25 + #55 (old frontend M1/Dumpster/hardening)** - Frontend deliberately removed by reset(main) #41; superseded by current Mini App stack.
7. **#46-#53 (G3/G4/Grain Wave visual experiments)** - Eight experiment PRs; design authority moved to brand system v1.
8. **#11-#14 (old Arc/Astra product chain)** - Pre-reset product surface removed by reset; keep refs as history, close PRs.
9. **#19 + radar branches (old Radar generations)** - Superseded by Rat Trap projection + Case Model intelligence.
10. **#56/#58/#59/#60 (autonomous-rat stack)** - Stranded on dead prelaunch base; needs owner decision, then close 4 PRs.

## 7. Unknowns requiring human / strong-model review (G)

- 23 records (13 branches, 10 PRs). Branches: codex/binrat-prelaunch-release-a911c23, feat/binrat-autonomous-rat-v1, feat/binrat-miniapp-hierarchy-v1, feat/binrat-pons-outcome-capability-v1, feat/binrat-pons-outcome-receipts-v1, feat/binrat-rats-share-v1, feat/binrat-robinhood-live-rat-v1, feat/binrat-telegram-mood-art-v1, feat/binrat-telegram-ux-v2, hotfix/pons-catchup-throughput-v1, hotfix/pons-launch-identity-retry-v1, plan/binrat-token-prelaunch-control-v1, release/binrat-autonomous-rat-v1-1.
PRs: #56, #57, #58, #59, #60, #64, #65, #75, #76, #77.

## 8. Verification receipt

```
COMMAND: python3 scripts/audit/binrat_verify_manifest.py
EXIT_CODE: 0
SUMMARY: ALL CHECKS PASSED - 87 PRs exactly once; 144 branches exactly once; sets match live inventory;
  no A/B/C marked safeToDeleteBranch; every G has requiresOwnerDecision=true; no G PR safeToClose;
  protected SHAs spot-checked (funding 95968749/90296437, case c9bcb01c/f5934950, brand 770c7aa/91cee9f/
  568b0a3/0b96eea/de0fa94/7452747, donor ab844e48); #93=D repl #103; #70=C with exact extract list;
  summary counts consistent; full schema on all 231 records.
COMMAND: jq -e . docs/ops/binrat-repo-cleanup-v1.json
EXIT_CODE: 0
SUMMARY: JSON parses.
```

## 9. Branch-level appendix (D/E/F/G branches)

### Category D

- `agent/arc-launch-ingest-v0` -> main - Fully merged into origin/main (0 unique commits, is-ancestor=true); ref is redundant, content preserved in main history.
- `agent/binrat-public-read-plane-v0` -> main - Fully merged into origin/main (0 unique commits, is-ancestor=true); ref is redundant, content preserved in main history.
- `codex/prelaunch-hardening-v1` -> main (reset 28c4553 'backend-only BINRAT', PR #41) + current Mini App lineage (#84/#86/#89) - Pre-reset frontend/product chain; deliberately removed from main by reset commit 28c4553 (#41, 2026-09-30). Superseded by backend-only main + current Mini App stack.
- `design/binrat-brand-assets-v0` -> main - Fully merged into origin/main (0 unique commits, is-ancestor=true); ref is redundant, content preserved in main history.
- `design/binrat-dumpster-web-v0` -> main - Fully merged into origin/main (0 unique commits, is-ancestor=true); ref is redundant, content preserved in main history.
- `design/binrat-frontend-astra-v1` -> main (reset 28c4553 'backend-only BINRAT', PR #41) + current Mini App lineage (#84/#86/#89) - Pre-reset frontend/product chain; deliberately removed from main by reset commit 28c4553 (#41, 2026-09-30). Superseded by backend-only main + current Mini App stack.
- `design/binrat-launch-presentation-v0` -> main - Fully merged into origin/main (0 unique commits, is-ancestor=true); ref is redundant, content preserved in main history.
- `design/binrat-north-star-v1` -> main (reset 28c4553 'backend-only BINRAT', PR #41) + current Mini App lineage (#84/#86/#89) - Pre-reset frontend/product chain; deliberately removed from main by reset commit 28c4553 (#41, 2026-09-30). Superseded by backend-only main + current Mini App stack.
- `design/binrat-share-cards-v0` -> main - Fully merged into origin/main (0 unique commits, is-ancestor=true); ref is redundant, content preserved in main history.
- `feat/binrat-cloudflare-d1-v0` -> main (reset 28c4553 'backend-only BINRAT', PR #41) + current Mini App lineage (#84/#86/#89) - Pre-reset frontend/product chain; deliberately removed from main by reset commit 28c4553 (#41, 2026-09-30). Superseded by backend-only main + current Mini App stack.
- `feat/binrat-dumpster-os-d1` -> main (reset 28c4553 'backend-only BINRAT', PR #41) + current Mini App lineage (#84/#86/#89) - Pre-reset frontend/product chain; deliberately removed from main by reset commit 28c4553 (#41, 2026-09-30). Superseded by backend-only main + current Mini App stack.
- `feat/binrat-frontend-live-integration-pr3` -> main (reset 28c4553 'backend-only BINRAT', PR #41) + current Mini App lineage (#84/#86/#89) - Pre-reset frontend/product chain; deliberately removed from main by reset commit 28c4553 (#41, 2026-09-30). Superseded by backend-only main + current Mini App stack.
- `feat/binrat-frontend-mobile-m1` -> main (reset 28c4553 'backend-only BINRAT', PR #41) + current Mini App lineage (#84/#86/#89) - Pre-reset frontend/product chain; deliberately removed from main by reset commit 28c4553 (#41, 2026-09-30). Superseded by backend-only main + current Mini App stack.
- `feat/binrat-frontend-routes-pr2` -> main (reset 28c4553 'backend-only BINRAT', PR #41) + current Mini App lineage (#84/#86/#89) - Pre-reset frontend/product chain; deliberately removed from main by reset commit 28c4553 (#41, 2026-09-30). Superseded by backend-only main + current Mini App stack.
- `feat/binrat-g0-g1-capacity-foundation-v1` -> current funding rails (#88/#91/#103) - Offline G0/G1/G2 capacity + funding-ledger candidate chain (pre-reset); funding functionality superseded by current funding storage/provenance rails.
- `feat/binrat-g2a-a1-pons-receipt-proof-v1` -> current Pons rails: #88 feat/binrat-pons-token-identity-production-v1 / #91 / #103 - Old Pons candidate chain (SIWE/holder-probe/cutover/discovery) from pre-reset lineage; superseded by the current token-identity + funding rail stack.
- `feat/binrat-g2a-pons-source-candidate-v1` -> current Pons rails: #88 feat/binrat-pons-token-identity-production-v1 / #91 / #103 - Old Pons candidate chain (SIWE/holder-probe/cutover/discovery) from pre-reset lineage; superseded by the current token-identity + funding rail stack.
- `feat/binrat-g2b-funding-ledger-v1` -> current funding rails (#88/#91/#103) - Offline G0/G1/G2 capacity + funding-ledger candidate chain (pre-reset); funding functionality superseded by current funding storage/provenance rails.
- `feat/binrat-g2b-prepaid-entitlements-candidate-v1` -> current funding rails (#88/#91/#103) - Offline G0/G1/G2 capacity + funding-ledger candidate chain (pre-reset); funding functionality superseded by current funding storage/provenance rails.
- `feat/binrat-intelligence-v1` -> main (reset 28c4553 'backend-only BINRAT', PR #41) + current Mini App lineage (#84/#86/#89) - Pre-reset frontend/product chain; deliberately removed from main by reset commit 28c4553 (#41, 2026-09-30). Superseded by backend-only main + current Mini App stack.
- `feat/binrat-live-candidate-v1` -> main (reset 28c4553 'backend-only BINRAT', PR #41) + current Mini App lineage (#84/#86/#89) - Pre-reset frontend/product chain; deliberately removed from main by reset commit 28c4553 (#41, 2026-09-30). Superseded by backend-only main + current Mini App stack.
- `feat/binrat-live-read-v0` -> main (reset 28c4553 'backend-only BINRAT', PR #41) + current Mini App lineage (#84/#86/#89) - Pre-reset frontend/product chain; deliberately removed from main by reset commit 28c4553 (#41, 2026-09-30). Superseded by backend-only main + current Mini App stack.
- `feat/binrat-north-star-slice-g0-g2` -> main (reset 28c4553 'backend-only BINRAT', PR #41) + current Mini App lineage (#84/#86/#89) - Pre-reset frontend/product chain; deliberately removed from main by reset commit 28c4553 (#41, 2026-09-30). Superseded by backend-only main + current Mini App stack.
- `feat/binrat-pons-candidate-worker-routes-v1` -> current Pons rails: #88 feat/binrat-pons-token-identity-production-v1 / #91 / #103 - Old Pons candidate chain (SIWE/holder-probe/cutover/discovery) from pre-reset lineage; superseded by the current token-identity + funding rail stack.
- `feat/binrat-pons-candidate-worker-v1` -> current Pons rails: #88 feat/binrat-pons-token-identity-production-v1 / #91 / #103 - Old Pons candidate chain (SIWE/holder-probe/cutover/discovery) from pre-reset lineage; superseded by the current token-identity + funding rail stack.
- `feat/binrat-pons-cutover-candidate-v1` -> current Pons rails: #88 feat/binrat-pons-token-identity-production-v1 / #91 / #103 - Old Pons candidate chain (SIWE/holder-probe/cutover/discovery) from pre-reset lineage; superseded by the current token-identity + funding rail stack.
- `feat/binrat-pons-discovery-consistency-v1` -> current Pons rails: #88 feat/binrat-pons-token-identity-production-v1 / #91 / #103 - Old Pons candidate chain (SIWE/holder-probe/cutover/discovery) from pre-reset lineage; superseded by the current token-identity + funding rail stack.
- `feat/binrat-pons-funding-collector-v1` -> #103 feat/binrat-pons-funding-storage-v1 - Authoritative funding verdict: every valuable #93 invariant was ported into canonical #103 and verified by test. safeToDeleteBranch=false until #103 PR closure + ancestry verification (note: git ancestry check shows funding-collector is NOT an ancestor of funding-storage; both share base #91).
- `feat/binrat-pons-holder-balance-probe-v1` -> current Pons rails: #88 feat/binrat-pons-token-identity-production-v1 / #91 / #103 - Old Pons candidate chain (SIWE/holder-probe/cutover/discovery) from pre-reset lineage; superseded by the current token-identity + funding rail stack.
- `feat/binrat-pons-launch-receipt-v0` -> current Pons rails: #88 feat/binrat-pons-token-identity-production-v1 / #91 / #103 - Old Pons candidate chain (SIWE/holder-probe/cutover/discovery) from pre-reset lineage; superseded by the current token-identity + funding rail stack.
- `feat/binrat-pons-siwe-bound-candidate-v1` -> current Pons rails: #88 feat/binrat-pons-token-identity-production-v1 / #91 / #103 - Old Pons candidate chain (SIWE/holder-probe/cutover/discovery) from pre-reset lineage; superseded by the current token-identity + funding rail stack.
- `feat/binrat-pons-token-identity-livebase-v1` -> #88 feat/binrat-pons-token-identity-production-v1 - Token-identity candidate/livebase/runtime variant; #88 'converge bounded Pons token identity rail on production base' is the newer authoritative implementation the active stack builds on. Content containment in #88 unverified - verify before any branch deletion.
- `feat/binrat-pons-token-identity-runtime-v1` -> #88 feat/binrat-pons-token-identity-production-v1 - Token-identity candidate/livebase/runtime variant; #88 'converge bounded Pons token identity rail on production base' is the newer authoritative implementation the active stack builds on. Content containment in #88 unverified - verify before any branch deletion.
- `feat/binrat-pons-token-identity-v1` -> #88 feat/binrat-pons-token-identity-production-v1 - Token-identity candidate/livebase/runtime variant; #88 'converge bounded Pons token identity rail on production base' is the newer authoritative implementation the active stack builds on. Content containment in #88 unverified - verify before any branch deletion.
- `feat/binrat-product-surface-v1-demo` -> main (reset 28c4553 'backend-only BINRAT', PR #41) + current Mini App lineage (#84/#86/#89) - Pre-reset frontend/product chain; deliberately removed from main by reset commit 28c4553 (#41, 2026-09-30). Superseded by backend-only main + current Mini App stack.
- `feat/binrat-radar-calibration-v1` -> current Rat Trap / Case intelligence lineage (#80/#84/#86/#89, #97-#102) - Old Radar generation (calibration/case-file/workbench/final, rat-radar-v0); superseded by current Rat Trap projection + Case Model intelligence.
- `feat/binrat-radar-case-file-v1` -> current Rat Trap / Case intelligence lineage (#80/#84/#86/#89, #97-#102) - Old Radar generation (calibration/case-file/workbench/final, rat-radar-v0); superseded by current Rat Trap projection + Case Model intelligence.
- `feat/binrat-radar-final-v1` -> current Rat Trap / Case intelligence lineage (#80/#84/#86/#89, #97-#102) - Old Radar generation (calibration/case-file/workbench/final, rat-radar-v0); superseded by current Rat Trap projection + Case Model intelligence.
- `feat/binrat-radar-workbench-v1` -> current Rat Trap / Case intelligence lineage (#80/#84/#86/#89, #97-#102) - Old Radar generation (calibration/case-file/workbench/final, rat-radar-v0); superseded by current Rat Trap projection + Case Model intelligence.
- `feat/binrat-rat-radar-v0` -> current Rat Trap / Case intelligence lineage (#80/#84/#86/#89, #97-#102) - Old Radar generation (calibration/case-file/workbench/final, rat-radar-v0); superseded by current Rat Trap projection + Case Model intelligence.
- `feat/binrat-rat-watch-v0` -> main (reset 28c4553 'backend-only BINRAT', PR #41) + current Mini App lineage (#84/#86/#89) - Pre-reset frontend/product chain; deliberately removed from main by reset commit 28c4553 (#41, 2026-09-30). Superseded by backend-only main + current Mini App stack.
- `feat/binrat-telegram-rat-v0` -> codex/telegram-as-code-private-v2 stack (#63/#69) - Old Telegram generation (scout/rat-v0/ux-v2/mood-art); superseded by the Telegram-as-code stack rooted at #63.
- `feat/binrat-telegram-scout-v0` -> codex/telegram-as-code-private-v2 stack (#63/#69) - Old Telegram generation (scout/rat-v0/ux-v2/mood-art); superseded by the Telegram-as-code stack rooted at #63.
- `feat/telegram-messaging-v1` -> #69 feat/binrat-telegram-messaging-v1 - Parallel Telegram-messaging implementation opened same day as #69; active lineage (#70/#71) builds on #69, not #68. Content containment unverified - verify before any branch deletion.
- `fix/binrat-v2-evidence-integrity-pr1` -> main (reset 28c4553 'backend-only BINRAT', PR #41) + current Mini App lineage (#84/#86/#89) - Pre-reset frontend/product chain; deliberately removed from main by reset commit 28c4553 (#41, 2026-09-30). Superseded by backend-only main + current Mini App stack.
- `ops/fix-controlled-rat-workflow-yaml-20260930` -> main - Controlled-Rat workflow registration/fix; equivalent content already on main (08a42f7 'ops: register controlled Rat rollout workflow', 9fea1c8 'fix: quote controlled rollout workflow description'); two-dot diff vs main confirms content parity/supersession.
- `ops/register-controlled-rat-workflow-20260930` -> main - Controlled-Rat workflow registration/fix; equivalent content already on main (08a42f7 'ops: register controlled Rat rollout workflow', 9fea1c8 'fix: quote controlled rollout workflow description'); two-dot diff vs main confirms content parity/supersession.
- `plan/binrat-network-roadmap-v0` -> main (reset 28c4553 'backend-only BINRAT', PR #41) + current Mini App lineage (#84/#86/#89) - Pre-reset frontend/product chain; deliberately removed from main by reset commit 28c4553 (#41, 2026-09-30). Superseded by backend-only main + current Mini App stack.
- `plan/binrat-pons-canonical-selection-v1` -> current Pons rails: #88 feat/binrat-pons-token-identity-production-v1 / #91 / #103 - Old Pons candidate chain (SIWE/holder-probe/cutover/discovery) from pre-reset lineage; superseded by the current token-identity + funding rail stack.
- `plan/binrat-v0` -> main - Fully merged into origin/main (0 unique commits, is-ancestor=true); ref is redundant, content preserved in main history.
- `reset/backend-only-main-20260925` -> main - Reset staging ref; the backend-only reset already executed on main via #41 (28c4553). Keep ref until owner confirms no unique staging content is needed.
- `reset/binrat-backend-only-20260925` -> main - Duplicate ref: identical head SHA 3ca6cf59 to feat/binrat-frontend-mobile-m1 (old-lineage mobile M1); reset executed on main via #41. Keep until owner confirms.

### Category E

- `design/binrat-hero-image-fidelity-v0` - Labeled experiment/research exploration; never merged, not referenced by main docs; retain ref for Git history only.
- `design/binrat-public-identity-v0` - Labeled experiment/research exploration; never merged, not referenced by main docs; retain ref for Git history only.
- `design/binrat-rive-machine-demo-v0` -> design/binrat-brand-system-v1 family (current design authority) - G3/G4/Grain Wave visual experiment chain; superseded as design authority by brand system v1; retain refs as historical experiments.
- `design/binrat-rive-signal-prototype-v0` -> design/binrat-brand-system-v1 family (current design authority) - G3/G4/Grain Wave visual experiment chain; superseded as design authority by brand system v1; retain refs as historical experiments.
- `experiment/72h-hot-garbage-v0` - Labeled experiment/research exploration; never merged, not referenced by main docs; retain ref for Git history only.
- `experiment/binrat-design-review-gallery-20260928` - Labeled experiment/research exploration; never merged, not referenced by main docs; retain ref for Git history only.
- `experiment/binrat-g3b-reviewed-20260926` -> design/binrat-brand-system-v1 family (current design authority) - G3/G4/Grain Wave visual experiment chain; superseded as design authority by brand system v1; retain refs as historical experiments.
- `experiment/binrat-g3c-mobile-20260926` -> design/binrat-brand-system-v1 family (current design authority) - G3/G4/Grain Wave visual experiment chain; superseded as design authority by brand system v1; retain refs as historical experiments.
- `experiment/binrat-g4a-field-instrument-20260926` -> design/binrat-brand-system-v1 family (current design authority) - G3/G4/Grain Wave visual experiment chain; superseded as design authority by brand system v1; retain refs as historical experiments.
- `experiment/binrat-g4a-integration-20260926` -> design/binrat-brand-system-v1 family (current design authority) - G3/G4/Grain Wave visual experiment chain; superseded as design authority by brand system v1; retain refs as historical experiments.
- `experiment/binrat-g4r-cinematic-20260926` -> design/binrat-brand-system-v1 family (current design authority) - G3/G4/Grain Wave visual experiment chain; superseded as design authority by brand system v1; retain refs as historical experiments.
- `experiment/binrat-g4r-header-cta5-inspired-20260926` -> design/binrat-brand-system-v1 family (current design authority) - G3/G4/Grain Wave visual experiment chain; superseded as design authority by brand system v1; retain refs as historical experiments.
- `experiment/binrat-g4r2-grain-wave-20260927` -> design/binrat-brand-system-v1 family (current design authority) - G3/G4/Grain Wave visual experiment chain; superseded as design authority by brand system v1; retain refs as historical experiments.
- `experiment/binrat-g4r4-official-grain-wave-20260927` -> design/binrat-brand-system-v1 family (current design authority) - G3/G4/Grain Wave visual experiment chain; superseded as design authority by brand system v1; retain refs as historical experiments.
- `experiment/binrat-g4r5-demo-first-20260927` -> design/binrat-brand-system-v1 family (current design authority) - G3/G4/Grain Wave visual experiment chain; superseded as design authority by brand system v1; retain refs as historical experiments.
- `experiment/binrat-reactbits-license-probe-20260926` - Labeled experiment/research exploration; never merged, not referenced by main docs; retain ref for Git history only.
- `feat/binrat-pons-outcome-o1-v1` - Labeled experiment/research exploration; never merged, not referenced by main docs; retain ref for Git history only.
- `feat/binrat-pons-outcome-v1` - Labeled experiment/research exploration; never merged, not referenced by main docs; retain ref for Git history only.
- `feat/binrat-rat-conversation-free-ai-v1` - Labeled experiment/research exploration; never merged, not referenced by main docs; retain ref for Git history only.
- `g3a-interactive-prototype-20260926` -> design/binrat-brand-system-v1 family (current design authority) - G3/G4/Grain Wave visual experiment chain; superseded as design authority by brand system v1; retain refs as historical experiments.
- `integration/binrat-r5-approved-20260927` - Labeled experiment/research exploration; never merged, not referenced by main docs; retain ref for Git history only.
- `planning/binrat-g1a-prefigma-2026-09-26` - Pre-reset planning/blueprint docs; not referenced anywhere in main docs (verified via git grep); historical planning artifact.
- `planning/binrat-pons-hybrid-blueprint-2026-09-26` - Pre-reset planning/blueprint docs; not referenced anywhere in main docs (verified via git grep); historical planning artifact.
- `research/pons-gates-holder-econ-v1` - Labeled experiment/research exploration; never merged, not referenced by main docs; retain ref for Git history only.
- `research/rat-radar-evidence-lab-v0` - Labeled experiment/research exploration; never merged, not referenced by main docs; retain ref for Git history only.

### Category F

- `binrat-dumpster-os-d1-githack` - Deployment/inspection/preview receipt branch; historical receipt value, not active development. Retain ref.
- `binrat-mobile-m1-githack` - Deployment/inspection/preview receipt branch; historical receipt value, not active development. Retain ref.
- `binrat-v2-githack-pr23` - Deployment/inspection/preview receipt branch; historical receipt value, not active development. Retain ref.
- `diag/binrat-observability-readonly-20260924` - Deployment/inspection/preview receipt branch; historical receipt value, not active development. Retain ref.
- `ops/binrat-miniapp-preview-v1` - Recent (2026-10-01/02) production deploy/inspect/preview receipt; may still describe live production state - owner should confirm before any change.
- `ops/binrat-miniapp-preview-v2` - Recent (2026-10-01/02) production deploy/inspect/preview receipt; may still describe live production state - owner should confirm before any change.
- `ops/binrat-o2-production-base-v1` - Recent (2026-10-01/02) production deploy/inspect/preview receipt; may still describe live production state - owner should confirm before any change.
- `ops/binrat-o2-production-rollout-v1` - Recent (2026-10-01/02) production deploy/inspect/preview receipt; may still describe live production state - owner should confirm before any change.
- `ops/binrat-pons-provider-regression-deploy-v1` - Recent (2026-10-01/02) production deploy/inspect/preview receipt; may still describe live production state - owner should confirm before any change.
- `ops/binrat-pons-replay-production-inspect-v1` - Recent (2026-10-01/02) production deploy/inspect/preview receipt; may still describe live production state - owner should confirm before any change.
- `ops/binrat-provenance-repair-deploy-v1` - Recent (2026-10-01/02) production deploy/inspect/preview receipt; may still describe live production state - owner should confirm before any change.
- `ops/binrat-rat-trap-production-inspect-v1` - Recent (2026-10-01/02) production deploy/inspect/preview receipt; may still describe live production state - owner should confirm before any change.
- `ops/binrat-token-identity-production-rollout-v1` - Recent (2026-10-01/02) production deploy/inspect/preview receipt; may still describe live production state - owner should confirm before any change.
- `ops/cloudflare-deploy-v0` - Deployment/inspection/preview receipt branch; historical receipt value, not active development. Retain ref.
- `preview-binrat-bento-pr31` - Deployment/inspection/preview receipt branch; historical receipt value, not active development. Retain ref.
- `preview-binrat-bento-v1` - Deployment/inspection/preview receipt branch; historical receipt value, not active development. Retain ref.
- `preview-binrat-g2` - Deployment/inspection/preview receipt branch; historical receipt value, not active development. Retain ref.

### Category G

- `codex/binrat-prelaunch-release-a911c23` - Autonomous-Rat/prelaunch stack stranded on dead pre-reset base codex/binrat-prelaunch-release-a911c23; not in current lineage and not referenced on main docs, but no explicit rejection evidence - owner must decide abandon vs donor.
- `feat/binrat-autonomous-rat-v1` - Autonomous-Rat/prelaunch stack stranded on dead pre-reset base codex/binrat-prelaunch-release-a911c23; not in current lineage and not referenced on main docs, but no explicit rejection evidence - owner must decide abandon vs donor.
- `feat/binrat-miniapp-hierarchy-v1` - Mini App hierarchy candidate off #71; NOT ancestor of current Mini App chain (#86/#89) and purpose overlaps #89 'restore Hot Garbage journey', but containment unproven - owner must decide.
- `feat/binrat-pons-outcome-capability-v1` - Chosen Pons outcome-capability candidate line (#75->#76); not in active lineage, no successor and no rejection evidence - owner must decide if outcome-receipt capability is still planned.
- `feat/binrat-pons-outcome-receipts-v1` - Chosen Pons outcome-capability candidate line (#75->#76); not in active lineage, no successor and no rejection evidence - owner must decide if outcome-receipt capability is still planned.
- `feat/binrat-rats-share-v1` - Autonomous-Rat/prelaunch stack stranded on dead pre-reset base codex/binrat-prelaunch-release-a911c23; not in current lineage and not referenced on main docs, but no explicit rejection evidence - owner must decide abandon vs donor.
- `feat/binrat-robinhood-live-rat-v1` - Autonomous-Rat/prelaunch stack stranded on dead pre-reset base codex/binrat-prelaunch-release-a911c23; not in current lineage and not referenced on main docs, but no explicit rejection evidence - owner must decide abandon vs donor.
- `feat/binrat-telegram-mood-art-v1` - Autonomous-Rat/prelaunch stack stranded on dead pre-reset base codex/binrat-prelaunch-release-a911c23; not in current lineage and not referenced on main docs, but no explicit rejection evidence - owner must decide abandon vs donor.
- `feat/binrat-telegram-ux-v2` - Autonomous-Rat/prelaunch stack stranded on dead pre-reset base codex/binrat-prelaunch-release-a911c23; not in current lineage and not referenced on main docs, but no explicit rejection evidence - owner must decide abandon vs donor.
- `hotfix/pons-catchup-throughput-v1` - Hotfix branched from pre-reset main (424/416 commits off current main); fixes not found on current main and target code may have been rewritten in the new lineage - owner must decide if bugs persist.
- `hotfix/pons-launch-identity-retry-v1` - Hotfix branched from pre-reset main (424/416 commits off current main); fixes not found on current main and target code may have been rewritten in the new lineage - owner must decide if bugs persist.
- `plan/binrat-token-prelaunch-control-v1` - Autonomous-Rat/prelaunch stack stranded on dead pre-reset base codex/binrat-prelaunch-release-a911c23; not in current lineage and not referenced on main docs, but no explicit rejection evidence - owner must decide abandon vs donor.
- `release/binrat-autonomous-rat-v1-1` - Autonomous-Rat/prelaunch stack stranded on dead pre-reset base codex/binrat-prelaunch-release-a911c23; not in current lineage and not referenced on main docs, but no explicit rejection evidence - owner must decide abandon vs donor.


## 9. V1 update (2026-10-02, post-81868c2 snapshot)

This section documents the first refresh of manifest v1 against current remote state. Read-only except for this documentation commit on `ops/binrat-repo-cleanup-manifest-v1`. Nothing was closed, merged, deleted, deployed, or reconfigured.

### 9.1 Snapshot delta vs 81868c2

- Live inventory regenerated (`git fetch origin --prune`; `gh pr list --state open --limit 200 --json number,title,headRefName,baseRefName,updatedAt,headRefOid`; `git for-each-ref refs/remotes/origin` excluding the `origin`/`origin/HEAD` symbolic line): **88 open PRs + 147 remote branches (235 records)**.
- New branches (3): `integration/binrat-case-canonical-v1`, `design/binrat-roadmap-brand-v1`, `ops/binrat-repo-cleanup-manifest-v1`.
- New PRs (1): #104. Gone branches/PRs: **none**. Head-SHA moves: **none** (verified by join of snapshot vs live SHAs for all 144 old branches and 87 old PRs).
- New authority SHAs verified with `git cat-file -t` + ref match: case-canonical `9e8b37ec0a643aadf8aaf789e9ab6c4ae4b85cb3`, brand-composed `0343d3815e509c45ef6b4991a7f8d438e2f4deb1`, roadmap-brand-v1 `95c7e78223cec4f2f8bbe62d83d4aa81bc9fc4ee`, funding-storage `90296437d8846df71311f9523a4e7a29d9968798` (unchanged).

### 9.2 New authorities added as records

- `integration/binrat-case-canonical-v1` (branch, **A ACTIVE**) @ `9e8b37ec` — PR #104 head; based directly on `feat/binrat-pons-funding-storage-v1` @ `90296437` (merge-base = `90296437`). CI green: `check` SUCCESS, `wrangler-dry-run` SUCCESS (2026-10-02).
- `#104 (integration/binrat-case-canonical-v1)` (PR, **A ACTIVE**) — "feat: reconstruct canonical Pons Case stack", base `feat/binrat-pons-funding-storage-v1`.
- `design/binrat-roadmap-brand-v1` (branch, **A ACTIVE**) @ `95c7e782` — Roadmap V2 built directly on Brand V1 composed `0343d381` (first-parent).
- `ops/binrat-repo-cleanup-manifest-v1` (branch, **F OPS_RECEIPT**) @ `81868c2` — this manifest branch itself (based on main @ `9fea1c8`).
- `integration/binrat-brand-v1-composed` was already recorded as A in the 81868c2 snapshot; unchanged.

### 9.3 Old Case stack reclassification (evidence-based)

Method: for each old head H, `git merge-base --is-ancestor H 9e8b37ec`; unique-commit counts (`git rev-list --count`); and blob-content containment — for every file changed by H vs its merge-base with the canonical, compare blob SHAs between H and the canonical.

**Result: containment NOT proven.** None of the old heads is a commit-ancestor of the canonical (it is a reconstruction), and in every case multiple changed files differ or are missing in the canonical (e.g. `src/pons/fundingSync.ts` missing; `cloudflare/schema.sql`, `src/cloudflare/ponsFundingStore.ts`, `src/cloudflare/syncQueue.ts` differ):

| PR | head | files changed vs merge-base | identical / differ / missing |
|----|------|------------------------------|------------------------------|
| #94 | `a604f869` | 9 | 2 / 6 / 1 |
| #98 | `70bb71d0` | 11 | 4 / 6 / 1 |
| #99 | `192b1da1` | 18 | 10 / 7 / 1 |
| #100 | `7a96a3c1` | 20 | 10 / 9 / 1 |
| #101 | `c9bcb01c` | 23 | 14 / 8 / 1 |

- PRs **#94, #98, #99, #100, #101: B → G UNKNOWN_REVIEW_REQUIRED** (`requiresOwnerDecision=true`, `safeToClose=false`). Replacement noted as #104, but the reconstruction's fidelity to the old deltas is unproven — owner must decide accept-vs-review before closure.
- Branch refs `feat/binrat-pons-funding-recurrence-read-v1`, `feat/binrat-case-model-v1`, `feat/binrat-case-model-convergence-v1`, `feat/binrat-case-adapter-v1`, `feat/binrat-case-endpoint-v1`: **B → G** (`requiresOwnerDecision=true`, `safeToDeleteBranch=false`) — preserved for historical/reconstruction evidence. NOT marked safe to delete merely because #104 contains equivalent work.
- `feat/binrat-case-surface-v1` @ `c9bcb01c`: **stays B ACTIVE_ANCESTOR** (`safeToDeleteBranch=false`) — base of the preserved #102 preview chain; not contained in the canonical (8/23 files differ, 1 missing).
- **#102 / `ops/binrat-case-surface-private-preview-v1`: A → F OPS_RECEIPT** (private-preview donor, preserved until the canonical private preview is reconstructed on top of #104; `safeToDeleteBranch=false`).

### 9.4 Roadmap donor reassessment

- **#70 / `feat/binrat-roadmap-living-scenes-v1` @ `ab844e48`: C → D SUPERSEDED** — containment PROVEN: `git merge-base --is-ancestor ab844e48 95c7e782` = YES with **0 unique commits**; the extract list (scene sequencing, lighting/effect mechanics, transition logic, roadmap interaction patterns) is preserved via ancestry in the ACTIVE Roadmap V2 line. Ref kept (`safeToDeleteBranch=false`); PR `safeToClose=true`.

### 9.5 #93 strengthened

- `#93 (feat/binrat-pons-funding-collector-v1)` stays **D SUPERSEDED** (replacement #103, `safeToClose=true`, `safeToDeleteBranch=false`). Strengthened reason: `feat/binrat-pons-funding-storage-v1` @ `90296437` is now a proven commit-ancestor of the canonical #104 head `9e8b37ec`, and #104 CI is green — proving canonical #103 is reachable; #93 head `1175423a` is not an ancestor of the canonical (10 unique commits) and its content differs.

### 9.6 G records resolved by ancestry evidence

Proven commit-ancestors of the ACTIVE canonical line (`git merge-base --is-ancestor` = YES against both `9e8b37ec` and `0343d381`), reclassified **G → D SUPERSEDED** (replacement `integration/binrat-brand-v1-composed`; refs kept, `safeToDeleteBranch=false`; PRs `safeToClose=true`):

- Branches: `codex/binrat-prelaunch-release-a911c23`, `feat/binrat-robinhood-live-rat-v1`, `feat/binrat-telegram-ux-v2`, `release/binrat-autonomous-rat-v1-1`.
- PRs: #59, #60.

Remaining **G (19 branch + 8 PR = 27 records)**: no proven ancestry into main or the active line — kept G per the never-guess rule.

### 9.7 Updated counts

| Category | Branches | PRs | Total |
|----------|----------|-----|-------|
| A ACTIVE | 19 | 9 | 28 |
| B ACTIVE_ANCESTOR | 13 | 11 | 24 |
| C DONOR | 0 | 0 | 0 |
| D SUPERSEDED | 57 | 33 | 90 |
| E HISTORICAL_EXPERIMENT | 25 | 18 | 43 |
| F OPS_RECEIPT | 19 | 4 | 23 |
| G UNKNOWN_REVIEW_REQUIRED | 14 | 13 | 27 |
| **Total** | **147** | **88** | **235** |

Full invariant verification (coverage, uniqueness, safety invariants, protected SHAs, live-SHA match, count cross-check) was re-run for this update; receipt in the verification log of the update commit.
