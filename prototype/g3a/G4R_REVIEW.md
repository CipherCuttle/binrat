# G4-R · Cinematic Intelligence (experimental review)

Status: one disposable Svelte 5 visual hypothesis. **Not a production design system or owner-approved frontend.**

## Visual authority

The two 26 Sep 2026 owner-provided screenshots establish the art/workspace relationship:
- Homepage: a large illustrated rat + cyberpunk sunset, with navigable product modules inside that world.
- Radar: a dark observation table opposite one warm, tactile paper case file.
- Mobile: retain the illustrated world on arrival, then show a dedicated list → case transition instead of shrinking desktop columns.

Original approved `rat-original.jpg` is unchanged. Hero sunset and skyline are lightweight CSS atmosphere surrounding that image; buttons, text, table, case file and scanning are real Svelte components, not a flat image.

## Functional contract

- Home → Radar → select historical token → skippable **preloaded** receipt scanner → Dig Deeper → separately **fictional** MOLD Rat Trap.
- One actual frozen historical Pons V2 factory record. **No live index, RPC, wallet, transaction submission, watch alerts or ranking.** Unavailable product tiles explicitly say Planned.
- The original deployer is **not** established to be a fee recipient or human owner. Direct funding, token pricing, graduation and V4 state remain UNKNOWN/NOT RECONSTRUCTED.
- The source caveat, independent proof manifest and original Robinscan link remain available in Dig Deeper.
- MOLD, its four funding transfers, three previous launches, 6h/24h/3d/7d denominators and optional small relationship view are **fully fictional**, unrelated to the real receipt, and do not infer human identity or profitable trades.
- History, keyboard, reduced motion, accessible horizontal strips and focus behaviors inherit the G3c functional hardening without merging PR #46.

## Visual decision

The rat speaks in observations. The UI presents evidence. Cinematic art is reserved for arrival and workspace mastheads; densely readable dark application surfaces and a single selected paper document carry the actual investigation. Accents are limited to warm gold for primary action and sea glass for evidence.

## Verification and approval gates

`pnpm install --frozen-lockfile && pnpm build && pnpm test` inside `prototype/g3a`; immutable `pnpm test:published` against the exact PR head via CI. Screenshot fixtures include desktop 1440, 390px and 320px for world, Radar, selected paper case and dossier. Inspect image artifacts and perform a physical Android Back/Forward and small-font test before owner approval.

**No merge authority.** Do not treat CI, screenshots or this documentation as owner aesthetic approval or a production release.
