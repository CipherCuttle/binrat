# BINRAT ASSET BIBLE V0

Status: visual-system plan. This document does not authorize replacement or regeneration of the approved mascot.

## World

BINRAT is **forensic editorial instrument × filthy dumpster culture × high-end industrial product UI**. Assets should look as if one investigative publication, one municipal evidence room, and one nocturnal dumpster rat share a print shop.

Avoid glossy coins, generic Web3 gradients, purple neon, glass panels, stock iconography, sci-fi HUD rings, bubble maps, Sigma-style network canvases, and undifferentiated terminal cosplay.

## Canonical anchor

`web/assets/binrat-hero.webp` is the owner-approved presentation mascot. Preserve its character, silhouette, colors, and provenance. It is the static fallback until approved state artwork exists. Do not trace, regenerate, reinterpret, or use image generation to create alternate mascot states without explicit owner approval.

## Visual grammar

- **Shapes:** square/near-square industrial frames, clipped paper tabs, stamped rectangles, perforations, thin rules, receipt tears. Rounded pills are reserved for small status markers only.
- **Line:** one consistent utilitarian stroke family. Product-object icons must read at 16, 24, and 48 CSS pixels.
- **Texture:** restrained ink/grease/noise texture at large scale; never reduce text contrast or suggest corrupted evidence.
- **Type:** Plex Condensed Bold for voice/display; Plex Mono Regular/Medium for facts, addresses, status, and controls.
- **Core palette:** asphalt black `#101210`, panel `#1d211d`, dumpster green `#263b35`, dirty bone `#e4ddcc`, muted orange `#cf9567`, evidence green `#a8b795`, unknown purple `#9a8aa2`, alarm red `#ff3948`.
- **Semantic rule:** green is observed/complete evidence, orange is noted/partial, purple is unknown/unverified, red is alarm/brand energy. None means buy/sell, safe/risky, or good/bad.

## Minimum family

### Brand

- primary approved mascot;
- simplified rat-head mark;
- BINRAT wordmark;
- `$BINRAT` token mark;
- favicon/app icon sizes.

### Product objects

- trash bag — launch object;
- dumpster — launch feed/home;
- evidence receipt — immutable projection/receipt;
- case folder — Bag/Creator dossier;
- radar marker — observed address/recurrence;
- watch tripwire — future subscription;
- ledger stamp — treasury/accounting evidence.

Objects share perspective, stroke, distress, and negative-space rules. They must not become isolated illustration styles.

### Mascot states

| State | Product meaning | Visual behavior |
|---|---|---|
| idle | index healthy, no active request | breathing/ear attention only |
| indexing | checkpoint work in progress | scanning/listening, no celebratory motion |
| digging | evidence request in progress | direct rummaging action |
| evidence_found | validated evidence returned | reveal receipt/object |
| repeat_creator | explicit reported-address recurrence | attention shift to repeated bag trail |
| empty | valid empty result | stop and show empty paws/bin |
| error | read plane/validation failed | offline/error posture, no synthetic output |
| receipt_verified | receipt/digest validation passed | stamp/receipt confirmation |

Emotion supports product state; it never evaluates a token or address.

### Distribution

- X/OG 1200×630 composition;
- Telegram avatar with simplified rat-head silhouette;
- Telegram channel banner;
- bounded sticker set based only on approved state masters;
- launch card template;
- receipt share card template with checkpoint, coverage, receipt ID, and identity/recommendation boundary where relevant.

## Rive integration contract

One state machine should expose a string/enum-equivalent state input mapped by the frontend adapter plus optional booleans for reduced motion and focus/visibility. Runtime transitions originate from validated application events. The adapter must support:

- unavailable runtime → approved static WebP;
- missing state/artboard → approved static WebP plus text state;
- `prefers-reduced-motion` → no looping movement, state poster or minimal crossfade;
- offscreen/background → pause;
- load or validation error → `error` state without hiding the underlying data error.

Rive is loaded only on surfaces where mascot state materially explains system activity. It is not a cursor follower, page loader that delays evidence, or decorative loop in every panel.

## Export and governance

- Store source masters outside lossy derivatives and record owner approval, source path, dimensions, export settings, bytes, and SHA-256 in `docs/BRAND_ASSET.md`.
- Use WebP/AVIF for raster display, SVG for approved marks/icons, PNG only where platform requirements demand it, and `.riv` for approved state machines.
- Name by family/state/size, for example `rat-evidence-found-poster-512.webp` or `object-receipt-24.svg`.
- Every canonical replacement is an explicit brand decision. Derivatives may be optimized only from approved masters and must retain receipts.
- Do not use external token metadata or community art as BINRAT-owned brand material.
