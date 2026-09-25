# BINRAT — Backend and evidence services

BINRAT indexes launch activity, maintains source-backed address and observation records, and publishes time-bound public evidence. This branch contains **no frontend**: no website, HTML, React, CSS, client-side routes, design system, web artwork, static-asset hosting or GitHack publishing pipeline. No aesthetic direction has been selected for any future UI.

The API, Arc indexer, historical replay, public projections, D1/Queue integration, Pons backend candidate and Telegram service remain separate technical capabilities. Their claimed deployment state is governed by `docs/CAPABILITY_MANIFEST_V0.json`, not by this unmerged branch. Existing public web deployments are **not** deleted by a Git commit.

Install and verify the backend:

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm serve:live
```

The local server now serves JSON APIs only. Cloudflare's candidate Wrangler configuration has no static assets binding; **do not deploy this configuration over a public website without an explicit migration plan**.

Source-of-truth technical docs: `AGENTS.md`, `docs/PRODUCT_CAPABILITIES.md`, `docs/CLAIM_BOUNDARY.md`, `docs/PHILOSOPHY.md`, `docs/ROADMAP_V0.md`. Previous visual experiments remain recoverable only as Git history and are not requirements. No merge, production deployment, token launch, wallet access, trading, funds or webhook cutover is authorized by this reset.
