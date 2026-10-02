# BINRAT Brand V1 — Usage Guide

**Status:** distribution usage contract for the approved Brand V1 system  
**Export authority:** \`exports/manifest.json\`  
**Source authority:** \`design/binrat-brand-system-v1\` at \`25a54278e6a5d8eb6f5a568e9e8f05d39ea21a4c\`

This guide does not redesign BINRAT. It explains how to use the deterministic export pack without weakening the frozen Rat, typography, lockup, social-composition, or evidence-language contracts.

## 1. Start with the surface, not a new composition

Use the existing export closest to the target surface. Do not redraw or rebuild the identity in Canva/Figma/Photoshop just because a destination has a different upload dialog.

- **Profile/avatar:** use a Rat Zero avatar export. Upload the square file and allow the platform to apply its circular mask.
- **Horizontal brand mark:** use the canonical horizontal dark/light export whose background assumption matches the destination.
- **Wordmark only:** use the single-color wordmark dark/light export. Do not split \`BIN\` and \`RAT\` by color.
- **X-style header:** use the candidate header preset as-is until a platform-specific crop forces a new bounded preset.
- **Telegram profile:** use \`exports/telegram/profile-512.png\`.
- **OpenGraph:** use \`exports/opengraph/default-og-1200x630.png\` as the static default preview.
- **Social cards:** choose only **RECEIPT**, **CASE FILE**, or **RAT FOUND SOMETHING**. The generic social exports are the approved demo/non-live reference outputs for those families.

The manifest records whether an asset is \`canonical\` or \`candidate\`. Candidate does not mean “redesign freely”; it means the export still requires real-surface validation before being treated as permanent platform geometry.

## 2. Rat Zero rules

Rat Zero is the same individual everywhere.

Allowed downstream operations are bounded crop, resize, responsive crop, non-destructive mask/background treatment, bounded scene-level brightness/contrast, and deterministic format conversion.

Do not:

- redraw or vectorize the Rat;
- mirror the Rat when that moves the asymmetric cyber-eye or identity marks;
- invent a cleaner mascot for tiny sizes;
- generate a replacement pose to solve an export problem;
- derive a new mascot from an already degraded derivative.

The 32px crop is a favicon/tiny-mark **candidate**. If real browser chrome makes it unreadable, reopen the explicit simplification gate described in \`RAT_CANON.md\`; do not silently “fix” it.

## 3. Typography

- **Geist Sans:** wordmark, headline, explanation, navigation, human-facing copy.
- **Geist Mono:** receipts, addresses, hashes, timestamps, evidence metadata.
- **Geist Pixel:** not required by this export pack.

The renderer uses Geist files from the immutable Vercel Geist commit already used by Brand V1 proofs. Font binaries are not committed or redistributed in this repository.

Do not substitute a display font, distressed font, crypto font, fake terminal font, or pixel font for the core wordmark.

## 4. Lockup

Canonical lockup:

\`[ RAT ZERO ]  BINRAT\`

The wordmark is one flat color. The Rat and wordmark remain visually separable. Optional Geist Mono evidence metadata may sit near the lockup, but it is detachable context rather than permanent logo geometry.

Preserve at least the clear-space guidance in \`LOGO_LOCKUP.md\`. Do not use glow, outline, skew, stencil cuts, fake glitch, or custom glyph surgery to rescue poor placement.

## 5. Background choice

The export pack uses only the current Brand V1 proof palette already present in the approved wordmark/social proofs. That does **not** promote a new global palette decision.

- \`canonical-horizontal-dark\` and \`wordmark-dark\` assume the Brand V1 near-black proof context.
- \`canonical-horizontal-light\` and \`wordmark-light\` assume the Brand V1 bone/paper proof context.
- Never place the wordmark over busy imagery without enough local contrast.
- Do not introduce purple crypto gradients, multicolor glow, or generic neon to make an asset “pop.”

## 6. Social copy hierarchy

Every social composition must preserve:

**FERAL HEADLINE → LITERAL EXPLANATION → RECEIPT / SOURCE**

The Rat may be expressive. The factual layer stays literal and inspectable.

Do not publish demo fixture values as if they were live. Do not create BUY/SELL/APE calls, safety/rug scores, unsupported human identities, fake urgency, fabricated live counts, or market claims from these templates.

When binding real data, missing evidence remains \`UNKNOWN\`, \`PARTIAL\`, \`UNVERIFIED\`, or \`MISSING\` as appropriate. Visual emphasis cannot upgrade a claim.

## 7. Platform crops

Platform UI may crop or mask uploads differently across devices. Check the final surface, not only the source PNG.

The frozen Social V1 browser-capture proofs currently contain one extra bottom raster row (wide: 1200×676; square: 1080×1081) despite their declared 1200×675 / 1080×1080 targets. The export pipeline removes only that extra bottom row, deterministically, when producing distribution assets. Source proofs are not modified. `exports/manifest.json` records the final output dimensions and hashes.

The export system includes one diagnostic contact sheet covering:

- tiny circular avatar;
- X-style profile/header;
- Telegram circular avatar and message card;
- OpenGraph preview;
- mobile feed thumbnail;
- dark page;
- light page.

If a platform crop materially hides Rat identity or the canonical lockup, create a bounded **platform preset** using the same frozen ingredients. Do not change the mascot or wordmark to fit the platform.

## 8. Reproduction

Generate:

\`\`\`bash
python tools/brand/render-export-pack.py
\`\`\`

Verify existing outputs without rewriting them:

\`\`\`bash
python tools/brand/render-export-pack.py --verify
\`\`\`

Pinned CI dependencies are recorded in \`.github/workflows/binrat-brand-export-pack.yml\` and every manifest record carries the generation command/version plus source/output hashes.
