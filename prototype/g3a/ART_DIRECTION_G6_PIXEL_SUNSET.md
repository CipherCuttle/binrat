# BINRAT — G6 static pixel-art direction (asset handoff)
**Status:** owner's next visual reference; art generation not yet approved as production assets.

The owner rejected React Bits Grain Wave even after it matched the demo.
The moving effect is removed from the consolidated draft PR; it must not be
reintroduced as a gradient, shader, animation, blur, wavy canvas, WebGL or
screen-space distortion. A temporary *static CSS sunset* preserves a usable
preview while new pixel-art scenery is commissioned. The source of truth for
the next visual direction is the TWO images the owner attached to the
2026-09-27 conversation: (1) a highly detailed pixel-art BINRAT marketing
homepage, (2) a dense rat-themed Rat Radar terminal with a paper case file.

The screenshots are high-fidelity ART DIRECTION, **not evidence that Radar's
example addresses, counts, ranks, alerts or products are implemented**.
Do not hard-code fake live stats, arm real notifications, or display a
fictional amount without a visible demo label.

## Non-negotiables
- Retain the exact owner's approved rat image at
  `prototype/g3a/public/rat-original.jpg`; keep identity, silhouette,
  cyber-eye side and expression. The rat is large on the homepage, smaller
  above Radar; don't redesign or replace with generic vector mascot.
- A real pixel artist's cohesive late-GBA/modern indie pixel-art scene,
  with crisp deliberate clusters, visible dithering and sunset light.
  **NO** procedural Grain Wave, purple blob gradient, blurry VHS
  background, stock cyberpunk photograph, random high-res painting, or
  large generic bento cards.
- Static layered artwork: magenta/indigo/purple skyline against vivid
  apricot-gold sunset, densely staged rooftop/crows/neon signs, grimy
  teal rusted dumpster, and charcoal product terminal surfaces.
- Desktop: poster-scale illustration, pale blocky title left, giant
  dumpster rat right, readable warm primary CTA; below, five structured
  product modules (Radar, Replay Lab, Ledger, Creator Files, Watch).
- Radar: same world/skyline, smaller original rat in a dumpster above a
  data-dense table of *observed* receipts and a parchment-style case file.
  Signage, copper borders and restrained mint/teal indicators. Use real
  historic fixture only when sourced; concept stats remain clearly DEMO.
- Produce distinct desktop (1440–1600w) and mobile (390 and 320) art
  crops: separate foreground/background transparent layers; do not
  simply scale the desktop poster to unreadable phone proportions.

## Asset generator instructions — copy into a NEW GPT instance
Attach the two screenshots in this conversation AND the exact original rat
image from the repo (or user-provided approved master). Use screenshots as
layout/world/style reference, not as pixel-perfect copyrighted copy of
third-party art. Preserve the rat identity. Generate **actual assets**,
not a new page of explanatory prose:
1. Main 1536×768 panoramic sunset/skyline BACKGROUND without mascot,
   headline, text, buttons or in-world statistics.
2. Transparent near/mid/far skyline layers with lit windows, rooftops,
   subtle mint and amber windows and independently positionable crows.
3. Foreground rusty teal dumpster, garbage overlays, neon sign props and
   corner ornaments as transparent layers; never burn existing rat into
   the sky background.
4. Five 384×256 UI card illustrations/icons: Rat Radar (receipt map),
   Replay Lab (scanner/contact sheet), Ledger (wallet graph), Creator
   Files (identity silhouette, no doxxing), Watch (observation feed),
   each distinct and consistent in pixels and lighting.
5. Radar panoramic header backdrop without mascot, transparent
   small rat-in-dumpster *compositional crop only* from canonical
   artwork if permitted, and paper-case-file **blank frame texture**
   without fabricated addresses, analytics or claims.
6. PNG transparent source layers, annotated contact sheet with
   coordinates/safe zones, separate desktop/mobile crops and density
   guide; no arbitrary smooth-vector scaling or high-resolution auto-pixelate.

**Review gate:** inspect each exported PNG at 100% and in an actual
390px Android browser composition before replacing CSS placeholder.
No final art/style guide lock or merge until owner signs off.


# BINRAT G6 — PIXEL-SUNSET ASSET PRODUCTION SPRINT

You are my senior pixel artist, game-environment artist, visual director,
product illustrator and export-production lead.

**I will attach THREE images:** screenshot A (the BINRAT homepage concept),
screenshot B (the Rat Radar concept), and the approved original BINRAT
rat master (or retrieve `prototype/g3a/public/rat-original.jpg` from
https://github.com/CipherCuttle/binrat). Do not proceed by inventing the rat
if you cannot see the master. Treat A/B as my next art direction.

The previously tried moving Grain Wave has been rejected and removed.
**Do not use shaders, aurora, particle backgrounds, blurry gradients,
SVG-mascot replacements, generic cyberpunk stock scenery or automatic
pixelation.** Draw authentic clean hard-edged pixel art with deliberate
clusters and controlled dithering. The feeling is a grimy, bright,
slightly humorous late-GBA-meets-modern-indie intelligence arcade,
not a UI mockup pasted on generic wallpaper.

Visual world: deep midnight indigo and electric violet rooftops; vivid
raspberry/magenta sky; molten apricot, amber and pale yellow sunset
clouds; tiny warm-lit city windows; black silhouettes of crows and
rooflines; neon teal/turquoise product indicators; rust, scratches and
glowing amber on a battered oversized teal-green dumpster. Mischievous
underground rat-noir, professional investigative UI under the art.
The approved rat's exact face, notched ear, asymmetrical red cyber-eye,
expressive paws, pizza and original dumpster imagery must never drift.
Large rat for homepage; smaller framed/cropped presence for Radar.

DELIVER actual images/files in ONE coordinated art pack, not a prose-only
concept, not an HTML page, and no fake product screenshots used as evidence.

A. Panoramic 1536×768 clean sunset/skyline *without rat or UI copy*;
   separate transparent far skyline / middle buildings / near roof &
   fence layers. Leave a calm readable left headline safe zone and a
   dramatic right-side subject window. Include crows, signs and pixel
   window lighting as independently compositable transparent props.
B. Independent foreground rusted teal dumpster trim, grime/garbage
   overlaps, standalone neon signs and edge decals; match the exact
   lighting/texture of screenshots A and B without repainting the rat.
C. Five distinctive 384×256 product-card miniature scenes: Rat Radar
   (observed receipt map), Replay Lab (archived scanner/contact sheet),
   Ledger (wallet/counterparty diagram), Creator Files (public profile
   silhouette, NOT real-person identity claim), Watch (fictional alert
   panel). Export art with NO hardcoded metrics, live statuses, price
   bars or text; leave copy as an editable frontend layer.
D. Radar panoramic 1536×480 matching skyline/dumpster world, enough
   negative space for a readable left title; provide a smaller,
   separately positioned rat crop only if the canonical image can be
   preserved exactly without repainting. Also export separate parchment
   paper-case texture, corners, stamps, icon primitives, clean blank
   receipt-row cards and three source-status marker designs. The
   example Radar numbers in screenshot B are visual-only mockups.
E. Three contact sheets showing 1536/1440 desktop, 390px Android and
   320px Android *composition*. Mobile must use individually composed
   crops and retain a substantial visible rat and sunset within first
   viewport; not just shrink a desktop image into unreadable text.

Every delivered item: transparent PNG when foreground; no anti-aliased
scale or blurry sprite edges; transparent padding and logical anchor
points documented; native pixel scale and optional crisp integer-upscaled
versions, sensible file names, color swatches and contrast-safe overlay
zones. For any logo/text, use separate layers; do not burn text into
scene art. Background must be static; optional subtle CSS parallax can
only be proposed AFTER visual approval and is not part of this task.

Maintain the product truth boundary: the prototype has ONE verified
historical Pons V2 factory receipt on Robinhood Chain, not a live
feed. Funding, price history, graduation and wallet ownership are
unknown. MOLD Rat Trap is entirely fictional. Keep all numbers,
address leaderboards, active watchlists, signal scores and coverage
claims out of exported art, and mark any demonstration UI explicitly
DEMO when you create the two final composite mockups.

Work in this order: (1) extract common design grammar from references
A/B; (2) draw homepage panorama + clean layer separation; (3) match
the approved rat master without altering it; (4) produce Radar header
and parchment/card art; (5) five card thumbnails; (6) 390px/320px
mobile compositions; (7) one critical visual self-review for seams,
readability, mascot drift and obvious AI pixel noise; fix Critical/High
once and export the final files plus labeled contact sheets. Return
assets ready for Svelte integration. Do not touch production branches,
merge, make up backend data or ask me to reapprove the already supplied
art direction unless the approved rat image is missing.
