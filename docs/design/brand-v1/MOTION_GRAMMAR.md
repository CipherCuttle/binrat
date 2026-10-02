# BINRAT Motion Grammar V1

**Status:** bounded motion-identity prototype  
**Branch:** `design/binrat-motion-identity-v1`  
**Visual authority:** `docs/design/brand-v1/`  
**Product language authority:** `docs/PRODUCT_LANGUAGE.md`  
**Roadmap raster authority:** `docs/design/roadmap-v1/README.md`

Motion may reveal, move, dim, mask, illuminate or settle approved raster artwork. It may not redraw the Rat or the physical BINRAT world.

## North star

**Evidence moves because something happened. The Rat moves because he noticed. Everything else stays quiet.**

BINRAT motion is physical, causal and sparse. It should feel like a grimy instrument waking up around evidence, not an arcade attract screen, casino UI or generic cyberpunk edit.

## Motion vocabulary

### 1. ENTRY — practical wake

Purpose: establish place and attention before personality.

Sequence:

1. darkness / near-darkness;
2. one practical light or authored raster layer wakes;
3. the evidence-bearing region resolves;
4. decorative/environmental motion, if any, comes last.

Timing:

- first readable state: <= 900 ms;
- entry transition: 320–700 ms;
- never hold an unreadable intro longer than 900 ms.

Allowed:

- opacity;
- bounded brightness/contrast on the raster scene;
- small camera drift (<= 1.5% scale or <= 12 px at 1200 px wide);
- mask reveal where the mask follows a physical light/occluder already present in authored art.

Reject:

- logo-first cinematic reveal that delays evidence;
- generic glitch;
- fake CRT boot text;
- full-screen bloom;
- strobe.

### 2. RAT MOTION — notice, do not perform

The Rat is an inhabitant of the scene, not a bouncing mascot.

Approved motion classes:

- **SNIFF:** 2–4 px snout/head micro-shift or approved raster-frame equivalent; 280–520 ms action, then stillness.
- **GLANCE:** eye/head orientation cue using approved authored frames/layers; 180–320 ms.
- **PAW:** one small purposeful reach/tap/pull; 260–520 ms.
- **IDLE:** tiny body/breath shift; 1.8–4.0 s cycle, amplitude <= 1.2% of body bounds.
- **REACT:** one short attention change after a find; 160–280 ms.
- **ENVIRONMENT:** already-approved insects, garbage or practical-light motion; low amplitude and never synchronized like a game loop.

Rules:

- maximum one Rat action at a time;
- no squash-and-stretch;
- no bounce easing on Rat anatomy;
- no blinking loop used as constant decoration;
- no mirrored Rat Zero;
- no generated intermediate mascot poses unless separately accepted by Rat Canon.

### 3. RECEIPT — a retained physical artifact

Purpose: make the evidence feel kept, not gamified.

Sequence:

1. finding exists;
2. receipt enters from a physically plausible edge;
3. one small settle;
4. evidence rows reveal in reading order;
5. source / coverage state is visible before CTA emphasis.

Timing:

- travel: 300–520 ms;
- settle: 120–220 ms;
- row stagger: 45–90 ms;
- max total row reveal: 650 ms.

Easing:

- travel: cubic-out / critically damped;
- settle: one low-amplitude overshoot only (<= 6 px at 1200×675);
- no elastic, springy or slot-machine motion.

### 4. CASE FILE — resolve causally

Purpose: reveal an investigation in the order a human can understand it.

Sequence:

1. case shell / approved raster paper state is already present or enters once;
2. literal summary appears;
3. chronology/facts appear in causal order;
4. evidence boundary / coverage follows;
5. optional action comes last.

Do not simulate analysis with fake typing. Text can fade/reveal by row; it must not pretend the system is computing when it is not.

### 5. ALERT / FIND — one spike, then proof

Purpose: earn attention without turning urgency into theater.

Sequence:

1. one light / contrast cue: 120–220 ms;
2. Rat reacts once: 160–280 ms;
3. **FOUND SOMETHING.** or equivalent feral headline;
4. literal explanation within <= 450 ms of the headline;
5. receipt/source immediately follows.

Constraints:

- one attention spike;
- no repeated red flashing;
- no pulsing CTA while evidence is still unresolved;
- color never upgrades a claim.

### 6. END CARD — calm finish

Required elements:

- Rat Zero or approved deterministic derivative;
- canonical single-color BINRAT lockup;
- one canonical line at most;
- optional single action.

Timing:

- arrive by the final 900–1400 ms;
- remain fully readable for >= 900 ms;
- no logo bounce, spin, glitch or zoom punch;
- finish still or with sub-perceptual environmental life only.

## Easing principles

Use easing to express physical cause, not mood.

Preferred families:

- opacity / light: linear or ease-out;
- evidence panel resolve: cubic-out;
- paper travel: cubic-out;
- paper settle: critically damped single overshoot;
- camera drift: linear or sine-in-out at very low amplitude.

Avoid:

- elastic;
- back/overshoot on Rat anatomy;
- repeating spring;
- random jitter;
- per-letter bouncing;
- “glitch” easing.

## Simultaneous-motion budget

At any moment:

- **1 primary motion** — the thing the viewer should notice;
- **1 supporting motion** — Rat reaction or physical settle;
- **1 ambient micro-motion** maximum — insect/light/garbage, only when already approved.

Hard cap: **3 simultaneous motion channels**.

If the viewer cannot identify the primary motion in one glance, simplify.

## Flicker / flashing constraints

- no full-frame flash;
- no strobe;
- no repeated luminance pulse above 3 Hz;
- avoid large-area high-contrast changes above 1 Hz;
- attention cues should be single-shot, not repeating;
- practical light variation should be slow and low amplitude.

## Text dwell

For social video:

- feral headline: >= 900 ms readable dwell;
- literal explanation: >= 1.5 s;
- evidence/source row: >= 1.8 s when it is the proof object;
- end-card line: >= 900 ms.

Do not “fit” copy by speeding it up. Shorten copy.

## Loop rules

Default social motion should **not** visibly loop.

When a platform requires looping:

- loop only ambient micro-life;
- do not repeatedly land the receipt;
- do not repeatedly trigger the find alert;
- do not repeatedly make the Rat react;
- loop seam must occur during a still/ambient state;
- loop period >= 4 s for visible ambient motion.

## Reduced motion

Reduced motion is a first-class composition, not the same animation slowed down.

When `prefers-reduced-motion: reduce` or an equivalent export mode is active:

- remove camera travel;
- remove Rat movement;
- remove paper travel/bounce;
- remove looping ambient movement;
- show the final truthful composition immediately;
- preserve reading order spatially;
- keep all literal explanation, evidence/source and CTA semantics available.

A reduced-motion version fails if any fact becomes understandable only because it moved.

## Web / Telegram transitions

### Web

Use existing `motion` dependency only for bounded UI choreography where CSS is insufficient.

Good uses:

- opacity/transform entrance of an evidence panel;
- layout presence for case/receipt transitions;
- one-time attention cue tied to an actual state change.

Prefer CSS for simple state transitions. Do not add GSAP for this grammar.

### Telegram

Telegram-delivered video/GIF exports should be pre-rendered and deterministic. Do not rely on client-side playback tricks for evidence ordering.

## Dependency recommendation

### Keep

- **FFmpeg** — canonical encoder/compositor for deterministic social/video exports.
- **Motion** (already in `web-v2`) — bounded interactive Web transitions.
- **existing Python/Playwright proof approach** — useful for static/browser proof capture where needed.

### Do not add now

- **GSAP / ScrollTrigger** — no missing capability in this bounded slice; risks encouraging scroll choreography where native scroll + Motion/CSS is sufficient.
- **Rive** — would require another representation/state-machine asset and creates pressure to redraw the Rat. Revisit only for reusable non-pictorial controls or after a canonical authored Rat rig exists.
- **Remotion** — strong candidate only when BINRAT needs many data-bound video variants, scheduled renders, reusable composition code or platform batch export. This single proof does not justify the dependency.

## Performance budget

Interactive surfaces:

- animate `transform` and `opacity` first;
- avoid layout-thrashing properties in continuous motion;
- pause offscreen ambient loops;
- no more than one large raster layer receiving continuous transform at a time;
- large raster video/scene layers should be pre-sized close to display size;
- prefer 30 fps for authored social motion; use 60 fps only when interaction quality proves a need.

Video proof target:

- authored source composition: 1200×675;
- H.264 compatibility encode: 1200×676 via one dark bottom-row pad (no crop/stretch);
- 30 fps;
- H.264 / yuv420p;
- no audio by default;
- 4–8 seconds;
- one causal attention event.

## Kill criteria

Kill a technique when any one is true:

- it makes BINRAT feel like an arcade game;
- it distracts from evidence;
- it makes Rat Zero cute;
- it requires a different mascot representation;
- it cannot be reproduced from committed inputs and an explicit render command;
- reduced motion leaves the content unclear;
- the movement has no physical/product cause;
- the same meaning works better with a still frame.

## Prototype proof

See `docs/design/brand-v1/motion-v1/README.md`.

The proof deliberately composes only already-approved raster outputs:

- `proofs/social-v1/rat-found-wide-1200x675.png`;
- `proofs/social-v1/receipt-wide-1200x675.png`.

It is a choreography test, not new canonical artwork.
