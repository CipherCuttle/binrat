# BINRAT language & journey contract V1

**Status:** restored product-language authority for the current Pons/Robinhood Telegram surface. This contract consolidates owner-accepted decisions from the Pons-first blueprint (PR #43), Telegram UX V2 plan, prior Rat Trap prototype work, and the 2026-10-01 owner acceptance feedback. It governs presentation only; evidence contracts remain authoritative.

## North star

**He gets the scraps. You get the receipts.**

BINRAT is dumpster intelligence, not a generic analytics terminal with a rat emoji. The rat rummages through noisy launches, notices a trail worth keeping, and brings back receipts. The product should feel like memecoin gossip with evidence underneath: fast, grubby, competent, suspicious of bullshit, and never cute or finance-bro.

The first five seconds must answer:

1. **What did the rat find?**
2. **Why does it smell interesting?**
3. **What can I do next?**

Technical coverage, block numbers, evidence counts and raw receipts sit one level deeper unless they are themselves the finding.

## Canonical journey

**Fresh Garbage → Dig Deeper → Rat Trap → Rat Watch**

These are different jobs and must not collapse into one repeated “same deployer” screen.

### Fresh Garbage

Job: show fresh Pons findings worth a closer look.

Language: discovery, scraps, familiar paws, found something, smells familiar.

Do:
- lead with the current launch/token;
- state the shortest factual reason it surfaced;
- show 1–3 prior project names when available;
- offer one primary action: **Dig Deeper**.

Do not:
- headline lifetime launch counts;
- headline block numbers or retained-receipt counts;
- ask the user to Watch before showing why the history matters;
- present an arbitrary historical leaderboard as fresh discovery.

Internal code may still call this RATS. User-facing copy should not depend on that implementation name.

### Dig Deeper

Job: turn one finding into a compact story.

Language: digging, trash trail, dug it up, receipts.

Show:
- current launch;
- same reported deployer/funder relationship that caused the finding;
- prior projects;
- known lifecycle/outcome facts;
- explicit gaps where outcome data is missing.

One primary next action should move into **Rat Trap** when enough comparable historical evidence exists. Raw receipts remain available, but are not the main story.

### Rat Trap

Job: answer **“what happened the other times these paws showed up?”**

This is where prior-project outcomes belong. Historically accepted fields include:
- observed peak valuation;
- latest supported valuation;
- time to peak;
- drawdown/lifespan;
- comparable windows (6h / 24h / 3d / 7d);
- honest denominators and missing/immature cases.

This layer is historical context, not prediction.

**Market-cap wording rule:** call a value market cap only when circulating supply is actually verified. Otherwise use **estimated FDV**, token/pair quote, or another precisely qualified valuation. Never silently label FDV as market cap.

After the user can see why the trail matters, offer the meaningful monitoring action: **Add to Rat Watch**.

### Rat Watch

Job: remember a trail the user decided was worth keeping.

Language: watching, squeak, familiar paws returned.

Watch copy should promise only the supported future event, for example:
- “Rat Watch set. I’ll squeak if these paws launch again.”
- Alert: “Trap sprung. Familiar paws are back.”

Do not imply profitability, safety, maliciousness, shared human identity or guaranteed timing.

## Voice

The rat is:
- dry;
- grubby;
- competent;
- observant;
- mildly hostile to bullshit;
- degen-readable;
- concise.

The rat is not:
- cute;
- anime/furry;
- a generic cyberpunk terminal narrator;
- a compliance memo;
- a trading influencer;
- a predictive oracle.

Facts remain precise even when the expression is playful. Persona may compress or decorate a fact; it may not change the fact.

## Preferred lexicon

| Product meaning | Preferred language |
|---|---|
| new discovery | **Fresh Garbage**, **Found something**, **Smells familiar** |
| investigation | **Dig Deeper**, **Digging**, **Dug it up** |
| creator/deployer history | **Trash Trail** |
| evidence | **Receipt**, **Receipts worth keeping** |
| historical related-project comparison | **Rat Trap** |
| monitoring | **Rat Watch** |
| no current finding | **Empty paws** |
| provider/source failure | **Lost the trail** / **Stuck in a pipe** depending the actual error |
| repeat pattern | **Familiar paws**, with exact-address evidence available underneath |

Avoid level-one implementation vocabulary such as:
- indexed launch counts as the headline;
- retained receipt counts;
- source checkpoints;
- runtime freshness;
- chain-health terms;
- raw block numbers unless the block itself is relevant to the user’s question.

## Copy contract

For a discovery card:

1. one short rat headline;
2. current launch/token;
3. at most three supporting observations;
4. one primary action;
5. optional secondary evidence action.

Example shape:

> 🐀 SMELLS FAMILIAR.  
> **$XYZ** turned up in Fresh Garbage.  
> Same paws left receipts on **$ABC · $DEF · $GHI**.  
> That is a trail worth digging. Not a verdict.

Primary action: **Dig Deeper**.  
Secondary: **Receipts** or **Copy deployer**.

Do not put **Watch** on this first card until Rat Trap can show enough history to justify why the user may want to monitor it.

## Evidence and claim boundary

The existing evidence contracts remain unchanged:
- same address does not establish the same human;
- a transfer does not prove common ownership/control;
- missing history remains UNKNOWN/PARTIAL/UNVERIFIED;
- no safety/rug/scam score;
- no BUY/SELL recommendation;
- no profitability or future-outcome claim;
- historical temperature is descriptive, not predictive.

Cheeky copy is a projection of receipts, never evidence authority.

## Telegram interaction contract

Telegram should be independently useful without the Mini App.

Avoid rubber-band journeys where the user repeatedly visits RATS → CASE → WHY → WATCHES to learn the same fact. The reason a finding surfaced belongs on the discovery card. **WHY/Full receipt is evidence depth, not a mandatory intermediate screen.**

Native happy path:

**Fresh Garbage → Dig Deeper → Rat Trap → Add to Rat Watch**

The Mini App/Radar may later provide denser evidence and charts, but it must complement this path rather than rescue an incoherent native flow.

## Current data gap

The active Pons 4663 surface currently has canonical launch/deployer evidence but does **not** yet expose a supported Pons historical valuation/outcome projection. Existing observation and swap machinery is not sufficient authority for a live Pons market-cap claim.

Until a separate Pons outcome contract is implemented:
- show prior project identity/history;
- do not fabricate MC/ATH/lifespan;
- keep Watch secondary or behind Dig Deeper;
- label missing outcome context honestly.

Next data milestone: a bounded **PONS_OUTCOME_V1** receipt capable of supporting qualified historical peak/latest valuation and time-window comparisons for previous launches.
