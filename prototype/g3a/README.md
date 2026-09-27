# BINRAT — approved R5 frontend integration

This Svelte 5 + Vite prototype implements the **owner-approved R5
discovery hero**, the archived Pons V2 receipt scanner, evidence-first
Rat Radar, and a strictly separate fictional Rat Trap.

The homepage lazy-loads the **official React Bits Pro Starter Grain Wave**
as a small React island. The paid component is downloaded only into
the ignored `src/premium-grain/` workspace from the owner's authenticated
Starter registry. Its exact TSX/CSS hashes are pinned in
`scripts/install-licensed-grain.mjs`; never commit raw licensed files,
print the license secret, or publish sourcemaps.

## Run locally

Use Node 22 and pnpm 10. Set `REACTBITS_LICENSE_KEY` as a private
environment variable (never commit it), then from `prototype/g3a`:

```sh
pnpm install --frozen-lockfile
node scripts/install-licensed-grain.mjs
pnpm build
pnpm test
pnpm dev
```

The experimental `dist/` directory is intentionally committed after
source build and browser tests for immutable GitHack previews; this is
**not** a production deployment.

## Pons evidence boundary

- Fixture: `BINRAT-G1A-PONS-4663-20260926-v3`.
- Exactly one verified *historical* Pons V2 factory event; not live.
- Funding, price history, graduation and V4 status remain unknown/not
  reconstructed. Never imply real-time monitoring or a trading signal.
- MOLD is a separate **fictional DEMO**: four synthetic fund transfers
  and three fictional previous launches; shared funding does not prove
  common ownership, safety or performance.
- No live backend, wallet, trading, payment, alerting, or network API.
- The original owner-supplied `rat-original.jpg` is unchanged:
  SHA-256 `43541a9b469fbe46a9b54dccb227cfb21c7fcfade1d96656410b124ded2d3edc`.

## Runtime hardening

On supported devices, the React/Three shader is loaded after feature and motion checks. On WebGL2 failure, context loss, hidden tabs or reduced motion, a lightweight static background remains visible and all navigation works. The renderer is disposed on scene changes; browser tests cover GPU failure and context loss.

## Visual acceptance

The owner approved R5 on Android on 2026-09-27. The standard homepage
uses the original Grain Wave demo's motion, count and red/blue colors in
the approved responsive layout. `?demo-isolate=1` removes all BINRAT
composition for direct comparison with the original demo;
`?static-sky=1` shows the low-power/static variant.

See `FRONTEND_INTEGRATION.md` for acceptance checks and provenance.
This is an isolated draft integration PR: **merge authority NONE**.
