# Issue #171 — static cutover safety verdict and operator proposal

Scope: PR #170, branch `feat/binrat-v3-frontdoor-cutover-candidate-v1`.
Pinned input: `19dce2c6963928ee13e5ba7e203e3831700b1c8e`, fetched from the PR; original CI [37842635278](https://github.com/CipherCuttle/binrat/actions/runs/37842635278) completed successfully at that SHA. Changes are restricted to the diff above PR #168 (`f0799f214a9134562ab0ae0340a2119f1b7c468f`). The final source SHA and dirty flag are generated in each artifact receipt; use the final exact-head CI run, never the input run for changed code.

**Candidate verification can pass locally; production cutover is NO-GO.** No deploy, merge, production configuration write, webhook call, D1/queue/cron/DNS/Telegram/launch mutation or signing is part of this task.

## Changes and verification

- `build-frontdoor-candidate.mjs`: honest working-tree provenance, independent package gate; removes the ineffective hardcoded routing assertion.
- `check-frontdoor-package.mjs`: exact manifest coverage, SHA-256/size checks, dedicated HTML/JS entry, hashed Rat Zero art, both Geist fonts, compiled resource existence and no candidate origin in served code.
- `check-frontdoor-routing.mjs`: Wrangler 4.135.0 local workerd using the compiled site and actual `handleWorkerRequest`; no bindings/credentials, DB and external IO throw. Instrumented handler responses prove dispatch, not API/business correctness. Static collisions are inserted in a temporary copy, never the staged release.
- `frontdoor-candidate-browser.cjs`: Playwright 1.56.1 on compiled assets, 24 check groups: WHAT → TRAIL → RECEIPTS → NEXT, keyboard, exact share/deep links, absent Case, legacy routes, explicit isolated lab, stale, empty, 503, tampering and retained verified snapshot. All requests must be same-origin GETs. Recorded public transport is **REPLAY**; adverse controls are **SIMULATED**.
- CI runs the same pinned package/runtime/browser checks and uploads their evidence on the exact PR SHA. Production Worker source, Wrangler example, Vite config, frontend components, art/fonts and independent Radar workflows are unchanged.

Browser captures: 1440×900, 390×844, 768×1024, 320×800, 430×932, 360×800, 1024×768. Primary sizes include all four journey stages. Screenshots/results live under `.artifacts/v3-frontdoor/browser/`; package manifest/results and routing results are adjacent. Existing V2 build and root suite remain required.

Known presentation limits: at 320×800 the primary button spans y≈756–805 and requires a small scroll to see it completely. Earlier tablet CLS≈0.226 is not remeasured or claimed fixed. Cross-browser/real-device performance remains unverified. Owner local visual approval survives because product code and assets are unchanged.

## Local routing matrix

| Path | Direct GET / browser navigation | HEAD, POST, PUT, PATCH, DELETE, OPTIONS |
| --- | --- | --- |
| `/`, `/bag/<64hex>`, `/visual-lab` | React V3 HTML | No frontend mutation capability; outside API gate |
| `/radar`, `/watch`, `/replay`, unknown client URL | React HTML; client renders NOT IN THIS BUILD | Outside API gate |
| `/api`, `/api/status`, `/api/launches/latest` | Worker JSON, including static collisions | Worker, never SPA |
| `/api/miniapp/bootstrap`, `/api/miniapp/case`, `/api/miniapp/case-intelligence` | Worker JSON | Worker, never SPA |
| `/api/holder/challenge`, `/api/holder/session` | Worker JSON | Worker, never SPA |
| `/api/future-route` | Worker 404 JSON, including static collision | Worker, never SPA |
| `/health`, `/telegram/webhook` | Worker JSON, including static collisions | Worker, never SPA |
| `/__candidate/rat-smoke`, `/__candidate/pons-bootstrap` | Worker JSON | Worker; diagnostics are not executed with real IO |
| Current JS/CSS/WebP/WOFF2 paths | Static bytes equal manifest; correct non-HTML content type | Outside API gate |
| Absent old `/assets/*.js` | SPA returns 200 HTML, a recorded limitation | Old/new-tab release rehearsal required |

209 local routing/resource checks. Local status/launch handlers return unavailable with no local DB; webhook/diagnostic handlers lack credentials. These responses prove routing only and cannot establish production readiness. API checks include normal fetch and `Sec-Fetch-Mode: navigate` for every method.

Cloudflare's [SPA routing](https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/) and [run_worker_first rules](https://developers.cloudflare.com/workers/static-assets/binding/) support this proposal. Protect both `/api` and `/api/*`; retain `/health`, `/telegram/*`, `/__candidate/*`. Negative patterns override positive ones; do not introduce an API exception. The example Worker has no ASSETS binding or manual static forwarding; actual provider bindings require independent readback. Only one asset collection can be configured per Worker.

## Reproduce without provider changes

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm --dir web-v2 check
pnpm --dir web-v2 build:frontdoor-candidate
npm install --prefix /tmp/binrat-171-tools --no-save --no-package-lock playwright@1.56.1 wrangler@4.135.0
node /tmp/binrat-171-tools/node_modules/playwright/cli.js install chromium
BINRAT_FRONTDOOR_TOOLS=/tmp/binrat-171-tools node web-v2/checks/check-frontdoor-routing.mjs
pnpm --dir web-v2 exec vite preview --host 127.0.0.1 --port 4189 --outDir ../.artifacts/v3-frontdoor/site
# In a second terminal while that compiled preview runs:
BINRAT_FRONTDOOR_TOOLS=/tmp/binrat-171-tools node web-v2/checks/frontdoor-candidate-browser.cjs
```

On this Ubuntu 26.04 workstation, pinned Playwright requires `PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=ubuntu24.04-x64` for install and execution; the downloaded pinned Chromium runs successfully. CI uses its supported Ubuntu runner. Installation warned about ignored esbuild scripts; Vite build succeeded. The local routing config is generated only in ignored staging, with local mode, no provider IDs or resource bindings.

## Current production observations and blockers

Two bounded sets of read-only public GETs to `https://binrat-edge-v0.pettevik.workers.dev` found `/health` HTTP 200 with release SHA `53325fd0806765578ed6921428ad55f15a9728f1`; `/api/launches/latest` returned HTTP 503 `PUBLIC_PROJECTION_UNAVAILABLE` twice. `/api/status` timed out once, then returned HTTP 503 `INDEX_NOT_READY`. Receipts are `.artifacts/v3-frontdoor/public/`; these are fresh public observations, distinct from browser replay. They fail freshness acceptance. Health alone gives no verified Worker/asset deployment version or full binding inventory.

Release remains blocked by provider readback of the **active** Worker/asset versions and bindings, independent Pons freshness with two consecutive healthy publications, a proven rollback, integration divergence from `main`, and explicit owner release authorization. Frontend checks repair none of the read-plane sync problems.

## Deployment and rollback proposal — DO NOT EXECUTE

1. Owner first names the target account/Worker and authorizes an isolated rehearsal. Obtain provider readback of the active deployment ID, every version/percentage, source/script identity, asset collection identity, compatibility date/flags, variables/secret binding names (no values), D1/queue/cron/AI/service bindings and routes. Compare the current public release digest with that provider version. Preserve a complete previous script/config/assets bundle and hash inventory. Public `/health` is insufficient.
2. Prepare `BINRAT_CUTOVER_CONFIG` from that verified provider configuration and current active Worker script. Do not copy the example over production settings or assume this branch Worker is the active script. Change only the proposed assets directory/SPA/rules; resolve the assets directory relative to that config location. Preserve the original compatibility settings and all resource bindings. If active bindings conflict, lack the required public handlers or cannot be reconstructed exactly, STOP. No auto-provisioning or D1 repair belongs in a static cutover.
3. Pin `BINRAT_CANDIDATE_SHA` to the successful CI head and archive its complete manifest/site. Require `sourceDirty=false`, all package/browser/routing checks passing, source reconciliation and explicit authorization. Test version/asset retention and the absent-old-chunk behavior on an isolated target with local/replayed APIs. Rehearse restoring the previous HTML, JS, fonts/art and Worker version; test existing tabs and fresh deep links after rollback. This rehearsal itself needs future authorization.
4. With later, specific production authorization and passed independent freshness/provider gates, use the preserved config and approved script, upload a version, inspect it, then move traffic to it. Do not run `scripts/deploy-cloudflare-web-assets.py` or `versions deploy latest`. Exact future commands (placeholders must come from provider evidence):

```sh
# READBACK, future operator session; not executed here:
pnpm dlx wrangler@4.135.0 deployments list --config "$BINRAT_CUTOVER_CONFIG" --json
pnpm dlx wrangler@4.135.0 versions view "$BINRAT_PREVIOUS_VERSION" --config "$BINRAT_CUTOVER_CONFIG" --json
# MUTATIONS: require separate owner authorization; not executed here:
pnpm dlx wrangler@4.135.0 versions upload --config "$BINRAT_CUTOVER_CONFIG" --tag "$BINRAT_CANDIDATE_SHA"
pnpm dlx wrangler@4.135.0 versions view "$BINRAT_CANDIDATE_VERSION" --config "$BINRAT_CUTOVER_CONFIG" --json
pnpm dlx wrangler@4.135.0 versions deploy "$BINRAT_CANDIDATE_VERSION@100%" --config "$BINRAT_CUTOVER_CONFIG"
```

5. Compare public GET `/health`, `/api/status` and `/api/launches/latest` with the uploaded version/build/asset identities. Check direct `/bag/<id>`, every manifest resource, old/new-tab loading, and API navigation exclusion. On stale/unavailable provenance, incorrect routing, resource failure or unauthorized capability, stop the cutover and invoke the preapproved rollback:

```sh
# MUTATION: requires separately authorized, rehearsed rollback; not executed here:
pnpm dlx wrangler@4.135.0 rollback "$BINRAT_PREVIOUS_VERSION" --config "$BINRAT_CUTOVER_CONFIG" --message "Restore verified pre-V3 Worker and asset release"
```

6. Read back deployment/version/asset identities and traffic percentages again; repeat deep-link/resource/public-read checks against the preserved previous release. Restore the recorded multi-version deployment percentages explicitly if the previous deployment was split; `rollback` alone selects one version. Do not claim rollback proven until the complete script/assets/config outcome has been observed. Connected DB/queue data is not rolled back by Worker rollback; a git revert is insufficient. See [Cloudflare rollback limitations](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/).

## Bounded review boundary

Run IMPLEMENT → TEST → ONE hostile review → fix concrete Critical/High findings → ONE targeted rereview → STOP. No broad remediation or infrastructure work is authorized by this verdict.

One hostile review found two High evidence defects: (1) early failures could leave previous PASS receipts available; (2) the verifier trusted manifest source metadata and sampled future API paths without independently requiring universal, exception-free API rules. Fixed by clearing each prior result before validation, independently comparing git HEAD/dirty state, requiring clean CI source, enforcing the complete Worker rule set, and revalidating the package before routing/browser acceptance. Product code and routing proposal did not change.

One targeted rereview passed eight rejected-input groups: stale SHA, false dirty metadata, omitted API wildcard, negated API exception, corrupted JS bytes, unmanifested file, missing Geist font and dirty CI source. Each rejection removed the prior package PASS; stale-source rejection also removed previous browser/routing PASS receipts before startup. The restored package passed. Root checks passed 548 tests; V2 checks/build passed. Local review output is `.artifacts/v3-frontdoor/review.md`; this tracked record and final exact-head runtime/browser CI checks establish the review scope. Missing old chunks returning HTML, unhashed Crew/font paths (tracked and byte-hashed in the versioned release), 320px CTA clipping and prior tablet CLS are recorded limitations; they are not silently repaired. No credential patterns or unsupported live Watch/Rat capability were observed in the staged code or browser paths. Provider identity, healthy Pons and rollback remain release blockers.
