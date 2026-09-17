# BINRAT HERO ASSET V0

## Approved source

- user-supplied file: `56c437f8-98f9-4eae-887f-cfcc40c26dff.png`
- source dimensions: 1254×1254
- source byte size: `3328127`
- source SHA-256: `6f22821dfad44309638dd0d08b0dfba8b08d74f324abf89795188d4dbed275fe`

This is the approved source for the landing-page hero image in this slice. It does not replace the compact mascot/badge asset used by smaller UI surfaces.

## Served hero derivative

- wrapper asset: `web/binrat-hero.svg`
- embedded format: WebP
- embedded dimensions: 512×512
- embedded byte size: `30850`
- embedded WebP SHA-256: `f1cd98539d4eade13204904e0c707d81cf9de9be7451ee746e92b10189a2c648`
- rendering: normal browser interpolation (`image-rendering: auto`)

The SVG wrapper is intentional. Larger binary uploads were previously corrupted by the connected GitHub binary transport. Embedding the verified WebP bytes as text preserves the higher-fidelity hero while keeping the compact `binrat-mascot-128.webp` unchanged for small UI/share-card contexts.

Changing the hero image requires updating this receipt and the hero-fidelity CI gate.