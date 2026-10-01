# Rat Watch V0 Live Subscription Acceptance

Date: 2026-09-19 CEST

Repository branch: `feat/binrat-rat-watch-v0`
PR: #18
Accepted head: `cc782f04b08c938412394fd587f7158426acc067`

## Verdict

**LIVE SUBSCRIPTION ACCEPTANCE: PASS**

**REAL FUTURE RECURRENCE ALERT: PENDING**

## Live evidence

Watched ArcPad-reported creator address:

`0x05952cb87116ddfbc4a2f85204e4e267202dd950`

Historical indexed evidence before watch:

- indexed launch count: 2
- first indexed block: 19036645
- last indexed block: 19120527

The live watch was armed from checkpoint/start block:

`21585477`

Therefore the two older launches are outside the watch scope and must not create retroactive alerts.

Durable D1 subscription evidence:

- chat id: `1477488882`
- creator: `0x05952cb87116ddfbc4a2f85204e4e267202dd950`
- start block: `21585477`
- created_at_ms: `1789778891575`

Durable Telegram operational receipt:

- update id: `462260007`
- state: `REPLIED`
- intent: `WATCH`
- renderer: `binrat.operational/0.1`
- reply digest: `196697dda699a9a707f451d1fea4f3f06d44225d105a95378fb24d9fd22c9f20`
- Telegram message id: `11`

Earlier `/watches` operational receipt:

- update id: `462260006`
- state: `REPLIED`
- intent: `WATCH_LIST`
- renderer: `binrat.operational/0.1`
- Telegram message id: `9`

## Engineering gates

Head `cc782f04b08c938412394fd587f7158426acc067`:

- CI #181 PASS
- Cloudflare dry-run #41 PASS
- PR #18 mergeable
- hostile review completed
- High unsubscribe/pending-alert leak fixed
- targeted rereview clean
- runtime/live D1 schema parity guarded

## Boundary

This acceptance proves:

- live `/watches`;
- live `/watch`;
- exact reported-address subscription persistence;
- future-only start block;
- durable operational Telegram receipt.

This acceptance does **not** yet prove:

- delivery of a real recurrence alert from a future matching launch.

No synthetic launch will be injected into production to manufacture that evidence.

Identity boundary remains:

`same ArcPad-reported address != same human identity`

Token/marketing/trading/signing/capital authority remains blocked or absent.

## Current status

**RAT WATCH ENGINEERING: PASS**

**RAT WATCH D1 MIGRATION: PASS**

**RAT WATCH LIVE SUBSCRIPTION: PASS**

**RAT WATCH COMMAND RECEIPT: PASS**

**REAL RECURRENCE ALERT: ARMED / PENDING FUTURE REAL LAUNCH**

**TOKEN / MARKETING AUTHORITY: BLOCKED**
