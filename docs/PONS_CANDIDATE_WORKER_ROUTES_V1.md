# Pons candidate Worker integration V1 — default OFF

Status: **test-only routing candidate**, not a production holder gate, not a token launch or a deployment authorization.

## Scope

Adds `/api/pons-candidate/challenge` (POST), `/api/pons-candidate/session` (POST) and `/api/pons-candidate/me` (GET), using the separately namespaced Robinhood 4663 SIWE and D1 tables from PR #28.

**Two independent gates:** `BINRAT_PONS_CANDIDATE_ROUTES_ENABLED=true` **AND** the injected `WorkerDeps.ponsCandidateTestRoutes === true`. The deployed Worker's `DEFAULT_DEPS` does not include that opt-in, so setting an environment variable or installing the candidate SQL cannot expose the new routes in production. They return 404 otherwise. No other Worker routing or existing Arc 5042 holder session logic changes.

All sessions are **FREE / candidate-only**. They do not unlock Rat Radar's full projection, Rat Watch capacity, or any other paid/product entitlement. The candidate SIWE resource now points at the free `/api/pons-candidate/me` inspection endpoint rather than implying access to the full Radar watchlist.

## Controls

- POST requests require an exact same-origin `Origin` header, JSON body (max 4 KiB), and an allowed HTTP method. No cross-origin CORS is added.
- GET introspection requires a Pons bearer token from its **separate** session table, checks expiry, policy, exact origin, chain 4663 and FREE-only database constraint. Old Arc 5042 bearer tokens are never accepted.
- All responses use `Cache-Control: no-store` and `X-Content-Type-Options: nosniff`; the API never asks for transaction approval, private keys or token purchases.
- Durable one-minute D1 throttle: at most 6 challenges per edge-observed client IP (missing IP shares a restrictive global bucket), 3 per normalized wallet, and 12 proof attempts per IP. Buckets are SHA-256 hashes; raw IP values are not stored. D1 upserts serialize increments. Missing migration or DB failure returns 503 without minting a session.
- The throttle is only a candidate control: distributed adversaries or untrusted forwarded IPs may evade IP quotas. Before internet exposure, enforce Cloudflare's actual edge-rate protection, assess write amplification and daily D1 row limits, ensure `CF-Connecting-IP` is trusted, and determine an approved retention/cleanup policy.

## Additive D1 migration

`migrations/20260924_pons_candidate_route_limits_v1.sql` creates only the throttling table. Its DDL is present byte-identically in `src/cloudflare/d1Schema.ts` and `cloudflare/schema.sql`. The PR does **not** apply this migration to live D1 or enable the feature toggle. Existing historical Arc rows and Pons candidate sessions are unchanged.

## Verification

`test/ponsCandidateRoutes.test.ts` exercises both default-off gates, a full fixture wallet signature through the Worker and subsequent FREE-only session inspection, legacy Arc bearer isolation, wrong origins and methods, rate limits/window reset, invalid signatures and expiry, and failure when the throttle migration is absent. All assertions must pass on the exact PR head, alongside full `pnpm check` and the non-deploying Cloudflare dry-run.

The next authorized production step must separately establish a verified deployed BINRAT token address, approved holder threshold/price sensitivity, a reviewed finalized Robinhood balance source, session-policy invalidation for changed balances, supported contract-wallet signatures, stronger edge abuse controls and legal/compliance clearance. No such authority is granted here.
