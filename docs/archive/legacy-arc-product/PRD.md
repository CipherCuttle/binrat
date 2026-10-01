# BINRAT V0 PRD

## Product thesis

BINRAT is an ArcPad launch-intelligence and evidence-preservation project. It indexes source-reported launch events, maintains deterministic creator-address provenance and records auditable, time-bound observations. The repository has no website, no visual assets and no authorized frontend direction; earlier mascot or UI copy does not prescribe a future style.

## User problem

A user looking at a new memecoin currently has to manually combine launchpad data, explorer history, creator addresses, holder distribution, social metadata, and later price/liquidity outcomes. BINRAT turns that into one factual, time-bound trail.

## V0 user value

For each ArcPad launch, BINRAT answers:

1. What exactly launched and in which transaction/block?
2. Which creator address did ArcPad report in the launch event?
3. What earlier ArcPad launches reported that same creator address?
4. Is historical coverage complete, partial, or unresolved?
5. Can the underlying facts be replayed from a deterministic receipt later?

The ArcPad-reported creator address is an onchain address, not proof of a human identity, EOA wallet, or ultimate deploying actor.

V0 does **not** classify safety or recommend trades.

## Evidence semantics

Evidence classes: `DIRECT_ONCHAIN`, `DERIVED_ONCHAIN`, `LAUNCHPAD_INDEXER`, `EXTERNAL_METADATA`.

Finding states: `OBSERVED`, `FLAGGED`, `NOT_OBSERVED`, `UNKNOWN`.

Coverage: `COMPLETE`, `PARTIAL`, `UNVERIFIED`.

Missing evidence never silently becomes positive or negative evidence.

## V0 source

ArcPad only. Runtime chain constants are frozen in PR 1 from ArcPad's published mainnet interface; `ARC_RPC_URL` remains provider-configurable.

## Non-goals

V0 has no token launch, wallet connection, smart-contract deployment, trading/signing/private keys, BUY/SELL output, rug probability, frontend, social bot, LLM-generated evidence, Postgres, Redis, or queues.

## Success gate

Run a 72-hour ArcPad observation before building the LP.

Engineering gate:

- >=99% reconciled launch capture versus ArcPad indexer/API where comparable;
- zero unresolved launch identity conflicts;
- deterministic provenance replay;
- crash/restart replay is idempotent;
- bounded reorg repair works.

Volume decision rule:

- >=25 launches / 72h: continue ArcPad-only product experiment;
- 10-24: add a second Arc source before deciding;
- <10: ArcPad-only HOT GARBAGE feed is too sparse.

These volume thresholds are experiment rules, not market claims.
