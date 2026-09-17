# BINRAT PUBLIC READ PLANE V0

## Objective

Create a strict boundary between BINRAT's internal evidence/indexing state and any consumer-facing web/API projection.

The browser must never read the raw SQLite evidence store directly. Internal field names and inferred semantics must not leak into product copy by accident.

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
PUBLIC JSON / WEB ADAPTER
        |
        v
THE DUMPSTER
```

## Public schema

Schema: `binrat.public-feed/0.1`

Projection version: `BINRAT_PUBLIC_PROJECTION_V0`

The V0 projection exposes only:

- exact launch identity and chain point;
- token/pool addresses;
- ArcPad-reported creator address;
- supplied launch metadata;
- earlier indexed launches with the same reported creator address;
- explicit evidence states;
- explicit history coverage;
- a deterministic projection receipt.

It does **not** expose or infer:

- human identity;
- wallet ownership;
- ultimate deployer identity;
- BUY/SELL eligibility;
- safety/rug/scam scores;
- price prediction;
- outcome, distribution, or sellability claims that are not yet part of the frozen projection contract.

## Creator semantics

The public field is named:

`reportedCreatorAddress`

Never `deployer`, `owner`, `person`, or `walletOwner`.

The only claim V0 makes is that ArcPad reported the address on the launch event and, where evidence exists, that the same reported address appears on earlier indexed launches.

## Coverage law

`COMPLETE`, `PARTIAL`, and `UNVERIFIED` describe the supplied indexed-history coverage only.

No prior matching launch may be presented as affirmative/positive evidence unless history coverage is explicitly `COMPLETE`.

With `PARTIAL` or `UNVERIFIED` history, absence of a prior match must remain `UNKNOWN`.

## Receipt law

Every public projection binds:

- projection version;
- chain ID;
- as-of block and block hash;
- history coverage;
- canonical input digest;
- canonical output digest.

The receipt is projection identity, not a claim that the underlying token is safe or truthful.

## Browser boundary during the 72-hour experiment

The browser remains fixture-only.

`web/data-source.js` is the only browser data-source entry point and currently returns `FIXTURE` mode. The app fails closed if that mode changes unexpectedly.

No network fetch to live BINRAT evidence is authorized in V0. After the HOT GARBAGE experiment matures, a later branch may add an `EVIDENCE_PROJECTION` adapter only if the experiment/read-plane gates pass.

## Acceptance

- deterministic output independent of input ordering;
- future-dated launch/fact input fails closed;
- mismatched provenance fails closed;
- public field is `reportedCreatorAddress`;
- incomplete history cannot silently become positive evidence;
- output has a digest-bound projection receipt;
- web consumes data through `web/data-source.js` only;
- browser remains fixture-only and noindex;
- no live-data, token-launch, trading, signing, transaction-submission, or capital authority is introduced.
