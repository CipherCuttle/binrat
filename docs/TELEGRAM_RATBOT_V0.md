# TELEGRAM RAT V0

Status: implementation specification  
Goal: let BINRAT communicate continuously without requiring the founder to answer routine questions manually.

## Product role

The Telegram bot is **the Rat**: BINRAT's automated public voice.

It uses the canonical mascot as its avatar and clearly identifies itself as automated.

Tone:

- short;
- dry;
- slightly feral;
- factual;
- no corporate voice;
- no fake certainty.

Example:

> 🐀 dug through the bin.
>
> Intelligence V1: CLOSED / PASS
> Exact reviewed head: 69793aef...
> No token launched. No trading authority.
>
> receipts: <link>

## Recommended Telegram structure

### 1. Announcement channel

The Rat is an administrator and posts:

- shipped product milestones;
- release notes;
- important evidence/indexer status;
- meaningful ecosystem updates;
- new public experiments;
- bounty/case announcements later.

Avoid posting every commit.

### 2. Discussion group

Users can ask the Rat questions.

Initial deterministic commands:

- `/status`
- `/roadmap`
- `/why`
- `/token`
- `/creator 0x...`
- `/bag <id>`
- `/receipt <id>`
- `/faq`
- `/proof`

## Architecture boundary

Do not couple Telegram availability to evidence authority.

Preferred topology:

```
BINRAT indexer / public API
          |
          | read-only HTTP
          v
Telegram Rat service
          |
          +--> announcement channel
          +--> discussion group
```

The Rat consumes BINRAT's public read plane.

It does not write launch/provenance/observation evidence directly.

Telegram failure must not affect indexing.

## Runtime

Use a small separate Node/TypeScript process in the same repository and a separate deployment/service.

Production should use Telegram webhooks over HTTPS.

Validate Telegram's webhook secret header before processing any update.

Suggested environment variables:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`
- `TELEGRAM_CHANNEL_ID`
- `TELEGRAM_DISCUSSION_CHAT_ID`
- `BINRAT_PUBLIC_BASE_URL`
- `BINRAT_PUBLIC_SITE_URL`

Never commit tokens or webhook secrets.

## Update pipeline

Outbound project updates should come from an explicit publishable event/outbox, not raw Git commit spam.

Candidate public update types:

- `release.shipped`
- `system.degraded`
- `system.recovered`
- `launch.creator_recurrence_observed`
- `observation.horizon_completed`
- `case.opened`
- `bounty.opened`
- `bounty.resolved`

Every outbound event gets:

- deterministic event id;
- payload version;
- source reference;
- created timestamp;
- Telegram delivery status;
- Telegram message id;
- retry count.

Identical event id + identical payload is replay-safe.

Changed payload under the same immutable event id fails closed.

## Question answering

### V0

Answer deterministic commands from:

- canonical docs;
- public status;
- public API;
- receipt links.

### V1 conversational Rat

A model may answer natural-language questions only when grounded in retrieved canonical sources.

Rules:

1. retrieve canonical docs/API evidence first;
2. distinguish shipped, planned, experimental, and unknown;
3. attach receipt/source links where possible;
4. never infer token price or expected return;
5. never fabricate dates or partnerships;
6. never claim two addresses are the same human without explicit evidence;
7. when evidence is absent, say the Rat does not know;
8. log the question, retrieved evidence ids, answer, and model version for replay.

Frequently repeated unanswered questions become candidates for the canonical FAQ.

## Investor/backer questions

The Rat may explain:

- what is shipped;
- what is planned;
- why Rat Credits exist;
- token-gating criteria;
- technical architecture;
- known risks;
- public roadmap;
- public evidence.

The Rat must not provide:

- promises of returns;
- future token-price claims;
- undisclosed fundraising terms;
- private allocations;
- invented partnerships;
- individualized investment advice.

## Rat Watch integration

Later, users can opt into:

- creator recurrence alerts;
- Trash DNA alerts;
- watched-launch observation updates;
- case/bounty state changes.

Subscriptions must be explicit and rate-limited.

## Security / abuse

Required controls:

- webhook secret validation;
- input length limits;
- per-chat rate limits;
- command allowlist;
- URL/address validation;
- Telegram update-id dedupe;
- outbound event dedupe;
- bounded retries;
- no secrets in logs;
- no arbitrary URL fetch from user input;
- no arbitrary code execution;
- no trading/signing authority;
- moderator kill switch for conversational replies.

## Avatar

Use the canonical BINRAT mascot already committed as:

`web/assets/binrat-hero.webp`

Set the bot profile image manually through Telegram/BotFather using the canonical exported image.

The application should never depend on the avatar image being retrievable from Telegram.

## Acceptance gates

V0 passes when:

1. `/status` reports canonical status correctly;
2. `/roadmap` distinguishes shipped vs planned;
3. `/creator` returns a public Creator File or a bounded not-found response;
4. one explicit release event posts exactly once to the announcement channel;
5. duplicate delivery is idempotent;
6. invalid webhook secret is rejected;
7. Telegram outage does not affect BINRAT indexing;
8. no bot token appears in repository/history/log fixtures;
9. bot identifies itself as automated;
10. no BUY/SELL, token-price, return promise, or unsupported identity claim is emitted.

## First deployment sequence

1. create bot with @BotFather;
2. set canonical mascot/avatar;
3. add bot as channel administrator with post permission;
4. add bot to discussion group;
5. deploy dedicated Rat service;
6. configure secrets in deployment environment;
7. set HTTPS webhook + webhook secret;
8. register commands;
9. run private smoke test;
10. enable announcement posting;
11. enable discussion replies only after deterministic command tests pass.
