# BINRAT Brand V1 — Distribution Handoff

**Branch:** \`design/binrat-export-pack-v1\`  
**Do not merge from this handoff without explicit owner authorization.**

## What this workstream owns

This branch converts the already-approved Brand V1 identity into reproducible distribution outputs. It owns export mechanics, hashes, platform presets, and pressure-test receipts only.

It does **not** own a new mascot, new wordmark, new social family, new palette, new font family, production web changes, Telegram runtime changes, product-language changes, deploys, or live-data claims.

## Source authority

The export system is bound to the approved Brand V1 authority commit:

\`design/binrat-brand-system-v1\` → \`25a54278e6a5d8eb6f5a568e9e8f05d39ea21a4c\`

Read before modifying exports:

- \`docs/design/brand-v1/README.md\`
- \`docs/design/brand-v1/RAT_CANON.md\`
- \`docs/design/brand-v1/TYPOGRAPHY.md\`
- \`docs/design/brand-v1/LOGO_LOCKUP.md\`
- \`docs/design/brand-v1/WORDMARK_PROOF_V1.md\`
- \`docs/design/brand-v1/SOCIAL_TEMPLATES_V1.md\`
- \`docs/PRODUCT_LANGUAGE.md\`
- \`docs/PHILOSOPHY.md\`

## Deterministic pipeline

Renderer:

\`tools/brand/render-export-pack.py\`

Inspectable composition source:

- \`docs/design/brand-v1/export-v1/index.html\`
- \`docs/design/brand-v1/export-v1/export.css\`

CI receipt:

\`.github/workflows/binrat-brand-export-pack.yml\`

The workflow pins Python, Pillow, Playwright, and the Playwright Chromium bundle. Geist Sans/Mono load from the same immutable Vercel Geist commit already used by the approved Brand V1 proofs. No third-party font binary is committed.

The workflow renders twice and compares every export SHA-256 in the same environment. Any byte drift fails the job before generated outputs are committed.

### Social proof geometry normalization

The frozen Social V1 source proofs are one raster row taller than their declared targets (1200×676 instead of 1200×675; 1080×1081 instead of 1080×1080). The export layer removes only that extra bottom row when present. It does not mutate the frozen source proofs, reflow copy, redraw artwork, or change the composition contract.

## Distribution tree

\`\`\`text
exports/
  logo/
    canonical-horizontal-dark-1200x320.png
    canonical-horizontal-light-1200x320.png
    wordmark-dark-1000x280.png
    wordmark-light-1000x280.png
    rat-avatar-512.png
    rat-avatar-256.png
    rat-avatar-128.png
    rat-avatar-64.png
    rat-avatar-48.png
    rat-avatar-32.png
    favicon-candidate-32.png
    favicon-candidate-48.png
  x/
    avatar-512.png
    header-1500x500.png
    post-receipt-wide-1200x675.png
    post-rat-found-square-1080.png
  telegram/
    profile-512.png
    card-case-file-wide-1200x675.png
    card-rat-found-square-1080.png
  opengraph/
    default-og-1200x630.png
  generic-social/
    receipt-wide-1200x675.png
    receipt-square-1080.png
    case-file-wide-1200x675.png
    case-file-square-1080.png
    rat-found-wide-1200x675.png
    rat-found-square-1080.png
  proofs/
    pressure-tests-1800x1600.png
  manifest.json
\`\`\`

\`exports/manifest.json\` is the machine-readable handoff. Each record includes role, dimensions, source assets, source hashes, output hash, intended surfaces, background assumptions, canonical/candidate status, and generator command/version.

## Status semantics

- **canonical** — direct deterministic derivative or exact copy of an already-frozen Brand V1 decision.
- **candidate** — platform geometry or tiny-size use that still needs real-surface validation; frozen brand ingredients remain unchanged.

Current candidate classes are intentionally narrow: favicon/tiny use, X-style header preset, default OG preset, and the diagnostic pressure-test board.

## Modification rule

Small changes only. A valid export change should normally be one of:

- add a new deterministic size/crop from an approved source;
- add a platform preset using the same frozen Rat/wordmark/social family;
- improve reproducibility or validation;
- fix a real crop/readability failure without changing identity.

Stop and escalate if the requested change requires:

- mascot redraw, mirroring, vector replacement, or new pose;
- changing the canonical lockup;
- changing fonts or introducing global colors;
- inventing another social family;
- changing public product language;
- publishing demo/fake data as live;
- weakening source/hash reproducibility.

## Review path

1. Run the renderer.
2. Run \`--verify\`.
3. Inspect \`exports/proofs/pressure-tests-1800x1600.png\` at 100%.
4. Inspect the standalone X header, Telegram profile/card, OG preview, and both dark/light lockups.
5. Check \`exports/manifest.json\` for source/output hash completeness.
6. Validate candidate assets on their real target surfaces before promoting candidate → canonical.

No merge or deployment is part of this handoff.
