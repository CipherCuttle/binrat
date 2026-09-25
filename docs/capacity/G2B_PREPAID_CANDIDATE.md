# G2B — candidate bounded prepaid research entitlements

Stacked on PR #37 at `114b0572de3f3d153d24a155b8cfbbea07f38670`; separate from G2A and visual PR #31.

## Implemented — isolated, disabled by default

- Candidate SQLite/D1 schema lives **only** in `src/entitlements/schema.ts`. No production migration and no Worker route imports it.
- Server-scoped account + billing period, separate global/Arc/Robinhood ceilings, an immutable funding reference, and per-request idempotency key.
- Cost classes are explicitly only `EXTENDED_RADAR`, `DEEP_REPLAY`, `PRO_ALERT`; public raw receipts cannot be quota-gated through this API. No token/holder benefit exists.
- One conditional database `INSERT ... SELECT` is the admission gate: checks active period, expiry, global cap, per-chain cap and existing reserved+consumed units in one SQLite write; no read-modify-write race in application code. Duplicate same-key inputs replay without debiting again, conflicting payloads fail closed.
- State transitions are conditional writes: RESERVED → CONSUMED, RESERVED → RELEASED, CONSUMED → REFUNDED. A released/refunded request key is permanently terminal. Revocation prevents future reserve and consume. Read-only balance is diagnostic, **not** authority.
- Only `openOfflinePeriod` with both `enabled: true` and `allowOfflineFixtures: true` can seed a period in this slice. There is **no** provider webhook, checkout, real-money subscription, plan pricing, billing activation or active holder reward.

## Scope and outstanding gates

This is local D1-compatible simulation, **not** a distributed production race proof. G2B next requires real nonproduction Cloudflare D1 concurrent 1K-client contention, immutable provider event ledger, authenticated signed hosted fiat webhooks, out-of-order/refund/chargeback tests, merchant/legal/tax gate, per-cost routing and server monthly infrastructure ceiling. Exact D1 execution cost and 4663 RPC spend remain unmeasured. Do not publish Pro or charge any user until the checkout and compliance gates pass.

No merge, deployment, payments, token action, production table or CI network spend authorized.
