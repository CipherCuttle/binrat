# BINRAT Brand V1 — Banned Language

**Status:** lint/reference companion to `COPY_LIBRARY.md`  
**Machine-readable authority:** `copy-fixtures.json`

This file exists to catch public-copy drift before it becomes product truth.

A linter can catch literal words and common constructions. It cannot decide whether evidence supports a sentence. Human review still owns semantic boundaries.

## 1. Hard-ban phrases in BINRAT conclusions

Reject these when BINRAT itself is asserting them:

- smart money
- good buy
- bad buy
- buy now
- sell now
- ape in
- ape this
- safe
- safe score
- rug score
- rugger
- scammer
- guaranteed returns
- guaranteed yield
- guaranteed APY
- guaranteed listing
- guaranteed price appreciation
- AI-powered alpha
- AI powered alpha
- revolutionary blockchain intelligence
- next 100x
- gem found
- alpha found
- whale move
- trade smarter
- never miss the next gem
- trust the rat

The words `safe`, `scammer`, `rugger`, `buy`, `sell`, and `ape` may appear in quoted user content, source material, or explicit “we do not do X” documentation. They should not appear as BINRAT verdicts or CTAs.

## 2. Hard-ban trading imperatives

Reject public BINRAT copy matching an imperative such as:

- BUY {asset}
- SELL {asset}
- APE {asset}
- APE IN
- GET IN NOW
- EXIT NOW
- TAKE PROFIT
- LOAD UP

A disclaimer does not rescue a trading instruction.

Bad:

> APE IN. Not financial advice.

Still bad.

## 3. Semantic upgrades that require rejection

These are not synonyms.

| Source-bounded term | Forbidden silent upgrade | Why |
|---|---|---|
| deployer | creator / founder / dev | source role does not establish authorship or human role |
| address / wallet | human / person / team | an address is not an identity |
| recipient | trader / buyer | transfer role does not establish intent |
| recurrence | skill / expertise | repetition is not competence |
| recurrence | profitability / winning | repetition is not outcome |
| pattern | verdict | a pattern is inspectable structure |
| similarity | common human identity | matching evidence is not identity proof |
| missing | safe / clean / benign | absence of evidence is not positive evidence |
| no match in scope | never happened / unique | scoped search is not global proof |
| ENGINEERING_PASS | deployed / live | engineering readiness is not availability |
| DEPLOYED | PUBLIC_LIVE | deployment is not automatically public access |
| autonomous | unrestricted authority | automation must remain scoped and attributable |

## 4. High-risk constructions

Reject or force manual review when public copy uses these structures.

### Identity overreach

- “same person”
- “same team”
- “same dev”
- “their other launches”
- “this founder”
- “the creator” when the source only reports DEPLOYER

Allowed only when that exact identity/role is separately established by an authoritative source and the copy remains scoped to it.

### Intent overreach

- “trying to”
- “planning to”
- “wants to”
- “dumping on”
- “baiting buyers”
- “hiding”
- “knows what they’re doing”

Observable behavior may be described. Motive requires direct support.

### Outcome overreach

- “wins”
- “profitable”
- “successful wallet”
- “good track record”
- “bad track record”
- “prints”
- “always pumps”
- “usually rugs”

Outcome language requires explicit outcome evidence, coverage, time window, and method. Even then, avoid turning historical outcome into a recommendation.

### Coverage erasure

- “nothing found” without scope
- “no history” without supported completeness
- “all clear”
- “clean”
- “nothing suspicious”
- “complete history” without a defined supported scope

Prefer:

> No supported match in current indexed coverage.

## 5. Generic startup / crypto slop

Reject as Brand V1 public copy unless quoting or criticizing it:

- cutting-edge
- game-changing
- revolutionary
- next-generation
- next gen
- state-of-the-art intelligence
- unparalleled insights
- actionable alpha
- unlock alpha
- alpha engine
- AI-powered
- AI driven
- powered by AI
- intelligent insights
- make smarter trades
- trade with confidence
- edge the market
- beat the market
- institutional-grade alpha
- one-stop shop
- seamless experience
- ecosystem of intelligence
- Web3 intelligence platform
- crypto intelligence revolution

These phrases are not only generic; many also imply product outcomes BINRAT does not own.

## 6. Roadmap/status overclaims

Reject:

- “live” unless the exact surface is supported as live/public;
- “shipped” when only engineering-pass;
- “available now” when not actually available to the stated audience;
- “coming tomorrow/next week/on {date}” unless the canonical authority explicitly supplies that date;
- “fully autonomous”;
- “the Rat trades for you”;
- “hands-free alpha”;
- “set it and forget it.”

Prefer the canonical status values:

- ENGINEERING_PASS
- DEPLOYED
- PUBLIC_LIVE
- BUILDING
- PLANNED
- EXPERIMENTAL
- BLOCKED

## 7. Evidence-state misuse

Do not use **COMPLETE** without naming the scope whose expected evidence is complete.

Do not use **OBSERVED** for:

- model inference;
- derived similarity;
- a claim copied from another claim without source retention.

Do not use **DERIVED** as a euphemism for speculation.

Do not use **PATTERN** as a verdict.

Do not use **UNKNOWN**, **UNVERIFIED**, and **MISSING** interchangeably merely for tone.

Do not hide **PARTIAL**, **UNKNOWN**, **UNVERIFIED**, or **MISSING** because a cleaner card looks nicer.

## 8. Feral language limits

Allowed character language includes:

- SMELLS FAMILIAR.
- FOUND SOMETHING.
- RAT GOT PAPER.
- HOLE IN THE BAG.
- TRASH MOVED.
- SAME TRACKS.
- THE RAT KEPT THIS.

Reject feral language when it independently asserts risk, guilt, quality, or opportunity:

- THIS ONE STINKS.
- CAUGHT THE RUGGER.
- FOUND A GEM.
- RAT SAYS BUY.
- EASY MONEY.
- DEAD TOKEN.
- BAD ACTOR CONFIRMED.
- SCAM DETECTED.

The headline can be weird. The finding cannot be vague.

## 9. CTA denylist

Never use as BINRAT CTAs:

- Buy Now
- Sell Now
- Ape In
- Ape This
- Trade Now
- Copy Trade
- Follow Smart Money
- Catch the Pump
- Get Alpha
- Trust the Rat

Preferred action families:

- Open Receipt
- Open Case
- Follow Trash Trail
- Inspect Evidence
- Compare Receipts
- See Coverage
- Replay This
- Leave a Tripwire
- Watch Address
- View Source
- Show Gaps

## 10. Suggested lint behavior

Use `copy-fixtures.json` as the machine-readable source.

Recommended severities:

- **ERROR** — trading instruction, financial guarantee, SAFE/RUG verdict, unsupported identity upgrade, capability-status upgrade, unrestricted-autonomy claim.
- **ERROR** — exact hard-ban/slop phrase in BINRAT-authored public copy.
- **WARN** — high-risk identity/intent/outcome phrase requiring evidence-aware review.
- **WARN** — “nothing/no history/complete/live” without nearby scoping language.
- **INFO** — style drift such as excessive corporate phrasing that is not independently unsafe.

Recommended exclusions:

- code identifiers;
- fixture fields explicitly marked `bad`;
- quoted source/user content;
- documentation sections whose purpose is to enumerate banned phrases;
- tests that assert the linter catches a phrase.

Linting is a tripwire, not an evidence engine. A line can pass every regex and still overclaim.
