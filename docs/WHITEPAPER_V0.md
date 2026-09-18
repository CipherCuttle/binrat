# BINRAT WHITEPAPER V0.1

Status: product / network design draft  
Not a token offering document. Not a promise of launch, token value, returns, or roadmap timing.

## Abstract

BINRAT is a launch-intelligence and creator-memory system for crypto markets.

Its core claim is simple:

> New launches are easy to create. Reliable memory is hard to recreate.

BINRAT observes launch events, preserves point-in-time evidence, reconstructs creator history, records later observations, and turns those facts into replayable receipts.

The long-term design extends that evidence system with collaborative research, bounties, challenges, contributor reputation, historical replay, alerts, and potentially permissionless evidence providers.

A transferable token is not assumed to be necessary. BINRAT first tests the coordination model using off-chain Rat Credits.

## 1. Problem

Launch intelligence is fragmented across:

- launchpads;
- explorers;
- wallets;
- websites;
- social accounts;
- liquidity/pool state;
- holder behavior;
- historical launches.

The information is also time-sensitive.

Websites disappear. Social handles change. Wallets rotate. Evidence is deleted. A later analyst can easily contaminate an earlier judgment with facts that were not knowable at the time.

Most interfaces optimize for the present.

BINRAT optimizes for memory.

## 2. What exists today

BINRAT Intelligence V1 has an engineering-pass implementation at reviewed head:

`69793aef3ac6c152e0a91d8c914a6f71c5a4f0f3`

The implemented system includes:

- ArcPad launch ingestion;
- deterministic provenance;
- resumable deeper history;
- Creator Files;
- Trash Trails;
- frozen 5m / 1h / 24h observations;
- point-in-time WHAT CHANGED views;
- reorg handling;
- coverage states;
- append-only/idempotent receipt behavior;
- public read surfaces.

The product intentionally does not claim human identity from an address and does not output a SAFE/RUG score or trading recommendation.

## 3. Evidence hierarchy

BINRAT distinguishes between evidence and interpretation.

Core categories include direct and derived on-chain facts, launchpad/indexer facts, and external metadata.

Every meaningful public claim should answer:

- where did this come from?
- when was it observed?
- what exactly was observed?
- what is missing?
- can it be replayed?
- has it been challenged?

Unknown information remains unknown.

## 4. Creator memory

A Creator File records the history associated with the creator address reported by the source launchpad.

A Trash Trail shows earlier indexed launches connected by that explicit evidence.

Future versions expand from exact recurrence toward **Trash DNA**: inspectable similarities across observable launch characteristics.

Similarity does not equal common human identity.

## 5. Point-in-time replay

BINRAT's frozen observations support a stronger product than a current-state dashboard.

The system can eventually expose a **Rat Machine** that answers:

> What did the launch look like at launch, +5m, +1h, and +24h?

This creates a replay environment for forensic review and testing heuristics without future leakage.

## 6. Preserving disappearing evidence

**Dead Drops** preserve evidence that may later vanish or mutate.

Examples include:

- website and domain observations;
- social links and profile metadata;
- project descriptions;
- imagery;
- public statements;
- linked resources.

The objective is not to make every external claim true.

The objective is to preserve what was publicly observable, with provenance.

## 7. Collaborative intelligence

Not every useful fact is available from deterministic chain reads.

BINRAT therefore proposes a structured contribution layer.

### Rat Credits

Rat Credits are an off-chain experiment for contribution economics.

They can be used for:

- submission bonds;
- challenge bonds;
- rewards;
- bounties;
- proof-of-first;
- anti-spam costs.

They are not equity, revenue share, or a promise of token conversion.

### Trash Bounties

A Trash Bounty asks a bounded question and specifies acceptable evidence.

Example:

> Find publicly verifiable evidence that this domain/social identity appeared in an earlier launch.

Submissions remain claims until accepted under the relevant evidence rules.

### Proof of First

A commit/reveal mechanism can preserve attribution for novel discoveries while reducing copy-submission incentives.

### Rat Reputation

Reputation is non-transferable and derived from evidence history.

Token balance, if a token later exists, never substitutes for reputation.

## 8. Case Files

Case Files combine:

- receipts;
- evidence;
- claims;
- challenges;
- bounties;
- unresolved questions;
- status transitions.

The design objective is structured collaborative investigation, not an accusation board.

## 9. Right of reply

A creator may prove control of an address and attach signed context.

Creator context remains labeled as such and cannot overwrite historical receipts.

## 10. Alerts and machine access

**Rat Watch** turns memory into operational intelligence through user-defined tripwires.

**Rat API** exposes the same evidence to external bots and agents.

Examples include alerts when:

- a creator recurs;
- a watched domain reappears;
- Trash DNA similarity crosses a configured threshold;
- a new point-in-time observation matures;
- a bounty or challenge changes state.

## 11. Telegram Rat

The Telegram Rat is BINRAT's automated public communicator.

It should:

- post verified project/build updates;
- announce meaningful launch/evidence events;
- answer bounded factual questions;
- expose status and roadmap;
- link directly to receipts;
- state when it does not know.

It should not:

- impersonate the founder;
- make token-price predictions;
- promise returns;
- invent roadmap dates;
- answer unsupported claims as facts;
- issue trading recommendations on BINRAT's behalf.

## 12. Token doctrine

BINRAT does not begin with the assumption that it needs a token.

The token thesis must survive this test:

> What important coordination problem fails if we replace the token with a database permission, reputation score, stablecoin deposit, or subscription?

If nothing important fails, the token is decorative.

A future transferable `$BINRAT` is only justified if permissionless participation creates a real need for transferable economic collateral.

Candidate functions include:

- bonded evidence submission;
- bonded challenges;
- evidence-provider collateral;
- independent observer/node collateral.

Economic stake can make spam expensive.

It cannot make a claim true.

## 13. Why stable-value bounties may coexist with collateral

Bounty compensation and adversarial collateral solve different problems.

A stable denomination can make a bounty economically legible.

A protocol asset, if eventually justified, can supply network-specific collateral.

The design should not force every useful payment through a volatile asset merely to create token demand.

## 14. Business model

BINRAT may support sustainable revenue without requiring token appreciation.

Potential revenue surfaces include:

- advanced user features;
- alerts;
- API access;
- higher-rate machine access;
- team/researcher tools;
- enterprise data access.

The evidence product should have a business model independent of speculative token demand.

## 15. Risks

Material risks include:

- insufficient launch volume;
- chain/launchpad concentration;
- RPC/provider failures;
- incomplete external evidence;
- wallet rotation defeating naive creator recurrence;
- adversarial submissions;
- false identity inference;
- social/legal risk from unsupported accusations;
- contributor collusion;
- token mechanics creating incentives that corrupt evidence quality;
- regulatory obligations around any future crypto-asset offer.

The system should fail closed where evidence quality is uncertain.

## 16. Roadmap philosophy

BINRAT uses capability gates rather than calendar promises.

Major progression:

1. deterministic launch memory;
2. longitudinal observations;
3. Trash DNA + Rat Watch;
4. Dead Drops;
5. Rat Credits + bounties;
6. Proof of First + reputation;
7. Case Files + replay + Rat Lab;
8. API/agent distribution;
9. independent evidence providers;
10. token consideration only if the coordination experiment proves the need.

## 17. North star

BINRAT should become:

> **Git history for crypto launch provenance.**

The moat is not a dashboard.

It is the accumulated chain of evidence that becomes harder to recreate every day.
