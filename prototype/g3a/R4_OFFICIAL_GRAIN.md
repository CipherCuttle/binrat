# BINRAT R4 — actual React Bits Pro Starter Grain Wave

This branch replaces the disliked home-built contour approximation with the official
`grain-wave-css` component fetched from React Bits Pro's licensed Starter registry.

The owner's existing GitHub Actions `REACTBITS_LICENSE_KEY` was verified in preflight
run https://github.com/CipherCuttle/binrat/actions/runs/36299461295. Verified registry
file hashes (TSX and CSS) are pinned in `scripts/install-licensed-grain.mjs`.
The paid source is deliberately only present in the job's git-ignored workspace.
The public repository receives BINRAT's integration code and minified site bundle,
not reusable premium component source, and no source maps or license keys.

The original official demo numeric values are used first for speed (0.5), count
(25), amplitude (0.85), frequency (4), width (3.5), variation (0.006), thickness
(0.2), grain (50), scale (0.6), and brightness (1). Only palette changes to
BINRAT's rose/peach. A React 19 + React Three Fiber island mounts inside the
existing Svelte 5 homepage and unmounts before entering Radar. Reduced-motion
keeps a static CSS sunset without mounting WebGL.

Do not copy the paid TSX/CSS from CI to the public repo. When building locally,
set `REACTBITS_LICENSE_KEY` in your own shell and run:
`pnpm install && node scripts/install-licensed-grain.mjs && pnpm build`.
A new upstream component revision must be visually reviewed and repinned.

No merge, deployment or production funding authority. Screenshots and exact
GitHack smoke are required before owner visual approval.
