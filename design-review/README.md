# BINRAT · Frontend review desk

Independent, local-first **design preference collector** covering 21 exact, immutable GitHack snapshots. This is not a production frontend and is deliberately isolated from PR #53, `main` and every historical branch.

## Use

Open `design-review/index.html?v=g4r` via GitHack (replace `g4r` with any ID in `versions.json`). The desk embeds the exact historical GitHack snapshot on demand, provides an always-visible **Open original GitHack** link, and attaches a per-version review form. All URLs use full 40-character commit SHAs instead of mutable branch heads.

The original pages themselves have **not been edited**: it would be unsafe to retroactively graft new functionality into 21 frozen builds. A review link is the wrapper around an original preview.

For each version: choose the surface/device, enter any 1–5 ratings you actually observed (unrated remains unscored), tag explicit likes/dislikes, enter Keep/Change/Why text, and optionally mark a dealbreaker. Compare two versions with a specific written reason. Local storage auto-saves across page reloads on the same origin and browser.

**Export:** Download `BINRAT_design_feedback.json` or Copy review for ChatGPT. The exported schema is `binrat.design-feedback.v1`, including the exact SHA, URLs, ratings and notes. The overview aggregates only explicitly selected tags, and is not a permanent style guide. An optional public GitHub issue draft is filled with your current review. It does **not** post automatically. Do not submit private personal notes to this public repository.

## Limits

- Sandbox-embedded historical previews can fail if they need their original backend, storage origin or embedding permissions. Always test using **Open original GitHack** too. No GitHack link proves the old service still answers network requests today.
- G6a GitHack is **source-only**: all eight reviewed art PNGs are missing from the committed build. The locally assembled full-art G6a preview is a different artifact and is intentionally not misrepresented as a GitHack snapshot.
- Animated Grain Wave variants are included to collect comparative preference evidence, not to reverse the owner's static-art decision.
- Old fixture/demo readouts are not current trading intelligence. Historic Figma-only concepts lack compiled GitHack pages and are not given invented GitHack URLs.
- Local storage is device/origin scoped. No backend is collecting reviews, and this assistant cannot see them until you export/paste the JSON or manually create a GitHub issue.

## Verify

`node --test design-review/test/catalog.test.mjs`

`npm install --no-save playwright@1.55.0 && npx playwright install chromium && node design-review/test/browser.mjs`

Workflow: `.github/workflows/binrat-design-review.yml`. A separate screenshot artifact captures the desk at 1440, 390 and 320 px, not all 21 third-party previews.

No merge, production promotion or design-lock authority.
