# SESSION HANDOFF v3.2 — BINRAT NORTH STAR FIDELITY REBUILD
Date: September 24, 2026 (CEST)
Priority: P0 / NEXT EXECUTION MILESTONE (owner explicitly prioritized this visual rebuild)
Repository: https://github.com/CipherCuttle/binrat
Existing draft PR: https://github.com/CipherCuttle/binrat/pull/31
Working branch: feat/binrat-north-star-slice-g0-g2
Base: feat/binrat-frontend-mobile-m1 (PR #24)
Authoritative implementation plan: docs/design/north-star/HOMEPAGE_REBUILD_CONTRACT_V1.md
Visual contract: docs/design/north-star/NORTH_STAR.md
Latest inspected predecessor head BEFORE THIS HANDOFF COMMIT: 7e19989e3ef03236027cfc559354980e8b4ee14c. Always refetch live branch and CI before any change; this document commit advances the head.

## 0. MISSION — DO THIS NEXT, NOT TOKEN WORK

The owner compared two September 24 screenshots: (LEFT) original approved BINRAT desktop homepage, (RIGHT) actual raw.githack.com G2 preview. Owner explicitly rejected the discrepancy and selected faithful homepage rebuild as the next priority. Do not start another design-discovery round or token-launch sprint.

The LEFT target is edge-to-edge pixel/dither sunset, horizontal masthead, massive distressed cream "THE RAT REMEMBERS" headline on left, intact giant canonical red-eye rat and dumpster on right, large physical yellow "ENTER THE DUMPSTER" CTA, FIVE illustrated portal panels (Rat Radar, Replay Lab, Ledger, Creator Files, Watch) across the bottom of first view, and a restrained lower information band.

The RIGHT failure is the current conventional dashboard: 210px desktop left sidebar, 45px technical status rail, boxed darkened/cropped hero, tiny typography, three dark live-summary cards replacing the five illustrated portals, little of the approved environment visible. The architecture is wrong, not just colors and spacing.

Owner-provided comparison screenshots are not yet stored in GitHub. Ask the new session to attach the handoff screenshot bundle from the outgoing session (or the two images) if it has no access to them. The four approved original master PNGs ARE in GitHub, under docs/design/north-star/. Never label a regenerated approximation the approved asset.

## 1. OPERATING CONTRACT

PLAN -> CHANGESET -> VERIFY -> VERDICT.

Smallest coherent changesets on EXISTING draft PR #31 only. Bounded completion: IMPLEMENT -> TEST -> ONE hostile review -> fix Critical/High -> ONE targeted rereview if necessary -> CLOSE WITH OWNER VISUAL ACCEPTANCE. No endless review loop, no scattered micro-PRs.

Authorization: bounded engineering on PR #31 approved. Existing isolated GitHack/frontend GET-only preview approval applies solely to the previous G2 preview workflow; verify exact scope before republishing. Merge NONE. Production deployment NONE. Token launch, token marketing, wallet sign/broadcast/spend NONE. D1 production migrations NONE. Pons holder/funding activation NONE. No private keys.

Avoid colliding with the separate Pons PR stack (#20/#26/#27/#28/#29/#30/#32). Arc 5042 research and its FREE factual receipts remain unchanged. Owner-selected future $BINRAT token direction: Robinhood 4663/Pons V2, still BLOCKED, NOT_LAUNCHED; old Arc V0 roles are historical only. The visual rebuild does not create token launch authority or fake verified official links.

## 2. VERIFIED CODE AND CI BASELINE

As inspected before this handoff:
- Draft PR #31 was open/unmerged, base PR #24.
- Prior functional/visual-scaffold commit 9c64263a854860af2dbd67453cfba79a4b00ecc5 passed GitHub CI run 36027854707 (check + frontend-v2-browser-smoke jobs SUCCESS; optional radar deploy/smoke jobs SKIPPED) and Cloudflare DRY-RUN 36027854689 SUCCESS. These are not visual-fidelity acceptance.
- Planning contract was committed at 7e19989e3ef03236027cfc559354980e8b4ee14c; this handoff advances branch again. Refetch new head and workflow state, do not imply newest commit CI passed without checking.
- Existing G2 has useful, tested: independent GET-only Arc recipient activity adapter; exact address/deep-link/evidence detail and full-ID copy; Feed/Radar/recipient independent failure handling; explicit DEMO/LIVE toggles; responsive/task-first mobile shell; preview-specific GET-only proxy; GitHack static preview.
- Preview: https://raw.githack.com/CipherCuttle/binrat/preview-binrat-g2/index.html (may lag branch until preview workflow republishes).
- Render public read-only preview proxy: https://binrat-githack-proxy-v2.onrender.com/api/health; upstream may sleep/fail.
- PR body predating this handoff was stale and described only initial five tests. Update or verify current PR metadata separately.

Key code:
- web-v2/src/App.tsx: App() branches compact mobile vs desktop; desktop ShellNav() + StatusRail() + Home(); Home currently three snapshot panels. RatPresence() mounts flattened canonical PNG. Keep data and recipient logic.
- web-v2/src/styles.css: ~2000-line legacy shared stylesheet; .app-frame two-column 210px nav; .home-hero 660px; broad gradient masks; many 6–9px UI font sizes. Do NOT keep layering contradictory override rules.
- web-v2/src/northStarSlice.css: provisional world image/rat overlay and interior paper scaffolding; desktop still dark boxed hero.
- web-v2/src/RoutePages.tsx: real Watch route is Telegram-managed, Ledger is prelaunch-bound, Creator route requires exact address, Replay route exists. Every new portal must navigate truthfully.
- web-v2/src/mobile/MobileExperience.tsx: preserve approved working mobile bottom nav and task flow until mobile visual gate.
- web-v2/checks/north-star-live-smoke.cjs, responsive-preview.cjs, browser-smoke.cjs, githack-preview-smoke.cjs: functional acceptance exists, but no strict North Star composition gate.
- docs/design/north-star/binrat-character-master.png: exact canonical scruffy rat, ONE red cyber-eye on viewer-right.
- docs/design/north-star/binrat-world-background.png: exact cobalt/purple/magenta/orange/cream pixel sunset.
- docs/design/north-star/binrat-home-north-star.png: owner-approved homepage composition reference.
- docs/design/north-star/binrat-radar-north-star.png: owner-approved Radar composition reference.
- docs/design/north-star/COMPOSITE_ADAPTATION.md: additional eight-panel mobile/desktop reference originally held outside GitHub; do not falsely claim its binary is present in repo.
- docs/design/north-star/G2_HOSTILE_REVIEW.md: earlier functional G2 review; it explicitly marks art/performance gate OPEN.

## 3. WHY WE FAILED — DO NOT REPEAT

The approved image was interpreted as moodboard art rather than the actual layout contract; the old dashboard shell was retained; original PNG inserted as full-bleed image under a giant dark mask and cover crop instead of making separately positionable art layers; five product portals replaced with three data cards; tiny monospace metadata took first-view attention; CI checked functional behaviors/overflow and not screenshot composition; a provisional asset gate was allowed to coexist with a superficially "finished" frontend.

The owner does NOT want another redesign or generic SaaS aesthetic. Preserve original rat anatomy, red eye, skyline, dither, visual density and reference spatial hierarchy.

## 4. EXECUTION PLAN AND REQUIRED VISUAL ACCEPTANCE

Full detailed, actionable acceptance contract: docs/design/north-star/HOMEPAGE_REBUILD_CONTRACT_V1.md. Use that as spec. Recommended bounded batches:

A. FREEZE + ASSETS (first priority, actual blocker)
- Record reference viewport/DPR/browser/zoom, preserve Git blob SHA and original images, stage owner left/right comparison captures.
- Extract/prepare exact transparent rat/dumpster foreground without redrawing/reinterpreting original; reconstruct obscured background if necessary, be explicit if a source layer cannot be recovered faithfully. Prepare responsive world/skyline art without duplicated sunset, five distinct illustrated empty portal images, empty CRT/paper dossier/evidence frame assets.
- Use GIMP/manual layer masks when needed; Sharp as reproducible derivative/export pipeline; do not ship unoptimized >5MB raw pair on mobile if reasonable pixel-faithful derivatives are available.
- Owner G0 visual sign-off on authentic rat/world layered composite and phone crop. Do not substitute CSS gradient illustrations or bake fake dynamic data into art.

B. HOMEPAGE ARCHITECTURE
- Create isolated HomeScene/SiteMasthead/WorldStage/ProductPortalRail and dedicated tokens/styles; desktop "/" gets horizontal masthead, full scene and five illustrated clickable portals. Existing forensic ShellNav/StatusRail remains where actually useful on /radar,/dumpster,/creator,/bag etc. Keep compact task-first mobile path intact while matching approved mobile reference.
- CTA "Enter the Dumpster" goes to /dumpster; other cards link /radar,/replay,/ledger,/watch; Creator Files card leads to actual creator-discovery /dumpster or exact supported /creator/:address route, never empty/fake route. Search or Sign In must be real before interactive.
- Move current useful live-summary cards into /dumpster or optional below-the-fold evidence area; don't delete business functionality.
- Keep DEMO versus LIVE toggle discoverable, truthful, accessible, with NO LIVE -> DEMO data substitution.

C. INTERIOR VISUAL INTEGRATION
- Radar gets owner-approved empty CRT/workbench, recipient file gets dirty-paper casefile and activity sheet empty frame; retain exact evidence state and tested GET-only adapters. Don't broaden into Rive rigging/PixiJS, new token privileges or infrastructure.

D. SCREENSHOT AND FUNCTIONAL VERIFICATION
- At minimum 320,360,390,430,768,1024,1440, owner-reference desktop viewport and DPR1/2: screenshot real preview; owner-review before/after. Test visible masthead, complete rat/dumpster, no duplicated/cropped sunset seams, exact red eye, distressed headline, primary yellow CTA, five illustrated cards present in intended area, no overlapping controls, no horizontal overflow, readable typography and mobile task flow.
- Playwright geometry and deterministic screenshot assertions for components; human/owner visual review for overall reference fidelity, no fake quantified similarity. Test frontend routes, feed/radar/recipient errors, DEMO/LIVE separation, preview static paths and public GET-only backend. Run full repository check on exact FINAL head.
- Target conditional art-transfer budget in plan; verify LCP/CLS and actual bytes without destroying pixel style.
- Exactly one NEW hostile review after rebuilt implementation; Critical/High fix; one targeted rereview if required; owner visual PASS mandatory. Keep PR DRAFT until separate merge authority.

## 5. IMMEDIATE NEXT ACTION FOR SUCCESSOR

1. Use connected GitHub. Fetch PR #31 and exact latest branch head, latest CI, full rebuild contract, 4 approved master images, and current App/styles/preview workflows before editing. Do not assume user's local filesystem is available.
2. Ingest side-by-side owner screenshots from handoff bundle if provided; left=target, right=failed current.
3. Start G0 ASSET WORK, not a fifth planning document and not generic CSS overrides. Determine what exact layers can be recovered faithfully from current original Git art. Produce first layered desktop/phone composite for owner approval, then continue scoped homepage engineering in SAME draft PR.
4. If execution environment cannot fetch binary Git art or prepare exact layers, surface the missing transfer capability and use the provided screenshot bundle/user file attachments or a cloud computer; do not hallucinate asset creation or falsely mark G0 PASS.
5. Verify latest CI and draft status before claiming completion. Keep PR body/current state up to date, deliver screenshot evidence and specific owner approval question at art gate. No production deployment/merge.

VERDICT ON HANDOFF: Implementation remains visually unaccepted. Functional G2 prior CI green. Next priority = genuine art-layer manufacture and authentic illustrated Home rebuild, followed by interior visual integration; token sprint suspended, not canceled.
