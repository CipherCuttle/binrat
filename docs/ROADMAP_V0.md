# BINRAT ROADMAP V0

Status: planning document  
Rule: roadmap items are not promises, launch dates, or claims of future token value.

## SHIPPED / ENGINEERING-PASS

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

## NEXT — MEMORY BECOMES OPERATIONAL

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

### 5. TRASH BOUNTIES

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

Autonomous communication layer for updates, status, launch intelligence, FAQs, receipts, and watch alerts.

The bot is explicitly automated and never impersonates the founder.

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
- **Dumpster Raids** — token-lock signaling for which evidence gaps/cases the community wants investigated next;
- **Trash Hunts** — seasonal research quests that earn Rat Credits and reputation rather than purchasing truth;
- **Bounty Boosts** — use `$BINRAT` to increase the posted reward/priority of a bounded evidence task;
- **Case sponsorship** — visibly sponsor research without gaining adjudication authority.

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

`HOT GARBAGE -> RECEIPTS -> CREATOR FILE -> TRASH DNA -> EVIDENCE GAPS -> BOUNTIES -> CONTRIBUTORS -> VERIFIED EVIDENCE -> STRONGER MEMORY -> RAT WATCH -> MORE USERS -> MORE EVIDENCE`

The moat is accumulated, replayable history.

The token launches early as a fair-access culture/coordination asset and project-funding mechanism; its utility expands with shipped roadmap capabilities. The evidence history remains useful independently of token price.
