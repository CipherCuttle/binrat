# BINRAT V3 — Cloudflare frontend cutover review

2026-10-08 · PR #170 · **Preparation only — no production deployment or merge authorized**

## Owner decision

Owner inspected the locally served V3 React candidate and explicitly said: **"i approve, it looks nice"**. Record: `OWNER_VISUAL_APPROVAL=APPROVED_LOCAL_CANDIDATE_2026_10_08`. This is **visual acceptance only**; it does not authorize backend upgrade, production cutover, token launch, trading, merges, or changing Cloudflare settings.

## What changed for cutover

The V3 static build now uses a **dedicated HTML + React entry** instead of a runtime conditional import of the historical Product Surface V2. Ordinary V2 builds remain unchanged. `pnpm --dir web-v2 build:frontdoor-candidate` stages the React site at `.artifacts/v3-frontdoor/site` with a SHA-256 file manifest. It does **not** overwrite `web/`, deploy to Workers, or modify live Wrangler configuration.

This built site makes Pons 4663 Cases the homepage. It uses the **same-origin** `/api/status` and `/api/launches/latest` without an embedded proxy or fallback to ARC 5042. On a 503 response it shows unavailable evidence, not a fictional launch. The explicit `/visual-lab` route remains synthetic and clearly marked.

## Proposed Worker static-asset routing

The deployable configuration has **not** been written or applied. A proposed `assets` fragment is included in the offline build manifest:

```json
{
  "directory": "./.artifacts/v3-frontdoor/site",
  "not_found_handling": "single-page-application",
  "run_worker_first": ["/api", "/api/*", "/health", "/telegram/*", "/__candidate/*"]
}
```

Cloudflare reference:
https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/

The SPA fallback should allow direct browser navigation to `/bag/<64hex>`, `/visual-lab`, and client routes. Every API request and existing Telegram webhook route must still reach the current Worker. **These rules have been checked offline but not verified on Cloudflare's runtime.** A browser navigating to an API URL must not receive the SPA HTML.

## Release blockers

1. Source / branch integration: `main` diverges heavily from this feature train. Do not bulk merge.
2. Runtime readiness: production reported an old active Worker source, HTTP 503 and Pons 4663 not caught up; candidate still reports intermittent `SYNC_UNKNOWN_ERROR`. The new React frontend cannot fix indexing.
3. Provider route/provenance: the actual current Cloudflare production Wrangler configuration, Worker deployment, bound static assets, D1/queue/cron bindings and rollback authority must be read back independently.
4. Cloudflare isolated rehearsal: deploy only with **separate future authorization** to a non-production isolated Worker first. Check normal navigation, deep-link SPA fallback, GET API routing, Telegram webhook method, the actual public digest binding and rollback path.
5. Final QA: mobile accessibility / small width, tablet layout shift, cross-browser, asset budgets and owner acceptance of any changes since local review.

The existing `scripts/deploy-cloudflare-web-assets.py` **must not be used for V3**. It alters production Wrangler config and runs `wrangler deploy` as part of its operation. Static assets on the same Worker are not automatically independent of the Worker script/deployment.

## Rollback gate

Before a cutover, preserve **actual currently active** Cloudflare Worker revision, asset release, full bindings, deployment version percentage and route. Prepare a tested provider-supported rollback or restore of precisely that release; a plain `git revert` does not restore independently deployed Cloudflare assets.

## Reproduction

```bash
pnpm install --frozen-lockfile
pnpm --dir web-v2 check
pnpm --dir web-v2 build:frontdoor-candidate
# Only the ignored staging artifact is changed; no Cloudflare writes.
cat .artifacts/v3-frontdoor/manifest.json
```

**Gates:** Offline artifact and recorded-response browser test must pass at exact SHA. Cloudflare SPA runtime, current production Pons freshness, production provider route identity and cutover authority all remain **BLOCKED / UNVERIFIED / FALSE**.
