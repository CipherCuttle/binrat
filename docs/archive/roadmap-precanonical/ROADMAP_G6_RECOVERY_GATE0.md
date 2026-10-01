# BINRAT — Roadmap Gate 0 G6 Recovery Receipt

Date: 2026-10-01  
Branch: `feat/binrat-roadmap-living-scenes-v1`  
Status: GATE 0 COMPLETE / recovered sources located; no production asset install performed.

## GitHub evidence

PR #53 (`integration/binrat-r5-approved-20260927`) explicitly recorded that the eight reviewed G6 PNGs were not committed to GitHub and that the safe art ZIP lived in the owner ChatGPT sprint.

The still-live GitHub Actions artifacts were inspected:

- run `36353726972`
  - `binrat-g6a-tested-static-bundle` — source-only bundle, no G6 PNGs
  - `binrat-g6-static-frontend-evidence` — screenshot evidence, no source G6 PNGs
- run `36318202800`
  - older screenshot evidence, no source G6 PNGs

The artifacts expire 2026-10-04 and are not substitutes for the missing reviewed art pack.

## Recovered Library source set

The Sept 27 ChatGPT Library still contains the generated G6 source images from the same sprint.

Safe-manifest mapping is recoverable as:

| Safe manifest target | Recovered Library image |
| --- | --- |
| `homepage-panorama-1536x768.png` | `Pixelstad i violett solnedgång.png` |
| `radar-panorama-1536x480.png` | `Indigolila takåsar vid solnedgång.png` |
| `environment-layer-atlas.png` | `Transparent pixelatlas med taksilhuetter, kråkor och neonramar.png` |
| `rat-radar-384x256.png` | `Abstrakt kvitto-radar i pixelstil.png` |
| `replay-lab-384x256.png` | `Pixelartad arkivstation med kontaktbilder.png` |
| `ledger-384x256.png` | `Pixelgrafiskt bokföringsnätverk med kvitton.png` |
| `creator-files-384x256.png` | `Anonym profil i pixelarkiv.png` |
| `watch-384x256.png` | `Pixelklocka med ögonsymbol.png` |

Recovered related/quarantine candidates also include:

- `Transparent pixelatlas med soptunna och neonrekvisita.png`
- `Genomskinligt pergamentatlas med UI-element.png`
- `Transparent pergamentatlas för bevisgränssnitt.png`
- `Pixelobjekt med ren transparens.png`
- `Abstrakt nätverk i kopparterminal.png`
- `Pixlad integritetspanel med mappar och sköld.png`

Do not promote the parchment/foreground candidates into the application without the historical alpha-cleanup review gate.

## Gate 1 first composition finding

A first non-production SNIFF + REMEMBER composition was made from the recovered Radar and archive assets with black edge falloff and a center roadmap spine.

Useful evidence:

- the two sources clearly share one palette/world;
- dark edge masking works;
- the recovered art can be re-used as donor/reference material.

Failure against the new roadmap bar:

- the original sunset is still too visually dominant;
- each source reads as a large monitor illustration rather than a partially discovered underground chamber;
- the center spine competes with the art when the scenes reach too far inward;
- these should not simply be dropped into the roadmap unchanged.

Therefore Gate 1 should create dedicated dark chamber crops/layers using this recovered source set as the style donor, while keeping the page predominantly black.

## Decision

Gate 0 is closed.

Next bounded work:

1. create dedicated SNIFF and REMEMBER chamber assets only;
2. keep each vignette constrained to the side of the viewport;
3. preserve large areas of black negative space;
4. separate practical-light regions from structural scene art;
5. static visual review before any GSAP/ScrollTrigger dependency;
6. do not modify production `web/`, merge or deploy.
