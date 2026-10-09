# BINRAT Sprint A1 — frontdoor and discovery

Status: implementation verified locally; owner visual approval pending. No merge or production deployment.

## Baseline and plan

Isolated branch: `feat/binrat-sprint-a1-frontdoor-discovery`, from PR #172 head `8a2245176889e5e75aeb3695661e8dc834e2cac6` (`release/binrat-v3-production-20261009`). The original worktree and unrelated backend WIP were preserved.

Read the frontdoor journey, V3 visual freeze, roadmap, product language, existing router/Case adapter, approved raster pack and PR #172. The deployed `https://binrat.tech` JS and CSS matched the V3 release package byte-for-byte:

- JS SHA-256 `498c4a5d563f39fa2d9788351a1f701ee2b68c9f204362b7963c66824ae7426b`
- CSS SHA-256 `3279a074a76b078cfc9e37e0e7f433ab61f20b1e240b1a64229d30f2ac6df13f`

MemPalace was unavailable. Repository doctrine/release evidence supplied durable context; React effect/focus documentation came from Context7. Native pinned Playwright supplied browser truth. Chrome DevTools could not start its headful browser in this environment, so native Chromium console, network and layout measurements were used.

Plan: literal hero → supported discovery → intentional exact Case → inspect trail/receipts → return. Keep one dominant pearl surface, approved art/fonts and secondary crew; do not add backend APIs, libraries, saved state or persistent Watch.

## Changeset

- `PonsCasePreview.tsx`: discovery-first hero; supported latest/familiar views; four readable initial launch rows with optional expansion; names/symbols/address fallbacks; recurrence explanation; honest freshness/empty/unavailable states; exact `/bag/<id>` selection; back/forward; copy link; accessible Case transition and mobile stage navigation.
- `DiscoveryCrew.tsx`: approved crew assets, native keyboard disclosure; Rat Zero LIVE only with fresh verified data; Tripwire BUILDING, Sniffer PROVING, future Rats LOCKED; literal limitations.
- `frontdoor-discovery.css`: distinct phone/tablet compositions, quiet feed rows and unchanged pearl material/artwork; 17px explanation; visible first action at 320px; reduced-motion support.
- Browser checks: retained source/tamper/chain/route isolation controls, adapted to the new journey; added discovery/history/mobile/crew/copy-link/focus checks and a separate real-public-GET browser run.

No production Worker, backend contract, dependency, lockfile or approved asset changed. Discovery consumes the existing validated feed/status pair. Initial activity is at most one cancelled StrictMode GET plus feed/status GETs; filters and card selection add no requests. Creator detail loads only when the user enters TRAIL.

## Verification

Commands run:

```sh
pnpm install --frozen-lockfile
pnpm rebuild better-sqlite3
pnpm build
pnpm test
pnpm --dir web-v2 check
pnpm --dir web-v2 build:production
node --test web-v2/checks/check-pons-readonly-preview.mjs web-v2/checks/check-pons-preview-proxy.mjs
BINRAT_FRONTDOOR_TOOLS=/tmp/binrat-v3-sprint-runner/node_modules \
  BINRAT_FRONTDOOR_URL=http://127.0.0.1:4191 \
  BINRAT_FRONTDOOR_OUTPUT=.artifacts/sprint-a1/browser \
  node web-v2/checks/frontdoor-candidate-browser.cjs
BINRAT_FRONTDOOR_URL=http://127.0.0.1:4191 \
  node web-v2/checks/frontdoor-live-browser.cjs
```

557 unit tests passed. Frontend evidence/source/type/build gates passed. All 14 Pons adapter/proxy tests passed. Compiled Chromium 1.56.1 runner: 40 browser groups passed across 1440×900, 768×1024, 390×844, 320×800, 430×932, 360×800 and 1024×768. No horizontal overflow, broken assets or JS errors; primary CTA inside every initial viewport; maximum observed initial CLS 0.032904.

The first unit-test attempt failed because this new worktree lacked generated release modules; the documented `pnpm build` prerequisite resolved it, followed by 557/557 passing tests. A first copy-link browser assertion sampled before the asynchronous result; waiting for the announced result resolved the check. These were not backend or production changes.

Real production GETs independently passed all four requested widths with fresh verified launch/status binding, supported recurrence, correct chosen Case, deployer trail and matching exact Case source/receipts. A final local interactive 390px user path passed with three public GETs and no console/JS errors. Real source reads are distinct from the stored replay and simulated failure controls.

[Rendered review gallery](receipts/sprint-a1/review.html) · [browser summary](receipts/sprint-a1/browser-summary.json) · [live public-GET summary](receipts/sprint-a1/live-summary.json) · [one hostile self-review](receipts/sprint-a1/hostile-review.md) · [one targeted self-rereview](receipts/sprint-a1/targeted-rereview.md).

| Viewport | Shipped V3 before | New frontdoor | Discovery | Same exact Case after |
|---|---|---|---|---|
| 1440×900 | [Before](receipts/sprint-a1/before-1440x900.png) | [After](receipts/sprint-a1/after-1440x900.png) | [Finds](receipts/sprint-a1/discovery-1440x900.png) | [Case](receipts/sprint-a1/case-1440x900.png) |
| 768×1024 | [Before](receipts/sprint-a1/before-768x1024.png) | [After](receipts/sprint-a1/after-768x1024.png) | [Finds](receipts/sprint-a1/discovery-768x1024.png) | [Case](receipts/sprint-a1/case-768x1024.png) |
| 390×844 | [Before](receipts/sprint-a1/before-390x844.png) | [After](receipts/sprint-a1/after-390x844.png) | [Finds](receipts/sprint-a1/discovery-390x844.png) | [Case](receipts/sprint-a1/case-390x844.png) |
| 320×800 | [Before](receipts/sprint-a1/before-320x800.png) | [After](receipts/sprint-a1/after-320x800.png) | [Finds](receipts/sprint-a1/discovery-320x800.png) | [Case](receipts/sprint-a1/case-320x800.png) |

Matched comparison set: the same recorded public feed/status, visibly stale on both sides. The before view and after Case use launch `742ed5c2d361c11d5a4da715e35e6c189a9b61ae4a433a937a96111360d7ab01`. Controlled empty/no-recurrence/partial-metadata/503/tamper states are labelled and never substituted into LIVE. Fresh production checks are separate evidence.

## Verdict and gaps

A first-time visitor can understand Rat Zero, start discovery, compare latest launches with supported deployer recurrence, choose a distinct unnamed or named launch, inspect its exact trail and receipts, share its URL, and return using browser history. Crew explains future jobs without active-job controls.

The frontdoor now explains the product before demanding investigation. Discovery is readable and has reasons to open a Case; the Case remains the dominant investigation surface. Phone actions are visible and deliberately composed. These rendered results are ready for owner judgment, not a claim of owner approval.

Remaining gaps: missing API token metadata; partial indexed history; historical Case UI rehydration outside the latest-20 snapshot (exact source link remains available); Safari/Firefox, real-device performance and independent reader comprehension untested. Saved Cases and persistent Watch are outside A1.

One hostile self-review and one targeted self-rereview completed; all four High findings fixed. No unresolved Critical/High findings in that bounded review. Draft PR only. Stop before merge or production deployment.
