# BINRAT Roadmap V2 — Donor Extraction Receipt

**Status:** Brand V1-aligned product-integration candidate  
**Implementation commit:** `6ef5667e827e7d63bba62c05e299983d3968c153`  
**Brand authority:** `integration/binrat-brand-v1-composed` at `0343d3815e509c45ef6b4991a7f8d438e2f4deb1`

## Scope boundary

This is isolated roadmap presentation work. It does not read or modify funding, Case read models/endpoints, Telegram, Watch mutations, or production configuration. The roadmap is labelled as an experiential capability sequence, not a live-status source or promise calendar.

## Donor audit

The historical donor was `feat/binrat-roadmap-living-scenes-v1` at `ab844e4814d553b4485b7d3351e176c8376712a6`. Its mechanics existed in the base history, but no donor history was merged and no donor visual asset was retained.

Reused mechanics:

- six-stage linear progression and a single active chapter;
- `IntersectionObserver` plus request-animation-frame coalescing for scroll activation;
- one semantic section per chapter, responsive layout, and reduced-motion state transitions;
- deterministic browser proof structure and no-overflow checks.

Rejected and removed:

- `web-v2/src/roadmap/assets/sniff/sniff-base.webp`;
- SNIFF’s CRT/radar/lamp image replays and all old roadmap scene composition;
- old mascot/world identity and its dedicated scene component;
- continuous Motion Lab rail and all roadmap status projection derived from product capability data.

## Brand V1 composition

The experience now communicates exactly:

`SNIFF → REMEMBER → INVESTIGATE → WATCH → CONNECT → AUTONOMOUS RAT`

Each scene uses one direct, unmirrored raster source: `docs/design/brand-v1/canon/rat-zero.jpg` (`SHA-256 43541a9b469fbe46a9b54dccb227cfb21c7fcfade1d96656410b124ded2d3edc`). Controlled crops, scale, exposure, local light and foreground falloff vary framing without redrawing, regenerating, mirroring, or substituting the Rat.

Geist Sans serves human-facing copy; Geist Mono serves stage/evidence metadata. All colors resolve through the frozen Brand V1 token CSS. The practical light resolves only when its stage becomes active; the Rat’s small reframing follows that state change. There are no loops, glitches, CRT effects, particles, canvas, SVG pictorial art, or fake live alerts.

## Performance notes

- One shared Rat Zero URL is bundled once (`535,609` bytes); six stage instances share that browser cache entry.
- Each active scene has six bounded structural children: matte, raster, exposure, practical light, literal evidence tag and occlusion. There is no procedural pictorial layer.
- Scroll activation is passive and coalesced to one animation frame; no per-scroll layout animation or polling loop is introduced.
- The implementation has zero `@keyframes` and zero permanent running animations. State changes use short opacity/transform/filter transitions only.
- Browser proof confirmed no horizontal overflow at 1440×900, 1024×768, 390×844 and 390×568; reduced motion preserves the active scene and literal evidence tag while removing travel/focus movement.

## Visual proof

The proof images are committed under `docs/design/roadmap-v2/proofs/`.

| Proof | SHA-256 |
| --- | --- |
| Before: SNIFF desktop | `70ba9c359412ad96576c757d92dccba106fefab2272147814ea4c9bc51043df1` |
| After: AUTONOMOUS RAT desktop | `0e9792b3dc3a96e02acd4d7e3bfd8be93cc772e29952178af6a32a4c4a3859fe` |
| Laptop | `c558b151f52530cba51caca9750295205d82d616aace54638d0d1044bf1b16f8` |
| Narrow mobile | `614012d26c5432e6e300ed88234c4e6696995bba212b317d1664a4722e8e2825` |
| Short mobile | `4d61c2c945b46039f010ca4d81cbd8bb048db193f98e43ed4aec13e52b0ddc6e` |
| Reduced motion | `5e77fcf9b5a6c8834be588f54145aad147998ca4537d62fc9602ac8ad4d81411` |

## Verification receipt

- `pnpm --dir web-v2 check` — PASS (evidence semantics, Roadmap V2 scene purity, Roadmap V2 content authority, TypeScript and Vite build).
- Browser proof — PASS across all specified desktop/mobile/reduced-motion views: one active stage, no console errors, no horizontal overflow, no permanent animations, active scene ≤ 6 structural layers.
- Brand palette and Rat Zero byte provenance are verified by the Roadmap V2 purity check; Brand V1 itself remains unmodified.

## Verdict

**ROADMAP V2 BRAND-ALIGNED / READY FOR PRODUCT INTEGRATION**
