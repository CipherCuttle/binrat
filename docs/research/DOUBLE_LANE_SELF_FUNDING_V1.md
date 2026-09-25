# BINRAT — two-lane self-funding execution contract V1

Status: DRAFT RESEARCH ONLY. Owner discussion 2026-09-25. This is the next-step plan for (A) real Arc+Robinhood intelligence and (B) viable paid service + bounded holder access. It does not change production, final pricing, token rights, legal status, treasury, payment accounts or launch authority. Reference: DUAL_CHAIN_LAUNCH_ARCHITECTURE_V1.md and HOLDER_UTILITY_ECONOMICS_V1.md. PR #35 is stacked on PR #32; frontend PR #31 concurrently edits the canonical roadmap. Do not conflict with that branch.

## Decision

Give everyone independently verifiable free Arc 5042 and Robinhood 4663 research. Sell optional Pro capacity using fiat subscriptions first. Consider approved stablecoin payment processing afterward if Swedish merchant availability and legal obligations are verified. Qualifying BINRAT holders receive optional bounded convenience benefits and a proposed capped discount against Pro, only after the real 4663 token and production holder gate are approved.

A token purchase is NOT project revenue. Holding NEVER yields unlimited RPC, API or fast alerts. Financial survival and launch viability must be evaluated with ZERO token trading-fee revenue.

## 10-stack hostile reasoning

| Lens | Adversarial failure | Corrective invariant |
| --- | --- | --- |
| Economics | Temporary trading-fee spike funds permanent obligations | Budget token fees at zero until measured; paid seats cover recurring operation |
| Incentives | Cheap token can unlock uneconomic free Pro | Holder-only low-cost perks + capped subscription discount; no perpetual unlimited pass |
| Game theory | Flash-rented holdings and multi-wallet farming | Time-bounded verified snapshots, chain-bound wallet proof, one benefit/account and budget cap; disclose imperfect Sybil resistance |
| Architecture | Robinhood outage degrades Arc | Independent workers/checkpoints/health/cost caps; combined read plane without false common head block |
| Security | Fraudulent, replayed, refunded billing grants access | Signed idempotent webhook, explicit refund/revocation, chain/policy-bound sessions |
| Product | Ambiguous Pro and premium truth hiding | Sell measurable capacity/latency; raw receipts always free |
| Growth | Pons traders never use Arc intelligence | Verify two-chain real user tasks, return cohorts and voluntary paid conversion |
| Operations | D1/RPC and Telegram bills rise without revenue | Per-chain spend budgets, paid consumption meter, fail closed for costly optional work |
| Compliance | Utility label assumed exempt; crypto payment treated as easy DIY | Separate service and token legal/tax analysis; reviewed third-party processor |
| Falsification | Launch-week fee windfall looks profitable | Two reconciled billing periods at ZERO token fees and stressed costs before declaring self-funded |

## Service tiers — hypothetical tests, not public promises

**Free:** verified chain-filtered launch feed, Creator Files, source-linked raw receipts, bounded cached Radar, limited basic Watch for BOTH Arc and Robinhood. Quotas must match measured cost. No wallet required.

**Pro:** test USD 19 versus USD 29 monthly as hypotheses; never market an unshipped feature. Sell more chain-aware Watch slots, flexible cohorts, faster bounded alerts, larger documented cached API/export quotas and optional prepaid usage top-ups. No unlimited subscriptions or hidden factual proof.

**Holder companion:** after actual Pons token launch, contract verification, chain-4663 custody proof, independently reviewed balance reader, frozen raw threshold and reviewed entitlement policy, test inexpensive additional convenience plus up to USD 5 monthly discount against a genuine paid Pro seat. Require periodic verified balance snapshots over a published policy window, expiry, replay protection and an explicit maximum per-user and global program infrastructure budget. Snapshots alone do not establish uninterrupted ownership or unique human identity. Eligibility failures degrade only extras, never free factual access.

**Fully free Pro by holding:** DEFER. It is not financially viable as a launch obligation unless an independently funded, time-bounded and replenishable subsidy budget covers actual marginal service plus otherwise-paying customers who switch. Do not imply holder fees are dividends, yield, guaranteed token demand or guaranteed returns. No launch-day staking, buyback or lockup contract is required for token utility.

**Stablecoin checkout:** later, only via a vetted payment processor and compatible compliant settlement asset after merchant onboarding, tax/refund terms, webhook idempotency and chain/network support are verified. Quote products in fiat, reconcile settled amounts, and never treat a raw transfer to a wallet as a recurring subscription. The current Stripe Sweden and Coinbase docs do NOT establish that Swedish BINRAT merchant crypto acceptance is already approved.

## Zero-token-revenue scenarios (invented inputs)

All price and cost values below are sensitivity tests, NOT real BINRAT prices, demand, expected Pons payments or audited accounting. Taxes, founder wage, one-time legal/audit/launch expenses, VAT and other omitted items are additional.

| Case | Payment/refund haircut | Variable cost / paid seat | Monthly fixed cost | Net per seat | Break-even paid seats |
| --- | ---: | ---: | ---: | ---: | ---: |
| USD 19 Pro | 8% assumed | USD 3 | USD 2,000 | USD 14.48 | 139 |
| USD 29 Pro | 8% assumed | USD 4 | USD 2,000 | USD 22.68 | 89 |
| USD 24 discounted Pro | 8% assumed | USD 4 | USD 2,000 | USD 18.08 | 111 |

At 25 full-price USD 29 seats with zero Pons receipts and these assumptions, the modeled monthly contribution is MINUS USD 1,433. If 1,000 accounts each use USD 1/month of holder-only service, that creates USD 1,000 in costs without any new subscription income. Protect both the per-user benefit and the global monthly subsidy cap, including cannibalized full-price subscriptions. The existing offline economics calculator and research tests reproduce these sensitivity cases.

**Cash acceptance gate (proposed):** two actual reconciled monthly payment cycles with collected paid-service contribution (before token fees) >= 1.25 times observed fully loaded recurring operating expense, and an independently funded three-month cash reserve, plus separately budgeted legal, security and launch costs. If demand is lower, maintain a cost-capped truthful beta; do not launch the token expecting trading to rescue it. Annual prepayments have future service/refund liabilities, not instantly earned free cash. This gate does not replace counsel, security or explicit token-launch authority.

## Lane A: actual dual-chain launch evidence — isolated engineering PR

A0. Verify the current Pons V2 4663 factory, hook, deployer, source-compatible event schemas, creator roles, curve buy/sell receipt types, graduation event and any V4 post-graduation adapter against genuine real chain receipts. A token-launch eth_call receipt is NOT an indexer.

A1. Add distinct Pons V2 versioned source namespace and chain registry without changing immutable ArcPad IDs/hashes. Implement bounded read-only 4663 backfill, block/hash checkpoints, chain-specific finality/reorg handling and separate degraded-state/health telemetry. Never convert unknown into zero or safe.

A2. Build real Pons-curve phase-aware activity and source-supported Radar. Do not remap curve data into Arc V3 recipient role or claim wallet human identity. Independently verify V4 graduated-pool events before displaying them.

A3. Make creator Watch subscription, alert ID, cursor and delivery chain-scoped; then expose separately timestamped Arc and 4663 feeds. UI chain selector is LAST and must not falsely announce equal coverage.

Acceptance: at least three verifiable genuine 4663 Pons launches, immutable block-bound launch/role/phase records, replayable 4663 activity, honest per-chain coverage, chain-aware Watch dry delivery, one genuine matured Robinhood replay or clearly PARTIAL supported fields, full unaffected Arc regression. No production D1 write or deploy without separate authority.

## Lane B: paid and bounded entitlements — separate engineering PR

B0. Measure real per-chain D1 rows, storage, RPC/archive requests, alerts, cache misses, historical jobs, retries and customer support. Establish actual fully-loaded budget, per-chain hard caps and a global alert-work queue. D1 Free limit failure must not surprise the operator.

B1. Build provider-agnostic account plan, paid subscription ledger, top-up usage units, per-chain consumption, exact idempotent reserve/consume/refund and fail-closed entitlement policy. Raw public receipts remain independent from paid quotas. Cost-class limits are enforced server-side, not just hidden buttons.

B2. After Swedish merchant/account/commercial review, stage a hosted fiat subscription checkout with signed provider webhooks. Test paid, cancelled, renewed, payment-failed, refunded, chargeback, webhook replay and out-of-order events. No direct client-provided payment success or trusting a static checkout return URL. Published price and tax/refund terms before authorization.

B3. Only after the actual 4663 token, verified 4663 wallet/contract-wallet controls, canonical balance source, raw threshold and legal authorization exist, add versioned HOLDER_BONUS entitlement with cost cap and a paid Pro discount. No active rights derived solely from the candidate token config or Arc wallet role addresses.

B4. Add optional approved USDC/stablecoin processor only after provider confirms this Swedish merchant is eligible, settlement networks are supported and legal/tax/refund duties satisfied. Do not request wallet approvals for a mere login.

Acceptance: no amount of free traffic or holder access can silently exceed server-side monthly cost ceilings; paying customers receive documented benefits on BOTH genuinely available chains; refunds/reorgs/session invalidation fail closed; token fee revenue zero never breaks the subsidy model.

## Integration and immediate-revenue sequencing

I0. Price-test the EXISTING honest Arc research product now with opt-in paying beta customers, if and only if it can deliver a real paid convenience feature; state Robinhood as BUILDING. Do not charge for future 4663 capability as already delivered.

I1. While Lane A implements genuine Pons indexing, Lane B meters costs and implements feature-flagged billing and entitlements without charging anybody. Validate the existing Arc API is unchanged by both.

I2. When both lanes pass exact-head tests + one hostile review and their separate authorities are granted, deliver truthful Arc+Robinhood API parity, paid quota consumption across both chains and cost/coverage displays in the approved frontend PR. Distinct PR owners prevent aesthetic or Telegram regressions.

I3. The product may be technically ready before economics are ready. A credible "self-funding from day one" claim requires the actual collected-cash gate above, including ZERO fee revenue, plus truthful two-chain coverage, separate legal/security/launch permission and verified official identities. No automatic merge, token transaction, public promotion, paid account connection or holder activation.

## Current provider and regulatory facts to confirm before action

Cloudflare current official billing: https://developers.cloudflare.com/workers/platform/pricing/ . Its Workers Paid minimum is USD 5/account monthly; D1 Free has 100,000 written rows/day and 5m read rows/day; paid has metered excess after included monthly amounts. Measure the actual BINRAT account, not pricing-page hypotheticals.

Stripe Sweden official pricing: https://stripe.com/en-se/pricing . Billing pay-as-you-go advertised 0.7% of Billing volume, separate from card/payment processing; combined 8% above is purely an invented margin stress assumption, not a Stripe quote.

Coinbase Payment Acceptance documentation: https://docs.cdp.coinbase.com/api-reference/payment-acceptance/overview ; business onboarding: https://docs.cdp.coinbase.com/api-reference/v2/business-onboarding . These docs describe USDC payment/refund support but do not independently verify Swedish merchant acceptance or supported Robinhood 4663 checkout assets.

Swedish FI token-offer obligations: https://www.fi.se/sv/betalningar/sok-tillstand/kryptotillgangar-och-kryptotillgangstjanster/kryptotillgangar/ ; crypto-service activities: https://www.fi.se/sv/betalningar/sok-tillstand/kryptotillgangar-och-kryptotillgangstjanster/kryptotillgangstjanster/ . EU MiCA Article 4: https://www.esma.europa.eu/publications-and-data/interactive-single-rulebook/mica/article-4-offers-public-crypto-assets-other . Do not assume operating utility exempts a token when intended admission to trading is publicly communicated; obtain applicable counsel decision.

**Authority:** research doc+offline tests only. NO merge, wallet action, contract deployment, token launch, token advertising, live subscription billing, production D1 migration, frontend or Telegram edits.
