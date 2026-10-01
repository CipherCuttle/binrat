# BINRAT Cloudflare Web Live Acceptance

Date: 2026-09-19 CEST

Repository branch: `ops/cloudflare-deploy-v0`

## Verdict

**PASS**

The BINRAT public web frontend is served as Cloudflare Worker static assets on the same edge deployment as the public API, indexer control plane, D1 persistence, observation lane, and Telegram Rat webhook.

## Deployment evidence

Cloudflare Worker version:

`9b3c59ba-efa9-457b-84c0-494e803fb880`

Public site:

`https://binrat-edge-v0.pettevik.workers.dev/`

Static asset deployment:

- 19 files discovered in `web/`;
- 17 new or modified assets uploaded successfully;
- Worker and scheduled/Queue bindings remained present after deployment;
- `BINRAT_PUBLIC_SITE_URL` points at the Cloudflare Worker root.

## Live acceptance

The guarded live verifier returned:

- `CLOUDFLARE_WEB_LIVE: PASS`;
- homepage title matched `BINRAT — The Dumpster`;
- `indexReady = true`;
- `observationReady = true`;
- `repliesEnabled = true`;
- `launchAuthorization = BLOCKED`;
- `lastSyncError = null`;
- `lastObservationError = null`.

## Verification

Repository checks before deployment:

- TypeScript build PASS;
- 98 tests PASS / 0 fail;
- BINRAT web invariants PASS;
- share-card invariants PASS;
- launch-presentation invariants PASS.

GitHub gates for head `b3e6b49801ebf524f0485358cfe0e8d920244709`:

- CI #164 PASS;
- Cloudflare dry-run #26 PASS.

## Architecture after acceptance

```
Cloudflare static assets
        |
        +--> /api/* --------> Worker --> D1
        |
        +--> /health --------> Worker control plane
        |
Telegram --> /telegram/webhook --> Worker --> D1 --> RatVoice --> Telegram
        |
Cron --> Queue --> live/history sync
                 --> separate observation jobs
```

The existing Render services were not modified and remain rollback infrastructure.

## Safety boundary

This acceptance does **not** authorize:

- token launch;
- token marketing;
- trading/signing;
- wallets or capital;
- BUY/SELL recommendations;
- unsupported identity claims.

Canonical launch authority remains:

- `status = BLOCKED`;
- `marketingAuthorized = false`;
- `launchAuthorized = false`;
- `tokenState = NOT_LAUNCHED`.

## Status

**CLOUDFLARE WEB: PASS**

**CLOUDFLARE EDGE API/INDEX: PASS**

**TELEGRAM RAT INGRESS + LIVE REPLIES: PASS**

**RENDER: ROLLBACK ONLY**

**TOKEN / MARKETING AUTHORITY: BLOCKED**
