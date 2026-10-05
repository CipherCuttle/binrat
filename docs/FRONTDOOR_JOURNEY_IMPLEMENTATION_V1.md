# Frontdoor Journey V1 — implementation receipt

Date: 2026-10-05
Branch: `feat/binrat-frontdoor-journey-v1`
Base: `integration/binrat-public-read-plane-stability-v1@d31faee8e7e572cf1e1a540e3f97832674ca5dca` (draft #121)
Design authority: `docs/BINRAT_FRONTDOOR_JOURNEY_V1.md`
Asset authority: frozen Rat Select Desktop V2; byte hashes in `docs/FRONTDOOR_ASSETS_V1.json`.

## PLAN

Implement the approved Home/navigation/Crew presentation slice on the canonical read-plane stability composition. Preserve the existing Dumpster, evidence drawer, source validators and read-plane controller. Existing branches and worktrees are untouched.

## CHANGESET

- Home: hero → three feed-backed launch previews → Crew overview → FIND/EMPLOY/LEAVE/RETURN → Free/Working comparison → Telegram.
- START DIGGING opens existing `#garbage` discovery. `#top` restores Home; Crew/Den use local fragments without introducing backend routes.
- Full Crew detail is shown on Crew destinations. Rat Zero is selected by default; Tripwire BUILDING, Sniffer NEXT and two LOCKED slots remain fixed.
- New launch previews reuse the verified feed and the same Case drawer. No extra background creator-summary request is made.
- Stale previews are retained with stale context. Initial failure has its own retry action; empty and unavailable remain distinct.
- Tripwire's Case action opens its BUILDING explanation. No employment, cost reservation or persistent job is created.
- Den is a BUILDING explanation, not an active-jobs simulation.
- Public token promotion and the old oversized roadmap/ledger sections leave the homepage. Runtime/document authority validators remain intact. Existing ledger endpoints are unchanged.
- Approved character raster bytes are copied unchanged; normal CSS sizing/cropping only. No regeneration, mirroring or new Rat.
- Self-hosted Geist Sans/Mono and OFL license accompany the frontend.
- Existing evidence, source, share-card, mascot-digest and launch-authority guards remain. Superseded UI wording/order assertions now enforce the frozen journey and absence of public token promotion.
- The existing pinned Playwright CI job includes this branch. No deployment job is added or enabled.

## VERIFY

Local checks:

- TypeScript build: PASS.
- `node --import tsx --test test/*.test.ts test/readPlane.test.mjs`: 461/461 PASS.
- `pnpm web:check` using pinned pnpm 10.15.0: PASS (syntax, web/evidence/source/asset invariants, share-card invariants, launch-presentation invariants).
- `pnpm --dir web-v2 check` using pinned pnpm 10.15.0: PASS (isolated V2 evidence gate and build).
- Playwright 1.56.1 frontdoor journey check: PASS at 320, 360, 390, 430, 768, 1024 and 1440 px.
- Read-plane fault injection: PASS for initial unavailability/retry, status failure, timeout, malformed refresh, recovery, unchanged-digest request bounds, filter retention, open-drawer retention and hidden-tab polling pause.
- `git diff --check`: PASS.

The local `pnpm check` wrapper encountered the execution environment's restricted tsx IPC socket. Its test suite was run directly via Node's tsx import hook instead; the repository command remains unchanged for CI. GitHub Actions runs the canonical `pnpm check` against the exact PR head.

Browser gates exercise fixture data and intercepted LIVE-shaped responses. They do not assert current production health or authorize release. Screenshots are labeled by viewport and stored as CI artifacts; data previews explicitly identify synthetic fixtures.

## ONE HOSTILE SELF-REVIEW

Scope: availability claims, first-click visibility, source/staleness binding, fragment navigation, write authority, approved identities and token-publication boundary. No independent reviewer or sub-agent was used.

Findings and repairs:

1. HIGH — desktop hero inherited the raster's HTML height, burying the first action. Fix: explicit automatic image height with the authored aspect ratio. First-action and availability visibility now gate every tested width, not only phone.
2. MEDIUM — repeating an already-current Crew link after manual roster selection could leave the wrong worker selected. Fix: same-fragment links explicitly reapply their destination. Browser regression covers it.
3. MEDIUM — a newer status response could lend its verification timestamp to an older retained feed after a failed refresh. Fix: display that time only when checkpoint and digest match the retained snapshot. Fault-injection regression checks the mismatch case.

ONE targeted rereview: these fixes satisfy their bounded checks. No unresolved Critical/High finding identified.

## VERDICT

ENGINEERING PASS for this presentation slice. Still draft and dependent on #121's stability composition. Not production or owner visual acceptance.

No Worker/backend, schema, provider, cron/queue, wallet, job runtime or economics changes are included in this delta. No merge, deployment, signing, broadcast, token launch or autonomous authority is performed.

Rollback: revert this presentation commit as a unit, including its updated presentation assertions. Its parent retains the stability composition. Do not cherry-pick the frontend onto a base missing that read-plane contract.

Next authorized scope requires a separate task: offline workforce schemas, competence packs and one Sniffer → Rat Zero → Case → alert proof. Den employment and final pricing remain future work.
