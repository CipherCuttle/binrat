# BINRAT PUBLIC READ PLANE V0

## Objective

Create a strict boundary between BINRAT's internal evidence/indexing state and any public JSON projection.

API consumers must not read the raw SQLite evidence store directly. Internal field names and inferred semantics must not leak into published facts.

## Frozen pipeline

```text
RAW CHAIN OBSERVATIONS
        |
        v
INTERNAL EVIDENCE / PROVENANCE
        |
        v
PUBLIC_PROJECTION_V0
        |
        +--> digest-bound projection receipt
        |
        v
PUBLIC JSON PROJECTION
```

## Public schema

Schema: `binrat.public-feed/0.1`

Projection version: `BINRAT_PUBLIC_PROJECTION_V0`

The V0 projection exposes only:

- exact launch identity and chain point;
- token/pool addresses;
- ArcPad-reported creator address;
- supplied launch metadata;
- earlier launches with the same reported creator address that are actually present in the supplied projection input;
- explicit evidence states;
- a frozen `UNVERIFIED` history-coverage state;
- a deterministic projection receipt.

It does **not** expose or infer:

- human identity;
- wallet ownership;
- ultimate deployer identity;
- BUY/SELL eligibility;
- safety/rug/scam scores;
- price prediction;
- outcome, distribution, or sellability claims that are not yet part of the frozen projection contract.

## Launch identity law

Before publication, `PUBLIC_PROJECTION_V0` independently rederives both canonical launch identity and source-event identity from their frozen authority fields.

A supplied `launchId` or `eventId` is not trusted merely because it arrived from an internal caller. Any identity drift fails closed before provenance is evaluated.

## Creator semantics

The public field is named:

`reportedCreatorAddress`

Never `deployer`, `owner`, `person`, or `walletOwner`.

The only claim V0 makes is that ArcPad reported the address on the launch event and, where evidence exists, that the same reported address appears on earlier launches present in the projection input.

## Provenance integrity law

A supplied provenance fact is not trusted merely because its visible creator/block fields match a launch.

Before publication, `PUBLIC_PROJECTION_V0` independently rebuilds the expected provenance fact from the canonical launch observation and requires the supplied fact to match the deterministic:

- fact kind;
- fact ID;
- evidence digest;
- creator address;
- block number/hash;
- log index;
- source event ID.

Fact identity or digest drift fails closed. A projection receipt may cite only provenance facts whose identity and digest have been independently reconstructed.

## Coverage law

`PUBLIC_PROJECTION_V0` **cannot claim complete history coverage**.

Its history coverage is frozen to:

`UNVERIFIED`

Presence is still useful: if prior matching launches are actually present, BINRAT may note them.

Absence is never promoted to affirmative evidence in V0. If no prior match is present, the public state remains `UNKNOWN`.

A later projection version may introduce `PARTIAL` or `COMPLETE` only after a separate, evidence-backed coverage authority exists. A caller-provided string or digest is not enough to establish completeness.

## Receipt law

Every public projection binds:

- projection version;
- chain ID;
- as-of block and block hash;
- frozen `UNVERIFIED` history coverage;
- canonical input digest;
- canonical output digest.

The receipt is projection identity, not a claim that the underlying token is safe or truthful, and not proof that the supplied history is exhaustive.

## Backend-only consumer boundary

No frontend, browser adapter or static site is part of this branch. Any future UI must validate source roles, checkpoints, coverage and receipt fields against the actual public contract and obtain a new owner-approved visual direction.

## Acceptance

- deterministic output independent of input ordering;
- future-dated launch/fact input fails closed;
- malformed as-of chain authority fails closed;
- noncanonical launch/event identity fails closed after independent rederivation;
- mismatched provenance authority fails closed;
- provenance fact ID/digest drift fails closed after independent reconstruction;
- public field is `reportedCreatorAddress`;
- V0 history coverage is always `UNVERIFIED`;
- absent history is always `UNKNOWN` in V0;
- output has a digest-bound projection receipt;
- public API consumer validation is source-bound and preserves receipt and coverage fields;
- no live-data, token-launch, trading, signing, transaction-submission, or capital authority is introduced.
