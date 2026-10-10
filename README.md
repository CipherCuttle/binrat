# BINRAT

BINRAT is an autonomous Arc launch-intelligence project. New launches are **HOT GARBAGE**. BINRAT watches launch events, preserves chain-authoritative facts, reconstructs creator history, records point-in-time observations, and publishes replayable receipts.

The current public beta runs on Cloudflare: static web assets + Worker API + D1 persistence + Queue-driven live/history/observation work + the Telegram Rat. Local development still supports SQLite-backed CLI workflows.

The token is not launched. This repository does not contain signing, trading, buy/sell recommendation, or capital-execution authority. Token launch and token marketing remain explicitly blocked in the canonical capability manifest.

## V0

V0 indexes ArcPad `TokenCreated` events on Arc mainnet, maintains deterministic creator provenance, handles replay/reorgs, reconstructs frozen observation horizons, and exposes public evidence through web/API/Telegram surfaces.

```bash
cp .env.example .env
pnpm install
pnpm check
pnpm backfill
pnpm watch
pnpm inspect 0xTOKEN
```

Evidence boundaries are defined by `docs/CLAIM_BOUNDARY.md` and `docs/PUBLIC_READ_PLANE.md`. There is no token-launch, wallet, trading, signing, or capital-execution authority in this repository.
