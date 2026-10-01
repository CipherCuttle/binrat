> **SUPERSEDED AS ACTIVE PLANNING AUTHORITY — HISTORICAL IMPLEMENTATION REFERENCE ONLY.**  
> Canonical roadmap intent is `docs/ROADMAP.md`. Current language is `docs/PRODUCT_LANGUAGE.md`. The current Motion implementation and tests are stronger implementation truth than this plan.  
> Frozen after the 2026-10-01 roadmap canonicalization.

# BINRAT — Living Roadmap Frontend Implementation Plan V1

Status: isolated React/Vite implementation contract

## Baseline

Do not modify deployed `web/` during the experiment.

Work in isolated `web-v2/`.

Current V2 is React/Vite and uses a small custom route model in `web-v2/src/App.tsx`; do not introduce a router migration.

## Initial route

Add a first-class `/roadmap` route using the existing navigation pattern.

The roadmap page should contain semantic ordered content even with JS/CSS disabled.

Suggested structure:

```text
web-v2/src/roadmap/
├── RoadmapPage.tsx
├── RoadmapStage.tsx
├── RoadmapSpine.tsx
├── roadmap.css
├── roadmapData.ts
└── scenes/
    ├── SniffScene.tsx
    └── RememberScene.tsx
```

Do not build a general-purpose animation framework.

## Active-state architecture

Maintain one authoritative active stage.

```ts
type RoadmapStageId =
  | "sniff"
  | "remember"
  | "investigate"
  | "watch"
  | "connect"
  | "autonomous";
```

All of the following derive from that state:

- active node
- active copy
- scene illumination
- local ambient activity
- aria-current

Individual scenes must not independently decide whether they are active.

## Stage data

Keep copy/status in typed application data, not art.

Suggested fields:

```ts
type RoadmapStage = {
  id: RoadmapStageId;
  index: number;
  title: string;
  body: string;
  side: "left" | "right";
  accent: string;
  productCapability?: "live" | "private" | "building" | "research";
  surfaceMaturity?: "telegram" | "web" | "cross-surface" | "concept";
};
```

Exact public status labels require separate truth review.

## Layout

Desktop:

- scene vignette left/right
- living spine near center
- copy opposite or adjacent
- no visible card frame around imagery
- scene width roughly 35–46% of viewport
- darkness consumes exposed edges

Mobile:

- move spine toward left edge
- scene occupies remaining width
- reduce parallax and spatial motion
- preserve same narrative order
- do not simply shrink desktop composition

## Animation gates

### Phase A — no GSAP

Use:

- IntersectionObserver
- CSS transitions
- CSS ambient loops
- SVG/DOM terminal overlays

Prove stage activation first.

### Phase B — GSAP only if warranted

If the visual proof passes and reversible choreography clearly benefits from GSAP, add:

- `gsap`
- `@gsap/react`

Use ScrollTrigger for:

- signal travel
- node ignition
- scene power-on/off
- tiny reversible parallax
- stage handoff

Use proper React lifecycle cleanup through `useGSAP()` or GSAP context cleanup.

Do not add:

- Lenis
- ScrollSmoother
- Three.js
- WebGL
- Rive
- particle engine
- another router
- another motion runtime

Native scrolling only.

## Scene life policy

Every scene gets:

- one primary motion;
- two secondary motions;
- a few near-subconscious state changes.

Do not animate everything.

### SNIFF

Primary:
- radar sweep

Secondary:
- terminal activity
- spine/node life

Subconscious:
- slow lamp voltage drift
- sparse LEDs
- optional rare rat micro-movement

### REMEMBER

Primary:
- local power/light wake across archive/workbench

Secondary:
- terminal cursor
- slight paper-shadow movement

Subconscious:
- lamp voltage drift
- sparse dust

Avoid rapid random flicker.

## Activation choreography

When a stage becomes active:

1. faint signal approaches node;
2. node catches;
3. practical lights wake;
4. scene resolves from darkness;
5. local ambient motion starts;
6. scene holds mostly still.

When leaving:

1. local activity stops;
2. practical lights dim;
3. scene contrast falls;
4. room recedes into darkness;
5. node halo drops.

Avoid giant fly-ins.

## Performance policy

Animate primarily:

- `transform`
- `opacity`
- SVG stroke/alpha where appropriate

Avoid scroll-time animation of:

- width
- height
- top
- left
- margin
- padding
- heavy blur

Do not permanently assign `will-change` to many elements.

Inactive scenes must pause animation.

Pause or suppress nonessential ambient activity when:

- scene is inactive;
- roadmap is substantially offscreen;
- document is hidden.

Do not eagerly load all future scenes.

Keep stage wrappers measurable. If GSAP is added, refresh measurements after layout-affecting asset decode or responsive changes.

## Reduced motion

Reduced-motion mode keeps:

- active stage
- static practical lighting
- copy hierarchy
- spine progression

It removes:

- parallax
- travelling charge
- radar rotation
- moving dust
- flicker
- spatial slides
- breathing scale

Reduced motion must be a coherent illustrated roadmap, not a broken animation.

## Testing / verification

Use repository-native checks and browser scripts.

Required viewport evidence should include repository screenshot gates:

- 390px phone
- 430px phone
- 1024px tablet
- 1440px desktop

Also preserve existing DEMO responsive coverage where relevant:

- 320px
- 360px
- 768px

Hostile interaction cases:

- reverse scroll
- very fast scroll
- direct route entry
- resize mid-page
- mobile orientation change where practical
- reduced motion
- missing scene image
- JS error/fallback
- inactive-scene CPU use
- offscreen pause

## First implementation slice

Only:

- `/roadmap` route
- Roadmap page shell
- living spine
- SNIFF
- REMEMBER
- mobile layout
- reduced-motion behavior
- deterministic fixture/debug activation if needed

No CONNECT or AUTONOMOUS work in the first slice.

## Acceptance

The first slice passes only if the user perceives:

> I am scrolling past rooms inside one functioning place.

It fails if the result reads as:

> nice images that fade in.
