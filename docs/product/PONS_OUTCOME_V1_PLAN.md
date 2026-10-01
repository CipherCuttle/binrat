# PONS_OUTCOME_V1 — historical outcome contract

**Status:** implementation plan only. No live valuation/outcome claim is authorized by this document.

This plan restores the accepted Rat Trap job: answer **"what happened the other times these paws showed up?"** with reproducible historical context, not a prediction.

## Product target

Fresh Garbage may identify a familiar deployer from canonical Pons launch facts.

**Dig Deeper / Rat Trap** may then show prior projects from that same reported deployer and, only when supported by verified observations, qualified historical outcome fields such as:

- estimated FDV in the launch's quote asset;
- latest supported estimated FDV;
- highest supported observed estimated FDV within the retained observation set;
- time from launch to that observed high;
- lifecycle phase (curve / swept / graduated V4 / rescued) when independently verified;
- fixed-age comparisons (initially 5m / 1h / 24h; later 3d / 7d);
- explicit sample denominators and UNKNOWN/PARTIAL cases.

It must not emit BUY/SELL advice, future price forecasts, rug/safety scores, profitability claims, or human-identity attribution.

## Why "estimated FDV", not market cap

Pons V2 launcher tokens mint their initial supply at construction, but the token inherits ERC20Burnable, so `totalSupply()` can decrease after holder burns. BINRAT also does not currently maintain a verified circulating-supply contract. Therefore:

- **market cap** is prohibited unless circulating supply is separately verified;
- **estimated FDV** = qualified token spot price × `totalSupply()` observed at the **same canonical block** is allowed;
- if quote asset is native ETH, display ETH-denominated estimated FDV;
- do not convert to USD without a separately receipted quote/USD observation;
- if the quote asset is an ERC-20, identify the quote asset and its decimals explicitly; do not silently treat it as USD.

## Pre-graduation Pons authority

Pinned Pons V2 source:
`ponsdotdev/pons-labs@162310fbd1217717e2f5e4cde794d6a11322b469`.

`PonsV2BondingCurve.getReserves()` exposes:
- tradeable quote reserve = phantom quote + tracked quote - pending fee/tax balances;
- tradeable token reserve = tracked token balance.

The contract describes the curve as constant product. At a verified block, the marginal quote-per-token reserve ratio is therefore derivable from the exact curve state, with token and quote decimals applied.

Required reads at the same canonical block:
- curve `getReserves()`;
- curve `pairToken()`;
- curve `graduated()`;
- token `totalSupply()`;
- token `decimals()`;
- quote-token decimals when pairToken is ERC-20;
- canonical block hash/timestamp.

Receipt must bind every input to block number/hash and chain 4663.

### Pre-graduation derived fields

A V1 observation may contain:

```ts
{
  chainId: 4663,
  launchId,
  phase: "CURVE",
  observedBlock,
  observedBlockHash,
  observedTimestampMs,
  quoteAsset,
  quoteDecimals,
  tokenDecimals,
  quoteReserve,
  tokenReserve,
  totalSupply,
  spotQuotePerToken,
  estimatedFdvQuote,
  status: "COMPLETE" | "PARTIAL" | "UNVERIFIED",
  missing: string[]
}
```

Use integer/rational arithmetic internally. Do not round before the final presentation boundary.

## Graduated V4 boundary

Curve state must not be extrapolated after graduation.

A graduated observation requires a separately verified V4 pool identity and state:
- factory graduation receipt / launch record;
- exact pool key / token ordering;
- PoolManager or StateView price state at the observation block;
- quote/token orientation;
- token total supply and decimals.

If V4 pool identity or historical state is missing, the observation is PARTIAL/UNVERIFIED and valuation is omitted. `LaunchSwept` alone does not prove a usable V4 market.

## Observation windows

Reuse the repository's existing immutable horizon pattern rather than inventing retrospective highs from future data.

Initial Pons horizons:
- 5m
- 1h
- 24h

Each observation is created only after the horizon matures and is bound to the first canonical block at/after the target timestamp.

Later, after cost/coverage proof:
- 3d
- 7d

The user-facing "peak" in V1 means **highest supported observed estimated FDV among retained qualified observations**, not all-time-high unless continuous coverage is separately proved.

Example:
- "Highest observed est. FDV (5m/1h/24h samples): 18.4 ETH"
- not "ATH: $42k"

## Rat Trap aggregation

For one familiar deployer, Rat Trap may aggregate previous launches only when each row carries its own receipt.

Example shape:

| Project | 5m est. FDV | 1h | 24h | highest observed | phase |
|---|---:|---:|---:|---:|---|
| $ABC | 3.2 ETH | 8.9 ETH | 1.4 ETH | 8.9 ETH @ 1h | CURVE |
| $DEF | UNKNOWN | 2.1 ETH | UNKNOWN | 2.1 ETH @ 1h | PARTIAL |
| $GHI | 6.3 ETH | 15.0 ETH | 12.4 ETH | 15.0 ETH @ 1h | V4 |

Never remove missing or immature launches from the visible cohort merely because they make the history less impressive.

## Telegram presentation

Fresh Garbage remains short:

> 🐀 SMELLS FAMILIAR.  
> $NEW turned up in Fresh Garbage.  
> Same paws left receipts on $ABC · $DEF · $GHI.  
> That is a trail worth digging. Not a verdict.

Primary action: **Dig Deeper**.

Once Rat Trap has qualified outcome observations:

> 🐀 RAT TRAP  
> These paws have been here before.  
> $ABC · high observed est. FDV 8.9 ETH @ 1h  
> $DEF · 2.1 ETH @ 1h · later data missing  
> $GHI · high observed 15.0 ETH @ 1h  
> 2/3 have complete 24h receipts.

Only here should **Add to Rat Watch** become a prominent action.

## Engineering slices

### O1 — Pons historical capability probe
Implement read-only historical block calls for:
- curve reserves;
- phase;
- total supply / decimals;
- quote decimals.

Run against a bounded real sample. Record provider failures separately from missing protocol state.

Acceptance:
- same block re-read produces the same canonical receipt;
- wrong chain/hash fails closed;
- no remote schema/deploy.

### O2 — Pons outcome receipt
Add append-only D1 schema and deterministic receipt identity for 5m/1h/24h observations.

Acceptance:
- reorg checks;
- maturity checks;
- exact launch/curve/token binding;
- replay stability;
- no USD/market-cap field.

### O3 — Rat Trap projection
Join previous launches to qualified outcome receipts and render:
- per-launch observations;
- missing denominators;
- highest **observed** qualified sample;
- no Watch promotion until this layer exists.

### O4 — V4 graduation continuation
Only after independent pool identity/state proof. Curve-only outcome remains valid and visibly partial until then.

## Explicit non-goals

- no Alchemy/Dexscreener dependency merely to make the card look useful;
- no unaudited external "market cap" API as evidence authority;
- no all-time-high claim from sparse samples;
- no inferred circulating supply;
- no prediction from deployer history;
- no ranking/score that compresses historical outcomes into "good/bad";
- no public activation or merge in this plan.
