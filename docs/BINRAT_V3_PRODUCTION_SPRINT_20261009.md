# BINRAT V3 production integration — 2026-10-09

This isolated release is based on read-only backend authority `16994bf1e331441f75d2ebba5f1d8d6226e7ebc6`. Only the required React source from PR #170 at `07737938ef48bf886293ba34c5225ac9e1e5ed2b` was reconciled. Its merge base with the backend is PR #168 at `f0799f214a9134562ab0ae0340a2119f1b7c468f`; that base already contains the approved PR #166 artwork and read adapter. No divergent history was merged. At initial inspection, PR #170 had 759 commits unique relative to main and main had two unique commits.

The owner authorized one conditional production asset cutover in this sprint. Earlier candidate-only no-deploy receipts remain valid historical records, but are not the current authorization. Authorization remains conditional on complete backend, frontend, provider, billing and rollback acceptance.

## Exact build and offline package

Commit all scoped source before building. Use the existing frozen pnpm lockfile, the production frontdoor build, package integrity check, compiled browser suite, and local workerd route test. Then run `node scripts/stage-v3-static-release.mjs` from the release root. Set `BINRAT_BACKEND_RELEASE_WORKTREE` only if the preserved backend receipt directory moved.

The packaging script requires a clean exact source SHA, unchanged backend/config/lockfiles, and the production build mode. It extracts only the independently hashed reviewed module from the existing backend archive; it does not rebuild or relabel the backend. The backend module SHA-256 remains `2634728884ac8327ccaaa2118f1c94f8237a893e57a604fd6af35ee65b32ee22`. Frontend SHA and asset hashes are tracked separately. Backend `/health` must continue to report its actual backend SHA, not the frontend SHA.

All 33 original assets are preserved byte-for-byte in `.artifacts/v3-production/rollback/site`. The cutover retains their 31 non-HTML resources for old tabs, replaces the homepage, and retires `app/index.html` so it cannot serve the old ARC interface. The served V3 entry imports no legacy scripts or fixture data. Unknown client paths fail closed in the React router; API paths always reach the Worker.

## Provider gate and cutover procedure

Do not run the legacy `scripts/deploy-cloudflare-web-assets.py`. It rebuilds/uploads Worker state from mutable configuration. The approved frontend cutover must send the exact preserved backend module and inherit every current binding without replacement, removal or new authority.

1. Read the authenticated active deployment, version, downloaded module, bindings, asset configuration, D1, queue, cron, routes and secrets inventory. Establish two coherent advancing production publications at least 60 seconds apart, including D1 and canonical RPC proofs. Read authenticated Alchemy account billing; require sprint spend at most $1 and remaining budget at least $5. Check Cloudflare health.
2. Independently verify current healthy version 104 and its previous 33 assets as the rollback authority. Version 102 is forbidden as a presumed healthy fallback. Do not mutate the healthy backend to rehearse rollback.
3. Require the clean source build, complete manifests, all mandatory tests, ONE hostile review and ONE targeted rereview. Re-read active and latest versions immediately before upload. The multipart API previously rejected explicit UUID inheritance; only literal `latest` worked. Use strict inheritance only if latest equals the independently verified healthy active version 104. Any drift stops. Never substitute bindings from a different uploaded version.
4. Register the exact cutover asset manifest with the existing Worker's assets upload session; upload only requested byte-verified files, keeping asset tokens in memory. Attach completion JWT and the tested SPA asset configuration to the exact old module. Upload ONE new version with `bindings_inherit=strict` and all current bindings inherited from the guarded latest. No schema, secret, DNS, resource, queue, cron or compatibility changes are part of this procedure.
5. Before traffic, download the staged version/module and require identical module hash, complete binding equality, protected secret inventory, exact assets, API/static route coexistence and immutable preview browser acceptance. A failed or unavailable guard stops before traffic.
6. Select the single inspected version at 100%, record version/deployment identity, then run real browser, Case/creator, deep link, API provenance and bounded telemetry/billing checks. No blind retry loop. On an attributable V3 regression, select the previously verified healthy version 104 with its exact old asset set; do not fall back to version 102.
7. Only after full acceptance, safely disable candidate automatic indexing while retaining its D1/history/evidence. Never disable production indexing. Stop after verdict; no additional roadmap implementation.

Current provider routing documentation: [SPA routing](https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/), [direct asset uploads](https://developers.cloudflare.com/workers/static-assets/direct-upload/), [multipart metadata](https://developers.cloudflare.com/workers/configuration/multipart-upload-metadata/). Provider response and pinned Wrangler 4.135.0 implementation take precedence over assumptions about upload syntax.

An offline manifest never proves active provider identity or supplies missing billing/rollback acceptance. The final machine-readable receipt and verdict must record each gate independently, including any authenticated-access blocker.
