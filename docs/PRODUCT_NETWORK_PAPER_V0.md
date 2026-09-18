# BINRAT PRODUCT / NETWORK PAPER V0.1

Status: product / network + early fair-launch design draft  
This is deliberately not the statutory crypto-asset disclosure artifact. Any legally required white paper/disclosure is governed separately through the launch-authorization lane. Not a promise of token value, returns, or roadmap timing.

## Abstract

BINRAT is a launch-intelligence and creator-memory system for crypto markets.

Its core claim is simple:

> New launches are easy to create. Reliable memory is hard to recreate.

BINRAT observes launch events, preserves point-in-time evidence, reconstructs creator history, records later observations, and turns those facts into replayable receipts.

The long-term design extends that evidence system with collaborative research, bounties, challenges, contributor reputation, historical replay, alerts, and potentially permissionless evidence providers.

BINRAT intends to fair-launch `$BINRAT` early. The purpose is explicit: create a native culture/coordination asset and use transparently disclosed project/creator fee revenue to help bankroll continued development. Utility is intended to expand as roadmap capabilities ship. This is a product and funding design statement, not a statement about future token value.

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

Replay Lab is the bounded pre-launch precursor. A later **Rat Machine** can expand that model and answer:

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

`$BINRAT` balance never substitutes for reputation.

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

BINRAT intends to launch `$BINRAT` early rather than wait for the complete network roadmap.

The project is explicit about why:

- a fair launch creates a native community/culture asset;
- disclosed creator/project fee revenue can bankroll development;
- holders can participate in progressively shipped product utility;
- the degen layer can help distribute BINRAT while the evidence layer earns trust.

The intended fair-launch principles are:

- no private presale;
- no discounted insider round;
- no hidden team allocation;
- launch mechanics and fee routes disclosed before launch;
- any founder/project market purchase disclosed;
- treasury inflows and project spending made legible through a public funding ledger;
- shipped utility clearly distinguished from planned utility.

Early utility may include token-gated optional community surfaces, Rat Watch capacity, Dumpster Raid case-priority signaling, Trash Hunts, bounty boosting, and case sponsorship.

Later utility may include bonded evidence submissions, bonded challenges, anti-spam collateral, and independent Rat Node collateral.

The permanent boundary is:

> Economic stake may decide who spends resources, what gets prioritized, and how costly spam becomes. It does not decide what is true.

BINRAT will not market roadmap utility as a prediction of token value.

## 13. Why stable-value bounties may coexist with collateral

Bounty compensation and adversarial collateral solve different problems.

A stable denomination can make a bounty economically legible.

A protocol asset, if eventually justified, can supply network-specific collateral.

The design should not force every useful payment through a volatile asset merely to create token demand.

## 14. Business model and project funding

BINRAT intends to combine ordinary product revenue with transparently disclosed token-launch economics.

Potential funding/revenue surfaces include:

- creator/project fee revenue from the selected fair-launch rail;
- advanced user features;
- alerts;
- API access;
- higher-rate machine access;
- team/researcher tools;
- enterprise data access.

Token-related project revenue should flow to disclosed treasury addresses and be summarized through a public funding ledger.

The project must remain capable of building useful evidence products without relying on token-price appreciation.

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
3. Replay Lab pre-launch proof;
4. Telegram Rat + capability manifest + public funding/Dumpster Ledger;
5. legal/compliance and launch-mechanics authorization running in parallel;
6. early fair launch only after authorization gates pass;
7. Trash DNA + advanced Rat Watch;
8. Dead Drops;
9. Rat Credits + bounties + Proof of First + reputation;
10. Case Files + Rat Machine/Rat Lab + API/agent distribution + independent evidence providers.

## 17. North star

BINRAT should become:

> **Git history for crypto launch provenance.**

The moat is not a dashboard.

It is the accumulated chain of evidence that becomes harder to recreate every day.
