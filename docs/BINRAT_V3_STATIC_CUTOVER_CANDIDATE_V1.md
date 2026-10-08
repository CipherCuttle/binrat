# BINRAT — V3 static frontdoor cutover candidate

Date: 2026-10-08. Status: **ISOLATED STAGED STATIC SITE, NOT DEPLOYED**.
Base: PR #168, frozen visual PR #166. `main` currently diverges drastically from this feature train. Do NOT perform a bulk merge or cherry-pick without independently reconciling those parents.

## Delivery scope

This change makes **the Pons 4663 read-only Case surface** the `/` homepage **only when the explicit V3 candidate build flag is enabled**. Ordinary V2 builds retain their old behavior; V3's synthetic Visual Lab remains separately accessible at `/visual-lab`. It retains React V3 art. No backend, D1, Worker, queue, cron, token, wallet, DNS or production `web/` directory is modified.

The compiled static candidate uses **same-origin** GET `/api/launches/latest` and `/api/status`; there is no production proxy, no upstream origin hardcoded into the UI, and no fallback to ARC 5042 or to synthetic launch data. Current production API 503 will appear as **UNAVAILABLE**, not a functional live index.

Old product routes such as `/radar`, `/watch` and `/replay` are explicitly marked **NOT IN THIS BUILD**; they do not load the old ARC adapter. Existing `/bag/<64hex>` links and `/?case=<64hex>` resolve to the exact Case when returned in the bounded verified feed; if absent the Case fails closed instead of changing selection.

## Reproduce

```bash
pnpm install --frozen-lockfile
pnpm --dir web-v2 check
pnpm --dir web-v2 build:frontdoor-candidate
# The artifact is .artifacts/v3-frontdoor/site/ and its manifest is adjacent.
# Static preview with SAME-ORIGIN API (no proxy) — may show UNAVAILABLE:
pnpm --dir web-v2 exec vite preview --host 127.0.0.1 --port 4189 --outDir ../.artifacts/v3-frontdoor/site
# Use separate candidate-only proxy for a *demonstration* against the stale candidate:
# BINRAT_PONS_PREVIEW=1 pnpm --dir web-v2 exec vite preview --host 127.0.0.1 --port 4189 --outDir ../.artifacts/v3-frontdoor/site
```

The preview-only proxy is Vite development tooling, not part of the static site and **must not** be included in a Cloudflare Worker deployed configuration. A stale candidate preview remains STALE_VERIFIED. Recorded public-response browser replays and screenshots are **simulation/test controls**, not proof of current freshness.

## Gate interpretation

- Candidate site is static HTML/JS/CSS + art/font assets.
- No release site cutover until `/api/status` and `/api/launches/latest` on target deployment pass exact provenance and independent live-read acceptance, including two fresh publications.
- The production Wrangler config currently serves `web/` and the site staging is **not** automatically installed there. A separate reviewed asset-path packaging/cutover plan is required and cannot mutate the Worker/database/queues during this build.
- 320px first-viewport CTA and ~0.226 tablet CLS limitations from V3 proof remain unless specifically verified fixed.
- Operator must verify Cloudflare static route fallback for `/bag/<id>` and unknown legacy URLs before future site cutover, without silently rewriting backend routing.

## Acceptance

PASS = exact SHA candidate build + manifest/asset integrity + browser homepage at desktop/mobile/tablet, retained `/visual-lab`, exact Case routing and 503/empty/stale truth. Evidence testing here can use recorded real candidate transport but must be marked replay. V3 visual owner signoff, source freshness, active Worker provenance, route fallback and production authorization are **independent unresolved gates**.

PLAN → CHANGESET → VERIFY → VERDICT. No merge, production deploy, token action or automatic grant.
