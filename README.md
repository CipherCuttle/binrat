# BINRAT

> He gets the scraps. You get the receipts.

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

Frontend **current owner design direction**: [`docs/design/BENTO_DASHBOARD_V1.md`](docs/design/BENTO_DASHBOARD_V1.md). Engineering agent entry: [`AGENTS.md`](AGENTS.md). The existing GitHack G2 preview is visually obsolete and is not the owner-approved new design.

Product and evidence documentation: `docs/PRD.md`, `docs/CODEPLAN.md`, `docs/CLAIM_BOUNDARY.md`, and `docs/DONOR_PROVENANCE.md`.
