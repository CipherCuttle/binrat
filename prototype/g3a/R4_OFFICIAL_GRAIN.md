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

### First-pass verification repair
The first official-source build succeeded; 29 of 30 existing Playwright checks passed. Its remaining desktop visual test reached a 30-second deadline while attempting a later navigation click under software WebGL. The first screenshots also exposed an unrelated ThemeProvider `script` element made visible by an overly broad integration CSS selector; that selector is now narrowed to `div` and canvas and scripts are explicitly kept hidden. Since first-pass headless screenshots were static, the Chromium test harness now explicitly enables software WebGL and captures only the official shader canvas over two times, requiring unequal PNGs on 1440, 390 and 320. The visual test's deadline accommodates GPU initialization; it is not a waiver of motion acceptance.

### CI performance isolation after software WebGL
The actual official shader renders dynamic pixels at 1440, 390 and 320 on Chromium SwiftShader. A site-wide GPU load exposed timer-dependent tests that expected the retrieval skip control to persist past its 3-second automatic completion. The functional route/axe/screenshot tests now intentionally use the public low-power query `?static-sky=1` (same static fallback as reduced motion, but without changing scanner timing). Dedicated R4 visual tests **do not** use this query and require rendered official shader motion on all three viewports. The published GitHack primary journey still exercises the normal active component; its skip action handles either a live skip control or natural completion. This keeps the shader verified without letting unrelated functional test scheduling depend on software GPU throughput.

### Final source-gate result
Official component install and build passed on isolated run [36300175054](https://github.com/CipherCuttle/binrat/actions/runs/36300175054): 30/30 Chromium Playwright tests, including nonzero rendered-shader pixel changes at 1440px, 390px, 320px and static reduced motion. Built dist/ and pnpm lockfile committed at `b1cb001cc46e2d9d62ea0367c745fd483b71631e`. A source-tree comparison against draft PR #50 confirms **no licensed TSX/CSS, registry response, or license key entered git**. Software-WebGL screenshot artifacts show the actual official wave field; physical Android aesthetics/thermal behavior and exact GitHack published smoke remain owner/pre-release gates. No merge authority.

### Final timing isolation
The previously untouched `g4r.spec.ts` functional suite remained sensitive to SwiftShader contention on a single CI runner: 29/30 passed in the docs-only rerun, but one desktop Radar transition stalled. It now uses `?static-sky=1`, matching the other functional route/accessibility suites. Actual official shader motion, desktop/390/320 screenshot comparisons, reduced-motion handling and user-facing GitHack journey remain tested separately on the normal animated URL. No product behavior change.
