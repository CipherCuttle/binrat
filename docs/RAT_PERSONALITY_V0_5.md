# RAT PERSONALITY V0.5

Status: implementation contract

## Thesis

The Rat is not an LLM wearing a mascot.

BINRAT decides what is true. The Rat decides how to say it.

Pipeline:

```
Telegram text
  -> deterministic intent/entity parser
  -> BINRAT public read-plane lookup
  -> typed factual answer plan
  -> deterministic Rat voice renderer
  -> claim-boundary validator
  -> Telegram
```

No personality layer may create evidence.

## NLP

V0.5 uses `compromise@14.16.0` locally in the Telegram service.

It is used only for bounded English intent matching. No model API, embedding service, vector database, or external NLP call is required.

Explicit slash commands remain highest authority.

Natural-language replies require an explicit reference to BINRAT/the Rat in group-style chat. Private bot conversations may omit the repeated Rat name. Ordinary unaddressed group chat is ignored.

Initial intents:

- HELP
- STATUS
- ROADMAP
- WHY
- TOKEN
- PROOF
- CREATOR_HISTORY
- BAG
- RECEIPT
- REPLAY
- BUY_BOUNDARY
- SAFETY_BOUNDARY
- CLARIFY

Entity extraction remains strict:

- EVM creator addresses: `0x` + 40 hex characters;
- launch ids: exactly 64 hex characters.

Low-confidence text produces CLARIFY. It never guesses an intent that would create a factual claim.

## Voice

Renderer version:

`binrat.rat-voice/0.1`

Tone:

- short;
- dry;
- slightly feral;
- competent;
- mildly hostile to bullshit;
- never hostile to the user;
- no corporate assistant voice.

Operational moods are presentation states, not evidence classifications:

- RUMMAGING
- DIGGING
- STUCK_IN_A_PIPE
- EMPTY_PAWS
- SMELLS_FAMILIAR
- BOUNDARY
- NEUTRAL

`SMELLS_FAMILIAR` never means scam/rug.

## Determinism

Voice variants are selected from a SHA-256 digest of:

- renderer version;
- intent;
- mood;
- sorted factual fields;
- receipt ids;
- source references.

No `Math.random()`.

The same factual plan under the same renderer version produces the same reply.

Each delivered reply logs:

- Telegram update id;
- intent;
- renderer version;
- voice variant;
- reply digest;
- evidence receipt ids;
- Telegram message id.

Raw user text is not required in that delivery log.

## Hard boundaries

The renderer has explicit invariant checks against:

- telling a user to buy/sell/ape;
- declaring a token safe;
- declaring a person/address a scammer/rugger;
- guaranteed-return language;
- deterministic price-pump claims.

Questions like “is this safe?”, “should I buy?”, or “is this dev a rugger?” are first-class intents. They receive useful boundary replies instead of generic refusal text.

Creator history always preserves:

same source-reported address != same human identity.

## Examples

User:

`rat should i buy this?`

Rat:

```
🐀 receipts, not prophecies.

i archive garbage. i do not predict candles.

no buy call. no sell call. no entry. give me a launch or creator and i will show you the receipts.
```

User:

`rat did this dev rug before 0x...`

Rat routes to Creator File, reports indexed launches/history coverage/receipt, then states that wallet history is evidence about an address, not a criminal record about a person.

## Later V1

A model may be added only behind this deterministic layer.

A future model gets retrieved canonical evidence and must return a structured answer candidate. Code validates the candidate before RatVoice renders it.

The model never becomes evidence authority.
