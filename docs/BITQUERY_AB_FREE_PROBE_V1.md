# BINRAT × Bitquery — free-tier A/B probe V1

**Execution status:** RETRY COMPLETE ([run #39036940032](https://github.com/CipherCuttle/binrat/actions/runs/39036940032)). The first authorized GitHub workflow ([run #39036392483](https://github.com/CipherCuttle/binrat/actions/runs/39036392483)) **FAILED PREFLIGHT BEFORE ANY BITQUERY REQUEST** because the default checkout depth was one commit; its `git diff HEAD^ HEAD` check had no parent. Secret-using step skipped. Thus actual Bitquery A/B remains **NOT RUN (0 requests)**. Fix is staged, but a new owner grant is required before another attempt.
**Scope:** one historical Pons v2 launch already validated in the BINRAT MCP Case V0.2. No archive requests, no model inference, no wallet actions, no publication or paid plan.

## Credential custody

- The owner must create a **GitHub Actions repository secret** \`BITQUERY_AB_FREE_TOKEN\` in \`CipherCuttle/binrat\`, using the GitHub Settings → Secrets and variables → Actions interface. Do not insert a token in committed code, a PR/issue comment, a workflow file, or a chat message.
- The secret is scoped to this one-shot read-only workflow and passed only as an \`Authorization: Bearer\` header to the exact \`https://streaming.bitquery.io/graphql\` endpoint. The runner never prints/persists the token or embeds it in a URL.
- Bitquery documentation currently uses **OAuth Bearer access tokens** for V2 (often \`ory_at_…\`), not the old V1 X-API-KEY header. A UUID-shaped identifier may be a different credential. On HTTP 401/403, report AUTH_UNAVAILABLE and STOP; no token-type guessing, retries or wider probes.

## Exact A/B design

- A: pinned source-bound BINRAT Case 4663 launch ID \`742ed5c2d361c11d5a4da715e35e6c189a9b61ae4a433a937a96111360d7ab01\`, historical, 20 records with partial older-history coverage. Use the original Case verifier in \`scripts/binrat-mcp-case-offline.ts\` to validate the Case; the comparator pins the exact original Git blob of the receipt and hashes it before any query.
- B: at most **two** GraphQL POST requests against Bitquery **realtime only** on \`EVM(network: robinhood)\`: (1) one recent Pons V2 TokenLaunched to confirm realtime data access, (2) one exact historical target transaction filtered to Pons V2 launch factory and event topic. **No archive or combined dataset.**
- Compares only five directly shared observable event fields: transaction hash, block number, token, reported deployer and event signature. An \`OK\` field comparison is **not** proof that Bitquery reproduces BINRAT's 20-receipt Case, nor evidence that BINRAT is more accurate or commercially useful.
- If the historical transaction is outside the free realtime window, outcome is \`NOT_COMPARABLE\`, not an A/B win or negative on-chain assertion.
- No free tier assurances beyond user-reported absence of a payment method; requests may still consume provider trial quota. No archive add-on, plan upgrade or credits purchase.

## Hard ceilings

At most 2 sequential Bitquery requests; no concurrent fanout; no retries; one fixed URL; 12-second deadline per request, bounded 32-KiB response streaming, 2-minute CI job cap; no raw GraphQL responses uploaded to public artifacts; only response/request SHA256, HTTP status, byte count, latency and fieldwise match result exposed. A 401, failed schema, unavailable recent data or network problem stops immediately with a NOT_RUN reason.

## Release gate: opt-in one-shot run (owner-required GitHub secret)

Original grant \`bench/bitquery-ab-grant-20261017.txt\` was consumed in a **preflight-only** run that did not touch the Bitquery API. The shallow checkout has been fixed using \`fetch-depth: 2\`. The workflow is now gated on a **separate new owner-authorized CREATE** of \`bench/bitquery-ab-grant-retry-20261017.txt\` on branch \`experiment/binrat-mcp-local-forensics-v01-20261017\`. That commit must change only the marker, use exact message \`test(benchmark): owner regrant after zero-request preflight failure\`, and marker text \`BINRAT_AB_20261017_PREFLIGHT_RETRY_ONLY\`. The workflow refuses reruns at run_attempt > 1. **Do not create the retry marker without a new explicit user approval.** No token should be placed in the marker, code or issue.

## Acceptance and truthful verdicts

\`FIELDS_MATCH\` or \`FIELDS_CONFLICT\`: same exact event became observable on both sources; still not a full product-vs-product evaluation.
\`NOT_COMPARABLE\`: Bitquery free realtime lacks the historical event; cannot score the same job.
\`NOT_RUN\`: authentication, schema, network, budget or other preflight gate failed.

The long-term fair head-to-head requires two providers with the same observed time window, identical user questions, agreed evidence fields, and measured requests/credits. There is **no demonstrated Bitquery-versus-BINRAT performance winner** from this prototype.

## Actual capped retry receipt — 2026-10-17

**Source of record:** [GitHub Actions #39036940032](https://github.com/CipherCuttle/binrat/actions/runs/39036940032), triggered by owner's explicit regrant and marker commit `989c2109e6fd2d01b0756dfcef3686a5728de6a7`. All workflow steps PASS; no second attempt authorized.

- Authorized Bitquery V2 Bearer authentication worked: the calibration realtime Pons query returned HTTP **200** with at least one Event, 801 response bytes, ~1,106 ms request time. GraphQL error handling did not report a failure.
- The exact historical BINRAT target transaction query returned HTTP **200** and **zero Events**, 30 response bytes, ~154 ms request time.
- Budget exhausted deliberately after **2 of 2 allowed requests**, with no paid archive request, retry, token printing, credential commit or GitHub artifact containing raw response.
- Output: `status: NOT_COMPARABLE`, `reason: HISTORICAL_TARGET_NOT_IN_FREE_REALTIME_WINDOW`, `checks: 0`, `matched: null`, `archiveQueried: false`.
- The reason label is the runner's coverage interpretation. **Zero Events cannot independently distinguish realtime retention limits from the query filters or field mapping.** We therefore do not claim that Bitquery lacks the onchain record, is inaccurate or inferior to BINRAT.
- BINRAT's independently validated historical 20-record Case digest remained `c2f0e7658021bc9587c265a3d172f230d4e203cc15b2ebfd24b049e6ed6ac1a3`. The current data-plane health and price/credit accounting were not observed in this run.

**Stopping rule:** STOP. No further Bitquery requests, retries, paid/archive query or new grants without separate user authorization. The next fair benchmark would need a genuinely overlapping event and aligned evidence scopes, not extrapolation from the empty historical target query.
