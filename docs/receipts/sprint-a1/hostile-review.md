# Sprint A1 — one hostile self-review

Scope: changed source, compiled Chromium result, real production GET result, four requested rendered sizes. This is a self-review, not an independent human review.

Pre-review evidence: 557/557 unit tests, frontend source/type/build checks, 14 adapter/proxy tests, 38 replay browser groups, four live-production GET browser viewports passed.

Critical: none found.

High H1 — mobile stage advancement can leave the new investigation content below the viewport. FOLLOW THE TRAIL changes a tab with preventScroll but provides insufficient visible confirmation at 320px. Fix: bring the journey tabs into view when an action advances the stage on narrow layouts; honor reduced motion.

High H2 — retry toggles `loading` and reruns selection focus/scroll, interrupting a person who has scrolled into receipts. Fix: react to selected identity and initial view readiness, not every loading transition. Add a targeted retained-read scroll/focus control.

High H3 — unavailable selected Cases have no `vl-case` ID while the skip link targets it. Fix: make the failure surface an accessible, labelled Case destination.

High H4 — future-Rat status requires opening Crew, so the literal ten-second explanation misses the fourth product goal. Fix: say that more Rats are in the works in the visible supporting explanation.

Medium — an exact Case outside the verified latest-20 feed cannot be rendered by this adapter. The public historical Case contract has UNVERIFIED history and a different projection count (sample: 19 versus 38 in the signed latest feed). Do not silently mix the projections or upgrade verification. Provide an explicit exact source link and preserve requested identity; disclose the UI rehydration gap.

Medium — Safari, Firefox, real devices and owner visual acceptance remain unverified. Local Chromium/CLS cannot establish those.

No backend, contract, asset, UI-library, Saved Cases, persistent Watch or production mutation found.
