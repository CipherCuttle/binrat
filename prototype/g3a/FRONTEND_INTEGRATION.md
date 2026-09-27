# BINRAT — G6 pivot acceptance / source boundary

Owner superseded prior R5 aesthetic approval on 2026-09-27 with TWO new
pixel-art screenshots (homepage + Rat Radar). This PR now removes *all*
motion-effect integration and keeps the historical scanner and Android
accessibility work, pending the new layered art pack.

- Current hero scenery is a static sunset placeholder, not a claim that
  the screenshots have already been implemented pixel-for-pixel.
- Original `rat-original.jpg` remains byte-identical.
- No React, React Three Fiber, Three.js, paid React Bits source/key,
  canvas, WebGL, shader, lazy 3D chunk, or runtime moving hero effects.
- No changes to backend or custody; historical receipt and MOLD DEMO
  remain strictly separated.
- Old experimental PRs and their history remain unchanged.
- CI must regenerate `pnpm-lock.yaml`, build & replace `dist/`,
  run browser tests at 1440/390/320, verify no paid/3D chunks remain,
  and check the exact GitHack SHA after its bot bundle commit.

## Next separate art sprint
Read `ART_DIRECTION_G6_PIXEL_SUNSET.md` alongside both owner-provided
screenshots and the original rat artwork. The new asset-generation model
must create real exportable compositing layers and two screen mockups.
New art will be inserted in a separate draft after visual approval.
No merge, deploy, frontend styling lock, or fabricated live Radar stats.

## Verified G6 static pivot (2026-09-27)
- Source build and GitHub Actions at
  https://github.com/CipherCuttle/binrat/actions/runs/36318202800:
  **31/31** Playwright browser tests passed for the static sunset,
  original rat, 1440/390/320 layouts, reduced motion, navigation, the
  historical receipt and separate fictional MOLD demonstration.
- Locked dependencies regenerated and frozen into tested `dist/` at
  `170c1f3207a67f545bc89e646fbb12b64748ca37`.
  The compiled output contains only one Svelte application JS (~66 KB)
  and CSS (~38 KB). No React, Three.js, Grain Wave chunks, WebGL, paid
  source, sourcemaps or license key. Root CI on the initial pivot passed.
- Browser-captured static hero frames for 1440, 390 and 320 archived in
  artifact 10931059155. The desktop/mobile screenshots have a usable
  temporary static backdrop and the exact existing rat; they do **not**
  yet reproduce the newly attached high-fidelity pixel-city references.
- The next actual art deliverable is a composed layered asset pack,
  not another implementation of a motion shader. Human visual approval
  remains required before replacing the CSS placeholder.

This source branch and pull request are DRAFT. **NO MERGE**.
