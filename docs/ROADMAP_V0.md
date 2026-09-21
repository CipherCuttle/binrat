# BINRAT ROADMAP V0

Status: planning document  
Rule: roadmap items are not promises, launch dates, or claims of future token value.

## CURRENT PRODUCT STATE — PUBLIC LIVE BETA / TOKEN LAUNCH BLOCKED

Status semantics are canonicalized in `docs/CAPABILITY_MANIFEST_V0.json`.

Verified public-beta runtime as of 2026-09-19:

- BINRAT web frontend served as Cloudflare Worker static assets;
- public read API served by the same Cloudflare Worker;
- Arc launch indexing and historical backfill persisted in D1;
- deterministic observation reconstruction active in a separately bounded Queue lane;
- Telegram Rat webhook, durable D1 reply ledger, and deterministic replies live on Cloudflare;
- existing Render services retained only as rollback infrastructure.

This public product state does **not** authorize token launch or token marketing. Canonical launch authority remains fail-closed: `BLOCKED`, `marketingAuthorized=false`, `launchAuthorized=false`, `tokenState=NOT_LAUNCHED`.

- `ENGINEERING_PASS` means the reviewed implementation passed its engineering gate.
- `DEPLOYED` means the referenced implementation is deployed.
- `PUBLIC_LIVE` means the deployed capability is authorized as a public-live product surface.
- `BUILDING`, `PLANNED`, and `EXPERIMENTAL` describe roadmap state, not shipping claims.

A capability may be `ENGINEERING_PASS` without being `DEPLOYED` or `PUBLIC_LIVE`.

### Intelligence V1

Current reviewed head: `69793aef3ac6c152e0a91d8c914a6f71c5a4f0f3`

Implemented and mechanically verified:

- ArcPad launch indexing and provenance;
- deeper resumable ArcPad history;
- Creator Files;
- complete indexed Trash Trails for the reported creator address;
- deterministic 5m / 1h / 24h observation receipts;
- point-in-time WHAT CHANGED projections;
- reorg-aware, fail-closed evidence semantics;
- public read plane;
- presentation layer that does not own evidence authority.

Current public deployment:

- Cloudflare Worker + D1 + Queue runtime;
- same-origin Cloudflare web + API;
- public beta live with fail-closed health authority;
- deeper historical coverage may still be backfilling and remains explicitly represented as incomplete/unverified where applicable.

Current boundary remains:

- no BUY/SELL recommendation;
- no SAFE/RUG score;
- no inferred human identity;
- no trading/signing/capital authority.

## LAUNCH V0 — THE RAT ESCAPES

Launch V0 is the next integrated product stage. It is intentionally smaller than the full roadmap.

Required launch stack:

- Intelligence V1 public evidence surfaces;
- Replay Lab pre-launch technical proof;
- Telegram Rat deterministic V0;
- `$BINRAT` fair-launch mechanics frozen and publicly documented;
- Dumpster Ledger / treasury transparency surface;
- minimal Rat Watch V0;
- Rat Radar V0 free intelligence surface plus a holder-gated depth/speed layer.

Legal/compliance is a **parallel authorization lane from the start**, not the last feature in the sequence. Token-facing marketing and launch authority remain fail-closed until the applicable legal/compliance, contract, treasury, and disclosure gates are complete and explicitly authorized in the canonical capability manifest.

### Launch Mechanics Verification V0

The dated Arc-mainnet receipt at `docs/LAUNCH_MECHANICS_VERIFICATION_V0.json` verifies the current ArcPad USDC standard creator-rewards rail through deployed bytecode, state, historical calls, logs, fee collections, and three real launch reconstructions. It binds the live launcher, token factory, fee/liquidity locker, Uniswap V3 authorities, token mechanics, bounded liquidity position, fee paths, 1,200-block wallet cap, and optional same-transaction creator first buy.

Status: `ENGINEERING_PASS / VERIFIED_BOUND_TO_LAUNCH_CONFIG_V0`. ArcPad contract source could not be matched independently to the deployed bytecode, and the verified rail contains material external authority: the current launcher owner can redirect future creator quote-fee accrual. The lock finding means no withdrawal path exists in the observed locker runtime; it does not mean the position remains in range or economically active forever.

The separate `BINRAT_LAUNCH_CONFIG_V0.json` now binds the owner-selected fee recipient, treasury, allocation policy, disabled first buy, and not-planned launch-time public purchase to this receipt digest. Holder threshold, token address, metadata, timing, execution, and legal/compliance remain unresolved. Canonical status remains `BLOCKED / marketingAuthorized=false / tokenState=NOT_LAUNCHED`.

### Replay Lab — pre-launch technical proof

Replay Lab demonstrates BINRAT's evidence moat without waiting for fresh launch density:

- real indexed Arc launch evidence;
- Creator File / Trash Trail context;
- deterministic launch -> 5m -> 1h -> 24h stages;
- no future leakage;
- copyable receipt/evidence bundle;
- missing stages remain missing rather than simulated.

The implementation originated in draft PR #13 and is now reconciled into the current Cloudflare/D1 stack without merging that PR. Live acceptance on 2026-09-21 verified launch `01f1eb8fe5acede475ce7f09bad73962cbb3279deb1e50f7e7c2746bcd28d85f` through genuine COMPLETE 5m, 1h, and 24h observation receipts at `GET /api/bag/:bagId/replay`.

Replay Lab is `ENGINEERING_PASS / CLOUDFLARE_LIVE_VERIFIED / PUBLIC_LIVE_BETA`. The response binds the canonical checkpoint block/hash, launch and Creator File authority, observation identifiers/digests, chronological maturation targets, explicit available/missing horizons, and no-lookahead boundaries. Global history coverage remains conservatively `UNVERIFIED` under `PUBLIC_PROJECTION_V0` even when the current deep-backfill cursor reports complete; Replay Lab does not upgrade that claim.

This remains a pre-launch proof surface, not a claim that the later Rat Machine roadmap is complete.

### Dumpster Ledger

The public funding surface should expose, where operationally safe:

- creator/project fee recipient wallet(s);
- treasury wallet(s);
- cumulative token-related inflows;
- categorized project outflows;
- relevant on-chain transaction links;
- current status of shipped / building / planned utility.

The point is not to pretend the project has no funding motive. The point is to make the funding mechanics legible.

Dumpster Ledger V0 is implemented as an immutable, receipt-bound projection over four separate layers: canonical funding configuration, observed transactions, conservative categorization, and public presentation. Production configuration validates chain, token, role-address uniqueness, effective block, and policy versions. A valid configuration still cannot activate accounting until a reviewed observation source exists.

The pre-launch transparency surface is live at `GET /api/dumpster-ledger`. It returns `PRE_LAUNCH_AUTHORITIES_CONFIGURED`, exposes the owner-selected future treasury and project-fee roles, and separately marks the token, launch transaction/block, and token-flow observations unavailable. Accounting remains disabled and production totals have zero entries; that absence of observations is not a claim that future flows cannot exist. Test fixtures remain explicitly labeled and cannot enter the production projection.

Status: `ENGINEERING_PASS / CLOUDFLARE_LIVE_VERIFIED / PRE_LAUNCH_TRANSPARENCY_LIVE` at Worker version `4648a965-9701-4793-b9a0-903f9786e6e5`. Wallet roles are `PRELAUNCH_AUTHORITIES_CONFIGURED`; production accounting remains disabled, and `dumpster_ledger_bootstrap` remains required until the actual token, effective block, bound receipt, and explicitly activated reviewed observer exist.

### Rat Den V0 — optional / post-launch

Rat Den is an optional community/product surface and is **not a Launch V0 blocker**.

Candidate later features:

- advanced Telegram Rat commands;
- experimental feature access;
- research/community channels;
- Trash Hunt eligibility when hunts ship.

Core receipts and factual evidence remain publicly inspectable.

### Rat Radar V0 — launch utility priority

Rat Radar turns BINRAT's accumulated launch evidence into a ranked watchlist of statistically unusual addresses.

The first version must be deterministic and receipt-bound. It must not label an address as a smart human, infer identity, or issue a BUY/SELL recommendation.

Evidence layer required before ranking:

- wallet/address participation around indexed launch pools;
- entry timing relative to pool/launch creation;
- observed token acquisition/disposal paths where deterministically recoverable;
- position size relative to observable pool/liquidity state;
- recurrence across independent launches;
- later 5m / 1h / 24h outcomes tied to the original point-in-time evidence;
- explicit sample size, coverage, and missing-data state.

A router, contract, recipient, or transfer beneficiary must remain labeled as the address actually evidenced. BINRAT must not silently infer the final human trader.

Free product should be useful enough to prove the intelligence layer:

- exact addresses for a small top watchlist;
- sample size and coverage;
- basic deterministic reasons for inclusion;
- a bounded historical profile;
- public receipts/evidence links;
- at least one basic watch slot.

Holder-gated depth may unlock:

- the full ranked address universe;
- richer factor decomposition and longitudinal statistics;
- current/near-real-time active-wallet views;
- larger Rat Watch capacity;
- custom filters/cohorts;
- faster/richer Telegram alerts;
- later API/webhook access.

**Truth is not gated.** Public receipts and the evidence needed to verify factual claims remain public. The gate sells depth, speed, scale, filtering, and operational convenience.

Holder eligibility should use a wallet-control proof plus a publicly frozen balance threshold. A percentage-of-fixed-supply target may be converted into an absolute token threshold, but the exact threshold is not frozen until holder-distribution and price sensitivity have been simulated. The gate must not imply ownership of a particular percentage of circulating supply when it only checks balance.

Holder Gate V0 engineering status (2026-09-20):

- EIP-4361 wallet-control challenges are domain-, purpose-, address-, chain-, nonce-, issue-time-, and expiry-bound;
- one-time challenges issue short-lived opaque sessions whose stored authority is a token digest, wallet, tier, policy id, and expiry;
- the free projection remains unauthenticated and unchanged;
- a test-only deterministic eligibility source proves FREE versus HOLDER projection behavior;
- HOLDER depth exposes the full ranked universe plus expanded acquisition/receipt factors from the same evidence inputs;
- public receipt and address evidence routes remain unauthenticated;
- deployed wallet challenge/session writes are disabled unless the separate wallet-auth switch is explicitly enabled;
- production holder eligibility is deliberately fail-closed as `TOKEN_AUTHORITY_NOT_CONFIGURED` because no canonical `$BINRAT` contract or final threshold exists;
- no production token address, production threshold, private-key custody, transaction signing, or token action is authorized by this engineering pass.

The launch-mechanics handoff keeps HOLDER inactive and leaves the token address and threshold unset. Later activation must bind chain ID `5042`, the actual canonical token address, an owner-approved absolute raw balance threshold, policy/version, effective time or block, and a separately reviewed balance source. No subset of those fields activates production eligibility.

### Rat Watch V0

Launch with the smallest useful alert loop:

- recurring reported creator address;
- watched Creator File update;
- matured 5m / 1h / 24h observation;
- Telegram delivery.

Advanced Trash DNA matching arrives after launch.

### Dumpster Raids V0 — post-launch experiment

Dumpster Raids are **not a Launch V0 blocker**. Token locking introduces additional contract, accounting, abuse, and compliance surface and therefore gets its own bounded post-launch gate.

Holders can lock `$BINRAT` behind bounded evidence gaps or investigations they want prioritized.

Rules:

- locking changes research priority, not factual outcome;
- lock accounting is public;
- raid terms have a defined start/end;
- tokens unlock under the published raid rules;
- no token-weighted adjudication of evidence.

### Feed the Rat

A deliberately memetic optional action.

A user can send `$BINRAT` to a disclosed destination such as a research/bounty pool or provably dead address, depending on the finalized mechanic.

The destination and effect must be explicit before the action is confirmed.

This is culture, not evidence authority and not a promise of token appreciation.

### Launch V0 acceptance gates

Launch V0 is ready only when:

1. launch contract/mechanics and fee routes are independently verified and captured in a dated verification receipt;
2. required legal/compliance artifacts are complete and launch authorization is explicitly unblocked;
3. public token/treasury addresses are frozen and disclosed;
4. Telegram Rat reports the canonical doctrine/status accurately from the capability manifest;
5. Dumpster Ledger is live or has a deterministic launch-day bootstrap path;
6. Rat Radar exposes a genuinely useful free watchlist and the holder gate demonstrably unlocks only depth/speed/scale while core factual receipts remain public;
7. Rat Watch has a live future-only subscription plus a deterministic end-to-end delivery smoke; a naturally occurring future recurrence alert remains required evidence for the mature feature, but is not allowed to hold Launch V0 hostage to event timing;
8. Replay Lab demonstrates at least one real historical launch -> matured-observation evidence chain without synthesizing missing evidence;
9. product/docs/Telegram status agrees with the canonical capability manifest;
10. no private presale, hidden insider allocation, or undisclosed privileged inventory exists under the chosen launch design.

## POST-LAUNCH PHASE 1 — THE RAT REMEMBERS


### 1. TRASH DNA

Deterministic, inspectable launch fingerprints built from observable characteristics.

Initial candidate dimensions:

- launch cadence;
- reported creator/deployer recurrence;
- funding-path features where supported;
- launchpad;
- early holder/distribution features;
- pool/liquidity behavior;
- domain/social reuse;
- contract characteristics;
- timing patterns.

Output is similarity and shared evidence, not a claim that two wallets are the same human.

**Kill criterion:** if fingerprints add little beyond simple creator-address recurrence on historical replay, do not expand the feature.

### 2. RAT WATCH

Tripwire alerts over BINRAT memory.

Examples:

- a previously observed creator launches again;
- a new launch crosses a Trash DNA similarity threshold chosen by the user;
- an old domain/social artifact reappears;
- a watched launch receives a new matured observation;
- a watched evidence gap is filled.

Delivery surfaces:

- Telegram;
- webhooks;
- API.

### 3. DEAD DROPS

Preserve public launch artifacts that can disappear:

- website snapshot metadata;
- social profile/link metadata;
- token art;
- project descriptions;
- linked domains;
- evidence source/time/hash.

The first implementation should preserve provenance and hashes before attempting broad archival infrastructure.

## POST-LAUNCH PHASE 2 — THE RATS ORGANIZE

This phase begins only after the launch/product loop is operating and Dead Drops provide useful evidence gaps.

## EXPERIMENT — CONTRIBUTOR ECONOMY

### 4. RAT CREDITS

Off-chain, non-transferable experimental credits.

Use cases:

- evidence submission bonds;
- challenge bonds;
- bounty eligibility;
- contribution rewards;
- proof-of-first rewards.

Rat Credits do not represent equity, revenue share, or a promise of future token conversion.

### 5. TRASH HUNTS + TRASH BOUNTIES

**Trash Hunts** are seasonal, bounded research quests. They are the degen/community wrapper around useful evidence work.

Hunters can earn Rat Credits, Rat Reputation, roles, badges, or explicitly disclosed rewards. Hunts must not be games of chance and must not let popularity substitute for evidence quality.

**Trash Bounties** are narrower evidence tasks with explicit acceptance criteria.



A user or project funds a bounded evidence question.

Preferred experimental design:

- bounty value uses a stable denomination such as USDC or an internal test balance;
- Rat Credits provide anti-spam collateral;
- submissions require explicit evidence;
- deterministic facts outrank social/community claims;
- accepted, rejected, disputed, and unresolved outcomes remain visible.

### 6. PROOF OF FIRST

Commit -> reveal -> validate for novel evidence.

Goal: preserve attribution for the first valid contributor without rewarding copied submissions.

### 7. RAT REPUTATION

Non-transferable contributor history.

Reputation is separate from token balance and cannot purchase factual authority.

## NETWORK — COLLABORATIVE INTELLIGENCE

### 8. CASE FILES

Collaborative, receipt-bound investigations containing:

- facts;
- evidence;
- claims;
- challenges;
- unresolved questions;
- bounties;
- status transitions.

No unstructured accusation feed.

### 9. CREATOR RIGHT OF REPLY

Allow cryptographic control proofs and creator-signed context without rewriting historical evidence.

### 10. RAT MACHINE

Replay Lab is the bounded pre-launch precursor. Rat Machine is the later interactive expansion.

Interactive point-in-time replay:

- launch;
- +5m;
- +1h;
- +24h;
- later reveal.

Primary uses:

- forensic review;
- education;
- heuristic evaluation;
- anti-lookahead testing.

### 11. RAT LAB

Replay user-defined heuristics against point-in-time historical receipts.

A published heuristic must expose its rule, evidence dependencies, evaluation window, and coverage limitations.

No implicit lookahead.

## DISTRIBUTION + BUSINESS

### 12. BINRAT RECEIPT SEAL

Embeddable proof link:

> Observed by BINRAT — coverage through block X

The seal proves evidence coverage, not safety.

### 13. RAT API / AGENT INTERFACE

Machine-readable access to:

- launches;
- Creator Files;
- Trash Trails;
- observations;
- WHAT CHANGED;
- Trash DNA;
- receipt/evidence bundles;
- alerts.

The API should become useful to bots and agents without granting them trading authority through BINRAT.

### 14. TELEGRAM RAT

Autonomous communication layer for updates, status, launch intelligence, FAQs, receipts, watch alerts, Dumpster Raid status, Trash Hunts, and later Case File/bounty events.

The bot is explicitly automated and never impersonates the founder.

### 15. DUMPSTER LEDGER

Public proof-of-funding and execution surface linking token-related project inflows, treasury policy, roadmap state, and on-chain receipts.

The ledger is part of the product trust model: the project can openly use token-related revenue to bankroll development without hiding the mechanism.

## EARLY FAIR LAUNCH — FUND THE BUILD, SHIP THE UTILITY

BINRAT intends to launch `$BINRAT` early, subject to the legal/compliance launch gate in `TOKEN_LAUNCH_DOCTRINE.md`.

The launch objective is explicit:

1. create a fair-access BINRAT culture/coordination asset;
2. use disclosed creator/project fee revenue to help bankroll continued development;
3. ship progressively deeper token utility alongside the evidence roadmap;
4. retain a degen layer without letting token wealth determine factual truth.

### Launch-day target

The cleanest fair-launch target is:

- no presale;
- no private discount;
- no hidden team allocation;
- fixed supply under the selected launch contract;
- locked launch liquidity under the selected launch contract;
- disclosed project/creator fee route;
- any founder/project market purchase disclosed and executed through the same public market;
- public treasury wallet and funding ledger;
- clear separation between shipped utility and planned utility.

### Early utility layer

Subject to implementation and legal review, early `$BINRAT` utility can include:

- **Rat Radar depth** — full ranked wallet/address universe, richer statistics, live activity views, filtering, and later machine access;
- **Rat Watch capacity** — additional watch slots or advanced alert configuration;
- **Rat Den** — optional post-launch community/product surfaces;
- **Dumpster Raids** — post-launch experimental token-lock signaling for which evidence gaps/cases the community wants investigated next;
- **Trash Hunts** — seasonal research quests that earn Rat Credits and reputation rather than purchasing truth;
- **Bounty Boosts** — use `$BINRAT` to increase the posted reward/priority of a bounded evidence task;
- **Case sponsorship** — visibly sponsor research without gaining adjudication authority;
- **Feed the Rat** — optional memetic contribution to a disclosed research/bounty/dead destination, with the effect shown before confirmation.

### Utility expansion

As the network matures, `$BINRAT` may additionally be used for:

- bonded external-evidence submissions;
- bonded challenges;
- anti-spam collateral;
- permissionless evidence-provider collateral;
- independent Rat Node collateral.

### Permanent exclusions

Token balance must never:

- determine whether evidence is true;
- overwrite receipts;
- buy Rat Reputation;
- turn an unsupported identity inference into a fact;
- create guaranteed yield or a promise of appreciation.

The project can be degen.

The evidence cannot be.

## END STATE

The product flywheel is:

`FAIR LAUNCH -> TELEGRAM RAT / RAT DEN -> HOT GARBAGE -> RECEIPTS -> CREATOR FILE -> TRASH DNA -> RAT WATCH -> EVIDENCE GAPS -> DEAD DROPS -> TRASH HUNTS / BOUNTIES -> CONTRIBUTORS -> VERIFIED EVIDENCE -> STRONGER MEMORY -> MORE USERS -> MORE EVIDENCE`

The moat is accumulated, replayable history.

The token launches early as a fair-access culture/coordination asset and project-funding mechanism; its utility expands with shipped roadmap capabilities. The evidence history remains useful independently of token price.
