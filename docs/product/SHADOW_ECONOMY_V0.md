# BINRAT Shadow Economy V0

Status: **contract-only / default-off / no route / no migration / no payment activation / no token dependency**

Base authority: `integration/binrat-case-canonical-v1@9e8b37ec0a643aadf8aaf789e9ab6c4ae4b85cb3`

## Mission

Test whether BINRAT has a real product economy before using a transferable token to simulate one.

Shadow Economy V0 must answer four questions with real behavior:

1. Will users repeatedly consume BINRAT intelligence?
2. Will users pay normal money or USDC for more leverage or bespoke investigation?
3. Can independent investigators produce evidence worth accepting?
4. Does accepted outside evidence improve later BINRAT cases?

If any answer is no, token mechanics must not be used to hide the failure.

## Hard invariants

- The free Rat remains useful end-to-end: Case, evidence boundary, basic history and a small WATCH allowance.
- Premium sells depth, volume and automation. It does not hide the core answer.
- Investigation requests use **FIAT or USDC only** in V0.
- No points, airdrop hints, staking, emissions, buybacks, revenue promises or pseudo-governance.
- No token-price metric appears in product-economy success criteria.
- No contributor assertion becomes a canonical BINRAT fact automatically.
- An accepted investigation means the job was accepted. Canonical graph promotion is a separate reviewed act.
- Existing Case evidence semantics remain authoritative: missing evidence stays missing; deployer address does not become human identity; evidence is not a trading recommendation.
- Payment provider data must be reduced to a provider reference, asset, amount and state. BINRAT must never store card credentials.
- A funded request cannot be silently cancelled. Refund behavior requires an explicit later design.

## User surfaces

### Existing Case / WHY

Add one bounded secondary action after the evidence-backed reasons:

**NEED MORE DIRT?**

The action is shown even to FREE users. It must not imply that more investigation will produce a suspicious finding.

Initial investigation kinds:

- `FUNDING_SOURCE`
- `RELATED_WALLETS`
- `PREVIOUS_PROJECTS`
- `EARLY_BUYER_OVERLAP`
- `CUSTOM`

Flow:

`CASE -> NEED MORE DIRT? -> QUESTION -> QUOTE -> PAYMENT -> JOB STATUS -> REPORT -> RECEIPTS`

No token language appears anywhere in this flow.

### FREE

- Case and WHY: available.
- Basic receipts: available.
- Prior-launch depth: 5.
- WATCH product entitlement: 5.
- Paid investigation requests: allowed.
- Advanced alert configuration: unavailable.
- Export: unavailable.

### PRO

- Everything in FREE.
- Prior-launch depth: 50.
- WATCH product entitlement: 25.
- Advanced alert configuration: available.
- Export: available.

These are experiment entitlements, not token-holder privileges. Existing native Telegram WATCH implementation remains unchanged until a later runtime slice reconciles product entitlements with its current hard cap.

### Investigator

Investigator status is a role, not a consumer plan.

V0 starts invite-only. There is no open marketplace and no permissionless submission endpoint.

## Investigation lifecycle

Allowed states:

`DRAFT -> QUOTED -> FUNDED -> ASSIGNED -> SUBMITTED -> ACCEPTED | REJECTED`

Before funding:

`DRAFT | QUOTED -> CANCELLED`

Rules:

- quote amount is an integer minor-unit amount greater than zero;
- quote asset is only `FIAT` or `USDC`;
- quotes expire;
- expired quotes cannot become funded;
- assignment requires confirmed funding;
- submission requires assignment;
- adjudication requires submission;
- accepted/rejected are terminal;
- funded cancellation is deliberately unsupported until refund semantics exist;
- every transition receives an event id and monotonic timestamp.

## Contributor evidence model

Each submitted claim has:

- `claimId`
- `evidenceClass`
- literal `statement`
- one or more provenance refs when the claim is presented as observed, derived or source-reported.

Evidence classes:

- `OBSERVED` — directly retained evidence.
- `DERIVED` — deterministic relationship derived from retained evidence.
- `SOURCE_REPORTED` — a source says X; BINRAT is not asserting X independently.
- `UNVERIFIED_CLAIM` — allegation/hypothesis awaiting evidence.

No class auto-promotes into the canonical evidence graph.

Promotion requires a later, separate pipeline that can reproduce the claim from canonical receipts or preserve it explicitly as source-reported material.

## Planned D1 contract — NOT ADDED IN THIS SLICE

### `shadow_entitlements`

- principal_id TEXT
- plan TEXT CHECK FREE/PRO
- source TEXT
- starts_at_ms INTEGER
- expires_at_ms INTEGER
- updated_at_ms INTEGER

Primary key: `principal_id`.

### `shadow_investigation_requests`

- request_id TEXT PRIMARY KEY
- principal_id TEXT
- chain_id INTEGER
- launch_id TEXT
- kind TEXT
- question TEXT
- state TEXT
- quote_amount_minor INTEGER
- quote_asset TEXT CHECK FIAT/USDC
- quote_expires_at_ms INTEGER
- payment_reference TEXT
- investigator_id TEXT
- created_at_ms INTEGER
- updated_at_ms INTEGER

### `shadow_investigation_submissions`

- submission_id TEXT PRIMARY KEY
- request_id TEXT REFERENCES shadow_investigation_requests
- investigator_id TEXT
- submitted_at_ms INTEGER
- payload_json TEXT
- payload_digest TEXT

### `shadow_investigation_claims`

- claim_id TEXT PRIMARY KEY
- submission_id TEXT REFERENCES shadow_investigation_submissions
- evidence_class TEXT
- statement TEXT
- refs_json TEXT
- claim_digest TEXT

### `shadow_investigation_adjudications`

- decision_id TEXT PRIMARY KEY
- request_id TEXT UNIQUE REFERENCES shadow_investigation_requests
- submission_id TEXT REFERENCES shadow_investigation_submissions
- verdict TEXT CHECK ACCEPTED/REJECTED
- reason_code TEXT
- decided_by TEXT
- decided_at_ms INTEGER

### `shadow_economy_events`

Append-only audit/event receipt:

- event_id TEXT PRIMARY KEY
- principal_id TEXT
- event_type TEXT
- subject_id TEXT
- occurred_at_ms INTEGER
- payload_json TEXT
- payload_digest TEXT

This table is for experiment telemetry and replayability, not token rewards.

## Planned API contract — NOT ROUTED IN THIS SLICE

All Mini App consumer endpoints reuse Telegram Mini App authentication.

- `POST /api/miniapp/entitlement`
  - returns FREE/PRO capabilities and quotas.
- `POST /api/miniapp/investigations/quote`
  - inputs launch id, kind, question.
  - returns quote id/amount/asset/expiry.
- `POST /api/miniapp/investigations`
  - creates a request only from a valid unexpired quote and confirmed payment callback/receipt.
- `POST /api/miniapp/investigations/status`
  - principal-scoped read.
- investigator/adjudication endpoints remain private/admin-only in V0.

Payment confirmation must be server-to-server or otherwise cryptographically/provider verified. The client cannot self-assert `PAYMENT_CONFIRMED`.

## Event telemetry

Product:

- `case_opened`
- `watch_created`
- `alert_opened`
- `premium_gate_seen`
- `premium_feature_used`

Economics:

- `quote_requested`
- `quote_issued`
- `checkout_started`
- `payment_confirmed`
- `investigation_created`
- `investigation_returned`
- `investigation_reordered`

Intelligence:

- `submission_received`
- `submission_accepted`
- `submission_rejected`
- `claim_promoted_separately`
- `promoted_claim_reused_in_case`

Do not collapse attention, activation, retention, revenue and evidence production into one vanity KPI.

## Success / kill criteria

No single arbitrary user-count threshold authorizes a token.

Advance only when the underlying behavior exists:

- real completed non-token payments occur;
- paid users repeatedly use what they paid for;
- multiple investigation requests are paid for, not merely clicked;
- at least one non-core investigator can complete a useful job;
- adjudication can reject weak/ambiguous evidence without corrupting canonical memory;
- accepted evidence is later useful in a Case or investigation;
- repeat purchase/request behavior exists.

Kill or defer deeper economy work when:

- users click but do not pay;
- payments occur only because of token/airdrop expectations;
- investigators need continuous subsidies to participate;
- submissions are mostly unverifiable;
- external evidence does not improve the product;
- USDC + ordinary accounts solve the coordination problem with less complexity.

## Token decision gate

Even after Shadow Economy succeeds, ask again:

**What does a native asset solve that USDC + accounts + reputation do not?**

Permitted answers must describe a concrete coordination advantage. `It creates demand` is not an answer.

Possible later roles, only if empirically justified:

- optional holder access;
- investigator economic bonding;
- intelligence bounty settlement.

Explicitly out of V0:

- staking APY;
- passive holder rewards;
- revenue/profit promises;
- governance theater;
- engagement mining;
- rewards for cheap-to-fake actions.

## Acceptance for this contract slice

- no Worker route;
- no D1 schema mutation;
- no production flag;
- no payment integration;
- no wallet/signing authority;
- no deploy;
- no merge;
- pure lifecycle tests prove funding-before-work;
- only FIAT/USDC are accepted payment assets;
- accepted contributor work never auto-promotes claims to canonical facts;
- FREE remains useful while PRO sells leverage.
