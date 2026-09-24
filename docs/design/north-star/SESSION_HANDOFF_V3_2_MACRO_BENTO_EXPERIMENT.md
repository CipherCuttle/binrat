# BINRAT — EXECUTION HANDOFF v3.2 — MACRO BENTO VERTICAL SLICE
Date: 2026-09-24 CEST
Priority: P0, next experiment; DO THE WORK, do not restart design discovery.
Repository: https://github.com/CipherCuttle/binrat
Existing DRAFT PR: https://github.com/CipherCuttle/binrat/pull/31
Working branch: feat/binrat-north-star-slice-g0-g2
Base: feat/binrat-frontend-mobile-m1
Last independently inspected pre-handoff head: 6def71a84de36677add26b0941fab2d5129a764e.
ALWAYS REFRESH PR HEAD, DIFF, CI AND WORKTREE BEFORE WRITING. This handoff commit advances the head.

## 0. MISSION AND THE LATEST OWNER DECISION

Build one actual, usable, **data-backed experimental homepage slice**: a working macro terminal + working Rat Radar bento, with deliberate negative space and a small source-faithful cyborg rat operating a dumpster workstation. Its desktop/mobile screenshots are the next OWNER VISUAL APPROVAL gate. Do not build five more fake illustrated dashboards.

The owner preferred the last, relatively restrained concept: near-black professional dApp/dashboard, very small rat, large functional macro screen behind him, asymmetric bento grid, live read-only Arc stats, substantial negative space, micrographics inspired by precision hardware labels, restrained 1990s/early-2000s street texture and optional amber/green CRT warmth. The owner's exact new target supersedes the **old requirement that the rat dominate the homepage and five image-heavy portals fit above the fold**. Other old invariants remain: exact canonical anatomy and viewer-right red eye; source-based world palette; true data; existing routes; owner sign-off. The latest AI concept is a DIRECTION REFERENCE, NOT a production asset or proof of actual figures; if it is not attached to the successor conversation, ask owner to attach only if essential for judgment, but begin source/code inspection and bounded engineering immediately.

The rat is an escaped, exceptionally clever lab cyborg living in a dumpster and using salvaged CRTs to investigate digital trash. That lore should appear in small, intentional touches and microcopy. Do not render the entire interface as a junk pile or let the mascot overshadow the tooling. Humor is restrained, not a themed obstacle to using a serious research product.

The user explicitly dislikes generic SVG/primitive geometric illustrations, arbitrary animation, childish UI, low-density text-as-an-icon, five competing rusty monitors, glow-card soup, visually fabricated charts, crowded backgrounds and fake dashboard screenshots. Their desired comparison is a professional, high-density but breathable product dashboard: fast to scan, credible to use for ten minutes, with street-art grit confined to authored environmental surfaces.

## 1. OPERATING CONTRACT AND AUTHORIZATION

Use PLAN -> CHANGESET -> VERIFY -> VERDICT.
Bounded completion: IMPLEMENT -> TEST -> ONE hostile review -> fix Critical/High -> ONE targeted rereview if needed -> present actual desktop/mobile browser screenshots and await OWNER VISUAL APPROVAL.
Smallest coherent diff on EXISTING PR #31. Preserve existing WIP from other contributors and inspect the latest head before every push; no force pushes. Avoid multiple planning PRs, another general design round or endless review cycles.

APPROVED: bounded isolated frontend experiment, source-derived asset use, read-only public GETs, tests and downloadable preview artifacts inside current PR. A new homepage must be experiment-gated rather than automatically replacing stable '/' or publishing the static preview. No production deployment, new worker/D1 production writes or migrations, merge, token launch, Pons work, wallet connection/signing, financial action, fake launch marketing or new paid infrastructure. Existing source LIVE/DEMO boundaries are mandatory. Owner's preference in mockups for "CONNECT WALLET" is NOT authority to implement it.

If CI/workflow settings prevent an action, report the specific blocked step and preserve the candidate without fabricating a result.

## 2. WHAT EXISTS: VERIFIED REPOSITORY FACTS

- Prior draft head 6def71a84de36677add26b0941fab2d5129a764e added G0.1 artwork review files. PR #31 was draft, open, unmerged. CI and Cloudflare dry run on preceding commit 4e84ba659320052ecad060580da365dea198f5a5 were SUCCESS, and G0.1 owner-art workflow 36049586711 was SUCCESS. CI and dry run on generated-asset head 6def... showed 'action_required'; that is **not a test pass**. The separate optional radar-deploy workflow failed on 4e84...; do not misrepresent as successful.
- Exact masters: docs/design/north-star/binrat-character-master.png (git blob db53e725e52f871f6eb2eb185a8dfef17425b3d9), binrat-world-background.png (42557b90197f924c5b34bb44204c6d7bdbc6c832), binrat-home-north-star.png (8cf7c81cc6b6d82e8ef61d3280f53b856e6c7243), binrat-radar-north-star.png. NEVER modify masters. Source mask candidates and optimizations exist under web-v2/public/north-star-g0/. The procedural G0.1 WebPs under north-star-g01/ are NOT approved art; avoid reusing them as the new UI's hero feature.
- Existing artistically faithful but currently oversized original/derivative rat is source-canonical. Cropping/resizing is permitted if no changes to anatomy, eye, expression or proportions; inspect foreground halos before use.
- Existing frontend is React + Vite in web-v2/, not Svelte. web-v2/src/App.tsx owns route, mode, feed/radar state, source toggle; web-v2/src/data.ts validates public feed and watchlist through web-v2/src/liveAdapter.ts; web-v2/src/types.ts defines PublicFeed/RadarWatchlist. React App has desktop Home/ShellNav/StatusRail and separate MobileShell; web-v2/src/mobile/MobileExperience.tsx already has approved functional Discover/Radar/Saved/More navigation. Retain mobile M1 and forensic interior architecture.
- Current static preview uses hash routing with GET-only proxy per web-v2/src/previewRuntime.ts. The published GitHack URL may lag PR head; do not mistake it for the latest build.
- Root package manager pnpm 10.15.0. Main commands: pnpm install --frozen-lockfile; pnpm check; pnpm --dir web-v2 check. Existing browser checks: web-v2/checks/browser-smoke.cjs, responsive-preview.cjs, north-star-live-smoke.cjs, githack-preview-smoke.cjs and the CI Playwright runner. Follow AGENTS.md.
- Current API: GET /api/health returns chainId=5042, indexReady, checkpointBlock, launchCount, runtimeFresh, runtimeUpdatedAtMs, lastSyncError, historyBackfillComplete and observationReady. HTTP 200 may still contain indexReady:false. GET /api/feed yields validated asOfBlock, receipt, historyCoverage and bag list. GET /api/rat-radar/watchlist yields independently validated asOfBlock, partial/unverified coverage, indexedLaunchCount, distinctRecipientAddressCount, rankedAddressCount and up to FIVE ranked observed-recipient addresses with recurrence fields. The live adapter intentionally rejects impossible historyCoverage values.
- Existing primary paths: /dumpster, /radar, /radar/address/:address, /replay, /ledger, /watch, /creator/:address, /bag/:id, /method, /saved, /more. Creator Files requires source-reported address; do not synthesize human profiles. Ledger production is PRELAUNCH/LIMITED. Watch has Telegram confirmation boundary.

Read these before editing:
1. THIS document.
2. docs/design/north-star/HOMEPAGE_REBUILD_CONTRACT_V1.md and G01_VISUAL_REVIEW.md. **Resolve differences in favor of the owner's more recent smaller-rat/bento decision**; preserve engineering, evidence and safety laws.
3. docs/design/north-star/NORTH_STAR.md plus exact master art; AGENTS.md.
4. web-v2/src/App.tsx, data.ts, liveAdapter.ts, types.ts, previewRuntime.ts, styles.css, mobile/MobileExperience.tsx.
5. src/cloudflare/worker.ts /api/health and /api/feed routes, src/ratRadar/watchlist.ts, and affected Playwright checks/workflows.

## 3. DESIGN SYSTEM, NOT A SVELTE MIGRATION

Borrow the asymmetric responsive CSS GRID bento pattern seen in Svelte bento examples, but stay on existing React/Vite. Professional dark dashboard inside boxes; grime only at the environmental boundary. Do not install Svelte, a huge visual kit or a generic dashboard theme.

Initial visual tokens (TUNE FROM ACTUAL SCREENSHOTS, not arbitrary absolute contract):
- Background deep charcoal/graphite, few near-black shades; understated warm metal edges.
- Evidence mint/phosphor ONLY where meaningfully active, restrained amber for CTA/annotations, subtle magenta/purple sunset distant behind **small** dumpster scene. Avoid simultaneous neon red, purple, green and yellow all over every box.
- Desktop 12-column layout. Main macro terminal ~7/12 columns and text/identity scene ~5/12 in top bento area, with a featured Radar bento below ~7/12, the remaining smaller modules progressively. Gap ~16-24 CSS px, panel inset ~20-32 px; allow actual negative space.
- Only the macro terminal gets a convincing salvaged CRT physical frame; smaller bento modules are restrained modern analytical panels (the owner rejected five equally rusty mini CRTs). Keep honest real HTML text/numbers/charts inside the terminal's hardware outline. Never screenshot fake charts or data into the illustration.
- Rat occupies small accent area near one macro terminal corner (rough first trial <15% of hero visible area, calibrate visually); exact original visual identity, not a brand-new armored AI rat. Preserve enough whitespace around charts and interactions. The rat and background should be separate optimized raster layers. Rat is optional decorative art for accessibility.
- Typography: clear utility sans for body, precise mono hardware-style labels for metadata, limited distressed/street treatment for hero/physical stickers only. Essential text must be legible; 10px or smaller micrographics must be decorative/nonessential.
- Reference Teenage Engineering's information discipline and calibrated micro-labels, not a verbatim logo/typeface or unlicensed asset. Create clean CSS border/ruler/annotation work; NOT noisy synthetic SVG art or looping animations.
- Keep the yellow PRIMARY real Radar/Explore action and secondary existing Dumpster link. Do not invent Search, Connect Wallet or prices unless backed by real functionality.
- Mobile: deliberate rearrangement, NOT squeezed five-column desktop; clear intro+CTA, useful macro snapshot and featured Radar within practical scroll distance. Preserve functional M1 mobile bottom nav and reduced-motion behavior.
- LOGO is OPEN: owner rejected prior fake rat-head glyph. Keep an existing unobtrusive wordmark or an isolated temporary text mark. Do NOT ship a newly imagined icon as canonical without visual approval.

## 4. COMPONENT RESPONSIBILITIES — SMALL VERTICAL SLICE

Scope only what is needed for the next verifiable experiment:
A. Isolated MacroBentoHome component with scoped styles and experiment-gated entry. Suggested paths:
  web-v2/src/experiments/MacroBentoHome.tsx
  web-v2/src/experiments/MacroBentoHome.module.css
  web-v2/src/experiments/MacroTerminal.tsx
  web-v2/src/experiments/RadarBento.tsx
  web-v2/src/experiments/healthAdapter.ts
  web-v2/checks/macro-bento-smoke.cjs
Consolidate if fewer files are cleaner. A separate visual-only design document is not the deliverable.

B. Feature-gate the experimental homepage at a clearly documented URL, e.g. "/?experiment=macro-bento&source=live" ONLY when VITE_BINRAT_BENTO_EXPERIMENT=1 is enabled in an isolated build. No production default route replacement. The actual test URL depends on local/GitHack route semantics. Preserve the experiment flag across DEMO/LIVE toggles in this experimental context; current sourceSwitchHref discards non-source query params. Do not break ordinary app links/hash routes. Prefer reusing existing App state rather than duplicate feed/radar fetches.

C. MacroTerminal is REAL data:
  * GET /api/health: validate shape, chainId===5042, monotonic/nonnegative safe values, checkpointBlock, runtimeFresh and indexReady; indexReady false or runtime stale -> visible NOT READY / STALE / UNAVAILABLE, never glowing LIVE green.
  * Reuse validated feed and Radar adapters. Present indexed launch count from healthy health.launchCount (not limited feed.bags.length), actual checkpoint, measured Radar distinctRecipientAddressCount and coverage. Show independently labeled as-of blocks if health/feed/Radar checkpoints differ; do NOT combine mismatched values into an invented synchronized snapshot.
  * Refetch approximately every 60 seconds ONLY while LIVE page is visible. DEMO stays deterministic/static and is clearly DEMO. Use an abort/cleanup or request-sequencing mechanism to prevent stale response overwrites, no thundering-herd polling or high-frequency D1 reads. Reuse one App-level feed/radar state owner; an independent health hook is acceptable. Health 200 + ok:false must remain an error/warning. Explicit loading, empty, stale, partial, error and successful states.
  * "Changing in real time" means actual new validated responses; never animate fabricated counts. Label age/last updated with correct source provenance and local refresh semantics. The generated screenshot's '842 launches / 12% same creator / 3.4x recurrence / 18m avg' are FAKE CONCEPT FIGURES: ABSOLUTELY NEVER ship them as LIVE or infer those indicators from unrelated data.
  * Historical time-series chart is NOT currently provided. In first experiment, show a truthful numeric snapshot and compact HTML data summaries. An optional Canvas trend chart is allowed only if a chronological verified series actually exists and labels disclose the period/observations. Do not derive price candles or volume from feed records. Add Lightweight Charts/TanStack Query only if clear need arises after the minimal slice is measured; avoid installing libraries because they are trendy.

D. Featured RadarBento is functional and evidence-first:
  * Consume validated RadarWatchlist exactly as currently loaded; display genuine up-to-five observed RECIPIENT ADDRESSES, distinctLaunchCount, related receipt counts and available evidence links.
  * Show PARTIAL/NO_SWAP_EVIDENCE/UNVERIFIED accurately. Never convert address -> human identity, never imply profitability, certainty or buy recommendations. If Radar unavailable while feed healthy, retain feed and show only Radar unavailable. Vice versa also independent.
  * Link cards to existing /radar/address/:address or /radar via tested AppLink. At least one meaningful actual interaction/filter/detail jump; no inert rows or clickable-looking decorations.

E. Other three/four product routes remain existing and linked with compact truthful secondary entry cards as needed. Do not implement the entire 5-portal application or new data products in this experiment. Real HTML labels/tooltips/controls; empty material artwork must never bake mock figures.

F. At most one subtle art interaction: original rat's static optimized layer, a short keyboard-focus-aware CRT highlight using existing CSS and prefers-reduced-motion fallback. No Pixi/Rive/GSAP dependency in first slice. Uncluttered bento layout must look good WITHOUT any animation.

## 5. EXACT IMPLEMENTATION SEQUENCE

PLAN: Inspect latest PR/branch/tree/CI, read above docs, map current App route/mode state and public adapters. Record changed-file plan (~4-7 focused source files + 1 smoke) and identify if owner latest concept image can be reused as visual direction only. No source master changes.

CHANGESET-1: Gate isolated MacroBentoHome from existing App on experimental query/build flag. Reuse route navigation and source mode. Build the responsive bento skeleton with real typed component props and no source or chart fakery. Add canonical small rat layer from G0 approved source; a simple image srcset/CSS is enough.

CHANGESET-2: Add strictly validated read-only health adapter and bounded 60-second visible LIVE updates integrated with existing loadProductData state. Wire MacroTerminal to health/feed/radar, then RadarBento to real candidate evidence and existing routes. The rest remain small truthful doorway links. Preserve all old views unmodified.

VERIFY functional and visual INDEPENDENTLY, on exact final commit. Render real browser screenshots: at minimum 390x844, 430px phone, 1024 tablet, 1440x900 and latest concept reference-sized desktop; respect preexisting 320/360/768 checks. Check phone first-view CTA, status readability, Radar discovery, no cramped bento, no horizontal overflow, reduced motion, keyboard, contrast and tap targets. Compare current branch old home versus experiment and owner target; capture ACTUAL Playwright screenshots; never present generated illustration as running product.

Run locally/CI (adjust to available environment, no assumption that /home/swirky is mounted):
  corepack enable
  pnpm install --frozen-lockfile
  pnpm check
  pnpm --dir web-v2 check
  # In repo's existing pinned CI Playwright environment:
  # run web-v2/checks/browser-smoke.cjs
  # run web-v2/checks/responsive-preview.cjs
  # run web-v2/checks/north-star-live-smoke.cjs
  # add/run web-v2/checks/macro-bento-smoke.cjs

EXPLICIT TEST FIXTURES:
  1. Healthy verified LIVE health/feed/radar -> real sourced figures with labels.
  2. health 200 indexReady=false / runtimeFresh=false -> no fake LIVE signal.
  3. valid feed / Radar 503 -> feed survives, Radar unavailable.
  4. Feed 503 / valid Radar -> Radar survives with own checkpoint.
  5. Cross-checkpoint health/feed/Radar -> never present joint synchronized total.
  6. Malformed or stale JSON -> typed error, no DEMO fallback.
  7. DEMO -> prominently identified fixed fixtures, no health polling.
  8. Tab hidden -> pause polling; restored -> bounded refetch; unmount -> no set-state leak.
  9. Keyboard/scroll/mobile nav and actual link destinations; 24px WCAG 2.2 AA target minimum, prefer >=44px touch controls; contrast 4.5:1 normal/3:1 large.
 10. No POST mutation, wallet flow, invented creator attribution or pseudo-historical price chart.

Hostile review ONCE after working component+tests+screenshots, with red-team focus on false claims, checkpoint mismatch, data/visual gaps, focus, responsive bento geometry, asset provenance, visual slop, source mode and unauthorized workflow. Fix Critical/High findings; targeted rereview once if necessary.

VERDICT: SMALL EXPERIMENT succeeds only when real screenshots, real data/state tests and owner visual response support the result. Existing PR stays DRAFT even if CI green. Offer a compact owner comparison: current G0/G0.1 versus new experimental desktop and mobile. If art still reads generic or charts/data feel fake, stop before propagating it to four other modules.

## 6. EVIDENCE, PERFORMANCE AND ROLLBACK

Source truth: original PNG hashes, actual route adapters and public /api endpoints. Model-generated images are layout inspiration, not production art or factual evidence. Record screenshot build SHA, viewport, DPR, source mode, API fixtures/provenance and state. Screenshots using synthetic DEMO MUST say DEMO in UI and review caption; LIVE screens must handle upstream errors transparently.

Optimize hero art with responsive WebP/PNG using source-preserving derivatives; avoid desktop-sized transfers to phones. Measure network/JS and page layout with actual Playwright/browser output; target WCAG 2.2 AA. Real-user CWV LCP<=2.5s, CLS<=0.1, INP<=200ms are later measurement goals, not claims for a freshly built local preview.

Rollback: remove/disable VITE_BINRAT_BENTO_EXPERIMENT (default OFF) to restore existing Home exactly. No shared API semantics, existing mobile bookmarks, core contracts, worker or D1 schema may change. Existing tests must remain green; no forced migration.

## 7. REQUIRED FIRST RESPONSE FROM SUCCESSOR

Do not reply with only another plan. Immediately fetch latest PR #31 head and relevant files, then implement the isolated macro terminal + Radar bento on the current draft branch. Report 1) current exact SHA and CI status, 2) proposed focused file changes, 3) concrete code/test/screenshot artifacts, and 4) unresolved owner visual questions. Stop at owner visual gate, not at green CI. No merge or deploy.
