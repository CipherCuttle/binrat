# BINRAT

> He gets the scraps. You get the receipts.

BINRAT is an autonomous Arc launch-intelligence project. New launches are **HOT GARBAGE**. BINRAT watches launch events, preserves chain-authoritative facts, reconstructs creator history, and later publishes replayable receipts.

The token is not launched in V0. This repository does not contain signing, trading, buy/sell recommendation, or capital-execution authority.

## V0

V0 indexes ArcPad `TokenCreated` events on Arc mainnet into SQLite, maintains deterministic creator provenance, handles replay/reorgs, and provides a CLI for backfill/watch/inspection.

```bash
cp .env.example .env
pnpm install
pnpm check
pnpm backfill
pnpm watch
pnpm inspect 0xTOKEN
```

See `docs/PRD.md`, `docs/CODEPLAN.md`, `docs/CLAIM_BOUNDARY.md`, and `docs/DONOR_PROVENANCE.md`.
