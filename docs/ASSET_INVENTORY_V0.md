# BINRAT ASSET INVENTORY V0

Status: repository inventory at `b1b25e3bbd08189e7e913ef16768841ba7cb5296` plus Product Surface V1 demo.
Scope: actual visual binary/font assets. CSS/JS visual treatments are implementation, not canonical artwork.

## Actual assets

| Path | Type / dimensions | Bytes | SHA-256 | Classification | Use |
|---|---:|---:|---|---|---|
| `web/assets/binrat-hero.webp` | WebP, 1100×1100 | 256,890 | `e984faa47cdf0ee17c5c0280c83f6d4944bbb8807d68a1e9917cb7f2138bd163` | **Canonical approved presentation derivative** | Hero and share preview; V2 static/Rive fallback |
| `web/assets/favicon.png` | PNG RGB, 64×64 | 9,977 | `cce2f404d991febe03e1d94f9736851c8e8055ed505815a80e7fe6ce486353f9` | **Canonical derived favicon** | Browser favicon |
| `web/binrat-mascot-128.webp` | WebP, 128×128 | 4,284 | `91a1c123e6d3d82443407625ee43b790f07fb36b0bc55c63b9640d816ccb1987` | **Archived approved V0 derivative** | Retained provenance; not current public hero |
| `web/assets/fonts/plex-condensed-bold.woff2` | WOFF2 / IBM Plex Condensed Bold | 17,364 | `b8e419feb977bcc68879eb26cc417500a00d876ab8230f9bf539c272fd4a50af` | **Font** | Display headings |
| `web/assets/fonts/plex-mono-medium.woff2` | WOFF2 / IBM Plex Mono Medium | 13,412 | `f1e95a9461e34ef3039f9b3ae60a44667ee7b012ce404e475103ad9b10ae31f2` | **Font** | Labels/emphasis |
| `web/assets/fonts/plex-mono-regular.woff2` | WOFF2 / IBM Plex Mono Regular | 13,072 | `57a9ee7256afe6fba2a49e5a1ed14e577ee54954a8e51e50309b364394e38b8d` | **Font** | Body/data text |
| `web/assets/fonts/LICENSE.txt` | IBM Plex license text | 7,370 | `ed00326e4573277ab21aaf0580b014c95ee234b3e3144e8516e7ba76156f6507` | **License** | Font licensing record |

The source master described in `docs/BRAND_ASSET.md` is not stored in the repository. Its owner-supplied source receipt remains canonical provenance; the in-repo 1100×1100 derivative is the approved presentation asset. `web-v2` reuses `web/assets/` as its Vite public directory and does not clone or mutate these files.

## Implemented but not standalone assets

- The `BR↗` compact mark is HTML/CSS typography, not an approved standalone logo file.
- BINRAT wordmarks in current pages are live type, not a finalized vector wordmark.
- Receipt bars, evidence stamps, case tabs, recurrence strips, grid textures, and status dots are CSS primitives.
- Share cards are runtime HTML/CSS compositions using the approved mascot, not exported distribution image files.
- Token thumbnails on the live feed are external metadata, not BINRAT brand assets and not part of this inventory.

## Placeholder status

There is no fake Rive file or placeholder image in the repository. The Product Surface V1 demo uses the approved mascot as an explicit static fallback behind a typed state contract. This is intentional, not missing provenance.

## Missing-asset queue

Priority is bounded to a coherent launch-quality family:

1. **P0 — identity reductions:** owner-approved simplified rat-head mark, BINRAT vector wordmark, `$BINRAT` token mark, and scalable app/favicon family derived under explicit brand approval.
2. **P1 — product object set:** trash bag, dumpster, evidence receipt, case folder, radar marker, watch/tripwire, and treasury/ledger stamp in one line/print language.
3. **P2 — mascot state masters:** idle, digging, sniffing/indexing, evidence found, suspicious recurrence, empty/nothing found, error/offline, and receipt verified. Preserve the approved character design.
4. **P3 — motion source:** approved Rive artboard/state machine implementing the documented inputs; static poster/fallback for every state.
5. **P4 — distribution exports:** X OG card, Telegram avatar and banner, a small Telegram sticker set, launch card, and receipt share card templates.

No additional decorative asset pack is justified before P0–P2 establish consistent silhouette, line weight, palette, texture, and export rules.
