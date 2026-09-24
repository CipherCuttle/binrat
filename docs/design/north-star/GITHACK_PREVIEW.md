# Isolated BINRAT G2 GitHack journey preview

Owner authorization: publish a testable FRONTEND + read-only BACKEND PREVIEW. This is **not** production deployment, a PR merge, a token launch, or permission to manipulate funds.

## Frontend

Source remains the approved PR #31 branch `feat/binrat-north-star-slice-g0-g2`. The publishing workflow builds an independent static Vite bundle with `VITE_BINRAT_GITHACK_PREVIEW=1` and relative assets and pushes only generated files to the dedicated `preview-binrat-g2` branch. The GitHack development URL is:

https://raw.githack.com/CipherCuttle/binrat/preview-binrat-g2/index.html

It uses hash navigation (e.g. `#/radar`) because GitHack is a static CDN, not an SPA rewrite server. Source mode remains explicit: `?source=live#/radar`. Saved identifiers remain local browser bookmarks. GitHack may display a first-visit confirmation page; the site's FAQ describes this behaviour.

## Backend

A separate Cloudflare Worker `binrat-journey-preview.pettevik.workers.dev` provides strict GET-only proxy access to the **existing** public BINRAT backend. It never mounts D1, queues, cron, production assets, Telegram secrets, holder credentials, wallet actions, POST endpoints or restricted Radar depth. It forwards only canonical public JSON paths and preserves upstream failures rather than creating synthetic LIVE data. Its CORS origin is restricted to `https://raw.githack.com`. A failed upstream may mean the public index is unavailable; check `/api/health`, do not claim an empty index.

## Publication and rollback

The workflow `.github/workflows/binrat-githack-preview.yml` builds, performs isolated browser checks, updates ONLY `preview-binrat-g2`, deploys ONLY the isolated Cloudflare proxy and verifies CORS/health. PR #31 remains draft/unmerged; production Worker `binrat-edge-v0` is not modified. For rollback, remove the generated preview branch and delete the isolated preview Worker in the Cloudflare dashboard; do not delete or alter production services. Never include preview Worker in the token/holder production manifest.

## First publication fallback
The static GitHack preview is published independently of Cloudflare credentials. If either GitHub Actions secret `CLOUDFLARE_API_TOKEN` or `CLOUDFLARE_ACCOUNT_ID` is missing, the optional isolated Worker deploy step is skipped, the workflow reports the limitation, and DEMO remains usable while LIVE fails visibly without fixture substitution. Adding both secrets and rerunning an explicitly tagged preview publish closes the backend gate. This does NOT justify granting access to production Worker credentials to arbitrary third-party CORS proxies.
