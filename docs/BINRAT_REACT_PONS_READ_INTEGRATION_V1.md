# BINRAT — React V3 to Pons read-plane integration gates

Date: 2026-10-08
Status: **PLAN / READ-ONLY CANDIDATE; production acceptance UNVERIFIED**
Visual source: draft PR #166 / `8d7bb44b3062d3fcf0889a01d1e8c8468851fee2`
Visual freeze: `docs/BINRAT_REACT_VISUAL_V3_FREEZE_V1.md`

## P0 mismatch: do not rewire the old LIVE switch

The current `web-v2/src/types.ts` and `web-v2/src/liveAdapter.ts` describe an **ARC 5042** public feed, Radar and historical schema. `web-v2/src/data.ts` uses `?source=live` to request `/api/feed` plus `/api/rat-radar/watchlist` and adapts those legacy contracts.

That path is **not** a Pons/Robinhood 4663 integration. It must not be reused, changed to report 4663 by renaming constants, or silently substituted for today's source. Historical Arc read products cannot become current Pons facts merely because V3's UI looks ready.

The active Pons contract already exists under **`web/`**, notably:
- `web/data-source.js`: `loadDumpsterFeed`, `adaptLatestLaunches`, `loadPublicBag`, `loadBagIntelligence`, `loadCreatorSummary`, `loadReplay`, `loadCapabilities` (verify exact exported names before coding).
- `web/snapshot-contract.js`: `verifyFeedBinding` with canonical digest and `bindingMatches` chain/checkpoint/block-hash/digest rules.
- `web/read-plane.js`: bounded status + latest feed, replay-safe freshness and fail-closed retention rules.
- `web/product-contract.js`: capability/status projection validation.
- `web/frontdoor.js` and `web/app.js`: existing supported Case/read-state/Watch presentation.
- `docs/BINRAT_PUBLIC_TRUTH_ACCEPTANCE_V1.md`, `docs/BINRAT_FRONTDOOR_JOURNEY_V1.md`, canonical C2 manifest/gates: production acceptance and authority.

**Source of truth:** Pons chain **4663**; `/api/launches/latest`, `/api/status`, and only the bounded supporting endpoints actually verified on the target deployed release. Exact backend route contracts, deploy revision and readiness must be checked fresh; filenames and current docs are not runtime health receipts.

## Minimal vertical slice

Create a separate **typed Pons view-model adapter**, next to (not by overwriting) the ARC adapter. Start with exactly one supported flow:
`verified recent launch → OPEN CASE → supported WHY → bounded TRAIL → source RECEIPTS → truthful NEXT`.

A candidate presentation model should preserve:
- Identifiers: immutable Case/launch ID, chainId 4663, token/deployer/transaction identities **only when present and validated**.
- Freshness: read state, checkpoint, canonical block hash, feed digest, verified time and coverage. Never transform publication age into live chain freshness.
- Support: every displayed observation, count, timeline node and claim references a real verified field or bound receipt; no invented score or social metadata.
- Unknowns: explicit missing/partial/not-supported state, with differences between no prior *indexed* match and none ever.
- Routing: Case selection uses exact ID; no fallback to first launch if a bag disappears.
- Actions: only currently available read-only Case, copy, source and gated Telegram/Watch flows. Never arm Tripwire or create employment/stake/trading authority from the React surface.

Adapt source data to a presentation model; do **not** adapt evidence to suit a visual fixture. Keep `visual-lab-fixtures.ts` isolated, visible only in `SYNTHETIC` mode. Introduce an explicit preview-only `PONS_READONLY` mode, default OFF, with a prominent truthful mode badge. Avoid retaining a synthetic case as a live fallback.

## Evidence/read-plane acceptance gates (fail closed)

- [ ] Source status schema and chain are valid: `binrat.public-status/0.1`, chainId 4663; feed is supported `binrat.latest-launches/0.1` and validated against exact current contract.
- [ ] Verify canonical feed digest, chain, checkpoint, checkpoint hash and status/feed binding **before** claiming `FRESH_VERIFIED`.
- [ ] `FRESH_VERIFIED` means matching snapshot AND unexpired freshness; stale verified retains last *verified* evidence with conspicuous staleness and age; failure cannot preserve a LIVE badge.
- [ ] `NO_VERIFIED_SNAPSHOT` / unavailable / invalid digest / status conflict: never invent cases, freshness, receipts, counts, or an Arc fallback. Healthy verified empty feed is distinct from unavailable.
- [ ] Newer checkpoint, same-block different hash/digest, regression, out-of-order responses and aborted requests do not overwrite canonical evidence with unverified data.
- [ ] `/api/bag/:id` is bound to exact selected Case and known snapshot provenance. Supplementary intelligence/replay `/api/bag/:id/intelligence` and `/api/bag/:id/replay` remain optional; missing/maturing evidence is visibly unavailable/unknown, not simulated.
- [ ] Bounded creator summary `/api/creator/:address/summary` never infers a human identity and never fabricates a complete history. Only latest verified bounded coverage may be presented.
- [ ] Capability/Watch status comes from validated current product projection/actual audience access, not a label in a fixture. Watch ≠ Tripwire; Telegram link ≠ proof of subscription.
- [ ] Existing site route `/` and its production behavior remain unchanged; no implicit cutover from `?visual=lab`.
- [ ] Unknown capability state maps to UNVERIFIED/disabled, never optimistically LIVE.

## Minimal implementation train

**S0 — inventory (read-only):** pin target commit + current live release/route/provider provenance; list exact API payload examples, validators, stage/Watch gates and errors. If current Pons endpoints cannot be verified, STOP here. No backend rewrite.

**S1 — model fixtures:** construct Pons 4663 transport snapshots (fresh, stale, empty, 404 Case, partial, corrupt, wrong chain, mismatched block/hash/digest, 503/Cloudflare 1102) from canonical local test handlers or reviewed shapes; don't edit the Visual Lab's invented example set to look live.

**S2 — adapter:** implement a separate pure typed Pons-to-Case mapper, status gate and read-only preview selector. No trading, signing, storing wallet secrets, Telegram mutation, or public Rat employment. Keep old ARC adapter isolated.

**S3 — one live Case:** wire only Fresh Find selection + WHAT + RECEIPTS using accepted Pons snapshot. Expand TRAIL only with real supported history and a receipt source; NEXT only with current access. Avoid importing Den or future workforce features.

**S4 — adverse browser receipts:** test verified fresh → stale, stale retained across 503, initial unavailable, healthy empty, bad hashes, conflicting status, exact Case routing, unknown coverage, no browser network mutation, rapid Case switches, keyboard/mobile/reduced-motion. Full browser screenshots at 320/360/390/768/1024/1440 with PONS_READONLY explicitly labeled.

**S5 — boundary review:** one hostile review; fix Critical/High; one targeted rereview; STOP. Maintain functional, evidence, performance and visual verdicts separately. Require explicit owner review of real-device first impressions.

## Gate to production (not granted by this document)

- [ ] Source/release IDs, tested build, Worker version, status/feed binding and actual deployed readbacks match.
- [ ] Pons production runtime freshness/error and Case read paths work; no stale-to-fresh laundering, Arc fallback or feed disappearance.
- [ ] Actual zero/partial/history/replay gaps remain honestly represented; product capability projection is validated; Telegram/Watch access path is independently tested.
- [ ] Evidence semantics, typed mapper fixtures, existing project tests, GitHub CI and pinned browser regressions pass.
- [ ] Owner visual sign-off on exact desktop/mobile captures, and performance/accessibility review at least on one actual phone.
- [ ] Owner explicitly authorizes any main-frontend cutover/merge/deployment **as a separate action**; C1/C2 production gates, legal and launch authority remain unaffected.

## Stop/kill and rollback

Stop on wrong chain, incompatible schema, unverified snapshot, unsupported evidence claim, fake fresh label, missing receipt binding, uncontrolled Watch action, or newly introduced production write. Do not claim production readiness from synthetic fixtures or a passing UI build.

Keep V3 fixture mode working until adapter evidence passes. The first integration change should be independently revertible without changing originals, published web/, canonical backend or production domain.

**Phase verdict now:** `VISUAL_DIRECTION_FROZEN`, `PONS_INTEGRATION_NOT_IMPLEMENTED`, `PRODUCTION_ACCEPTANCE=UNVERIFIED`, `NO_MERGE`.
