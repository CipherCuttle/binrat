# A1.2 — exact historical Case UI integration

HISTORICAL_CASE_UI = PASS (compiled local browser checks; production endpoint not deployed)
A1_RELEASE_READY = NO
VISUAL_OWNER_APPROVAL = PENDING

Frontend base: PR #173, `db13d4d8568bd99d72c6f318462664a8157e88eb`, confirmed still its draft head. Pure frontend integration source commit: `a85eba15880228f14e709174d6979a7dca6b9b8b`. Backend dependency: draft [PR #174](https://github.com/CipherCuttle/binrat/pull/174), runtime/test source `1b5d0a05dae900128065bc81c41013d6e24566ee`. The frontend branch carries clearly separated cherry-picked backend commits so its compiled checks can run; the frontend implementation commit changes only UI, local checks and UI CI.

## Behavior

The original `/bag/:id` route remains intact. Cases present in the separately validated latest feed retain the current projection and count. A selected Case absent from that feed requests the additive evidence endpoint and renders only after the complete shared validator succeeds, including byte limits, canonical digest/IDs/provenance, coverage/count/order, pinned Pons factory/chain and exact publication/checkpoint equality.

Historical WHY uses verified launch/deployer fields. TRAIL uses only the returned canonical window (no newer creator-summary substitution). RECEIPTS exposes the full recomputable envelope and its own Case evidence digest. The historical item does not carry the latest feed's digest. Invalid/missing evidence keeps the exact selected identity and source-only/unavailable state. Aborted or delayed requests cannot replace a newer selection.

The historical notice separates observation block, published-checkpoint reconstruction, stale/fresh publication, archive/replay limits and the trusted index's proof boundary. Fresh publication does not make an old launch recent. Rat Zero, approved artwork, holographic materials and font sizes are preserved. The mobile notice follows the hero so the actual count and CTA remain reachable in the first viewport; product limitations remain visible.

## Source-bound demonstration and checks

Real Case `742ed5c2d361c11d5a4da715e35e6c189a9b61ae4a433a937a96111360d7ab01` is absent from the captured production latest-20. The compiled frontend reopens its original URL through the actual local Worker read route over captured canonical production D1 rows, showing **19 earlier launches in a 20-record window**, observation block `84243094`, published checkpoint `84298735`. Reload, browser Back and current-Case navigation preserve identity/projection. The production legacy source remains available (HTTP 200).

This is an offline, source-bound demonstration, **not** a claim that the new production endpoint is active. No successful source data was invented or intercepted. Browser controls deliberately intercept adverse responses; the fresh-publication control also simulates clock/status and is explicitly labelled. The captured real-source demonstration is stale and remains stale.

- Root TypeScript and compiled production-mode static build: PASS (36 packaged files).
- Frontend adapter checks: **15/15 PASS** (3 historical checks plus 12 current/fresh/stale/binding regressions). [Output](receipts/sprint-a1-2-ui/adapter-tests.txt).
- Pinned native Playwright 1.56.1 / Chromium compiled checks: **23/23 PASS**. [Output](receipts/sprint-a1-2-ui/compiled-browser-tests.txt), [runtime/source hashes, GET requests, browser version and controls](receipts/sprint-a1-2-ui/browser-summary.json).
- Coverage: original historical URL, recomputable complete receipt, current Case regression, field tampering, wrong chain/Case/checkpoint, projection/count mismatch, missing evidence, 503 source-only, 404 unavailable, missing publication, delayed-proof navigation, 503 recovery after revalidation, stale real source and explicit fresh-publication control.
- Viewports: 1440×900, 1024×768, 430×932, 390×844, 320×800; no horizontal overflow, broken static assets or JS page errors. CTA fits first mobile viewport; keyboard focus reaches the actual selected Case.
- Contract checks separately pass 45/45. [Contract report and query/payload bounds](BINRAT_SPRINT_A1_2_CASE_CONTRACT.md).
- One hostile self-review and one targeted rereview completed; no unresolved Critical/High. [Review](BINRAT_SPRINT_A1_2_REVIEW.md).

## Screenshots for owner review

| Historical Case | TRAIL | RECEIPTS |
| --- | --- | --- |
| [Desktop 1440×900](receipts/sprint-a1-2-ui/historical-1440x900.png) | [Desktop](receipts/sprint-a1-2-ui/trail-1440x900.png) | [Desktop](receipts/sprint-a1-2-ui/receipts-1440x900.png) |
| [Mobile 390×844](receipts/sprint-a1-2-ui/historical-390x844.png) | [390px](receipts/sprint-a1-2-ui/trail-390x844.png) | [390px](receipts/sprint-a1-2-ui/receipts-390x844.png) |
| [Mobile 320×800](receipts/sprint-a1-2-ui/historical-320x800.png) | [320px](receipts/sprint-a1-2-ui/trail-320x800.png) | [320px](receipts/sprint-a1-2-ui/receipts-320x800.png) |

[Current Case](receipts/sprint-a1-2-ui/current-case-regression.png) · [Unavailable](receipts/sprint-a1-2-ui/404-unavailable.png) · [Source-only 503](receipts/sprint-a1-2-ui/503-source-only.png) · [Fresh-publication simulated control](receipts/sprint-a1-2-ui/fresh-publication-simulated-control.png).

## Remaining gate and risks

Backend provider readback remains version 105 at 100% traffic. Neither changeset is merged or deployed; no D1 migration, DNS/token operation or capability activation occurred. Production release requires separately authorized backend/frontend delivery and owner visual approval. Unsigned trusted-index integrity is not independent RPC chain truth, immutable archived publication or point-in-time replay. History remains bounded and partial. Publication races fail closed and require a recheck. Chromium screenshots do not substitute for Safari/Firefox or physical-device owner review.
