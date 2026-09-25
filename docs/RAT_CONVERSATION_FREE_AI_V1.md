# RAT CONVERSATION / FREE AI — isolated V1 experiment

Status: **DRAFT / DEFAULT OFF / NO PRODUCTION MIGRATION OR DEPLOY AUTHORITY**.

Base: `feat/binrat-frontend-mobile-m1`; deliberately separate from the active owner bento dashboard PR #31 and Pons successor PRs. Existing Telegram replies and read-only evidence authority are unchanged when the two new flags are not enabled.

## Behaviour

* Current deterministic commands, parser, source receipts, creator/address role checks and claim boundaries retain precedence.
* `RAT_CONVERSATION_ENABLED=true` enables 30-minute, **chat + sender** scoped D1 context, never shared between group members. Stores last **bot** reply (up to 320 chars) and one explicitly selected creator address / launch ID. It does **not** store raw user messages. Supported followups: prior launches for an explicitly discussed creator; receipt/replay for a specific launch. In group chats, each turn must still address BINRAT or reply to the bot. Bare addresses never become creator claims. `/forget` deletes that sender's context in that chat. Expired context is unreadable immediately; a daily UTC cron-window prunes expired rows and counters.
* `RAT_AI_ENABLED=true`, with the `AI` binding, adds **non-factual small-talk fallback only** for otherwise unclassified messages. No LLM inference for trading, legal/health, token, status, address, project evidence, or launch questions. Model responses must be a one-line JSON BANTER object, then pass a conservative postvalidation filter; bad JSON, model errors, budget exhaustion or missing migration fall back to existing deterministic CLARIFY.
* No web search, user URL fetch, wallet/transaction interface, secret forwarding, vector database or paid external LLM API.

## Nominal budget (admission cap, not an account-level billing lock)

Model: `@cf/zai-org/glm-4.7-flash`, fixed `max_completion_tokens=250`, <=600 user characters, tiny previous-bot context. Admission: **10 attempted AI calls per sender per UTC day** and **120 attempted AI calls globally per UTC day**. Atomic D1 `INSERT ... ON CONFLICT DO UPDATE ... WHERE count < limit` makes concurrent reservations enforceable. A user is reserved *before* the global pool, so unlimited over-cap spam does not drain shared capacity. Failed calls retain a reservation (fail-safe). Day boundary: 00:00 UTC.

At 4,500 input + 250 output tokens, published approximate pricing is 33.85 neurons/call; the 60-neuron planning reserve × 120 calls = 7,200 neurons, below an 8,000-neuron target (80% of the 10,000 free daily allocation). **60 neurons is a planning allowance, not a model-enforced per-call spending cap.** Real usage varies with reasoning, tokenizer, account-wide sharing and other Cloudflare Workers AI consumers. Cloudflare's Workers Free plan stops requests at the free allocation; Workers Paid **can charge for overruns**. If zero paid inference is an absolute requirement, keep Workers AI on an account with no overage authorization and watch the **account-wide** usage in the Cloudflare dashboard. Application quota alone does not guarantee a zero bill on a paid account. See [Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/) and [GLM-4.7-Flash model](https://developers.cloudflare.com/workers-ai/models/glm-4.7-flash/).

## Candidate setup (not permission to deploy)

1. Create a **separate candidate D1 database** or local D1 test database; apply `cloudflare/migrations/20260925_rat_conversation.sql`. Do not implicitly mutate the production D1 database.
2. In a **separate candidate** Wrangler config, attach `"ai":{"binding":"AI"}` and keep `RAT_CONVERSATION_ENABLED=false` and `RAT_AI_ENABLED=false` until live acceptance.
3. Run `pnpm check` and `pnpm exec wrangler deploy --dry-run`. Exercise private messages, multi-turn creator and launch followups, a public group mention, another group member isolation, `/forget`, 10/user + 120/global admission, 429/AI outage fallback, webhook duplicate suppression, Telegram send failure and 30m memory expiry. Inspect the Cloudflare neuron dashboard.
4. Separately authorize candidate deployment and enable memory first; only then enable AI. Do not merge this experimental PR into the visual/production branches without explicit owner authority.

## Test and rollback

`test/ratConversation.test.ts` freezes context, quota, validation and prune invariants; `test/cloudflareRatConversationWorker.test.ts` runs the actual Worker webhook with mocked Telegram and AI. Both are offline, cost-zero tests; they are **not** proof that the Cloudflare model responds to this prompt or that live billing remains zero.

Rollback: set both flags to `false` without schema rollback. Keep existing tables inert and preserve deterministic replies. This PR does not change public evidence schemas or authority.

## Authorized isolated candidate gate (September 25, 2026)

The \`rat-conversation-candidate-deploy\` workflow runs **only** on the exact
\`feat/binrat-rat-conversation-free-ai-v1\` branch when the head commit contains
\`[deploy-rat-candidate]\` (or after an explicitly selected workflow dispatch).
It executes full \`pnpm check\` on that branch before any Cloudflare write and
requires existing \`CLOUDFLARE_API_TOKEN\` and \`CLOUDFLARE_ACCOUNT_ID\`
GitHub Actions secrets. Missing credentials fail before provisioning.

The script pins only:
- Worker: \`binrat-rat-convo-candidate-20260925\`;
- D1: \`binrat-rat-convo-candidate-20260925\`;
- Workers AI: \`AI\` binding;
- no assets, cron triggers, queue producers/consumers or production RPC secret;
- production \`binrat-edge-v0\` and \`binrat-v0\` remain untouched.

Candidate defaults: memory ON, Telegram replies OFF, public Telegram AI OFF.
An authenticated private \`POST /__candidate/rat-smoke\` route is available
**only** with candidate flag and a high-entropy Worker secret. It has no
user-supplied prompt and one D1-fenced call per UTC day. Its JSON response
exposes actual model-reported token counts (if supplied) and a **derived**
neuron estimate (5,500 per million input tokens + 36,400 per million output
tokens). It deliberately cannot claim account-billed neurons, which require
Cloudflare dashboard verification. Unauthenticated requests cannot spend AI
or write budgets.

For a separate private Telegram acceptance, set GitHub Actions secret
\`RAT_CANDIDATE_BOT_TOKEN\` **for a newly created test/sandbox bot only**,
and GitHub Actions variable \`RAT_CANDIDATE_ALLOWED_USER_ID\` to the tester's
numeric Telegram user ID. The workflow verifies \`getMe\`: the candidate bot
username must contain \`test\`, \`sandbox\` or \`candidate\`, and cannot be
\`BinratBot\`. Only then does it install that *separate* token/secret, enable
deterministic replies with chat+sender memory for that one tester's **DMs**
and register the candidate webhook. Group chats and every other sender are
acknowledged but ignored. Public Telegram AI remains **OFF**.

To run exactly one *actual* AI request, **first** check Cloudflare's
**account-wide** free daily neuron headroom and plan in the dashboard. Set
both GitHub Actions variables \`RAT_FREE_NEURON_BUDGET_VERIFIED=true\` and
\`RAT_RUN_AI_SMOKE=true\`, then explicitly rerun the guarded workflow.
Without both variables the workflow deploys and tests the HTTP/auth surface
but performs **zero paid or free model inference calls**. On a paid account
even a one-shot request could incur a tiny overage when the free allocation
was already used: no script can guarantee zero invoice charges without an
account-level consumption check.

Acceptance requires CI, separate Worker/D1 readback, default-off public
Telegram AI, HTTP health, rejected unauthenticated AI smoke, single measured
AI sample if separately permitted, and a private DM rehearsal when a distinct
test-bot token + tester ID exist. Do not repoint the production bot. A failed
step is a block, not evidence of success.

Rollback: disable the *candidate* flags or delete only the exact candidate
Worker and D1 after exporting any evidence. Do not delete/alter production
Worker, production D1, live bot webhook or Cloudflare API token.

## Owner-authorized isolated run

September 25, 2026: isolated candidate Worker/D1 provisioning and private readback were authorized; **no production cutover, no production Telegram bot webhook change, no merge and no paid-model overage authority**. A real model invocation remains gated on independent verification of unused account-wide free allocation; a separate sandbox bot and tester ID are required to activate Telegram DMs.


## Live BINRAT and end-user feedback (owner-approved extension)

The owner has authorized a guarded deployment to the **existing** \`@BinratBot\`, not a separate test-bot cutover. This approval is scoped to conversation memory, bounded free-AI small talk when no paid inference can occur, and an explicit private feedback inbox. Deployment remains blocked until GitHub Actions passes the production-credential preflight and verifies the current bot's \`getMe\`, existing webhook URL, production Worker identity, pinned D1 and queue IDs. No merge authority or token/launch authority is implied.

The \`rat-conversation-live-deploy\` workflow is triggered only by a head commit bearing \`[deploy-rat-live]\` on the exact experiment branch or a manually confirmed dispatch. It tests the exact source, compares production web assets, applies only two additive D1 migrations to the pinned existing D1, deploys to the existing Worker with \`--keep-vars\` to retain Cloudflare dashboard vars and existing secrets, and verifies \`/health\` and the unchanged bot webhook after deployment. It never creates D1, queues, bots or a replacement webhook. Any missing or mismatched prerequisite halts without asserting success.

Production flags upon passing all gates: \`TELEGRAM_REPLIES_ENABLED=true\`, \`RAT_CONVERSATION_ENABLED=true\`, \`RAT_FEEDBACK_ENABLED=true\`. **\`RAT_AI_ENABLED=false\` until \`RAT_FREE_PLAN_VERIFIED=true\` is explicitly established in GitHub Actions variables after inspecting the Cloudflare account.** Workers Paid may bill beyond the account's shared free allocation; no user authorization to incur charges is implied. The existing deterministic Rat and multi-turn typed memory work without an LLM.

### User feedback

Users may opt in in a **private DM** with \`/feedback bug: ...\`, \`/feedback idea: ...\`, or \`/feedback <message>\`. Bare conversations are **never** silently archived as feedback. \`/feedback\` or \`/feedback privacy\` explains the retention policy; \`/feedback delete\` permanently removes the sender's submitted D1 rows and user-specific rate counters. \`/feedback inbox\` is a read-only view of five most recent 300-character excerpts **only** when used in a DM from the exact \`RAT_FEEDBACK_ADMIN_USER_ID\` configured in GitHub Actions vars. Unconfigured or different users get no data; group chats are always denied even for the owner.

Each submission has a source Telegram update receipt ID, category (BUG/IDEA/GENERAL), 1,200-character maximum, consented text, sender Telegram user ID for deletion and timestamp. D1 stores 90 days maximum with daily cron pruning. No raw ordinary conversation messages are retained in the feedback table, and feedback is never used as a model prompt or published automatically. A basic secret-like content filter warns against sending private keys/passwords; it is not a substitute for avoiding sensitive information. Quotas: max three submissions/user/UTC day and 100 globally/day; durable webhook dedupe avoids duplicate saves or double charging on Telegram send retry.

Operator can inspect the full inbox privately via the Cloudflare D1 console query:

\`\`\`sql
SELECT update_id, kind, body, datetime(created_at_ms / 1000, 'unixepoch') AS received_utc
FROM rat_feedback
ORDER BY created_at_ms DESC, update_id DESC
LIMIT 50;
\`\`\`

This query must be run only in the authorized Cloudflare D1 dashboard, never from a public website. The Telegram \`/feedback inbox\` command is a private summary and deliberately omits submitter IDs. Only the operator should have DB export access. Existing public evidence and token-related data are unaffected.

## Owner production test authority — 25 September 2026

Owner explicitly approved testing the existing public `@BinratBot` in Telegram and capturing opted-in `/feedback` from end users. This approval authorizes one guarded live Worker deployment when full exact-branch tests, GitHub deployment credentials, bot identity, webhook, D1 and queue checks all pass. The deployment must retain existing frontend assets, queues, indexed research, bot webhook and launch authority. Missing secrets or failed preflight means STOP, not a replacement deployment. Do not authorize any paid Workers AI overage; keep model inference disabled until no-charge eligibility is independently confirmed.

## Reuse existing BINRAT deployment secrets (25 September 2026)

GitHub Actions production and candidate workflows map their runtime environment from the existing `BINRAT_CLOUDFLARE_ADMIN_API_TOKEN` and `BINRAT_CLOUDFLARE_ACCOUNT_ID` secrets. GitHub `TELEGRAM_BOT_TOKEN` is optional: if missing, the production script uses Cloudflare metadata to **verify by name only** that the current `binrat-edge-v0` Worker already has `TELEGRAM_BOT_TOKEN` and `TELEGRAM_WEBHOOK_SECRET` bindings. Neither value is extracted, copied or logged. The script makes no `setWebhook`/`deleteWebhook` call; without a GitHub Telegram token it cannot independently check Telegram's currently registered webhook URL, so a successful deployment still requires a real DM acceptance check in Telegram. If the two live Worker secret bindings are absent, STOP before D1 migration or deployment.

Both prefixed Cloudflare GitHub secrets must be accessible to the workflow in the branch context; if they exist only as GitHub Environment secrets, the workflow must be assigned that protected environment by an operator rather than silently falling back to another token. The Workers AI flag remains off unless the Cloudflare plan and free-inference risk have been explicitly verified. No production token launch, merge, bot cutover or chargeable AI authority follows from this credential correction.

Rollout checkpoint: 25 September 2026 08:07 UTC. Existing BINRAT-prefixed GitHub secrets, current bot identity and webhook, production D1/queue, and current Worker secret bindings were all verified. First attempt stopped on Wrangler packaging because generated config lived outside the checkout. The generated live config now stays at the checkout root so `main` and static `assets` resolve correctly. The retry retains all safety gates and performs no webhook re-registration.


## 25 September owner continuation — dedicated AI Gateway cost preflight

Owner requested activation of small talk on the existing production Telegram bot after the Workers Paid subscription was disclosed. Before any new model invocation or public AI flag, test the dedicated `binrat-rat-capped-v1` gateway provisioner independently; require Cloudflare to read back both spend-limit rules and rate limits. Production remains AI-off until the real model smoke and bounded deployment meet their own acceptance gates. This step does not itself authorize an uncapped billing exposure.


## Real-model acceptance gate (one fixed-prompt request)

The dedicated `binrat-rat-capped-v1` AI Gateway readback on 25 September 2026 confirmed 3 requests/min and two spend-limit rules ($0.05/day and $0.50/30 days). Proceed with the *single fixed-prompt Cloudflare model smoke* before any public AI activation. The smoke must not send Telegram messages, redeploy Workers, or allow arbitrary prompts; failed JSON validation blocks rollout. Existing public AI remains off until that test and release CI pass.
