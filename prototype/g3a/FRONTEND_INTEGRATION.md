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
