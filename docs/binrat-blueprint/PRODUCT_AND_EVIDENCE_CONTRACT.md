# Product and evidence contract — Pons-first BINRAT

**Status:** owner-accepted feature direction, with explicit research and deployment gates. This is not a claim that features already run.

## Audience, jobs and presentation

Primary audience: impatient Pons/Robinhood memecoin explorers who want to know **what just launched, why it's interesting, whether prior related launches lasted, who is observably active and what to monitor**. Avoid technical jargon in the first five seconds. Allow deep receipts without degrading novice comprehension. Secondary audience: researchers wanting complete underlying facts and reproducible analysis.

The canonical journey is **Fresh Garbage → Dig Deeper → Rat Trap → Rat Watch**; optional advanced research/API later. The rat presents interesting **facts as a story**, not a buy/sell recommendation. Never use a conversational bot as the mandatory gateway to factual data.

For each surface render: the main verified/qualified finding; at most three short supporting observations initially; a single clear primary next action; evidence count and freshness/coverage; optional detail/receipts. Copy can be cheeky (e.g., "THIS FUNDER'S BACK") but the explanation must specify precisely what was observed. The same structured findings feed website and Telegram; platform-specific personality may vary, facts may not.

## Feature-to-data map

| Feature | User-facing job | Evidence needed before truthful activation | Limit |
|---|---|---|---|
| Fresh Garbage | Discover new Pons V2 tokens | Exact pinned factory event, chain, token, launch/curve, originalDeployer role, tx/block/log | No fake LIVE from old demos |
| Dig Deeper | Understand current launch | Verified phase and coverage, curve activity, economics, source-linked receipts | Missing V4 shown as partial |
| Funding Trail | Find direct funding sources | Relevant native ETH and ERC-20 transfer evidence into verifiably relevant launch address | Transfer does not prove owner |
| Familiar Faces | Find recurring early buyers | Trade receipts with factual buyer/recipient roles in comparable Pons launches | Router is not automatically true trader in V4 |
| Early Wallets | Observe repeated early entries | Consecutive cohort, precise trade timing, balances and phase; skip unreliable matching | No "smart money" or guaranteed profitability |
| Rat Trap | Understand previous projects linked to a funder | Verified funding paths + complete observed prior launch inventory + price/time evidence as available | Known services/unknown origin labelled |
| Burn History | Compare prior launch outcomes | Complete available chronological price/quote history with source/coverage | No selective survivor-only history |
| Exit Door | Explore indicative sale size and impact | Verified current pool/curve, fee/tax mechanics, quote/simulation at explicit block and size | No guaranteed execution or recommendation |
| Holder Movement | See major observed balance changes | Verified token transfers/balance observations, supply/coverage | Transfer ≠ sell; contracts/LP/service tags |
| Graduation Watch | Track real lifecycle | Separate `CurveBuy`/`CurveSell`, `LaunchSwept` and `PoolGraduated` plus independently verified V4 pool | Swept is not V4-ready |
| Creator Economics | Identify configured fees and role changes | Read exact Pons V2 configs / historical contract state and role-change events | `originalDeployer` ≠ creator fee recipient |
| Trade Activity | Contextualize trading breadth | Verified curve and, when present, V4 events with participant-resolution limits | Wash trading/concentration caveats |
| Shared Funding | Show recurrence across apparently separate launch addresses | Multiple independently verified links to same direct or justified upstream address | Do not imply shared human |
| Rat Watch | Alert on explicit supported events | Canonical new finding + eligibility + dedupe + chain-scoped cursor + delivery status | No promised latency until measured |

## Rat Trap dossier

The hero answers: **"This address funded another Pons launcher. What happened when it funded previous launches?"** Show the exact funding path, quote asset and amount, time between observed funding and verified launch, known service labels and proof links. The optional graph appears **only when multiple verified relationships genuinely clarify something**; otherwise use a chronological receipt trail. A multi-hop path is a documented chain of transfers, not proof of same controller. No claimed "average founder hop count."

### Temperature gauge: what we measure, not what we predict

Display **separate** (1) funding activity, (2) historical token behavior and (3) exit liquidity. A single hotness/safety/profit score is prohibited. The historical gauge can show observed previous-launch peak, latest supported valuation, median time to peak, drawdown age, and selectable 6h/24h/3d/7d windows. Show full prior sample and denominators, not only impressive tokens.

- **Peak price:** source-derived, event-window-qualified observed price, not necessarily a realizable fill. Reject/flag obviously unreliable isolated or wash-like observations where supportable. Record pair asset, timestamp, phase, pool, price method and freshness.
- **MC versus FDV:** show market cap only if genuine circulating supply is verified; otherwise show clearly marked *estimated fully diluted valuation*, or token/ETH quote prices when USD conversion is unavailable. Do not mix native ETH-quoted and other pair-token valuations into an unqualified USD table.
- **Lifespan:** a declared operational metric, initially elapsed time from launch to first **sustained** >=80% drawdown from a qualified observed peak. Document sustain interval and observation cadence before implementation. This is not project death, rug evidence or a return forecast. Compare at fixed token ages. Exclude immature tokens from "survived N days" denominator, but show them as ongoing/censored; do not remove unknowns.
- **Averages:** median and sample counts are usually more useful than means for skewed peaks/lifespans; show both when interpretable and never fabricate missing inputs. Ten comparable mature launches was only a *proposed display floor*, not statistical validity. Always compare the funder's cohort against contemporaneous ordinary Pons launches before calling a pattern unusual.
- **Curve/V4:** event reconstruction must cover the Pons curve plus independently linked postgraduation Uniswap V4 events. A missing phase means **PARTIAL**, not ATH. Event price alone cannot establish executable position returns; any scenario needs size, tax/fee, depth and realistic notification delay.
- **No future leak:** when replaying historic alerts, use only facts available at the simulated alert time. A pattern identified retrospectively cannot be advertised as a past live discovery.

Fictional examples may illustrate "$MOLD peaked at X, now Y; 6/9 faded inside 3 days." Mark every fictional fixture **DEMO**, never visually indistinguishable from real live findings.

## Evidence, roles and honest UI states

Each structured finding must expose at least: `chainId`; source/protocol version; observed on-chain role; asset; phase; exact tx/block hash/log reference where applicable; observed time and as-of block; computation/projection version; scope/coverage; known exclusions; relevant raw receipts. Do not force cross-chain identities or compare two different chain heights as one instant.

**Evidence classes:** DIRECT_ONCHAIN receipt, DERIVED_ONCHAIN reproducible calculation, LAUNCHPAD_INDEXER claimed role, EXTERNAL_METADATA (untrusted until corroborated). **Display states:** OBSERVED, NOTED/FLAGGED with qualification, UNKNOWN, NOT_OBSERVED *within stated coverage*; coverage COMPLETE, PARTIAL, UNVERIFIED and separate STALE/PROVIDER_ERROR. "We didn't see it" is not "it never happened." Provider failure is not a benign empty feed.

Pons V2's factory `TokenLaunched` provides `originalDeployer`; the initial three-receipt proof has **null fee recipient** and proves no funder relation. Contract reads at an appropriate verified historical block are needed for other roles. Never infer a person, insider, economic coordination or common controller solely from address/transfer patterns. Fact rows and narrative copy must share one source.

## Alerts and quota

Potential alerts: watched funder sends relevant funding; a newly funded wallet launches on Pons; supported recurring buyer activity; lifecycle change; unusual observable holder/exit activity if source coverage permits. Separate event existence from alert delivery and perceived early-entry advantage. Dedupe by actual event/chain/subscription, support digest and rate limits, disclose latency and stale provider status. Telegram bot and web read the same factual bundle. Trial and tier quotas must cap work at origin and shared collectors should not rerun per subscriber.

## Monetization boundaries

**Free:** live verified discovery where operational, basic public histories, original receipts, honest historical thermometer and limited bounded Watch. **Optional Pro:** additional watch slots, advanced alert filters, custom comparable historical windows, deeper investigations and exports, metered convenience. **Later researcher/API tier:** prepaid capacity and reproducible evidence bundles. The previously discussed $19/$29 figures are experiments, not promised prices; no unlimited token-holder access, hidden proof or revenue assumption from BINRAT token trading. Billing/legal/compliance are independent activation gates.

## Release acceptance

A feature cannot show LIVE before verified source ingestion, coverage semantics, quality fixtures, mobile/desktop UI states, evidence-link reproducibility and appropriate notification/latency/cost tests. If a feature is unsupported, show an honest future/partial/unknown presentation or omit it—not a synthetic "active" badge.

Sources: [Pons independent receipt proof #40](https://github.com/CipherCuttle/binrat/pull/40), [pinned Pons V2 source](https://github.com/ponsdotdev/pons-labs/tree/162310fbd1217717e2f5e4cde794d6a11322b469/contractsV2/src/v2), [existing PRD](https://github.com/CipherCuttle/binrat/blob/feat/binrat-north-star-slice-g0-g2/docs/PRD.md), [research dual-chain proposal](https://github.com/CipherCuttle/binrat/blob/research/pons-gates-holder-econ-v1/docs/research/DUAL_CHAIN_LAUNCH_ARCHITECTURE_V1.md).
