# BINRAT — Backend capability inventory (no frontend)

There is no implemented or approved frontend on this branch. Public HTTP responses, their schemas and source receipts are the product contracts, not any retired screen or route layout. Refer to `docs/CAPABILITY_MANIFEST_V0.json` for actual deployment and launch-authorization state.

- `GET /health` and `GET /api/health`: service health and independently validated index readiness; an HTTP 200 response with `ok:false` is not READY.
- `GET /api/capabilities`: explicit feature and launch-authorization manifest.
- `GET /api/feed` and `GET /api/bag/:id`: indexed source-reported launches and exact supporting evidence, with coverage and checkpoint.
- `GET /api/creator/:address`: history of an exact source-reported creator address, never proof of a common human identity.
- `GET /api/replay/:id`: available point-in-time observation horizons and honest missing stages.
- `GET /api/rat-radar/watchlist` and related address/activity endpoints: observed swap-recipient recurrence, independently validated timestamps, source receipts and incomplete-history warnings.
- `GET /api/dumpster-ledger`: existing prelaunch-limited financial projection; absent transactions are not implied to have occurred.
- Authenticated Telegram webhook and existing Watch commands: separate backend capabilities; no new callback permissions, media hosting or production cutover are implied.

Arc 5042 evidence and Robinhood/Pons 4663 evidence must remain isolated until exact source and checkpoint compatibility are independently established. Feed/Radar/Health may have different checkpoints; unavailable data cannot silently become synthetic LIVE data.

No future UI composition, palette, library, component structure or asset selection is prescribed here.
