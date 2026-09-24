# Isolated BINRAT G2 GitHack journey preview

Owner authorization: publish a testable FRONTEND + read-only BACKEND PREVIEW. This is **not** production deployment, a PR merge, a token launch, or permission to manipulate funds.

## Frontend

Source remains the approved PR #31 branch `feat/binrat-north-star-slice-g0-g2`. The publishing workflow builds an independent static Vite bundle with `VITE_BINRAT_GITHACK_PREVIEW=1` and relative assets and pushes only generated files to the dedicated `preview-binrat-g2` branch. The GitHack development URL is:

https://raw.githack.com/CipherCuttle/binrat/preview-binrat-g2/index.html

It uses hash navigation (e.g. `#/radar`) because GitHack is a static CDN, not an SPA rewrite server. Source mode remains explicit: `?source=live#/radar`. Saved identifiers remain local browser bookmarks. GitHack may display a first-visit confirmation page; the site's FAQ describes this behaviour.

## Backend

A separate free Render Node service `binrat-githack-proxy-v2.onrender.com` provides strict GET-only proxy access to the **existing** public BINRAT backend. It never mounts D1, queues, cron, production assets, Telegram secrets, holder credentials, wallet actions, POST endpoints or restricted Radar depth. It forwards only canonical public JSON paths and preserves upstream failures rather than creating synthetic LIVE data. Its CORS origin is restricted to `https://raw.githack.com`. A failed upstream may mean the public index is unavailable; check `/api/health`, do not claim an empty index.

## Publication and rollback

The workflow `.github/workflows/binrat-githack-preview.yml` builds, runs isolated browser checks, updates ONLY `preview-binrat-g2`, then independently checks the isolated Render free proxy for GET-only and CORS behaviour. The proxy is deployed automatically from the same working branch without secrets. PR #31 remains draft/unmerged; production Worker `binrat-edge-v0` is not modified. For rollback, remove the generated preview branch and delete the isolated preview Worker in the Cloudflare dashboard; do not delete or alter production services. Never include preview Worker in the token/holder production manifest.

## First publication fallback
The static GitHack preview is published independently of Cloudflare credentials. If either GitHub Actions secret `CLOUDFLARE_API_TOKEN` or `CLOUDFLARE_ACCOUNT_ID` is missing, the optional isolated Worker deploy step is skipped, the workflow reports the limitation, and DEMO remains usable while LIVE fails visibly without fixture substitution. Adding both secrets and rerunning an explicitly tagged preview publish closes the backend gate. This does NOT justify granting access to production Worker credentials to arbitrary third-party CORS proxies.

### Render free preview (2026-09-24)
Public read-only proxy: https://binrat-githack-proxy-v2.onrender.com/api/health; Render service `srv-daqkvcnlot8c73f21ucg`. It uses the same strict GET route allowlist and no D1/Telegram/key access. First load after sleeping on the free tier can take longer than a warm request. Original failed experimental service `binrat-journey-readonly-proxy` (service `srv-daqkv03tqb8s73b0k070`) was not used; remove that failed duplicate in the Render dashboard after the working proxy is confirmed. GitHack static publishing does not depend on the Render service being available. The abandoned Cloudflare proxy configuration is source-only; no Worker deployment was authorized by this workflow.
