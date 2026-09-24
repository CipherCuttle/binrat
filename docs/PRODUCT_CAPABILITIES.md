# BINRAT — technical route map (NOT a visual spec)

Current frontend design authority: `docs/design/BENTO_DASHBOARD_V1.md`, based on the owner's latest bento screenshot and wireframe. Technical data authority remains the validated public API and `docs/CAPABILITY_MANIFEST_V0.json`.

- Dumpster `/dumpster` → exact Bag `/bag/:id`: independently validated launch feed and source-reported token metadata, including untrusted `imageUri`. Token images are not project endorsements.
- Radar `/radar` → `/radar/address/:address`: observed recipient recurrence, independently validated coverage, public activity IDs and receipts. An observed recipient is NOT a known human creator.
- Creator `/creator/:address`: source-reported creator address from a specific indexed launch. No invented Creator directory.
- Replay `/replay`: real available frozen case observations only; unavailable horizons remain unavailable.
- Ledger `/ledger`: financial transparency / currently prelaunch-limited; NOT an alternative public launch-history feed.
- Watch `/watch`: truthful Telegram confirmation and accepted subscription boundaries. Saved local bookmarks are NOT Watch subscriptions.
- Method `/method`: actual ranking, checkpoint and coverage explanation.

`GET /api/health` independently supplies launchCount, index readiness, runtime freshness and checkpoint. `GET /api/feed` and `GET /api/rat-radar/watchlist` have independent timestamps, error and coverage states. A 200 health response can still contain `ok:false`. Never convert partial/unavailable data into synthetic LIVE totals or a fabricated historical chart.

Display real source-reported token artwork on exact linked-launch records when safe and available, with a controlled missing-image fallback. Never invent a human portrait from an address. This document grants no merge, deployment, token-launch, wallet, trading or fund authority.
