# BINRAT — existing isolated GitHack preview (infrastructure facts only)

The independently published **older G2** frontend is at:
https://raw.githack.com/CipherCuttle/binrat/preview-binrat-g2/index.html

It is generated from the dedicated `preview-binrat-g2` branch by `.github/workflows/binrat-githack-preview.yml` with `VITE_BINRAT_GITHACK_PREVIEW=1`; routes use URL hashes and explicit `?source=live#/<route>`. Its Render GET-only API proxy is `https://binrat-githack-proxy-v2.onrender.com`, which forwards permitted public reads to the existing Worker; it may be cold or unavailable. No D1, wallet, token or Telegram authority flows from publishing the preview.

**This published G2 is an obsolete visual and is NOT the current bento target.** The current bento design is defined only in `docs/design/BENTO_DASHBOARD_V1.md`. The current owner has not authorized the latest UI as a published preview; no publishing should occur until the user asks and an isolated build is visually reviewed. The preview workflow's publish gate remains opt-in and must not be bypassed with normal WIP pushes.
