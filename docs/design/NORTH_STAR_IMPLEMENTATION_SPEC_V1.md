# BINRAT North-Star Implementation Spec V1

Status: FROZEN FOR PRODUCT SURFACE V1 CALIBRATION

## Authority

- **Truth:** BINRAT APIs, receipts, and canonical manifests outrank every visual layer.
- **World:** `north-star/binrat-world-background.png` is the persistent pixel-sunset artwork; never recreate it with CSS gradients.
- **Character:** `north-star/binrat-character-master.png` is the only character authority. Crop and compose it; do not redraw it.
- **Machine:** dark cobalt/teal industrial instrument surfaces with hard rules, restrained wear, and physical controls.
- **Evidence:** dirty cream paper surfaces with rules, stamps, receipt vocabulary, and high legibility.

North-star screenshots define atmosphere, composition, hierarchy, material language, density, and graphic personality. Their labels, people, rankings, identities, evidence, responsive geometry, microcopy, and implied backend capabilities are illustrative only.

## Composition

- Working width: `min(1480px, calc(100vw - 32px))`; never expand indefinitely on ultrawide displays.
- Desktop (>= 1100px): 64px header; masthead and character share one atmospheric field; material specimens form two columns below.
- Tablet (721–1099px): preserve the environment and overlap, reduce character/decorative footprint, keep materials paired when space permits.
- Phone (<= 720px): intentional world crop, simplified two-row header, dominant title, secondary character, and vertically stacked specimens.
- Background focal positions: desktop `center 38%`, tablet `58% 34%`, phone `63% 26%`. Always cover without distortion or seams.

## Tokens and rules

- Machine: `#071c2d`, `#0b2b39`, `#124551`; rule `#2d7b78`; signal `#75d8c4`.
- Evidence paper: `#ded0ad`, `#c5b58f`; ink `#171d21`; rule `#776b55`; stamp `#9f342f`.
- Borders: 1px hard rules; occasional 3px status/action edge. No blurred glass borders.
- Radius: `0` by default; maximum `2px` only for small physical indicators.
- Type: IBM Plex Condensed for display (`clamp(4.25rem, 10vw, 9rem)`); IBM Plex Mono for body/labels (`0.7–1rem`). Body text stays readable and selectable.
- Interaction vocabulary: hard contrast/fill changes for hover, 2px cream/orange focus outline, pressed displacement, and explicit text labels. Motion is optional and removed under reduced motion.
- Future states: `LOADING`, `LIVE`, `EMPTY`, `PARTIAL`, `UNVERIFIED`, `ERROR`, `SELECTED`, `COPIED`, `WATCH_READY`, `WATCH_ARMED`, `WATCH_FAILED`, `STALE`.

## Runtime assets

Runtime assets are exact or optimized derivatives of canonical sources, stored under `web/assets/north-star/`; canonical files remain untouched. Gate 0 uses exact PNG copies because no safe optimizer is currently available. Produce visually lossless, measured derivatives before production migration.
