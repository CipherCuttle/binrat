# BINRAT G3a disposable interaction prototype

Isolated Svelte 5 + Vite experiment implementing one frozen journey:

`Fresh Garbage → optional receipt retrieval → Dig Deeper → back`

## Truth boundary

- Fixture: `BINRAT-G1A-PONS-4663-20260926-v3`.
- The Pons V2 factory event is a verified historical snapshot, **not live**.
- Funding, pricing, fee recipient, graduation and V4 status remain unknown or not reconstructed.
- MOLD is a separate fictional DEMO and is never attached to the historical token.
- No wallet, trading, payment, monitoring, backend or network API is present.

The rat asset is the owner-supplied 1536×1536 JPEG from the G1a package, SHA-256
`43541a9b469fbe46a9b54dccb227cfb21c7fcfade1d96656410b124ded2d3edc`.

## Run

```bash
pnpm install
pnpm build
pnpm test
pnpm dev
```

The compiled `dist/` directory is intentionally committed so the experimental branch can be opened through GitHack without production deployment.
