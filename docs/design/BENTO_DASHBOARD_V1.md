# BINRAT — active bento dashboard direction

**Status:** owner's current design direction, supplied in conversation 2026-09-24 22:53 UTC. Design implementation and owner visual approval PENDING.
**Scope:** homepage and related design decisions in draft PR #31 only. This document transcribes the owner's direction; it is not a claim that the current application matches it. The owner-supplied image is a conversation attachment, not an image checked into this repository.

## Design authority and exclusions

The owner's **bento dashboard image AND accompanying structural wireframe** are the only active visual/product-composition target for this frontend rebuild. This supersedes all older North Star, Dumpster OS, G0/G0.1 five-illustrated-portal, giant-rat, marketing-homepage, cyberpunk generated-image, and previous MacroBentoHome CSS contracts. Do not reinterpret the illustrated concepts as additional requirements. Current web-v2 visual code is a **legacy implementation to replace**, not a styling recipe, reference screenshot, or source of visual authority.

Continue to respect **technical authority** from working code and canonical endpoints: types and validators for /api/health, /api/feed, /api/rat-radar/watchlist, public address/activity evidence; real routes; M1 mobile task navigation; GitHub browser tests; explicit DEMO/LIVE and error semantics; capability manifest. The approved rat's identity may be sourced from docs/design/north-star/binrat-character-master.png; this image is an asset, not a mandate to reproduce its old homepage scene. Other existing imagery is non-binding.

## Owner's structural wireframe (copy/content intention)

Horizontal header: BINRAT · DUMPSTER · RADAR · REPLAY · LEDGER · WATCH.

Hero intro:
OPEN-SOURCE LAUNCH INTELLIGENCE
THE RAT REMEMBERS.
Investigate public launches, recurring addresses and their supporting evidence.
Primary real action: EXPLORE RADAR →.

Adjacent prominent ARC / MACRO TERMINAL:
SOURCE STATUS
INDEXED LAUNCHES
LATEST CHECKPOINT
OBSERVED RECIPIENTS
COVERAGE
Subtext: verified source data only; show actual source-specific checkpoint and freshness, never claim all panes share a synchronized update.

Lower product bento:
01 / RAT RADAR — observed recipient recurrence and linked launch evidence — actual recipient data / INVESTIGATE →.
02 / REPLAY LAB — select a launch and inspect available evidence over time — SELECT CASE →.
03 / LEDGER — available launch history, but distinguish financial ledger and existing capabilities accurately — OPEN →.
04 / CREATOR FILES — source-reported addresses — OPEN →.
05 / WATCH — Telegram handoff — OPEN →.

The headings describe the intended entry points, **not invented routes**. Use the existing correct route if one exists. Creator Files needs a real reported address to open a dossier: absent that, link to a real discovery path instead of making up a /creator index. Watch must disclose the actual Telegram confirmation/subscription boundary, Ledger its prelaunch/limited state, and Replay its actual evidence availability.

## Token portraits on launch cards

Use the real source-reported token `imageUri` only when it matches the exact indexed launch. Treat external token media as untrusted: validate the URL and media type/size, never execute active remote content, lazy-load below-fold images, and provide a clean fallback for absent/failed art. A project-supplied image is not verification of the project. Radar identifies observed addresses, not people: show linked tokens' own thumbnails on linked launch records, never invent address-holder portraits. The user's requested bento cards should include actual token artwork where available, not invented chart art.

## Layout, visual and interaction boundaries

- Keep existing React/Vite. Use a responsive **asymmetric bento CSS Grid** layout with actual negative space. The desktop hero includes a restrained text/identity area next to one *functional* macro terminal. Rat Radar is the first featured working bento; remaining panels are secondary navigation until real capability supports more. Show meaningful functionality, not five fake dashboards.
- Overall material: mostly flat, restrained charcoal panels with consistent alignment, typography and readable data. **Only the large hero macro terminal** gets a deliberately authored physical CRT casing; do not add five competing rusty mini-machines, decorative rust on every tile, generic glow-card effects, tiny decorative text pretending to be UI, or fabricated charts.
- The original small cyborg rat is positioned thoughtfully near the hero terminal without obscuring readable data. Preserve canonical anatomy and viewer-right red eye. The earlier full-scene hero/giant rat and synthetic generated cyberpunk interface are **not** the target.
- Primary action is the real yellow Radar exploration link; Dumpster is a valid secondary destination. No inert search, wallet button, token-live claim or invented marketing CTA.
- Normal body copy, labels, input affordances, focus states and mobile touch targets must be legible. Micrographics can be decorative but may not carry essential evidence, status or action meaning.
- Mobile is an *intentional* recomposition: introduction and Radar CTA, useful compact validated macro status, featured functional Radar near the top of the scroll, other bento panels progressively stacked. Preserve currently working four-tab M1 navigation (Discover / Radar / Saved / More) as a technical baseline, not a claim of final visual approval.

## Functional contract: the macro terminal must actually work

- GET /api/health supplies launchCount and index health only after strict validation. HTTP 200 with ok:false is NOT READY. Invalid or stale runtime cannot show a green verified LIVE badge or previously good totals as current.
- /api/feed supplies independently validated recent launches and its own as-of checkpoint; never present response length as the complete indexed-launch total.
- /api/rat-radar/watchlist supplies independently validated observed recipient counts, up-to-five ranked candidates, coverage and checkpoint. Address is not human identity. Recurrence is not profit, safety or a buy recommendation.
- Fetch LIVE data on a bounded cadence of approximately 60 seconds while visible, with cancellation/cleanup, independent Feed/Radar failures and non-atomic checkpoint disclosure. DEMO is explicitly synthetic and never used as an invisible LIVE fallback.
- Do not display a chronological chart until a verified historical series exists. A table and honest empty/stale states are preferable to fake visualization. Avoid installing libraries merely because earlier exploration recommended them.
- Radar is the first **fully functional** bento: real recipient records, recurrence and acquisition-receipt counts, real address/detail and public activity-evidence links, and a meaningful supported interaction. Other panels link to available honest routes rather than displaying screenshot-baked mock numbers.

## Acceptance and implementation sequence

1. Reuse **technical** source validators/routing, not legacy styles. Start with a fresh, scoped React/CSS implementation of the owner's exact macro + Radar bento structure. Preserve current stable / and production deployment until visual sign-off; use an explicit experiment/build gate on the existing draft branch.
2. Verify actual DOM behavior and data boundaries separately from visual design. Compare real Playwright desktop (1440 and reference width), tablet (1024/768), phones (430/390/360/320) against the user-provided image. Record exact build SHA, DPR, source mode and fixtures. No horizontal overflow, hidden action, clipped rat, or tiny essential labels.
3. Visual approval is a separate owner decision; green CI and no-overflow screenshots do **not** prove the design matches. Perform one hostile review, repair critical/high issues, one targeted rereview if necessary. No GitHack publish, merge, production deploy, wallet, token, fund or D1 authority follows from design approval.

**Do not resurrect retired instructions from Git history, old PR descriptions, generated concepts, issue comments, or outdated docs unless the owner explicitly re-approves them.** The attached current image controls the visual goal; current route/API code controls what claims can truthfully be made.
