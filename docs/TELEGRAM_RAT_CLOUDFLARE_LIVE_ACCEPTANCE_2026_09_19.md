# Telegram Rat Cloudflare Live Acceptance

Date: 2026-09-19 CEST

Repository branch: `ops/cloudflare-deploy-v0`

## Verdict

**PASS**

Telegram ingress and deterministic Rat replies are live on the Cloudflare Worker candidate.

## Live evidence

Cloudflare Worker version:

`da3b86c6-7478-4ddb-8748-1f169ce8fdcc`

Worker URL:

`https://binrat-edge-v0.pettevik.workers.dev`

Telegram bot:

`@BinratBot`

Ingress acceptance:

- Telegram webhook cut over from the unchanged Render fallback to Cloudflare.
- `pending_update_count = 0` after cutover.
- Telegram reported no webhook delivery error.
- Replies remained disabled during ingress smoke.
- A real Telegram update persisted in D1 as `IGNORED`.

Reply acceptance:

- `TELEGRAM_REPLIES_ENABLED = true`.
- `launchAuthorization = BLOCKED`.
- Real Telegram update id: `462260005`.
- D1 terminal state: `REPLIED`.
- Intent: `STATUS`.
- Renderer: `binrat.rat-voice/0.2`.
- Voice variant: `0`.
- Plan digest: `6dbea89131340d6e8abe485fcc83606f9757a2fd86e3978ccafea325935afbe2`.
- Reply digest: `8666eda9dc90586109a66ab7decc4f9531878c58462c992ef82382132ba56c2d`.
- Telegram message id: `7`.

Indexer state at acceptance:

- `indexReady = true`.
- `observationReady = true`.
- `lastObservationError = null`.
- `lastSyncError = null`.

## Safety boundary

This acceptance does **not** authorize:

- token launch;
- token marketing;
- trading or signing;
- wallets or capital;
- BUY/SELL recommendations;
- unsupported creator identity claims.

Canonical launch authority remains:

- `status = BLOCKED`;
- `marketingAuthorized = false`;
- `launchAuthorized = false`;
- `tokenState = NOT_LAUNCHED`.

## Rollback

The Render Telegram service was left unchanged. Restarting/redeploying that service can re-register its original webhook and remains the rollback path until Cloudflare acceptance is deliberately made canonical.

## Status

**CLOUDFLARE EDGE CANDIDATE: PASS**

**TELEGRAM RAT INGRESS: PASS**

**TELEGRAM RAT LIVE REPLIES: PASS**

**TOKEN / MARKETING AUTHORITY: BLOCKED**
