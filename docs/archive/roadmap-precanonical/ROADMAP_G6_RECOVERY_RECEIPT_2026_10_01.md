# BINRAT — G6 Roadmap Asset Recovery Receipt

Date: 2026-10-01  
Branch: `feat/binrat-roadmap-living-scenes-v1`  
Scope: Gate 0 only — recover and verify prior G6 art before generating new roadmap assets.

## Recovery result

Gate 0 is **PASS**.

The prior G6 art pack and the later safe-transfer pack were recovered from the user's persistent ChatGPT file library. They are not yet committed to this Git branch.

Recovered archives:

- `BINRAT_G6_pixel_sunset_art_pack.zip`
- `BINRAT_G6a_safe_assets_for_PR53.zip`

Archive SHA-256:

- full G6 pack: `3383e020b4f24eb6bb4cea07b3e28ba9681054c16d2e748b8678461f64943efa`
- safe-transfer pack: `b8fba3bdfb4ec76406f41b5d9d3a692a47434196754f3c94d3c17df364d5b9a7`

## Verified safe assets

The safe-transfer pack contains the eight files named by the historical G6 manifest:

| Asset | SHA-256 |
| --- | --- |
| `creator-files-384x256.png` | `de066a870912850a383193c645d2dcb61c7e613bb92f60154ffcd0937bb4a7ce` |
| `environment-layer-atlas.png` | `b272ff7616883379c65f38a394dcdf00af8b854f6e89bcfe19d87ad3676b4eb1` |
| `homepage-panorama-1536x768.png` | `e61849eaeef9b31f33539a33e7f58f2ea9fa149abf40fa0859bdc7f3a523919f` |
| `ledger-384x256.png` | `37114ca91abb72e1babf1dcfd24618bd16b7f890df988ef61ccff9dc9a1253bd` |
| `radar-panorama-1536x480.png` | `42613e355a16b2dc670cfcd09514e64e57735dd97085a2e6d58ebbfe65679386` |
| `rat-radar-384x256.png` | `d6a964babf9340a682def0d85f8212cb5e0467d30c4c9e10e4505ad299eb90b3` |
| `replay-lab-384x256.png` | `ed94a4f8d001dd5f56a5a2a25f0cc13546f52f0815c1994b27d3146aff0403f1` |
| `watch-384x256.png` | `0738877a2fd19345d987538ccbcf65720d50744cd14c23d85dea7d8078c23ac3` |

These hashes match the historical `G6A_ASSET_SHA256.txt` safe-transfer receipt.

## Canonical rat verification

Recovered canonical rat SHA-256:

`43541a9b469fbe46a9b54dccb227cfb21c7fcfade1d96656410b124ded2d3edc`

This matches the canonical hash recorded by the G6 integration contract.

## Full pack contents relevant to roadmap work

Recovered and inspected:

- clean homepage panorama;
- clean Radar panorama;
- transparent environment-layer atlas;
- five corrected product mini-scenes;
- canonical rat master;
- review-only desktop/mobile composition proofs;
- quarantined foreground/parchment alpha candidates.

The historical quarantine remains in force. Do not integrate the dirty-alpha foreground or parchment atlases without explicit cleanup/review.

## Roadmap donor mapping

For the first static visual proof:

- SNIFF donor: `rat-radar-384x256.png`
- REMEMBER donor: `replay-lab-384x256.png`
- shared world donor: `environment-layer-atlas.png`
- optional environmental reference: `radar-panorama-1536x480.png`

These are donors, not automatically final roadmap plates. The roadmap direction remains darker and more vignette-based than the original G6 presentation.

## Next gate

Gate 1 remains:

> Build an isolated SNIFF + REMEMBER static visual proof in `web-v2/`.

Before animation, the two scenes must look like adjacent rooms in one coherent BINRAT world and dissolve naturally into the dark roadmap background.

No merge, deployment, production `web/` mutation, backend action or capability change occurred during recovery.
