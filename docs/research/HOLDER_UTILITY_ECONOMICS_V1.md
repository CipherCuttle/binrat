# BINRAT — holder utility and unit-economics lab V1

Snapshot: 2026-09-25; standalone research based on the blocked Pons candidate at PR #32 head f1411ab83eddb25ed18c88584b6e26e75e86f163. No new holder policy, token allocation, paid service or production entitlement is approved by this document. ALL numeric scenarios below are invented stress inputs, not revenue forecasts or proposed token prices.

## Core product hypothesis

Public facts and reproducible receipts remain available for free. Token holding, if separately activated, might provide measurable convenience: more Radar addresses, more Watch slots, richer filters, fresher operational alerts and greater API capacity. These are service entitlements, not safer-token rankings, truth adjudication, investment signals, profit share or APY. Off-chain Rat Credits/reputation stay distinct.

Current verified engineering: free Radar and public receipts exist; holder engineering passed on its own earlier conditions but current 4663 candidate FREE-only login and probe are deliberately separate and fail closed. There is no verified Pons token, approved minimum holding threshold, active production entitlement or Robinhood funding observer. Never present this proposed menu as shipped.

Previous market-fit mismatch: BINRAT's existing implementation serves Arc 5042 while proposed token buyers enter through a Robinhood 4663 Pons listing. **Owner direction as of 2026-09-25 is meaningful Arc AND Robinhood intelligence at intended token launch.** This is an implementation and evidence gate, not a current shipped feature. Independently verify 4663 Pons launch ingestion, creator-role evidence, live activity and basic Watch before replacing this gap with a dual-chain claim. See DUAL_CHAIN_LAUNCH_ARCHITECTURE_V1.md.

## Product menu for testing only

| Surface | Public base (existing intent) | Candidate holder benefit (NOT SHIPPED) | Alternative for professionals to test |
| --- | --- | --- | --- |
| Raw receipts, Creator Files, Replay, evidence coverage | Public, identical truth | Identical public truth | Identical public truth |
| Rat Radar | A genuinely useful bounded five-address free view with reasons and links | More addresses, filtering and factor decomposition subject to evidence-quality proof | Paid independent research seat where legally/operationally permissible |
| Rat Watch | One basic slot as the proposed free UX target; actual deployed limits require readback | More saved queries/slots and lower latency subject to real measured infrastructure cost | Metered alert plan with service-level transparency |
| API/exports | Public receipts accessible without tokens | Larger read quotas and derived convenience exports after backend review | Stable-currency subscription or ordinary SaaS invoice |

The table is a product experiment, not a representation that one slot or paid checkout is active now. Do not gate public proofs of any factual ranking. Do not promise 4663 launch intelligence until a genuine indexed 4663 research source is verified.

## Project cash economics: keep revenue sources separate

**Observed facts from the old read-only 2026-09-22 Pons checker**: candidate launch config had 1% curve fee (100 bps), protocol fee share setting 30% (3000 bps), 0 additional creator tax, buybacks disabled. These values are historic observations/expected checker constants, NOT fresh economics, actual earned fee income, or a validated all-market effective project take. Graduation, protocol-controlled switches, actual fee collection and subsequent swaps can change what the project receives.

Simple sensitivity variables, **not forecasts**:
- V = eligible observed monthly trading volume, measured in a consistent USD-equivalent after independently verified on-chain accounting.
- r = actually realized **effective project creator-fee receipts / eligible volume**; model candidate r in {0, 0.10%, 0.35%, 0.70%}. These are illustrative test values, not Pons's guaranteed project rate.
- P = independent paying research seats, p = assumed $12 monthly nominal price, m = assumed 5% merchant haircut; s = assumed $2 variable monthly operating cost per paying seat.
- C = assumed $600 monthly fixed infrastructure, auditing/compliance accrual and baseline support.
- Contribution before taxes, legal costs beyond C, ETH conversion slippage and founder salary = V*r + P*p*(1-m) - P*s - C.

This deliberately does **not** count a token purchase as project revenue. Buying from another holder transfers funds to the seller; a buy does not itself fund the project except via verified contract fee flows. Holder access creates capacity/support costs; it is NOT a subscription payment and does not imply yield. Project revenues are not holder dividends.

Worked stress cases using invented inputs, USD equivalents:
- V=$0, P=0: $0 project receipts and -$600 contribution.
- V=$100,000, r=0.10%, P=0: $100 fee receipts; -$500 contribution.
- V=$100,000, r=0.35%, P=25: $350 fee receipts; $285 net subscription receipts; $50 variable seat cost; -$15 contribution.
- At the same assumed rate, seat mix and costs, whole-dollar break-even eligible volume is $104,286.
- V=$1,000,000, r=0.10%, P=0: $1,000 fee receipts; +$400 contribution before omitted costs.

To reproduce and vary, run: node scripts/research/holder-economics.mjs --volumeUsd=100000 --effectiveFeeBps=35 --paidSeats=25. The script uses integer-cents math, validates inputs and emits a scenario object explicitly labelled ILLUSTRATIVE_NOT_FORECAST. Root pnpm check tests its invariants. No RPC, wallet, price feed, checkout or production financial statement is involved.

## Holder threshold and opportunity cost, NOT a token-price model

The candidate Pons config currently expects 1 billion tokens (18 decimals), but only an executed canonical token can establish actual supply and decimals. Illustration at a hypothetical fixed 1bn supply:

| Hypothetical raw-balance policy | Token amount | Share of hypothetical full supply |
| --- | ---: | ---: |
| Low | 100,000 | 0.01% |
| Mid | 500,000 | 0.05% |
| High | 1,000,000 | 0.10% |

Under deliberately hypothetical fully diluted aggregate values of $250k / $1m / $5m, the *mark-to-market* notional for the low threshold would be $25 / $100 / $500; mid $125 / $500 / $2,500; high $250 / $1,000 / $5,000. These are **stress inputs**, not BINRAT market-cap predictions, practical acquisition costs, resale guarantees or a commitment to choose any threshold. Thin liquidity, spread, slippage and volatility can make actual purchase/unwind expense considerably different from a nominal quote. A policy that checks wallet balance does NOT prove ownership of that fraction of circulating supply or one unique user.

Freeze any threshold only after: real token/decimals and canonical block; observed distribution and contract-wallet concentration; held-out projected user tiers and operational cost; account/wallet control verification; snapshot finality/reorg semantics; stale-session invalidation; owner/legal approval. An EOA-only 4663 candidate may exclude contract wallets; disclose/support EIP-1271 through separate review, not an unconditional access promise.

## Smallest honest demand experiment

Recruit 12–18 opt-in non-affiliated testers split evenly between (A) active Arc launch-evidence researchers and (B) Pons/Robinhood launch discoverers. Do not cherry-pick existing $BINRAT fans or claim population-level significance. Randomize two *equivalent evidence-grounded* descriptions: convenience via a conditional token-holder gate versus an ordinary monthly research seat. The free task is identical.

Before any price prompt: each tester must find a real launch from free Radar, inspect its Creator File/Replay receipt, correctly state source coverage and identify what the evidence does NOT establish. Record completion, misinterpretation and time. Afterward, offer a clearly labelled no-payment fake door for additional filters/alerts and a separate optional research-seat waitlist; collect explicit opt-in and follow-up permission only. Never request a wallet deposit, pre-sale money or implied ROI.

Pre-registered *product decision heuristics* (tiny-sample gates, NOT statistical significance):
- If fewer than half in either segment finish the free evidence task unassisted, stop optimizing holder price or tier; repair comprehension/data first.
- If either segment does not request further depth after completing the task, do not infer holder demand from clicks or token-meme enthusiasm.
- If demand for conditional token-gated use is weak but demand for an independent seat persists, test the seat without coupling it to token inventory.
- If the Pons/Robinhood group cannot identify relevant value in Arc-only coverage, validate actual cross-chain use cases before investing in token-gated utility.

The first observational cohort should measure alert freshness, support cost per active watch slot, the fraction of Ranked Radar entries with fully public receipts, return task completion, and how much extra depth costs to deliver. Never judge demand from Discord sentiment, simulated purchases, social impressions or a token-price chart.

## Kill / defer criteria

Do not ship a holder gate with unverified token/threshold/source, or a fee-funded runway forecast with no real observed Pons inflows. Kill any exclusive feature that hides underlying factual receipts, invites investors to expect returns, or lets holdings influence the result of an investigation. Defer costly API/Radar depth until at least some users finish and request the free product's real research workflow.

Research verdict: SMALL EXPERIMENT for utility/WTP; DEFER monetized holder activation until actual token, credible demand, verified service costs, independent legal review and 4663 technical proof.

## Dual-chain product decision and cost stress (2026-09-25)

Two-chain research expands the potential useful audience but incurs an additional actual Pons indexer, RPC/archive and backfill path, chain-scoped Watch and alert delivery, larger D1 budgets and regression work. Separate usage and revenue by chain; do not count the same user twice or assume a Pons token buyer uses Arc research. All original $600, $100k and 0.35% examples remain synthetic sensitivity baselines, not dual-chain launch budgets.

At zero token revenue and the original invented $12/seat minus 5% payments minus $2 variable cost (= $9.40 nominal monthly contribution per paying seat), illustration:
- $600 fixed budget: 64 seats to cover it.
- $1,200 fixed budget: 128 seats.
- $2,000 fixed budget: 213 seats.
- $5,000 fixed budget: 532 seats.

At $2,000 fixed costs, zero verified token fees and 25 paid seats, contribution is **-$1,765/month** before omitted items. Even an unrealistically generous 0.35% realized effective project fee rate requires ~$504,286 eligible monthly trading volume in that example to break even; do not label that a Pons forecast. Test these with --fixedCostUsd=2000 in the independent offline calculator.

Operating rule: preserve public receipts on both indexed chains; put per-chain quotas and spending controls on expensive high-frequency Watch, historical backfills and bulk API access. A Robinhood RPC/D1 surge must not take Arc public receipts down. If budget collapses, visibly downgrade update freshness instead of silently returning 'nothing happened'. Charge for optional research service capacity independently of owning the token, when legal and operational gates permit. Premium wallet entitlement remains inactive until actual 4663 canonical token and chain-bound eligibility are reviewed. Free dual-chain value must be real before pricing it.
