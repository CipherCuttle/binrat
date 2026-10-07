# BINRAT Prelaunch Scout V0 — bounded feasibility spike

Date: 2026-10-07

## Question

Can BINRAT detect technically real, institutionally backed crypto projects before an observed public launch without collapsing weak adjacency into "backed by"?

This spike tests the decision rule only. It does not crawl GitHub, testnets, wallets or investor sites, and it does not recommend investments.

## Rule under test

A project becomes a `QUALIFIED_WATCH` only from evidence available at or before the replay cutoff:

1. public code;
2. at least one execution signal: testnet deployment, contract deployment, or audit;
3. at least one typed backing relationship: `LEAD_INVESTOR`, `INVESTOR`, or `STRATEGIC_INVESTOR`;
4. no public-launch receipt observed at or before the cutoff.

A later public-launch receipt is **outcome data only**. It may measure lead time after the decision, but it must never affect whether the project qualified. This is the explicit lookahead-bias guard.

`LIQUIDITY_PROVIDER`, `MARKET_MAKER`, `WALLET_ADJACENCY`, and `UNKNOWN` never count as investor backing.

## Real fixtures

### Taiko — historical positive

- Public repository existed by 2022-07-28: https://github.com/taikoxyz/taiko-mono
- Alpha-1 public testnet announced 2022-12-27: https://www.reddit.com/r/taiko_xyz/comments/zwoz3z
- $15M Series A with Wintermute Ventures and GSR participation reported 2024-03-03: https://defillama.com/raises/gsr
- Mainnet was live on 2024-05-27; repository deployment logs record the launch-day unpause: https://github.com/taikoxyz/taiko-mono/blob/main/packages/protocol/deployments/mainnet-contract-logs-L1.md

Expected replay:

- 2024-03-02 => `TECHNICAL_ONLY`
- 2024-03-04 => `QUALIFIED_WATCH`
- later observed launch in fixture => yes
- measured lead time => 84 days
- 2024-05-27 => `ALREADY_LAUNCHED`

The detector must produce the same 2024-03-04 decision if the future 2024-05-27 receipt is removed. Only the outcome metric is allowed to disappear.

### GTE — current watch fixture

- Public SDK repository created 2025-04-15: https://github.com/liquid-labs-inc/gte-python-sdk
- Testnet usage and Paradigm-led $15M Series A reported 2025-06-23: https://www.theblock.co/news/deals/2025-06-23-paradigm-gte-worlds-fastest-dex-clob-359205
- Code4rena GTE Spot CLOB and Router audit started 2025-07-23: https://code4rena.com/audits/2025-07-gte-spot-clob-and-router
- Wintermute Ventures portfolio lists GTE when checked 2026-10-07: https://www.wintermute.com/ventures/portfolio

Expected result from this fixture on 2026-10-07: `QUALIFIED_WATCH`.

That label does **not** assert that a token or TGE has not happened. It means only that the evidence available to this fixture meets the watch rule and no launch receipt is present in the fixture by the cutoff. A future launch-state resolver needs affirmative, bounded coverage before BINRAT can make a stronger live launch-state claim.

## Controls

The test suite preregisters failure controls:

- public code + testnet, no institutional relation => must remain `TECHNICAL_ONLY`;
- wallet adjacency => must not count as backing;
- liquidity-provider relationship => must not count as backing;
- market-maker relationship => must not count as backing;
- missing source or relation fields => fail closed;
- adding or removing evidence dated after the replay cutoff => must not change the detector decision.

## What this proves

If green, the spike proves that BINRAT can represent and replay the combined signal without violating the claim boundary or using future outcome leakage.

It does **not** prove predictive alpha, profitable token selection, live discovery recall, or acceptable false-positive rates.

## Next falsification gate

Do not build a broad crawler until the rule survives a frozen dataset of at least:

- 20 historical projects that later launched;
- 20 contemporaneous controls that did not meet the outcome;
- point-in-time decision evidence only; later launch outcomes may be attached solely for scoring lead time and precision, never as detector inputs.

Measure:

- days of lead time;
- qualified-candidate precision;
- recall;
- false-positive rate;
- relationship-attribution error rate.

Kill or redesign the idea if the detector cannot materially beat simple public funding/news discovery, or if controls qualify at a similar rate to positives.
