# BINRAT ROADMAP V0

Status: planning document  
Rule: roadmap items are not promises, launch dates, or claims of future token value.

## ENGINEERING-PASS / PUBLIC-LIVE NOT YET AUTHORIZED

Status semantics are canonicalized in `docs/CAPABILITY_MANIFEST_V0.json`.

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
- Rat Den V0;
- minimal Rat Watch V0.

Legal/compliance is a **parallel authorization lane from the start**, not the last feature in the sequence. Token-facing marketing and launch authority remain fail-closed until the applicable legal/compliance, contract, treasury, and disclosure gates are complete and explicitly authorized in the canonical capability manifest.

### Replay Lab — pre-launch technical proof

Replay Lab demonstrates BINRAT's evidence moat without waiting for fresh launch density:

- real indexed Arc launch evidence;
- Creator File / Trash Trail context;
- deterministic launch -> 5m -> 1h -> 24h stages;
- no future leakage;
- copyable receipt/evidence bundle;
- missing stages remain missing rather than simulated.

The current implementation candidate lives in draft PR #13. It is a pre-launch proof surface, not a claim that the later Rat Machine roadmap is complete.

### Dumpster Ledger

The public funding surface should expose, where operationally safe:

- creator/project fee recipient wallet(s);
- treasury wallet(s);
- cumulative token-related inflows;
- categorized project outflows;
- relevant on-chain transaction links;
- current status of shipped / building / planned utility.

The point is not to pretend the project has no funding motive. The point is to make the funding mechanics legible.

### Rat Den V0

Optional holder-facing community/product surfaces.

Candidate launch features:

- advanced Telegram Rat commands;
- additional Rat Watch slots;
- experimental feature access;
- research/community channels;
- Trash Hunt eligibility when hunts ship.

Core receipts and factual evidence remain publicly inspectable.

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
6. Rat Den cannot hide or alter core public receipts;
7. Rat Watch produces at least one real end-to-end Telegram alert;
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

- **Rat Den** — optional token-gated community/product surfaces;
- **Rat Watch capacity** — additional watch slots or advanced alert configuration;
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
