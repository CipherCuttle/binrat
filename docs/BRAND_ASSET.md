# BINRAT MASCOT ASSETS

## Astra frontend sprint — current presentation

The owner explicitly supplied this exact approved artwork for the frontend rebuild, superseding the V0 presentation derivative below. No image generation, redrawing, or artificial pixelation was applied.

- source: `/home/swirky/Downloads/56c437f8-98f9-4eae-887f-cfcc40c26dff.png`
- source dimensions: 1254×1254 RGB PNG
- source SHA-256: `36faee4b1d1a1bf533a3959b430207ae0812c1a7f2e40fb7ce9d23d550fce982`
- derivative: `web/assets/binrat-hero.webp`
- derivative dimensions: 1100×1100
- encoding: Pillow Lanczos resize, WebP quality 88, method 6
- byte size: `256890`
- derivative SHA-256: `e984faa47cdf0ee17c5c0280c83f6d4944bbb8807d68a1e9917cb7f2138bd163`
- interpolation: normal (`image-rendering: auto`)
- favicon: `web/assets/favicon.png`, 64×64, same source

The hero and share preview use the current derivative. Social image metadata points to it; production publishing should resolve those image URLs against the confirmed canonical origin. The local IBM Plex font subsets and their license are in `web/assets/fonts/`.

## Archived V0 provenance

The following receipt is retained for provenance. Its 128px derivative is no longer used on the public surface.

### V0 source master

- source: approved generated BINRAT dumpster-rat artwork
- format: PNG
- dimensions: 512×512 RGBA
- source SHA-256: `183dbb65cae463541f788603e01677e5987603c56d706b13266804b9fbd2c9af`

The source master remains the canonical art source.

### V0 web derivative

- asset: `web/binrat-mascot-128.webp`
- format: WebP, quality 40 derivative from the source master
- dimensions: 128×128
- byte size: `4284`
- SHA-256: `91a1c123e6d3d82443407625ee43b790f07fb36b0bc55c63b9640d816ccb1987`
- Git blob SHA-1: `b191f01ff319e2dd240eef5a9fbb3eb00cddc614`

This compact derivative is the approved mascot asset served by THE DUMPSTER V0. It is intentionally small enough to traverse the connected GitHub binary transport byte-for-byte and is enlarged with pixel-art rendering in the hero. It is not the canonical source master and is not described as lossless.

Brand identity remains pinned by the source-master digest above. Replacing the web derivative requires updating the byte-size and digest checks; replacing the source master requires an explicit brand decision.
