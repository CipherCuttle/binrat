> **Current source-of-truth entrypoint:** [docs/CANONICAL_AUTHORITY.md](docs/CANONICAL_AUTHORITY.md). This integration branch contains multiple **historical ArcPad / Cloudflare V0 statements below**. They are retained for project history and do **not** describe current Pons V2 / React V3 production, self-hosting status or token authorization. Read [Founder North Star](docs/BINRAT_FOUNDER_NORTH_STAR.md) for product direction, [Engineering Stack North Star](docs/ENGINEERING_STACK_NORTH_STAR.md) for technical choices, and [Agent Work Policy](docs/AGENT_WORK_POLICY.md) for bounded execution. Only current deployed/verified evidence decides actual live capability.

# BINRAT

**Historical V0 description (ArcPad/Arc 5042 only):** BINRAT began as an Arc launch-intelligence project that watched events, preserved facts and published receipts. Current Pons/Robinhood 4663 and React V3 direction is defined by the linked Founder and Engineering North Stars; this V0 text is not the present product scope.

**Historical infrastructure note:** The earlier public beta used Cloudflare static assets, Worker API, D1, Queues and Telegram. This is **not a claim of present availability or freshness** after the October 2026 Cloudflare containment and self-hosting rescue. The recovered SQLite proof and independent deployment have separate acceptance gates.

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
