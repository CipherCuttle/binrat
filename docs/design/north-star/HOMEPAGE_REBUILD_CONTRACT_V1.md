# BINRAT — Homepage North Star fidelity rebuild contract V1

Date: 2026-09-24. Status: PLAN / OWNER VISUAL ACCEPTANCE PENDING.
Scope: existing draft PR #31 only; base PR #24. No new visual PR, production deployment, merge, token action, wallet action, D1 migration, or public-marketing authorization.

## Why a rebuild rather than another CSS polish pass

The owner-supplied side-by-side desktop comparison establishes a substantial visual mismatch: the approved reference is an edge-to-edge illustrated world with a horizontal masthead, dominant complete rat/dumpster, massive distressed cream headline, prominent yellow Dumpster CTA, and FIVE illustrated product portals in one strip. Current G2 preview is an interior application dashboard with a 210px sticky sidebar, independent 45px status rail, 660px boxed hero, dark overlay, flattened cover-cropped master, and three summary panels instead of five product portals. Functional CI success did not measure this fidelity. The original approved homepage artwork, rat identity and world master in this directory remain authoritative. Do not silently redesign them.

VISUAL AUTHORITY: original four approved master PNGs plus owner reference screenshot. FACTUAL AUTHORITY: canonical public APIs/capability manifests; illustrative text/numbers in mockups are not evidence.

## Non-negotiable visual laws

1. Desktop / has its own illustrated home shell: full-width sunset, horizontal masthead, intact red-eye canonical rat and dumpster on the right, left-aligned oversized cream distressed two-line heading, physical-looking yellow Enter the Dumpster primary action, five distinct illustrated portal cards at the bottom of first-view composition, and an understated lower identity band. Desktop / must NOT inherit the forensic left sidebar or status rail.
2. Keep the pixel/dither texture and exact approved world palette; do not replace source artwork with gradients, a generic illustration, a card-grid hero, generic SaaS tiles, or reinterpreted rat anatomy. Shadows for dynamic text are allowed only where necessary for contrast, not as broad masks hiding the scene.
3. Rat Radar, Replay Lab, Ledger, Creator Files and Watch appear as five unique illustrated portals. Each must lead to an actual current route with truthful capability/availability disclosure. Reuse the existing route/data/evidence code rather than reimplementing business logic.
4. Technical chain/checkpoint/coverage detail moves to an accessible compact status entry on Home and remains prominent inside the forensic workspace. Preserve explicit DEMO versus LIVE choice, service-failure semantics and FREE public factual evidence.
5. Inside Radar / recipient / evidence, a task-oriented forensic shell is appropriate. The home composition is not to be forced across every route. Preserve current M1 mobile task navigation until the separately approved mobile composition is implemented and visually accepted.
6. No fabricated data, fake Sign In/Pricing/Careers actions, fictitious social links, invented human attribution, unsupported token-live claim, or inaccessible decorative link. Reference labels without backed functionality must be omitted or clearly non-interactive with a truthful explanation.

## Desired desktop composition / first screenshot acceptance

At the owner comparison viewport, default 100% browser zoom and a fixed device scale: masthead spans scene width; world extends edge-to-edge without an obvious seam or duplicated sunset; rat/dumpster silhouette occupies the majority of the hero's right half and remains readable; headline and yellow CTA dominate the left; five product portals form one visible horizontal strip below/overlapping the scene; an identity/about band closes the composition. The first viewport must not be consumed by one isolated hero with product discovery below the fold.

Reference-informed initial sizing at approximately 1440–1680 desktop width: masthead ~76–90px; illustrated hero ~460–520px after masthead; five portals ~220–250px; lower band ~70–95px. Rat, hero, and portal overlap boundaries are art-directed, not an arbitrary fixed-height cropping rule. Calibrate against screenshots, do not assume these estimates are final pixel-perfect measurements.

Tablet 768–1100: retain broad artwork and a horizontal/condensed header, with explicit scroll or progressive grid for portal cards; no unreadably tiny five-card squeeze. Phone 320/360/390/430: use owner-approved mobile composition and an independently art-directed portrait world; current bottom navigation remains task-first. No desktop full-size artwork downloaded unnecessarily for a phone.

## Work package 0 — Freeze reference and truth constraints

- Record approved desktop screenshot capture parameters (viewport, zoom, DPR, browser/font environment) and the four original asset blob SHAs. Preserve North Star PNGs byte-for-byte.
- Keep screenshot comparison source explicit; the eight-panel mobile/desktop reference mentioned in COMPOSITE_ADAPTATION.md is still absent from GitHub and must be archived from the exact owner original before claiming full reference traceability.
- Map every proposed visible navigation item, portal, search control and status badge to a real route and underlying capability; defer unimplemented Pricing/Careers/Sign In rather than shipping fake interactions.
- Snapshot current preview at matching desktop, tablet and phone widths to establish regression evidence.

EXIT: reproducible reference set + truthful feature/route mapping.

## Work package 1 — Manufacture real artwork layers (G0 gate)

- From the exact approved rat/dumpster master, prepare a transparent foreground without changing face, red viewer-right cyber-eye, ears, paws, expression, proportions, garbage details, or dither language. Preserve the original file. Manual masking and reconstruction of genuinely occluded background where necessary; do not claim a fully faithful extraction from unseen pixels.
- Prepare responsive world/skyline crops from the approved world master; preserve skyline continuity, sunset palette and dither. No duplicated world background in nested hero and app shell.
- Create empty artwork: illustrated Radar CRT/workbench, paper recipient dossier and evidence frame, plus five distinct empty/decorative product-portal thumbnails. No baked mock data or dynamic labels in these illustrations.
- Store approved master derivatives and a reproducible Sharp-based sizing/compression script; use lossless WebP or PNG where required to avoid pixel damage, with picture/srcset art direction for mobile. Optimize without treating a byte target as license to mutilate the art.
- Present the real composite on dark/bright test backdrops at target desktop and phone crops for OWNER G0 APPROVAL before final component work.

EXIT: visual approval of complete rat silhouette, scene continuity, empty framed assets and responsive crops. If an exact faithful layer cannot be produced from existing flattened pixels, surface the specific missing source art rather than patching with hallucinated lookalikes.

## Work package 2 — Build a new isolated homepage shell

- Introduce a scoped HomeScene / SiteMasthead / WorldStage / ProductPortalRail implementation, with dedicated homepage styles/tokens; do not keep growing the legacy 2000-line global stylesheet or pile on conflicting last-in-file overrides.
- Route desktop "/" through HomeScene, while existing forensic shell still serves /dumpster, /radar, /creator, /bag and other working paths. Preserve current route, feed, radar, bookmarks and source-mode state ownership.
- Scene composition uses one persistent world image and one independent foreground image. Use CSS Grid for masthead/hero/portal spatial relationships and absolute positioning only for bounded art layers; no meaningless text-baked UI backgrounds.
- Restore visible primary action Enter the Dumpster and secondary real Radar entry. Keep actual semantic h1, accessible links, keyboard focus, source-state affordance, reduced-motion behavior and readable text contrast.
- Implement five real illustration + HTML portal cards: Radar -> /radar; Replay -> /replay; Ledger -> /ledger; Creator Files -> supported /dumpster or documented creator-discovery route; Watch -> /watch with Telegram subscription boundary. Mark unfinished functionality truthfully.
- Retain existing three live-summary modules by relocating them to /dumpster or a coherent optional below-the-fold evidence section, NOT as replacements for the five portals.
- Horizontal navigation must not assert unsupported Pricing/Careers/Login functionality. Search appears only when real search submit behavior and route-state retention are tested.

EXIT: at reference desktop viewport, owner can identify the same composition before inspecting any data. All visible controls function truthfully.

## Work package 3 — Restore the intended interior world

- Radar route retains its reviewed API/checkpoint behavior but gains approved empty CRT frame; paper recipient file and evidence sheet gain approved empty paper/frame materials. No API data painted into static illustrations.
- Preserve independent Feed/Radar/recipient failures, distinct empty/unavailable states, exact activity/address IDs, no LIVE-to-DEMO fallback, direct links, clipboard controls and reduced-motion behavior.
- Use original world background consistently through transitions without duplicating entire sky/dumpster imagery behind interior panels. Do not broaden this sprint into speculative new product features, holder auth, Rive rigs or PixiJS.

EXIT: route-integrated Home -> Radar -> recipient dossier -> public evidence journey, existing trusted tests intact.

## Work package 4 — Verify VISUAL + FUNCTIONAL separately

VISUAL at fixed environment:
- Capture 320, 360, 390, 430, 768, 1024, 1440 and reference-size desktop screenshots; use the real GitHack build with identical asset paths. Produce before/after/contact-sheet evidence.
- Owner signs off reference-level hierarchy: horizontal masthead, full rat/dumpster, correct red eye, world palette/skyline, headline, yellow primary CTA and FIVE distinct portal cards. Do not mark a CSS approximation as G0 complete.
- Playwright geometry invariants catch missing/offscreen cards, rat clipping, overlapping navigation, unreadable status, horizontal overflow, layout regressions and wrong source mode. Screenshot baselines are separate from illustrative design comparisons; dynamic evidence is masked where appropriate.
- Evaluate pixel edges at 100% zoom and DPR 1/2, alpha halos, skyline seams, source image identity, tablet crop and real Android capture. Verify legible ordinary UI typography and accessibility (keyboard, focus, sufficient contrast).

FUNCTIONAL:
- Full repository check + V2 build/browser smoke on exact final PR head; mocked LIVE error/success and DEMO/LIVE route persistence; zero synthetic LIVE substitution; working preview URLs; no new wallet, deploy, worker-write or token pathways.
- Measure network transfer, hero LCP, CLS and responsive image loading in reproducible emulation. Initial target: avoid >1.5 MB of first-view art on desktop and >0.9 MB on phone if quality permits; disclose tradeoff if authentic pixel art makes target impracticable. No hero lazy-loading.
- ONE hostile review after implementation. Repair Critical/High. ONE targeted rereview if required. Medium/Low findings only reopen if they violate the stated visual acceptance or evidence invariants.

EXIT: explicit OWNER VISUAL PASS AND ENGINEERING PASS. Green CI alone is insufficient. Keep PR draft and do not merge/deploy until separately authorized.

## Change discipline

Plan -> smallest coherent changeset -> verify -> verdict.
One existing draft PR #31, four bounded logical commits/batches at most where practical: asset pipeline; new Home scene; interior integration; visual/functional verification and Critical/High repairs. Avoid reopening visual discovery, unrelated product work, backend migrations, generic animations, token marketing or token-launch tasks.

Authority: draft planning/implementation within existing approved branch only. Merge NONE. Production deploy NONE. Token/wallet/funds NONE. Separate external release authority is required.
