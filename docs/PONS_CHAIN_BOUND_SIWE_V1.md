# Pons chain-bound candidate SIWE V1

This PR implements a **separate, EOA-only Robinhood 4663 login realm**, not production holder eligibility. Pons login remains unmounted: no new Worker endpoints or environment switches are introduced. Existing Arc 5042 research authentication is unchanged.

## Authority invariant

- SIWE challenge binds exact HTTPS origin (or HTTP localhost for fixtures), chain 4663, wallet address, purpose, resource, nonce, issue time and expiry.
- One-time nonce is consumed via an atomic conditional D1 update after signature verification. Only FREE candidate sessions can be persisted.
- D1 candidate tables require chain_id=4663, fixed versioned candidate policy and FREE tier. Session tokens are 256-bit random strings; only their hashes are persisted.
- Session retrieval requires the matching origin, candidate policy, expiry and chain. Old Arc bearer tokens and even valid historical Arc HOLDER sessions cannot cross into this realm.
- No token address, threshold, live balance-source integration, upgraded data entitlement, production deployment, wallet transaction, approval or funding action occurs.
- EIP-1271 contract-wallet authentication is unsupported by this candidate and needs separate reviewed chain-specific verification before production if those wallets are to be supported.

## Deployment boundary

An additive migration file is provided at migrations/20260924_pons_candidate_auth_v1.sql. The D1 schema definition includes the same tables. This branch does not execute it against production D1. Run on an isolated candidate DB and verify schema parity/rollback before any separately authorized deployment. Legacy Arc tables are untouched.

## Follow-on gate

Once the actual Pons token is deployed after explicit separate authorization, bind the verified canonical token address and launch receipt to an approved raw balance threshold, finalized Robinhood reader and versioned entitlement policy. At that time review session invalidation after transfers, reorgs, policy changes, EIP-1271 handling, abuse/rate limiting, Worker route authentication and the public-vs-holder Radar/Watch contract. Default remains FREE. Never let token ownership rewrite receipts.

## Verification

Exact-head pnpm check, adversarial D1 regression tests for legacy bearer isolation, valid/wrong-chain SIWE, bad origin/signer/payload, replay/race, expiry, schema idempotency and enforced FREE-only sessions; one bounded hostile review. No merge or deployment authority.
