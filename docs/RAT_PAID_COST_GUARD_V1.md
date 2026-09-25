# BINRAT AI COST GUARD — Workers Paid launch trial

Date: 2026-09-25. Status: owner-approved limited public trial, automatic 7-day expiry.
This document supersedes the 120-call/250-token proposals in the earlier experiment brief.

## Live admission gates

- RAT_AI_ENABLED controls harmless small-talk ONLY, never factual trading, launch, safety, investment, legal or status claims. Existing deterministic handlers and /feedback always take priority. A model failure, quota failure, D1 outage or trial expiry falls back to the deterministic rat.
- Atomic production D1: **10 attempted calls per Telegram sender across chats per UTC day, 30 attempted calls globally per UTC day**. Failed calls retain reservations. Concurrent calls cannot exceed these quotas.
- Input truncated to 600 user characters and 280 characters of prior bot output. No raw user message history is stored. The fixed @cf/zai-org/glm-4.7-flash model has max_completion_tokens=160, enable_thinking=false, temperature=0.4, no tools or paid alternate model.
- Every public inference explicitly names the cost-controlled AI Gateway binrat-rat-capped-v1 in env.AI.run's third argument. If its dollar caps fail provisioning/readback, live AI enablement is blocked. No bypass to direct uncapped AI.
- AI trial deployment pins RAT_AI_TRIAL_EXPIRES_AT_MS to seven days after rollout. Once expired, model inference stops automatically without disabling ordinary Telegram replies, typed conversation context or feedback.

## Dedicated Cloudflare AI Gateway, independently verified

On 2026-09-25 the existing authorized BINRAT Cloudflare admin API token created and read back the dedicated gateway binrat-rat-capped-v1:
- three requests per rolling minute, zero retries;
- **USD 0.05 per day** (fixed) and **USD 0.50 per rolling 30 days** spend limits, whichever reaches its threshold first;
- standard Workers AI billing, collect_logs=false, caching disabled; no other app, gateway, D1, webhook or secret was changed.

The live deploy checks the exact gateway identity, cost rules, rate limit, model gateway routing, D1 quota and token cap *before* enabling public inference. Failed checks stop the deployment without changing the currently deployed bot.

Cloudflare says Gateway spend limits use estimated cost and are eventually consistent; simultaneous calls can briefly exceed the stated cap before enforcement catches up. D1's atomic 30-call/day admission and the gateway's 3-request/minute ceiling give a separate request-volume boundary. Other Workers AI apps can use the same account-wide free allocation and incur their own bills outside this gateway.

## Measured real model sample

An authenticated real GLM-4.7-Flash smoke on 2026-09-25 returned HTTP 200 and valid one-line BANTER JSON. The provider reported 72 prompt tokens, 16 completion tokens, 88 total tokens and **0.9784 neurons**. A single sample verifies model compatibility, not free-account headroom or a permanent cost forecast.

## Surge behaviour and total account spend

After 30 model attempts in one UTC day, remaining users get existing free deterministic replies, not queued paid model calls. Even if 50,000 new people try the bot, that count cannot raise the AI call cap without a reviewed code/configuration change. Feedback writes are separately limited to three/user and 100 globally/day.

Paid Workers also bill account-wide Worker requests/CPU and D1 activity above their monthly allowances; AI caps do not by themselves limit all traffic to the Telegram webhook, existing website, indexer, queues or unrelated applications. Check Cloudflare's complete account billing and D1/Workers metrics at scale, and configure operational billing alerts.

No increase to the global quota, per-minute gateway setting, monthly dollar ceiling, trial lease or alternative paid model without explicit new owner approval and verified CI.

Official docs: Cloudflare Workers AI pricing; Cloudflare AI Gateway spend limits; AI Gateway Workers AI binding; Cloudflare Workers and D1 pricing.
