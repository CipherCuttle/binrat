# BINRAT Social Templates V1

**Status:** active Brand V1 template system  
**Gate:** first three reusable composition families

## Principle

Social output must inherit the same product contract as Web and Telegram:

`FERAL HEADLINE → LITERAL EXPLANATION → RECEIPT / SOURCE`

A card may look feral. Its factual layer may not become feral.

The Rat is character. Evidence remains inspectable.

## Formats in this proof

Each family is tested in two neutral aspect-ratio targets:

- **wide:** 1200×675;
- **square:** 1080×1080.

These are Brand composition targets, not claims about a specific platform's permanent upload specification.

## 01 — RECEIPT

Job:

> make one retained finding feel tangible and inspectable.

Hierarchy:

1. canonical BINRAT lockup;
2. receipt ID / evidence class;
3. feral headline;
4. literal one-sentence explanation;
5. compact evidence rows;
6. source / coverage / proof state;
7. one action.

Use for:

- source-backed recurrence;
- preserved historical observation;
- one evidence bundle worth sharing;
- “here is what we actually saw” posts.

Do not use for:

- predictions;
- “alpha”;
- buy/sell calls;
- fake urgency;
- unsourced market claims.

## 02 — CASE FILE

Job:

> compress a deeper investigation into one shareable case summary.

Hierarchy:

1. canonical BINRAT lockup;
2. case ID;
3. feral headline;
4. literal narrative;
5. structured case facts;
6. explicit evidence/claim boundary;
7. one next action.

Use for:

- Trash Trail summaries;
- related historical launches;
- outcome coverage summaries;
- investigation handoff.

The case file should feel denser than RECEIPT but still be understandable in seconds.

## 03 — RAT FOUND SOMETHING

Job:

> use the character to stop the scroll, then immediately hand the user factual context.

Hierarchy:

1. canonical BINRAT lockup;
2. Rat Zero as dominant visual;
3. very short feral headline;
4. literal explanation;
5. one evidence strip;
6. one action.

This is the most expressive format and therefore has the strictest claim-boundary requirement.

The Rat may say “FOUND SOMETHING.”  
The literal line must say what was actually found.

## Shared rules

- Rat imagery comes only from canonical/approved derivatives.
- Geist Sans carries communication.
- Geist Mono carries evidence and metadata.
- Accent color does not mean safe/risky.
- No fake live counts, prices or alert states.
- No decorative “AI”, “ALPHA”, rockets, diamonds or generic crypto hype.
- No generic vector rat.
- No SVG/CSS pictorial substitute for authored Rat/world artwork.
- One primary action per card.
- Missing evidence remains visibly missing/partial.

## Reusable implementation

Proof source:

`docs/design/brand-v1/social-v1/`

Demo content is isolated in:

`fixture.js`

Template structure and styling do not depend on those specific demo values.

Rendered proof outputs:

`docs/design/brand-v1/proofs/social-v1/`

The proof fixture is deliberately labeled `DEMO / NON-LIVE` and uses non-production identifiers.

## Acceptance gate

For each family:

- recognizable as BINRAT with no generic crypto styling;
- Rat Zero remains canonical;
- headline understandable in ~2 seconds;
- literal explanation readable without zoom;
- evidence layer visually distinct from personality;
- wide and square compositions both hold;
- no content overlaps/crops;
- no claim becomes stronger due to visual emphasis.

A template that only works with one exact sentence is not reusable and fails.


## Internal visual review — 2026-10-02

Status: **CANDIDATE PASS / OWNER VISUAL APPROVAL PENDING**

The six rendered proofs were reviewed at wide and square ratios.

### RECEIPT

Candidate PASS.

Strengths:

- strongest evidence-first format;
- clear separation between feral headline and literal receipt;
- paper/bone evidence panel reads immediately as a retained artifact without becoming fake terminal chrome;
- square and wide both preserve hierarchy.

Watch:

- avoid filling every row just because space exists;
- PARTIAL / UNKNOWN / MISSING must remain visually honest rather than being hidden for aesthetics.

### CASE FILE

Candidate PASS.

Strengths:

- denser than RECEIPT without becoming a terminal screenshot;
- literal narrative remains readable before the structured facts;
- explicit `PATTERN · NOT A VERDICT` boundary survives both ratios;
- works without needing large Rat artwork.

Watch:

- do not let future cases expand beyond a few high-value rows;
- deeper evidence belongs behind the share card, not squeezed into it.

### RAT FOUND SOMETHING

Candidate PASS after one bounded repair.

Initial issue:

- wide source metadata drifted over the Rat artwork and lost contrast.

Repair:

- footer/evidence source constrained to the dark information side;
- no Rat art, copy semantics or core composition changed.

Strengths:

- strongest scroll-stop format;
- Rat Zero remains the same individual;
- headline is feral while the explanation immediately states the factual basis;
- evidence strip prevents the illustration from becoming unsupported mascot hype.

Watch:

- use this format selectively; if every post is character-dominant, the Rat becomes decoration rather than a signal.

## System-level review

PASS:

- canonical single-color wordmark preserved;
- Geist Sans / Mono roles remain distinct;
- no custom logo glyphs;
- no generic crypto gradient/neon treatment;
- no fabricated live evidence;
- no BUY/SELL framing;
- no unsupported human-identity claim;
- same template system survives 1200×675 and 1080×1080.

The proof workflow now serializes runs to prevent stale concurrent artifact pushes.

## Freeze gate

Do **not** mark these social templates globally frozen until the owner visually approves the rendered proof family.

On owner approval, promote:

- RECEIPT;
- CASE FILE;
- RAT FOUND SOMETHING;

to Brand V1 canonical social composition families and then build platform/export presets on top of them.
