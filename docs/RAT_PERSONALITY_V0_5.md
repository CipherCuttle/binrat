# RAT PERSONALITY V0.5

Status: pre-beta implementation contract

## Thesis

The Rat is not an LLM wearing a mascot.

**BINRAT decides what is true. The Rat decides how to say it.**

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

V0.5 uses exact-pinned `compromise@14.16.0` locally in the Telegram service.

It is used only for bounded English intent matching. There is no model API, embedding service, vector database, or external NLP call.

Explicit slash commands remain highest authority.

Group-style natural language requires an explicit BINRAT/Rat reference, except that a direct Telegram reply to the bot also counts as addressed context. Private bot conversations may omit the Rat name. Ordinary unaddressed group chat is ignored.

Conversational replies are gated by `TELEGRAM_REPLIES_ENABLED`. The gate defaults to `false`; only the literal value `true` enables replies. Invalid values fail configuration validation. Authenticated updates received while disabled are acknowledged and intentionally dropped rather than queued for later replay.

Initial intents:

- HELP
- STATUS
- ROADMAP
- WHY
- TOKEN
- PROOF
- CREATOR_HISTORY
- ADDRESS_LOOKUP
- BAG
- RECEIPT
- REPLAY
- BUY_BOUNDARY
- SAFETY_BOUNDARY
- CLARIFY

Routing strength is categorical, not probabilistic:

- `EXPLICIT`
- `STRONG_RULE`
- `AMBIGUOUS`

These labels are routing provenance. They are not calibrated probabilities.

## Entity handling

Launch ids are exactly 64 hex characters.

A bare EVM address is **not assumed to be a creator**. It first becomes `ADDRESS_LOOKUP` and is resolved against the current public feed as:

- `TOKEN`
- `POOL`
- `REPORTED_CREATOR`
- `AMBIGUOUS`
- `UNKNOWN`

A uniquely resolved creator address uses Creator File. A unique token/pool launch uses the bag projection. Multiple roles require clarification. Unknown stays unknown.

Explicit `/creator 0x...` remains an explicit creator request.

## Public API contract

The Telegram consumer fails closed on incompatible projection schemas.

Current consumed contracts:

- Creator File: `binrat.creator-file/0.1`
- bag/public feed: `binrat.public-feed/0.1`
- Replay Lab: `binrat.replay-bundle/0.1`

Replay Lab is integrated into the same Telegram candidate history; `/replay` is not allowed to depend on an untracked sibling-only route.

Capability and launch authorization are read from the live BINRAT public endpoint:

`GET /api/capabilities`

The Telegram process uses remote fail-closed mode. If that status cannot be verified, marketing and launch authorization become false in Rat replies rather than preserving a previously privileged state.

## Voice

Renderer version:

`binrat.rat-voice/0.2`

Answer-plan version:

`binrat.rat-answer-plan/0.2`

The answer plan is a discriminated TypeScript contract per intent rather than a generic fact bag.

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

## Determinism and answer receipts

The exact typed answer plan is canonicalized and SHA-256 hashed as `planDigest`.

RatVoice deterministically selects a voice variant from:

- renderer version;
- plan digest.

No `Math.random()`.

The same answer plan under the same renderer version produces the same reply.

After a successful Telegram send, the Telegram service persists a reply receipt containing:

- Telegram update id;
- chat id;
- intent;
- renderer version;
- voice variant;
- plan digest;
- reply digest;
- exact non-user-text answer plan;
- evidence receipt ids;
- Telegram message id;
- recorded timestamp.

Raw user message text is not stored in that reply ledger.

The ledger is SQLite-backed and suppresses an already-recorded update across process restarts **when the configured database path is on persistent storage**.

This is not an exactly-once delivery claim. A process/network failure after Telegram accepted a send but before the local receipt commit can still create an ambiguous retry window. The contract is replay-safe duplicate suppression for recorded deliveries, not mathematically exactly-once messaging.

## Hard boundaries

The renderer fails closed against phrasing that tells a user to buy/sell/ape, declares a token safe, declares a person/address a scammer/rugger, guarantees returns, or deterministically predicts a pump.

Questions such as “is this safe?” and “should I buy?” are first-class boundary intents rather than prompts for a trading recommendation.

Creator history always preserves:

**same source-reported address != same human identity.**

## Frozen parser evidence

Pre-beta routing is tested against:

- `test/fixtures/rat-intent-corpus-v0.json` — 131 labeled cases;
- `test/fixtures/rat-intent-holdout-v0.json` — 36 labeled cases.

They cover:

- explicit commands;
- degen slang;
- normal private-chat wording;
- group addressing/OOS chatter;
- buy/sell and safety questions;
- creator-risk wording;
- address ambiguity;
- bag/receipt/replay intents;
- clarification behavior.

The holdout is frozen. Parser changes must report their result against it rather than silently rewriting labels to obtain a passing score.

## Later V1

A model may be added only behind this deterministic layer.

A future model receives retrieved canonical evidence and returns a structured candidate. Code validates that candidate before RatVoice renders it.

Retrieved websites/social text must be treated as untrusted data, not instructions.

The model never becomes evidence authority and receives no trading/signing authority.
