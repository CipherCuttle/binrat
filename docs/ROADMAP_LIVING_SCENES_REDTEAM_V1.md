> **SUPERSEDED AS ACTIVE PLANNING AUTHORITY — HISTORICAL IMPLEMENTATION REFERENCE ONLY.**  
> Canonical roadmap intent is `docs/ROADMAP.md`. Current language is `docs/PRODUCT_LANGUAGE.md`. The current Motion implementation and tests are stronger implementation truth than this plan.  
> Frozen after the 2026-10-01 roadmap canonicalization.

# BINRAT — Living Roadmap Five-Pass Red Team V1

Status: hardened planning record

## Pass 1 — architecture

### Finding

The original implementation plan incorrectly assumed Svelte.

Actual repository state:

- public Cloudflare asset deployment serves `./web`;
- `web-v2/` is isolated React/Vite;
- V2 remains isolated pending route-by-route acceptance.

### Decision

- Do not migrate framework.
- Do not touch production `web/` during the experiment.
- Add isolated roadmap work under `web-v2/`.
- Follow the existing custom route model instead of introducing React Router.

### Kill criterion

If the roadmap requires frontend migration before it can be judged visually, scope is wrong.

---

## Pass 2 — animation runtime

### Finding

The concept does not need GSAP to prove its first hypothesis.

### Decision

Gate the runtime:

1. React + IntersectionObserver + CSS first.
2. Add GSAP/ScrollTrigger only after static + activation proof passes.

If GSAP is added:

- native scroll only;
- proper React lifecycle cleanup;
- no Lenis;
- no ScrollSmoother;
- no scroll-jacking.

### Kill criterion

If CSS activation already feels excellent, do not add animation complexity just because it exists.

---

## Pass 3 — asset/performance scope

### Finding

A final 30+ file asset family is premature for the prototype.

### Decision

SNIFF + REMEMBER should start with roughly eight scene rasters:

- base
- subject
- foreground
- light

per scene.

Radar beams, cursors, LEDs and state overlays should be live DOM/CSS/SVG.

Animate mainly transforms/opacity.

Pause inactive scenes.

Lazy/preload progressively rather than eager-loading all future scenes.

### Kill criterion

If four layers do not create convincing depth, test one additional plane before multiplying asset count.

---

## Pass 4 — motion taste and accessibility

### Finding

“Make everything alive” can easily regress into visual exhaustion.

### Decision

Per scene:

- 1 primary motion
- 2 secondary motions
- a few subconscious changes

Avoid fast random flicker and strobing.

Reduced motion preserves state and illumination but removes spatial/parallax/looping movement.

### Kill criterion

If the scene looks busier when it wakes rather than more legible, reduce motion.

---

## Pass 5 — roadmap truth

### Finding

Simple labels like SHIPPED / NOW / NEXT can misrepresent actual capability maturity across Telegram, web and experimental surfaces.

### Decision

Separate capability state from surface maturity internally.

Do not bake statuses into art.

Review public status labels independently.

Use narrative copy that remains true across surfaces:

- SNIFF — Find the launch.
- REMEMBER — Keep the trail.
- INVESTIGATE — Turn the trail into a case.
- WATCH — Notice when the pattern moves again.
- CONNECT — See structure across cases.
- AUTONOMOUS RAT — Give the rat a bounded investigation.

For autonomous work:

> Receipts still decide truth.

### Kill criterion

If the roadmap implies shipping maturity that the repository/evidence cannot substantiate, the wording fails.

---

## Ten-stack summary

1. Socratic — prove narrative comprehension and world quality, not animation cleverness.
2. Hegelian — synthesize static art and cinematic takeover into partial dark vignettes.
3. Popperian — kill the direction if two static rooms do not look like the same world.
4. Causal inference — test art, activation, parallax and ambient life separately.
5. Systems architecture — isolated React route, one stage controller, small motion surface.
6. Cybernetics — fixed screenshot checkpoints + actual-device feedback loop.
7. Bayesian — highest uncertainty is visual consistency, not scroll mechanics.
8. MDL — four layers beat eight until evidence says otherwise.
9. DOE — SNIFF + REMEMBER first; one variable class at a time.
10. Adversarial — reverse-scroll, fast-scroll, mobile, reduced-motion, asset failure, offscreen CPU.

## Do

- use darkness as layout;
- reveal rooms with practical light;
- keep one chamber meaningfully active;
- use live DOM/SVG for terminal activity;
- give motion a physical cause;
- preserve native scroll;
- pause inactive work;
- keep truth/status outside raster art;
- recover historical G6 assets before regenerating.

## Do not

- modify production `web/` in the experiment;
- introduce Svelte;
- generate all six scenes up front;
- build one giant illustration;
- add Lenis/Three.js/WebGL/Rive in V1;
- pin users into long full-screen sequences;
- rapidly flicker lights;
- run invisible animation continuously;
- invent capability maturity;
- use animation to hide weak art.
