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
