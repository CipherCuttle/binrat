# BINRAT — backend only

This is the original BINRAT ArcPad indexing and evidence baseline, with **no web frontend or approved visual style**. It indexes source-reported launches on Arc, stores deterministic identities and provenance in SQLite, handles replay/reorgs and exposes command-line backfill, watch and inspection.

```sh
cp .env.example .env
pnpm install
pnpm check
pnpm backfill
pnpm watch
pnpm inspect 0xTOKEN
```

The original website, styling, mascot images, published design documents and static publishing scripts have been removed. Nothing in this branch defines a layout, visual theme, font, component system or frontend framework. A future website requires a fresh design decision, not restoration of the rejected interface.

More recent backend work is still on separate, not-yet-main branches. In particular, `feat/binrat-frontend-mobile-m1` now contains the merged **backend-only reset** from PR #31 despite its historical branch name. Do not confuse this small original `main` baseline with the more advanced backend integration branch.

Evidence boundaries are defined by `docs/CLAIM_BOUNDARY.md` and `docs/PUBLIC_READ_PLANE.md`. There is no token-launch, wallet, trading, signing or deployment authority conferred by removing the frontend. Existing deployed sites and historical Git branches are separate from the active code tree.
