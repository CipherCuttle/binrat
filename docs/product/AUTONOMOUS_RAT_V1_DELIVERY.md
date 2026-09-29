# Autonomous Rat V1 — owner review handoff

Branch: `feat/binrat-autonomous-rat-v1`, rooted directly at deployed code
`b286f68f09494e58ecbba113c393679210eb2af1`. Review base is production release branch
`codex/binrat-prelaunch-release-a911c23`; its extra release-documentation commit is
not merged into this branch. Original worktree and its untracked files were preserved.

## Implementation

- `src/autonomous/model.ts`: chain-scoped targets, evidence envelope, stable IDs,
  deterministic DIG/WHY/ALERT wording and attention interface.
- `evidence.ts`: bounded canonical DIG and reconstructable receipts; unavailable/stale
  evidence fails closed, no LLM or financial judgment.
- `entitlements.ts`: neutral capacity provider, FREE only. PRO/HOLDER exist as profile
  types, with no runtime activation, wallet/balance or funding dependency.
- `watches.ts`: private typed subscriptions, atomic quota/mutation/replay receipts,
  future boundary, disabled tombstones and per-subject update ordering.
- `source.ts`: read-only Arc block/head adapter with bounded timeout and no retries.
- `delivery.ts`: shared recurrence finding, bounded fan-out, canonical source/time
  checks, atomic outbox claim and durable Telegram outcome.
- `telegram.ts`, Worker/Queue integration: default-off S1 `/dig`, `/watch`, `/unwatch`,
  `/watches`, `/why`. Existing legacy path remains active while S1 is off.
- One additive migration `cloudflare/migrations/20260929_autonomous_rat_v1.sql`, plus
  tracked/runtime schema parity. Five new tables (cases, watches, command effects,
  research admissions, outbox) and a rewind cancellation trigger.
  No migration has been applied to a remote D1 database.

No frontend, manifest, token configuration, payment, deployment workflow or production
resource was changed. No callback registration needed. Share-ready identifiers exist;
receipt deep-link recovery and graphical sharing remain S3.

## Verification

- `pnpm exec tsx --test test/autonomousRat.test.ts`: 26/26 PASS after High fixes.
- `pnpm check`: TypeScript, full 239/239 tests, web/share-card/launch-presentation PASS.
- `pnpm --dir web-v2 check`: evidence integrity and build PASS (frontend unchanged).
- Pinned Wrangler 4.135.0 `deploy --dry-run --no-autoconfig`: PASS using a temporary
  config with placeholder D1/Queue names, original compatibility date/nodejs flag,
  and the actual Worker entry point. No upload or resource mutation performed.
- Migration applies twice on the production schema; tracked/runtime parity PASS.
- Deterministic fixture executes real webhook → SQL → Queue → fake Telegram:
  one shared recurrence finding, one ALERT, one send receipt, reconstructable WHY,
  no replay duplicate, no notification after unwatch.
- One hostile review: zero Critical, two High fixed. One targeted rereview: PASS.
  Medium/Low backlog and test-environment limits are in the review record.

Exact synthetic conversation: [AUTONOMOUS_RAT_V1_DEMO.md](AUTONOMOUS_RAT_V1_DEMO.md).
Contract, extraction matrix and S2–S8: [AUTONOMOUS_RAT_V1_PLAN.md](AUTONOMOUS_RAT_V1_PLAN.md).
Review: [AUTONOMOUS_RAT_V1_REVIEW.md](AUTONOMOUS_RAT_V1_REVIEW.md).

## Activation contract — not executed or authorized here

A later owner-authorized deployment must apply the additive migration before enabling
`BINRAT_AUTONOMOUS_RAT_ENABLED=true`. Missing migration fails closed. This flag replaces
legacy Watch handling/consumer in that Worker; old watches are not migrated implicitly.
Users explicitly re-arm; `/watches` reports legacy subscriptions requiring re-arm.

Before cutover, record/snapshot existing legacy subscriptions and pending alerts under
separate production authority. Do not casually roll back the flag: the old consumer
would resume old subscriptions/backlog. A reviewed rollback must retire or reconcile
legacy work and account for V1 unwatch intent. Do not execute those operations from
this handoff. Token, payments, frontend and webhook registration need no change for S1.

Delivery limitation: Telegram offers no send idempotency key. A lost response or a
crash after send can leave UNKNOWN/SENDING. Automatic retry is deliberately prohibited;
operators must not reset these rows to PENDING without independent delivery evidence.
Unwatch stops work before the send claim; an in-flight Telegram request cannot be recalled.

Owner-review readiness does not mean deployed, load-qualified or activated. Public beta
continues running the original SHA. No merge, deploy, token or payment authority used.
