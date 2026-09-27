# BINRAT — G6 static pixel-art direction, isolated frontend prototype

The moving Grain Wave experiment was rejected by the owner and is removed
from this draft integration branch. This Svelte 5 + Vite prototype currently
uses a **temporary static sunset CSS backdrop** and the untouched original
rat image while a new asset-generation lane delivers layered pixel art
matching the owner's two supplied screenshots.

It retains the tested historical Pons V2 receipt scanner, Rat Radar case
file and explicitly fictional separate MOLD Rat Trap. There is **no live
launch feed, copy trading, wallet connection, buy/sell, active watch, or
verified pricing/funding history** in this prototype.

The approved original rat JPEG is unchanged at
`public/rat-original.jpg` (SHA-256
`43541a9b469fbe46a9b54dccb227cfb21c7fcfade1d96656410b124ded2d3edc`).

## Development
With Node 22 and pnpm 10 from `prototype/g3a`:

```sh
pnpm install
pnpm build
pnpm test
pnpm dev
```

No React, Three.js, licensed effect source, license key, WebGL, canvas
or Grain Wave is required. `dist/` contains a public static GitHack
preview frozen by CI after tests. Read `ART_DIRECTION_G6_PIXEL_SUNSET.md`
for the next proposed layered asset pack.

The historical receipt fixture is NOT LIVE; funding/pricing/graduation
unknown. MOLD is strictly a fictional educational DEMO.
**PR remains draft. No merge or deployment authorization.**
