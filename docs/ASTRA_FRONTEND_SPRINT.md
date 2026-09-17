# BINRAT Astra frontend sprint

Branch: `design/binrat-frontend-astra-v1`
Base: current `origin/main` at `dae4ad8` on 2026-09-17.

## Visual thesis

A restrained launch intelligence desk: dirty bone display type, green terminal instrumentation, original dusk artwork, evidence-first objects, and a paper-colored receipt inside a case-file drawer. Red accents identify noted conditions; brand chrome uses bone, green, and muted orange.

## Implementation

- Compact split hero and fixture-derived latest-bag inspection strip.
- Three receipt-like cards expose reported creator address, prior indexed bags, coverage, mature observations, concentration, and bounded rat notes.
- Local ticker/name/reported-address search, history filter, empty state, and `/` search shortcut.
- Case-file drawer with full addresses, numbered observations, current/older bag timeline, explicit coverage, and receipt. The timeline explicitly states how many fixture rows are shown, distinct from total prior indexed bags.
- Existing share-card model and copy generator retained; presentation fits the drawer and uses the quality art derivative.
- Keyboard close/focus return, focus containment, inert background, scroll lock, reduced-motion support, and restrained pointer response.
- Compact method schematic and clearly planned/not-live utility concept. No contract, presale, wallet, or ownership-dependent evidence.
- Self-hosted IBM Plex subsets (about 47 KB total), bundled license, favicon, and social image metadata.
- Asset gate updated for the authorized derivative; preview server serves image/font MIME types.

## Art

Exact supplied PNG: `/home/swirky/Downloads/56c437f8-98f9-4eae-887f-cfcc40c26dff.png` (1254×1254).
Derivative: `web/assets/binrat-hero.webp` (1100×1100, WebP q88, 256,890 bytes).
Normal interpolation. See `BRAND_ASSET.md` for hashes and retained V0 provenance.

## Verification

- JavaScript syntax check passed.
- `pnpm web:check` initially stopped on an exact-string CSS formatting assertion; formatting corrected.
- Individual web, share-card, and launch-presentation invariant scripts then passed.
- Browser smoke at 1440×1000 and 375×812: three fixture cards, history filter returns two, drawer opens/Escape closes, no page overflow.
- Fixed mobile share-preview overflow and drawer focus timing discovered in that smoke; confirmed drawer fits and close button receives focus.
- No full test suite, backend build, repeated CI, or experiment changes.

## Handoff

Preview: `PORT=4173 node scripts/serve-web.mjs`.
Screenshots: `/home/swirky/DevHub/artifacts/binrat-astra-v1/` (outside the repository).

Review should focus on metadata readability at intermediate widths, longer future evidence/address content, and final art crop/spacing preferences. Social images currently use relative local asset URLs; resolve against the confirmed canonical site origin before public release. No dedicated social artwork/exporter, React Bits dependency, live integration, or token implementation was added. No public repository, builder, or invented social links.
