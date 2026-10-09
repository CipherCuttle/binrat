# BINRAT Sprint A1.1 — Case permanence and UX corrections

A1_1_VERDICT = PARTIAL
HISTORICAL_CASE_PERMALINK = BLOCKED
VISUAL_OWNER_APPROVAL = PENDING

Base: draft PR #173, exact reviewed head `3aedca9d2ea9bfca1aa66d54aab3c8b86df8ef2b`. No merge or deployment.

## Contract finding and stopped portion

The original shared Case `742ed5c2d361c11d5a4da715e35e6c189a9b61ae4a433a937a96111360d7ab01` appears in the [original recorded latest feed](receipts/sprint-a1/public-feed.json). It is absent from the [new real latest-20 GET](receipts/sprint-a1-1/public-feed.json); its [exact historical GET](receipts/sprint-a1-1/historical-source.json) returns 200. [Transport receipt](receipts/sprint-a1-1/transport.json).

`src/cloudflare/publicCaseReadModel.ts` validates durable canonical launches and provenance facts, then projects at the published checkpoint. Its input is bounded to the deployer's latest 20 launches through the requested launch. `src/public/project.ts` derives IDs and facts, then computes an output digest over **all projected bags**. `src/cloudflare/worker.ts` returns only the requested bag and that multi-bag receipt. It does not return the complete output material, canonical input/facts or latest-feed digest/membership binding.

The browser cannot recompute that output digest from the returned one-bag subset. `web/data-source.js::loadPublicBag` provides structural V0 validation, not the recomputable canonical binding required by this frontdoor. V0 history is `UNVERIFIED`, while the latest feed is a different `PARTIAL` projection. The original recorded Case had 38 earlier launches in the latest projection and 19 in V0. Their counts and digests must not be combined, even at matching checkpoint heights.

**Minimal contract gap:** provide recomputable output material that includes the exact requested Case, either the complete bounded V0 output hashed by its receipt or a canonical per-Case envelope with its own digest and checkpoint block/hash. Define the projection/count scope and publication binding before mixing any feed or creator-summary evidence. An immutable old publication would additionally require a publication-addressed contract; today's URL identifies the launch, not an archived publication. This document proposes no backend implementation or authority change.

Verified historical Case UI rehydration is stopped. The implemented fallback checks the exact API record's identity, V0 schema, structural validity and checkpoint agreement. It returns only `HISTORICAL_SOURCE_ONLY`; no historical bag fields or counts are exposed as verified Case evidence. Missing records, HTTP failures, projection mismatches and checkpoint mismatches show `UNAVAILABLE`, retain the full requested ID and exact source link, and select no replacement.

## Scoped changes

- `web-v2/src/PonsCasePreview.tsx`: exact historical-source/unavailable disclosure and abortable lookup, freshness-aware discovery labels, publication versus launch-age explanation, partial recurrence/identity/profitability limitations. Current Cases still use only the verified feed. Fresh source checks no longer imply a freshly launched token.
- `web-v2/src/pons-readonly-preview.mjs` and `.d.mts`: diagnostic historical-source read with existing V0 structural checks. Existing canonical latest-feed, status, expiry, regression and creator-trail validation remains unchanged.
- `web-v2/src/frontdoor-discovery.css`: mobile source status gets its own row; Rat Zero stays prominent; redundant labels are reduced; exact identifiers and diagnostics wrap. No smaller text, new art or UI library.
- Two targeted check scripts and `.github/workflows/sprint-a1-1.yml`: pinned compiled Chromium, exact-head scoped CI, diagnostic contract checks and uploaded receipts.

## Verification

| Check | Result |
|---|---|
| `node web-v2/checks/check-pons-readonly-preview.mjs` | 12/12 pass |
| `node web-v2/checks/check-pons-historical-source.mjs` | 10/10 pass |
| `pnpm exec tsx --test test/cloudflareWorker.test.ts test/publicProjection.test.ts` | 16/16 pass |
| `node web-v2/checks/build-frontdoor-candidate.mjs --production` | TypeScript/Vite + 36-file static package pass |
| `BINRAT_A1_1_LIVE=1 node web-v2/checks/sprint-a1-1-browser.cjs` | 19/19 compiled Chromium groups pass |
| `git diff --check` | pass |

The compiled checks cover original exact URL after the Case leaves the actual latest-20 feed; current URL and receipt values; missing historical record; projection and checkpoint mismatches; stale/fresh labels; retained and initial 503 recovery; pending historical-request navigation; 390×844, 320×800 and 1440×900 screenshots; visible CTAs; source/status row geometry; overflow and static asset/runtime errors. The browser summary includes hashes of all changed runtime files and they match the final source.

[Compiled browser summary](receipts/sprint-a1-1/browser-summary.json) uses recorded public GET replay. Its adverse states and fresh-status controls are explicitly simulated. [Live browser summary](receipts/sprint-a1-1/live-summary.json) separately records five real production public GETs through the compiled local frontend, including current selection and the old exact source URL. No fake data supplies LIVE evidence. Production API/backend contracts, dependencies, lockfiles and artwork have no changes from the reviewed base. Broad A1 engineering checks were not repeated locally. The legacy ARC-5042 `live-candidate-smoke.cjs` targets a different UI/chain; the scoped V3 browser runner provides the actual current-Pons proof here.

One [hostile self-review](receipts/sprint-a1-1/hostile-review.md) and one [targeted self-rereview](receipts/sprint-a1-1/targeted-rereview.md) completed. This is not independent owner approval. Historical full rendering remains blocked. Safari/Firefox and real devices remain untested.

## Before/after screenshots

Both columns use the same original recorded production dataset and stale source state. Before is compiled from the exact reviewed A1 head. No art or material redesign.

| Size | Reviewed A1 | A1.1 | Discovery payoff | Current exact Case |
|---|---|---|---|---|
| 390×844 | [Before](receipts/sprint-a1-1/before-390x844.png) | [After](receipts/sprint-a1-1/after-390x844.png) | [Discovery](receipts/sprint-a1-1/discovery-390x844.png) | [Case](receipts/sprint-a1-1/case-390x844.png) |
| 320×800 | [Before](receipts/sprint-a1-1/before-320x800.png) | [After](receipts/sprint-a1-1/after-320x800.png) | [Discovery](receipts/sprint-a1-1/discovery-320x800.png) | [Case](receipts/sprint-a1-1/case-320x800.png) |
| 1440×900 | [Before](receipts/sprint-a1-1/before-1440x900.png) | [After](receipts/sprint-a1-1/after-1440x900.png) | [Discovery](receipts/sprint-a1-1/discovery-1440x900.png) | [Case](receipts/sprint-a1-1/case-1440x900.png) |

[Original old URL](receipts/sprint-a1-1/historical-original-url.png) · [Missing record](receipts/sprint-a1-1/historical-unavailable.png) · [Projection mismatch](receipts/sprint-a1-1/projection-mismatch.png) · [Checkpoint mismatch](receipts/sprint-a1-1/checkpoint-mismatch.png) · [Fresh source control](receipts/sprint-a1-1/fresh-source.png) · [Real GET current Case](receipts/sprint-a1-1/live-current-case.png) · [Real GET historical source](receipts/sprint-a1-1/live-historical-source.png).

Stop before merge, production deployment or release. Owner visual approval remains pending.
