# BINRAT Brand V1 — Logo & Lockup Contract

**Status:** FROZEN  
**Owner approval:** 2026-10-02

## Canonical parts

### Rat mark

Use the deterministic Rat Zero avatar crop produced by Identity Proof V1.

Canonical current derivative:

`docs/design/brand-v1/proofs/identity-v1/rat-avatar-128.png`

Source authority remains `docs/design/brand-v1/canon/rat-zero.jpg`.

The crop is a mascot mark, not a newly redrawn logo.

### Wordmark

Text:

**BINRAT**

Typeface:

**Geist Sans**

Treatment:

- heavy weight;
- tight tracking;
- no outline;
- no glow;
- no skew;
- no stencil cuts;
- no distressed glyph texture;
- no custom redrawing;
- one flat text color by default.

The wordmark remains typographic. Rat Zero provides the character identity.

### Primary horizontal lockup

`[ RAT ZERO ]  BINRAT`

Default order is mark left, wordmark right.

The two parts must remain visually separable. Do not fuse the Rat into letters.

### Secondary evidence lockup

Allowed:

`[ RAT ZERO ]  BINRAT`
`                 [ MONO EVIDENCE TAB ]`

The Geist Mono tab is optional contextual metadata.

Examples:

- `RECEIPT #00482`
- `CASE FILE`
- `OBSERVED`
- `RECEIPTS > SCORES`

It is not part of the permanent logo geometry.

## Default color behavior

Primary wordmark should normally use the Brand light foreground / bone-paper family on dark backgrounds, or near-black on light backgrounds.

Do not permanently split `BIN` and `RAT` into different colors.

Accent color may appear in surrounding composition, evidence tabs or campaign typography, but the canonical wordmark remains single-color.

## Clear space

For practical use, preserve at least **0.35× the Rat-mark width** around the full lockup.

Do not place evidence tables, borders, buttons or decorative props inside this exclusion zone.

## Relative sizing

Horizontal lockup target:

- Rat mark visual height ≈ wordmark cap-height to 1.35× cap-height;
- wordmark should not become smaller than the Rat's face details can support;
- at tiny navigation scale, reduce the Rat crop and wordmark together rather than dropping one arbitrarily.

## Small-size behavior

- 128px Rat crop: approved social/avatar use.
- 48px Rat crop: approved compact UI/social use.
- 32px Rat crop: approved favicon candidate; validate in real browser chrome before permanent favicon cutover.

At 16–24px, do not auto-generate a simplified replacement. Open a separate simplification gate if required.

## Backgrounds

Preferred:

- near-black / charcoal;
- dirty paper / bone;
- authored BINRAT raster scenes with enough local contrast.

Avoid:

- purple crypto gradients;
- bright multicolor gradients;
- busy imagery immediately behind the wordmark;
- glow effects used to rescue poor contrast.

## Hard rejects

Do not:

- redraw Rat Zero as vector/SVG;
- mirror asymmetric Rat identity;
- fuse Rat anatomy into letters;
- turn the wordmark into a token-symbol gimmick;
- permanently color `RAT` differently from `BIN`;
- attach a slogan so tightly that the logo fails without it;
- use fake glitch, scanline or distortion as canonical logo treatment.

## Source proofs

- Identity: `IDENTITY_PROOF_V1.md`
- Wordmark: `WORDMARK_PROOF_V1.md`
- Typography: `TYPOGRAPHY.md`
- Rat identity: `RAT_CANON.md`
