# BINRAT FAIR LAUNCH DOCTRINE V0

Status: planning / pre-launch design  
This document is not a statutory MiCA crypto-asset white paper and is not legal, tax, or investment advice.

> **Successor selection (2026-09-24): Robinhood Chain 4663 / Pons V2 is the owner-selected conditional token-launch direction.** This document still contains the frozen *historical* ArcPad V0 findings below. See [Pons canonical transition](PONS_CANONICAL_TRANSITION_V1.md). They are not Pons guarantees. Launch configuration, runtime authority, public marketing and token launch remain **BLOCKED** pending an independently reviewed migration, current Pons verification, owner inputs and applicable legal gates. Existing Arc intelligence stays on 5042.

## Intent

BINRAT intends to fair-launch `$BINRAT` early.

The project will not pretend the token is appearing only because a fully mature protocol already needs it.

The reasons are explicit:

1. **bankroll the build** — disclosed project/creator fee revenue helps fund engineering, infrastructure, research, security, design, distribution, and operations;
2. **create a native culture asset** — BINRAT is deliberately memetic and should have a degen/community layer;
3. **ship utility progressively** — token utility grows as real product capabilities ship;
4. **coordinate a future evidence network** — later stages can use token collateral for adversarial contribution mechanics.

None of these statements is a promise of token appreciation or holder return.

## Fair means fair access, not no project revenue

The target launch has:

- no private presale;
- no VC/insider discount;
- no hidden team allocation;
- one public market;
- public contract address;
- public launch mechanics;
- disclosed creator/project fee route;
- disclosed founder/project purchases, if any;
- disclosed treasury wallets;
- no mint/pause/blacklist authority where the selected launch contract provides those guarantees;
- locked liquidity where the selected launch contract provides that guarantee.

Project revenue is not hidden. It is part of the design.

## Historical ArcPad launch candidate (superseded for token planning)

The former candidate rail was ArcPad's Arc-mainnet USDC standard creator-rewards path. The dated `LAUNCH_MECHANICS_VERIFICATION_V0` receipt independently established that this variant currently provides:

- fixed 1,000,000,000 token supply;
- no presale;
- no team allocation;
- launch directly into a Uniswap V3 pool;
- an initial position minted to a non-upgradeable locker whose observed runtime exposes no withdrawal, position-transfer, or decrease-liquidity path;
- an optional same-transaction creator first buy through the new public pool, with privileged first-position ordering that must be disclosed if selected;
- a creator claim on 50% of collected quote-side USDC fees and an ArcPad treasury route for the other 50%;
- launch-token-side pool fees routed to the dead address;
- a temporary 2% per-recipient cap lasting exactly 1,200 blocks, which is not Sybil resistance;
- an ArcPad launcher-owner power to redirect future creator quote-fee accrual.

The position can move out of range and cease being economically active even though its NFT cannot be withdrawn under the observed runtime. The observed initial mint also leaves sub-token raw-unit dust in the launcher, so BINRAT must not describe the allocation as literally 100% of raw units entering liquidity.

The canonical receipt is `docs/LAUNCH_MECHANICS_VERIFICATION_V0.json`, summarized in `docs/LAUNCH_MECHANICS_VERIFICATION_V0.md`. ArcPad contract source was not available in a form that could be matched to deployed bytecode; the ArcPad findings are therefore on-chain verified or retained as platform claims, never source-verified.

`docs/BINRAT_LAUNCH_CONFIG_V0.json` binds that receipt to the owner-selected project roles. Treasury is `0xab063A9b53a2Ab832a941aE5890ea05c1672339D`; project/creator fee recipient is `0xba5Ee49734b50Cf62d0B538584fbaC0eFFB79866`. They are separate, non-interchangeable owner declarations, not custody or on-chain execution proof. The privileged first buy, private presale, discounted insider round, hidden team allocation, and privileged founder/project launch allocation are all disabled or none. A founder/project ordinary public-market purchase at launch is not planned.

BINRAT must re-verify the live app routing, deployed bytecode, state, fee authority, and current ArcPad terms immediately before launch. Product docs and this dated receipt are not perpetual contract authority.

That verification must produce a dated launch-mechanics receipt binding the contract addresses, relevant code/immutability properties, fee routes, liquidity-lock mechanics, source documents, and verification timestamp used for the launch authorization decision.

## Treasury doctrine

The project should publish a treasury/funding surface before or at launch.

It should show at minimum:

- treasury addresses;
- creator-fee recipient address;
- cumulative token-related USDC inflow;
- categorized project outflow;
- current runway/balance where operationally safe;
- links to on-chain transactions;
- material changes to treasury policy.

Suggested public categories:

- infrastructure / data;
- engineering;
- security / audits;
- research / bounties;
- design / distribution / community;
- legal / compliance / operations.

Do not fabricate fixed percentages before the operating budget actually exists.

## Founder exposure

A fair launch should not conceal founder inventory.

If the founder/project wants token exposure:

- acquire it through the same public market available to everyone;
- disclose the relevant wallet(s);
- disclose any launch-block/dev-buy mechanism used;
- do not relabel a privileged allocation as a market purchase.

The cleanest claim is the claim that can be verified on-chain.

## Utility ladder

Capability and utility status comes from `docs/CAPABILITY_MANIFEST_V0.json`.

The status model distinguishes:

- **ENGINEERING_PASS** — reviewed implementation passed engineering;
- **DEPLOYED** — referenced implementation is deployed;
- **PUBLIC_LIVE** — deployed capability is authorized for public use;
- **BUILDING**;
- **PLANNED**;
- **EXPERIMENTAL**.

### Launch / early utility

Candidate early surfaces:

#### Rat Radar depth
Rat Radar should provide a genuinely useful public watchlist while reserving higher-cost operational depth for eligible holders.

Public users should retain access to exact addresses on a bounded watchlist, sample size/coverage, basic inclusion reasons, and the receipts needed to verify factual claims.

A wallet that proves control and satisfies a publicly frozen $BINRAT balance threshold may unlock deeper ranking coverage, richer factor decomposition, live activity views, custom filters/cohorts, larger watch capacity, and later API/webhook access.

The holder gate sells depth, speed, scale, filtering, and convenience. It must not hide or rewrite factual receipts.

The initial balance threshold may be derived from a percentage of fixed total supply, but the final threshold must be frozen only after distribution and price-sensitivity simulation. The product must describe the actual balance test precisely rather than imply control of a percentage of circulating supply.

Pre-token Holder Gate V0 keeps eligibility behind a provider interface. Deterministic fixtures may exercise the policy in tests, but production resolves to FREE unless canonical token configuration and a separately reviewed balance source both exist. A configured address or threshold alone is not sufficient to activate HOLDER. Wallet control uses message signing only; it never requests a transaction, gas, approval, transfer, or private key.

#### Rat Watch capacity
Token holding/locking can unlock additional watch slots, richer alert configuration, or community alert channels.

#### Rat Den
Optional post-launch holder-gated community and product surfaces.

Core receipts and factual evidence must not become inaccessible merely because a user does not hold the token.

#### Dumpster Raids — post-launch experiment
Dumpster Raids are not required for Launch V0.

If later authorized, holders can lock tokens to signal which evidence gap, creator cluster, or Case File the community most wants investigated.

This changes **priority**, not truth. The locking/unlocking contract, accounting, abuse controls, and applicable compliance treatment require their own bounded gate.

#### Trash Hunts
Seasonal evidence/research quests.

Useful work can earn Rat Credits and Rat Reputation.

The project should avoid designing them as games of chance.

#### Bounty Boost
A holder can add `$BINRAT` to a bounded evidence bounty or case reward.

The bounty terms and evidence requirements remain fixed and inspectable.

#### Case Sponsor
A holder can visibly sponsor an investigation without receiving adjudication authority.

### Network utility

Later, after the contribution system exists:

#### Bonded submission
Submitting certain non-deterministic external claims requires collateral.

#### Bonded challenge
Challenging a claim requires collateral.

#### Anti-spam / Sybil cost
Repeated low-quality participation becomes economically expensive.

#### Rat Node bond
Independent evidence providers may eventually lock collateral against defined service/evidence obligations.

## Rat Credits and Rat Reputation

Do not collapse all incentives into one token.

### $BINRAT
Transferable culture/coordination/collateral asset.

### Rat Credits
Off-chain, non-transferable product credits earned/spent through useful activity.

### Rat Reputation
Non-transferable evidence history.

A wallet can own a huge amount of `$BINRAT` and still have terrible Rat Reputation.

## Degen layer

BINRAT should embrace being fun.

Acceptable degen surfaces include:

- public Trash Hunts;
- Rat Den roles;
- seasonal leaderboards;
- Dumpster Raid priority battles;
- bounty boosts;
- meme/art/community drops;
- visible on-chain treasury/fee counters;
- achievement badges;
- community rituals around major Trash Trail discoveries.

The rule is simple:

> **Degen decides attention. Receipts decide truth.**

Avoid mechanics whose core value proposition is guaranteed yield, promised appreciation, or misleading scarcity.

## Marketing doctrine

Allowed framing:

- "We are fair-launching early."
- "The project intends to use disclosed creator/project fee revenue to help bankroll development."
- "Utility will be shipped progressively against a public roadmap."
- "Some roadmap utility is not built yet."
- "The token can lose all value."
- "No private presale / no discounted insider round" when mechanically true.

Avoid framing such as:

- "buy before utility arrives";
- "utility will make the token worth more";
- guaranteed returns;
- guaranteed APY;
- guaranteed listings;
- manufactured partnership claims;
- implying roadmap delivery guarantees token value.

## Compliance / launch-authorization lane

Compliance begins in parallel with Launch V0 engineering. It is not a final checklist after token-facing product work is complete.

BINRAT adopts a stricter internal fail-closed rule: public token-launch marketing and launch execution remain unauthorized until counsel has determined the applicable obligations and the corresponding disclosure/notification/marketing gates have been satisfied.

Before authorization:

1. determine the legal offeror/issuer structure;
2. obtain EU/Swedish crypto counsel on classification and launch obligations;
3. determine the applicable MiCA white-paper/notification/marketing requirements;
4. produce any required statutory disclosure artifact separately from the product/network paper;
5. review launch website, Telegram, X, and other token-facing marketing for consistency;
6. freeze and publish the final launch mechanics and treasury addresses where required/appropriate;
7. independently verify the deployed token/launch contracts and fee routes and bind them into a dated launch-mechanics receipt;
8. update the canonical capability manifest with evidence references;
9. require explicit owner launch authority;
10. only then authorize launch.

The capability manifest starts with both `marketingAuthorized` and `launchAuthorized` false. Documentation or implementation progress alone must never flip those values.

## Product invariant

The token may fund BINRAT.

The token may coordinate BINRAT.

The token may make BINRAT more fun.

The token may increasingly unlock/use BINRAT features as they are built.

**The token never gets to rewrite a receipt.**
