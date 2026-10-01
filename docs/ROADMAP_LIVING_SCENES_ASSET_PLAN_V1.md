# BINRAT — Living Roadmap Asset Plan V1

Status: asset-production contract for `feat/binrat-roadmap-living-scenes-v1`

## Existing repo material

### Canonical rat

Historical G6 branch preserves:

`prototype/g3a/public/rat-original.jpg`

Recorded canonical SHA-256:

`43541a9b469fbe46a9b54dccb227cfb21c7fcfade1d96656410b124ded2d3edc`

Preserve identity, silhouette, cyber-eye side and expression.

Do not generate six unrelated rats.

### G6 planned pack

The G6 safe manifest named:

- `homepage-panorama-1536x768.png`
- `radar-panorama-1536x480.png`
- `environment-layer-atlas.png`
- `rat-radar-384x256.png`
- `replay-lab-384x256.png`
- `ledger-384x256.png`
- `creator-files-384x256.png`
- `watch-384x256.png`

Source pack: `BINRAT_G6_pixel_sunset_art_pack.zip`

Do not reuse quarantined alpha-dirty files unless explicitly cleaned and reviewed.

### North Star references

Useful historical art references include:

- `docs/design/north-star/binrat-character-master.png`
- `docs/design/north-star/binrat-home-north-star.png`
- `docs/design/north-star/binrat-radar-north-star.png`
- `docs/design/north-star/binrat-world-background.png`
- `web/assets/binrat-hero.webp`

Useful shared product-object vocabulary:

- evidence receipt
- dumpster / trash bag
- radar marker
- watch / tripwire
- ledger stamp
- case folder

## Prototype asset budget

Do not generate the final 30+ file family up front.

For the SNIFF + REMEMBER proof, target approximately eight scene rasters total.

### SNIFF

- `sniff-base.webp`
- `sniff-subject.webp`
- `sniff-foreground.webp`
- `sniff-light.webp`

Scene: radar/observation room, left-weighted.

Primary motion later: radar sweep.

Secondary life later: terminal activity + spine/node state.

### REMEMBER

- `remember-base.webp`
- `remember-subject.webp`
- `remember-foreground.webp`
- `remember-light.webp`

Scene: archive/evidence basement, right-weighted.

Primary motion later: local power/light wake across desk/archive.

Secondary life later: terminal cursor + subtle paper-shadow movement.

### Optional shared

- `dust.webp` only if it materially improves depth.

## Layer contract

Every scene should be composable as:

```text
dark page
↓
base environment
↓
subject / desk / rat
↓
practical light mask
↓
DOM/SVG terminal or radar activity
↓
ambient
↓
foreground occluder
↓
edge darkness
```

The scene should never read as a rectangular JPEG pasted onto a page.

## Common-world grammar

Use one shared industrial language across all scenes:

- rusted pipework
- cable trays
- masonry / steel
- CRT/terminal hardware
- evidence-paper objects
- dumpster/rat references
- practical amber / green / blue light
- deep charcoal negative space

The target is not generic neon cyberpunk.

## Future stage scene intent

### INVESTIGATE

Forensic workbench. Case is the hero, rat is secondary.

Potential layers:

- base
- subject
- foreground
- practical light
- case folder
- receipt

### WATCH

Overnight observation room. Most screens dark; one signal wakes.

Potential layers:

- base
- subject
- foreground
- light
- monitor bank
- tripwire

### CONNECT

Physical mapping/projection chamber. Network lines should be live SVG/DOM, not baked into art.

Potential layers:

- base
- foreground
- silhouettes
- light
- projector hardware

### AUTONOMOUS RAT

Deepest and sparsest chamber. Cold doorway, machinery, negative space, unknown territory.

Potential layers:

- base
- foreground
- rat/silhouette
- light
- machinery

## Rat policy

Preferred hierarchy:

1. reuse/crop canonical rat;
2. derive simple silhouette;
3. use small canonical-reference-derived state only when necessary.

Avoid generating bespoke detailed mascot variants for every scene.

## Never bake into raster art

- wallet addresses
- hashes
- metrics
- rankings
- roadmap status
- exact dates
- network lines
- terminal copy
- notification text
- fake charts
- Telegram messages

Those belong to live frontend layers.

## Asset acceptance gates

- SNIFF and REMEMBER must look like adjacent rooms in one world.
- Scene edges disappear naturally into darkness.
- Practical lights can be animated independently from the base image.
- Assets remain crisp at desktop and mobile sizes.
- No obvious AI artifacting, pseudo-text or inconsistent perspective.
- No mascot drift.
