# BINRAT WEB V0 — THE DUMPSTER

## Objective

Build the consumer-facing BINRAT shell before the 72-hour HOT GARBAGE experiment matures, using deterministic fixtures only.

The web branch must not affect the experiment branch, token launch, trading, signing, private keys, transaction submission, capital authority, or BUY/SELL output.

## Product language

- product: **BINRAT**
- ticker: **$BINRAT** — not launched
- live-feed concept: **HOT GARBAGE**
- product surface: **THE DUMPSTER**
- historical provenance: **TRASH TRAIL**
- evidence artifact: **RECEIPT**
- primary line: **He gets the scraps. You get the receipts.**

The metaphor is literal: the rat lives in a dumpster and rummages through new token launches as if they are garbage bags, looking for scraps of useful evidence.

## V0 pages/surfaces

V0 is intentionally one page plus an interactive detail drawer:

1. hero / brand premise;
2. HOT GARBAGE fixture feed;
3. bag detail drawer;
4. TRASH TRAIL historical rows;
5. RECEIPT evidence summary;
6. HOW HE DIGS explainer;
7. claim-boundary warning.

## Visual direction

- gritty retro pixel / terminal aesthetic;
- dirty industrial panels rather than glossy crypto cards;
- dumpster green, asphalt black, dirty bone, cyber-eye red, grease orange, dusk purple;
- red is semantic: active scanning, findings, warnings;
- no glossy coins, Web3 gradients, chrome logos, astronauts, generic circuit-board imagery, or finance-dashboard styling.

The canonical source mascot is the approved 512×512 generated BINRAT artwork. The web shell serves a verified 384×384 q80 WebP derivative at `web/binrat-mascot-384.webp`. Source and derivative digests are frozen in `docs/BRAND_ASSET.md`. Do not redesign or silently replace the mascot without an explicit brand decision.

## Fixture boundary

Every displayed token/address/outcome in WEB V0 is synthetic fixture data.

The UI must visibly say `FIXTURE MODE` and detail receipts must say `NOT LIVE EVIDENCE`.

Fixture output must never be represented as a live Arc observation.

## Claim boundary

BINRAT may say:

- ArcPad reported address X on launch Y;
- the same reported address appeared on earlier ArcPad launches;
- observation Z exists with coverage state C;
- evidence is missing or unresolved.

BINRAT must not say:

- a token is safe;
- a token is a scam/rug as a factual identity claim;
- a person controls an address;
- repeated addresses prove common human ownership;
- BUY / SELL / BUY_ELIGIBLE;
- price will increase/decrease;
- a percentage scam/rug probability.

## Architecture

No framework is introduced for V0.

```text
web/index.html
   |
   +-- web/styles.css
   +-- web/evidence-semantics.css
   +-- web/binrat-mascot-384.webp
   +-- web/app.js
          |
          +-- web/fixtures.js
```

The future live-data integration replaces `fixtures.js` with a read-only API adapter. DOM structure and product semantics should not depend on the data source.

## Acceptance

- fixture feed is understandable in under 10 seconds;
- cards expose creator history before generic contract boilerplate;
- detail drawer clearly distinguishes observation, coverage, Trash Trail, and receipt;
- verified canonical mascot derivative is used in the hero;
- mobile layout remains usable;
- keyboard Enter/Space opens a bag and Escape closes the drawer;
- reduced-motion preference disables animation;
- `pnpm web:check` passes;
- existing backend build/tests remain green;
- no wallet connection, token contract, holder gating, trading widget, or live-data claim.
