# BINRAT — Roadmap Gate 1 Verification Receipt

Date: 2026-10-01  
Branch: `feat/binrat-roadmap-living-scenes-v1`  
PR: #70  
Scope: isolated `web-v2/` SNIFF → REMEMBER living-scene proof only.

## Implemented

- isolated `/roadmap` route;
- SNIFF + REMEMBER only;
- one authoritative active stage;
- center signal spine and active node;
- native scroll;
- IntersectionObserver / requestAnimationFrame stage selection;
- CSS-only radar sweep, terminal activity, LEDs and practical-light variation;
- inactive scene dimming;
- desktop alternating scene/copy composition;
- mobile left-spine stacked composition;
- reduced-motion fallback;
- no GSAP, Lenis, Three.js, WebGL or Rive;
- no production `web/` change;
- no backend, Telegram, token, wallet, signing or deployment change.

## First verification

PR CI initially exposed one TypeScript blocker in `RoadmapPage.tsx`:

`TS2339: Property 'id' does not exist on type 'never'`

Cause: control-flow narrowing around a value mutated inside `Map.forEach`.

Fixed at:

`7df016c31078dd72f60f6234c6622faf23a5811f`

by replacing callback mutation with an explicit `for...of` closest-stage scan.

CI run `36876070366`: PASS.

Roadmap-specific Playwright acceptance passed at:

- 320×720
- 390×844
- 430×932
- 1024×768
- 1440×900
- reduced motion at 390×844
- reduced motion at 1440×900

## Hostile visual review

First screenshot pass found one High visual issue:

> active chambers were too ghosted to test the intended “room receiving power” effect.

No Critical code, accessibility or overflow blocker was found.

Smallest correction:

- slightly widen desktop scene territory;
- reveal more of the internal room;
- raise active-room brightness/saturation;
- increase active radar / mascot visibility;
- reduce active darkness mask opacity;
- keep inactive rooms and exposed edges near-black.

Targeted fix:

`3a6e71ea3c32a1fdcb757c967c73d7fb6b590e00`

## Targeted re-review

CI run `36877201820`: PASS.

Artifact:

`binrat-v2-viewport-acceptance`

Artifact digest:

`sha256:fabe81d50cdd7032b6bd1693e754a8178b1ae475bc50a0a6e3eb4c6de0551f96`

Re-reviewed desktop 1440 and phone 390/320 captures.

Result:

- one active stage remains unambiguous;
- room edges dissolve naturally into black;
- scene does not become a full-screen takeover;
- center spine remains visually dominant enough to communicate progression;
- active room now reads materially stronger than inactive state;
- mobile remains coherent without preserving desktop left/right alternation;
- no horizontal overflow;
- reduced-motion gate remains valid.

## Remaining visual boundary

This proof currently uses the approved in-repo mascot plus CSS-built room hardware.

The recovered G6 donor images and the newly approved darker SNIFF / REMEMBER scene images are not committed as web binaries on this branch. Therefore this gate validates composition, activation, darkness, motion grammar and responsive behavior — not final production illustration fidelity.

Do not add the remaining four rooms yet.

## Verdict

**GATE 1: PASS FOR INTERACTION / COMPOSITION.**

Next gate:

1. wire final/dedicated SNIFF + REMEMBER scene plates or layered derivatives;
2. verify they remain one coherent world at 1440 / 390 / 320;
3. only then decide whether GSAP materially improves signal travel / handoff;
4. INVESTIGATE + WATCH remain blocked until that visual gate passes.

No merge or deploy authorized.
