# BINRAT SHARE CARDS V0

## Objective

Give BINRAT a native, repeatable distribution surface without turning product copy into an investment verdict.

The share card is a projection of already-visible fixture evidence. It is not a second evaluator and cannot create new claims.

## Format

The visual target is a `1200 × 630` social card rendered responsively in the browser.

V0 contains only:

- **HOT GARBAGE** brand language;
- token symbol;
- shortened ArcPad-reported creator address;
- number of prior indexed bags present in the fixture;
- explicit coverage state;
- one bounded BINRAT note;
- receipt reference;
- canonical mascot;
- `FIXTURE // NOT LIVE EVIDENCE` stamp.

## Copy law

V0 post text uses the same factual boundary as THE DUMPSTER.

Allowed examples:

- `ArcPad-reported creator: 0xa71b…0001`
- `prior indexed bags in this fixture: 8`
- `coverage: PARTIAL`
- `binrat: “same address. ninth bag.”`

Prohibited:

- BUY / SELL;
- safe / unsafe verdicts;
- rug/scam labels as factual identity claims;
- probability scores;
- price predictions;
- human identity or wallet-ownership claims;
- invented facts that are not in the source bag/projection.

## Architecture

```text
fixture/public bag
      |
      v
web/share-card.js
      |
      +--> deterministic card model
      |
      +--> deterministic post text
      |
      v
web/app.js
      |
      v
share-card preview + COPY POST
```

`web/share-card.js` is pure: it does not fetch data, call an LLM, mutate evidence, or access a wallet.

## Fixture boundary

V0 is fixture-only.

Every generated post includes:

`FIXTURE // NOT LIVE EVIDENCE`

The stamp is part of deterministic generated copy, not optional UI decoration.

A future live version must consume the frozen public projection contract and change mode/version explicitly; it must not silently remove the fixture stamp on this branch.

## Viral design principle

The share surface should be recognizable before it is informative:

`🔥🗑️ HOT GARBAGE` + huge ticker + rat + compact evidence.

The joke is downstream presentation. Evidence remains upstream authority.

## Acceptance

- deterministic model and post copy;
- explicit `reportedCreatorAddress` semantics;
- fixture stamp is mandatory;
- malformed coverage fails to `UNVERIFIED`;
- malformed address does not become a human-readable identity claim;
- no BUY/SELL/safe/rug/scam/prediction language;
- card uses the byte-pinned canonical web mascot derivative;
- existing read-plane and web gates remain green;
- no live fetch, token launch, trading, signing, transaction submission, or capital authority.
