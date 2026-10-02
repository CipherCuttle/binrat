# BINRAT Brand V1 — Typography Contract

**Decision date:** 2026-10-02  
**Owner-selected family:** Geist

## Roles

### Geist Sans

Use for:

- BINRAT wordmark exploration;
- primary headlines;
- hero copy;
- navigation;
- explanatory prose;
- buttons and CTAs;
- social post headlines and literal explanations.

Default character:

- compact;
- clean;
- modern;
- not artificially distressed;
- sentence case by default unless a canonical BINRAT phrase intentionally uses uppercase.

Recommended weight range:

- body: 400–500;
- UI emphasis: 550–650;
- display: 650–800.

Do not use weight alone to manufacture a fake "brutalist" identity.

### Geist Mono

Use for:

- addresses;
- transaction / receipt IDs;
- hashes;
- timestamps;
- blocks/checkpoints when relevant;
- source metadata;
- evidence state labels;
- compact technical tables;
- code or CLI examples.

It is the visual signal for **inspectable evidence**, not generic hacker decoration.

Recommended weight range:

- dense evidence: 400–500;
- labels/emphasis: 550–650.

### Geist Pixel

Use sparingly for:

- very short chapter markers;
- tiny authored campaign labels;
- selected stamps;
- occasional title texture where raster/pixel art already carries the scene.

Hard limits:

- never paragraph/body copy;
- never raw evidence;
- never small legal/safety copy;
- never all navigation;
- never use it merely to make a screen feel "retro";
- never substitute it for a real raster illustration.

No Geist Pixel variant is globally frozen yet. Variants must be auditioned inside actual BINRAT compositions before promotion.

## Default hierarchy

A Brand V1 composition should normally read as:

1. **Geist Sans** — what the Rat found;
2. **Geist Sans** — literal explanation;
3. **Geist Mono** — receipt/source/evidence;
4. **Geist Pixel** — optional seasoning, if any.

This keeps personality above the evidence layer without making evidence look playful or ambiguous.

## Fallback stacks

Until self-hosted production assets are deliberately added:

```css
--font-sans: "Geist", "Inter", system-ui, sans-serif;
--font-mono: "Geist Mono", "SFMono-Regular", Consolas, "Liberation Mono", monospace;
```

Geist Pixel must fail back to Geist Sans, not to an arbitrary system pixel font.

## Migration gate from IBM Plex

IBM Plex remains incumbent implementation history, not Brand V1 authority.

Do not remove its files or rewrite all current CSS in the typography-decision commit.

A migration PR must show side-by-side proofs for at least:

- home/hero;
- one dense investigation/case screen;
- one evidence receipt;
- roadmap chapter treatment;
- 320px and 390px mobile;
- 1440px desktop.

Acceptance:

- no material evidence-density regression;
- no address/hash ambiguity;
- no headline wrapping regression that harms the five-second comprehension target;
- no new horizontal overflow;
- no decorative Pixel usage dominating the composition;
- no semantic meaning conveyed by font choice alone.

## Brand-system ratio

Not a literal CSS quota, but a design check:

- Geist Sans: dominant;
- Geist Mono: evidence layer;
- Geist Pixel: rare accent.

If a screen visually reads as "pixel font UI", the balance is wrong.
