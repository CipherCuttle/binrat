# BINRAT FAIR LAUNCH DOCTRINE V0

Status: planning / pre-launch design  
This document is not a statutory MiCA crypto-asset white paper and is not legal, tax, or investment advice.

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

## Preferred current launch rail: Pons V2 + Stake & Burn candidate

The current owner-selected planning direction is **Robinhood Chain 4663 / Pons V2**, with an existing **PonsVault Stake & Burn** template as the Launch V1 economic primitive.

This selection is planning authority only. It does not authorize launch.

Launch V1 should minimize custom contract surface:

- launch $BINRAT through the reviewed Pons/PonsVault path required for the selected vault mechanics;
- native ETH as the candidate quote/pair asset;
- one active-stake product tier: **WORKING RAT**;
- no inflationary $BINRAT staking emissions;
- Pons native buyback **OFF as the current candidate** unless the final reviewed manifest deliberately changes it;
- creator tax unresolved until scenario simulation, legal/product review, and immutable-manifest freeze;
- founder/project opening purchase, if any, must be atomic/publicly disclosed under the selected Pons launch mechanics;
- no custom RatVault, RWA dividend, Rat Bonds, governance or FERAL tier as Launch V1 blockers.

The Pons launch gate must independently pin and verify the exact live launcher/factory/config, `canLaunch` authority, relevant runtime bytecode/codehashes, PonsVault launcher/registry/template, Stake & Burn implementation, proxy/beacon state, upgrade authority and fee-sweep permissions immediately before launch.

Pons configs and upstream deployment state are not perpetual authority. A dated verification receipt and an exact launch manifest are required.

### Historical predecessor: ArcPad / Arc 5042

The existing ArcPad launch-mechanics receipt and `BINRAT_LAUNCH_CONFIG_V0` remain immutable historical evidence of the earlier launch design.

They are **not** Pons verification and cannot satisfy the Robinhood/Pons launch gate.

Before launch, the capability manifest and launch-gate matrix must explicitly record the Pons V1 successor authority rather than silently treating the old Arc `SATISFIED` launch-mechanics state as transferable.


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

#### WORKING RAT — active-stake product access

Launch V1 uses **active verified stake**, not simple wallet balance, as the token/product entitlement primitive.

FREE users retain useful core Case, receipt, Trash Trail and bounded Watch access.

A principal that proves control of a Robinhood Chain wallet and has active stake at or above the publicly frozen WORKING RAT threshold may unlock higher-cost product depth such as larger Watch capacity, deeper retained history and advanced alert filtering.

The gate sells depth, speed, scale, filtering and convenience. It must not hide or rewrite factual receipts.

Only one token-backed tier ships for Launch V1. FERAL RAT is post-launch.

The final WORKING RAT threshold must be frozen before token-facing marketing and bound to a versioned access policy. Product capability may fail closed to FREE when current stake cannot be verified; failure must never invent premium authority.

Wallet control uses message signing only; it never requests private keys. Staking transactions, where initiated by the user, remain explicit wallet actions separate from authentication.

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

## Genesis supporters and product-led distribution

Early-supporter rewards should reinforce product use without creating an airdrop-farming economy.

The canonical companion plan is `docs/product/BINRAT_TOKEN_LAUNCH_AND_GENESIS_FUNNEL_V1.md`.

### GENESIS RAT

A linked principal/wallet may earn non-transferable GENESIS RAT status for sustained qualifying active stake during a published launch-era Genesis window.

The candidate implementation test is 7 continuous qualifying days inside the first 30 days after verified public launch. Final values require a frozen supporter manifest before public promotion.

Genesis benefits may include:

- badge / Telegram role;
- public Genesis receipt;
- distinct share-card treatment;
- bounded temporary extra Watch capacity;
- early access to selected experiments.

Genesis does not provide extra token emissions or factual authority.

### Qualified referrals

BINRAT may attribute canonical Case/receipt share links to a referrer, but rewards trigger only after the referred principal becomes a retained product user.

Do not reward raw clicks, impressions, reposts, wallet creation, token purchase size, or transaction volume.

Candidate referral rewards are product/culture benefits such as a bounded WORKING RAT trial, temporary Watch capacity, beta access or cosmetic recognition.

Referral rewards are capped and do not imply a token airdrop or future conversion into $BINRAT.

### Product-led funnel

`X / receipt -> Case -> Dig -> Watch -> Alert -> Return -> Share -> Link wallet -> Put the Rat to Work`

Token acquisition is deliberately downstream of experiencing the product.


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
