# BINRAT Rat Canon V1

**Status:** frozen identity authority for Brand V1  
**Decision date:** 2026-10-02

## Rat Zero

The canonical BINRAT identity anchor is:

- path: `docs/design/brand-v1/canon/rat-zero.jpg`
- Git blob SHA-1: `f4c263e20144ccf47ab06a90ff34c1d4865d5c27`
- byte size: `535609`
- provenance: exact byte-for-byte copy of `prototype/g3a/public/rat-original.jpg` from `integration/binrat-r5-approved-20260927`

The blob SHA is identical at both locations. Rat Zero is therefore promoted into the active Brand V1 workstream without regeneration, redrawing or re-encoding.

Rat Zero owns **character identity**.

It does not, by itself, own the entire environment, palette, scene lighting or product UI.

## Current world/style donor

The current approved visual-world donor remains the roadmap raster source recorded at:

- `docs/design/roadmap-v1/README.md`
- source name: `gritty_binrat_roadmap_neon_sewer_network.png`
- source dimensions: `1448×1086`
- SHA-256: `95becddb235c825b591b8b454fbd0726d8adcfd2ddb13066446113a3ad613849`

That source owns the current **world / lighting / pixel-language direction** for the roadmap.

Brand V1 generation must combine these authorities correctly:

> **Rat Zero decides who the Rat is. The approved raster donor decides what world he lives in.**

A world/style donor may never be used as permission to invent a different mascot.

## Identity invariants

Any BINRAT depiction intended to represent the canonical Rat must preserve:

1. **the same individual character**, not merely “a rat in a dumpster”;
2. **face and snout geometry** closely enough to read as the same Rat;
3. **ear shape / notch identity**;
4. **the asymmetrical red cyber-eye identity and side**;
5. **core fur / face palette and contrast relationships**;
6. **body / paw proportions when visible**;
7. **the slightly feral, competent expression family**;
8. **raster/pixel-native character**, never a generic smooth-vector mascot.

### Mirroring rule

Do not horizontally mirror Rat Zero when that would move the cyber-eye or other asymmetric identity marks to the opposite side.

If a composition needs the Rat facing the other direction, create a new pose candidate that preserves anatomical identity rather than flipping the canonical image.

## Props are not identity

The following may appear frequently but are not mandatory identity features:

- dumpster;
- pizza;
- garbage;
- receipts/paper;
- pipes;
- terminal hardware;
- city/sewer scenery.

Do not accidentally turn a scene prop into a permanent mascot requirement.

## Allowed deterministic derivatives

The following are allowed without creating a new Rat identity:

- crop;
- resize;
- responsive crop;
- non-destructive background masking/removal;
- bounded scene-level brightness/contrast treatment;
- deterministic format conversion;
- avatar/head crop derived directly from Rat Zero.

These operations must not redraw the face, ears, cyber-eye, paws or silhouette.

A derivative should record its source and transformation when promoted into the canonical asset pack.

## New poses

New poses are allowed as **candidates**, not automatically as canon.

A new pose must be reviewed against Rat Zero in a side-by-side contact sheet.

Candidate pose acceptance requires:

- same face/snout identity;
- same asymmetric cyber-eye side;
- same ear/notch identity;
- same body proportions;
- no cute/chibi drift;
- no photorealistic-species drift;
- no new permanent costume/prop becoming accidental identity;
- scene style consistent with the approved raster world when used in a world scene.

Until accepted, a generated pose may be used only in exploration, never as the source for another derivative.

## Avatar / logo rule

Brand V1 should first attempt the avatar/rat mark as a deterministic crop or silhouette-preserving extraction from Rat Zero.

Do **not** ask a generator to “make a cleaner BINRAT logo rat” before testing the canonical image at small sizes.

If Rat Zero fails the 32px/48px mark test, the smallest safe next step is a manually authored simplification study derived from the same identity, with side-by-side owner approval. It is not permission for a new mascot.

## Hard rejects

Reject an asset if any of the following occur:

- cyber-eye changes sides;
- face becomes rounder/cuter/chibi;
- snout/ear geometry materially changes;
- Rat becomes photorealistic;
- Rat becomes a generic vector/SVG mascot;
- fur/palette shifts enough to read as another character;
- the character acquires a new costume/species/personality as default identity;
- automatic pixelation is used to disguise a non-matching illustration;
- a derivative is generated from another derivative after identity drift;
- a scene donor overrides Rat Zero identity.

## Production rule

Use the highest-authority source available:

1. Rat identity → `rat-zero.jpg`;
2. current raster-world treatment → current approved scoped raster donor;
3. typography → Brand V1 typography contract;
4. language/voice → `docs/PRODUCT_LANGUAGE.md`;
5. factual claims/status → canonical product/evidence authorities.

No visual asset may silently override a higher-level evidence or language contract.

## Acceptance proofs to build next

Before declaring the mascot asset pack complete, produce:

1. Rat Zero full-size reference;
2. 512px profile crop;
3. 128px avatar;
4. 48px avatar;
5. 32px favicon-style crop;
6. monochrome/silhouette study;
7. one new-pose candidate;
8. side-by-side identity contact sheet.

If the small-size derivatives stop reading as the same individual, do not “fix” them by inventing a new rat. Escalate to a bounded simplification study.
