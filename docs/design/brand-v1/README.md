# BINRAT Brand System V1

**Status:** active brand-system workstream  
**Branch:** `design/binrat-brand-system-v1`  
**Owner decision:** 2026-10-02 — use the Geist family instead of IBM Plex for the BINRAT brand system.

This brand system inherits current product authority. It does not replace:

- `docs/README.md` for authority routing;
- `docs/ROADMAP.md` for future product intent;
- `docs/PHILOSOPHY.md` for evidence/product doctrine;
- `docs/PRODUCT_LANGUAGE.md` for naming, voice and public copy;
- `docs/CAPABILITY_MANIFEST_V0.json` for capability/deployment truth.

The brand layer controls visual identity and presentation only. It may not upgrade evidence, capability status, financial claims or product authorization.

## North star

**HE GETS THE SCRAPS. YOU GET THE RECEIPTS.**

BINRAT is dumpster intelligence: a slightly feral but competent scavenger that digs through noisy onchain launches, preserves evidence and remembers trails worth inspecting.

The brand should feel:

- grubby, precise and evidence-led;
- expressive in discovery, restrained in investigation;
- recognizably pixel/raster-native without becoming a novelty game UI;
- funny because the Rat is a character, not because the product fabricates certainty;
- distinct from generic crypto-neon dashboards, finance terminals and cute mascot SaaS.

## Frozen Brand V1 decisions

### Typography

The authoritative Brand V1 family is **Geist**.

- **Geist Sans** — primary human-facing typography: brand copy, headings, explanatory text, navigation and calls to action.
- **Geist Mono** — evidence typography: addresses, hashes, receipts, timestamps, source metadata, code-like labels and dense forensic tables.
- **Geist Pixel** — rare display texture only: short labels, chapter markers, stamps or campaign moments where it reinforces the raster/pixel world.

Geist Pixel is not body copy, not evidence copy and not a substitute for authored raster artwork.

See `TYPOGRAPHY.md`.

### Rat identity

The Rat is one recurring individual character, not a theme.

Rat Zero is frozen at `docs/design/brand-v1/canon/rat-zero.jpg` and governed by `RAT_CANON.md`.

- character identity comes from Rat Zero;
- world / lighting / pixel-language comes from the current approved scoped raster donor;
- do not create generic vector/SVG mascot replacements;
- do not mirror asymmetric identity marks to the wrong side;
- new poses are candidates until side-by-side identity review passes;
- when uncertain, preserve rather than reinterpret.

### Logo / lockup

The canonical Brand V1 identity is frozen:

- Rat mark → deterministic Rat Zero crop;
- wordmark → single-color heavy Geist Sans `BINRAT`;
- primary lockup → Rat Zero left + wordmark right;
- optional contextual metadata → detachable Geist Mono evidence tab.

See `LOGO_LOCKUP.md` and `WORDMARK_PROOF_V1.md`.

### Palette

The canonical Brand V1 color system is frozen in `PALETTE.md`, `tokens.json` and `brand-tokens.css`.

- dark neutrals + Bone/Paper own hierarchy;
- Copper means attention/discovery, never recommendation;
- Rat Eye red is a character/error/destructive cue, never a risk score;
- Mint/Bruise evidence colors require literal state labels;
- Paper uses Ink for normal-sized evidence text;
- `Line High` is decorative and must not be the sole accessibility-critical boundary.

### Raster-world rule

For authored pictorial BINRAT environments, inherit the current roadmap rule:

> physical things inside the BINRAT world are authored raster artwork.

DOM/CSS may lay out, mask, dim, illuminate and animate raster layers. It should not procedurally redraw rooms, rats, terminals, pipes, paper, props or scene hardware as pictorial substitutes.

### Social composition

Canonical Brand V1 social families are frozen:

- **RECEIPT**
- **CASE FILE**
- **RAT FOUND SOMETHING**

See `SOCIAL_TEMPLATES_V1.md`.

### Voice

Inherit `docs/PRODUCT_LANGUAGE.md` without creating a parallel social-media dialect.

Public-copy hierarchy:

`FERAL HEADLINE → LITERAL EXPLANATION → RECEIPT / SOURCE`

## Explicitly not frozen yet

The following require Brand V1 gates rather than ad-hoc decisions:

- X / Telegram / OpenGraph export templates;
- motion grammar outside already-approved scoped implementations;
- exact Geist Pixel variant(s);
- production-wide font migration.

## Rollout rule

Do not partially replace IBM Plex across production surfaces just because Brand V1 selected Geist.

First prove:

1. wordmark/headline hierarchy;
2. evidence readability with Geist Mono;
3. mobile density at 320/390px;
4. receipt/case-file templates;
5. current screen regression against the incumbent Plex implementation.

Then migrate one bounded surface and verify before global replacement.

