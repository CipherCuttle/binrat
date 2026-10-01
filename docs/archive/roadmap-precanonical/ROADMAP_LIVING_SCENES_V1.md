> **SUPERSEDED AS ACTIVE PLANNING AUTHORITY — HISTORICAL IMPLEMENTATION REFERENCE ONLY.**  
> Canonical roadmap intent is `docs/ROADMAP.md`. Current language is `docs/PRODUCT_LANGUAGE.md`. The current Motion implementation and tests are stronger implementation truth than this plan.  
> Frozen after the 2026-10-01 roadmap canonicalization.

# BINRAT — Living Roadmap Scene System V1

Status: planning baseline for isolated implementation work  
Branch: `feat/binrat-roadmap-living-scenes-v1`  
Base: `feat/binrat-telegram-messaging-v1`

## Product thesis

The roadmap is a dark, cinematic sequence of partially revealed BINRAT chambers, not a full-screen illustration and not a generic SaaS timeline.

The interaction model is:

> scroll chooses the chapter → the center spine carries the signal → one chamber wakes → the previous chamber falls back into darkness.

Roadmap stages:

1. SNIFF
2. REMEMBER
3. INVESTIGATE
4. WATCH
5. CONNECT
6. AUTONOMOUS RAT

Only one stage is strongly active at a time.

## Non-negotiables

- Keep the page predominantly dark.
- Use side-scene vignettes that dissolve into black instead of rectangular cards.
- Keep a living vertical spine near the center on desktop.
- Do not let the roadmap become a full-screen image takeover.
- No fake live stats, wallet claims, rankings, addresses or evidence baked into raster art.
- Do not change backend, Telegram, indexing, wallet, token, signing, custody or deployment authority.
- Do not merge or deploy without explicit owner authorization.
- Preserve existing WIP.
- Prefer the smallest safe diff.
- Follow: PLAN → CHANGESET → VERIFY → VERDICT.
- Completion policy: implement → test → one hostile review → fix Critical/High → one targeted re-review → stop.

## Architecture decision

Current public Cloudflare deployment serves `./web`. The newer route-based frontend exists as an isolated React/Vite demo under `web-v2/`.

Therefore V1 roadmap work starts in isolated `web-v2/`, not in production `web/`, and does not introduce Svelte.

Initial target:

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

The first implementation proves only SNIFF + REMEMBER.

## Four gates

### Gate 0 — recover before regenerating — PASS

Search local sources for the historical G6 pack:

`BINRAT_G6_pixel_sunset_art_pack.zip`

The committed G6 manifest expected:

- `homepage-panorama-1536x768.png`
- `radar-panorama-1536x480.png`
- `environment-layer-atlas.png`
- `rat-radar-384x256.png`
- `replay-lab-384x256.png`
- `ledger-384x256.png`
- `creator-files-384x256.png`
- `watch-384x256.png`

Those binaries were staged outside GitHub and explicitly not committed. They were recovered and hash-verified on 2026-10-01; see `docs/ROADMAP_G6_RECOVERY_RECEIPT_2026_10_01.md`.

### Gate 1 — visual proof

Build static SNIFF + REMEMBER scenes with approximately four raster planes each.

No GSAP yet.

Pass only if the two scenes look like rooms in the same physical BINRAT world.

### Gate 2 — living proof

Add controlled activation and micro-life.

Start with React + IntersectionObserver + CSS. Add GSAP/ScrollTrigger only if the static/activation proof passes and reversible choreography materially improves the result.

Native scrolling only.

### Gate 3 — hostile proof

Verify desktop/mobile/reduced-motion/fast-scroll/reverse-scroll/offscreen-pause behavior using repository-native checks.

### Gate 4 — expansion

Only after SNIFF + REMEMBER pass, add INVESTIGATE + WATCH.

CONNECT and AUTONOMOUS RAT come last.

## Truth contract

The roadmap is a capability narrative, not a fake delivery schedule.

Keep status metadata out of imagery and review it separately from scene art. Do not collapse “capability exists” and “full web experience exists” into one badge.

Public language should stay capability-oriented:

- SNIFF — Find the launch.
- REMEMBER — Keep the trail.
- INVESTIGATE — Turn the trail into a case.
- WATCH — Notice when the pattern moves again.
- CONNECT — See structure across cases.
- AUTONOMOUS RAT — Give the rat a bounded investigation.

For Autonomous Rat:

> Give the rat a bounded question. It investigates. Receipts still decide truth.

## Kill criteria

Stop or simplify if:

- SNIFF + REMEMBER look like unrelated AI-generated pictures.
- animation is required to hide weak static composition.
- mobile becomes a lesser decorative version instead of a coherent roadmap.
- scroll control feels hijacked.
- inactive scenes keep consuming meaningful CPU/GPU.
- reduced-motion mode breaks the narrative.
- the roadmap implies capabilities the product cannot substantiate.
