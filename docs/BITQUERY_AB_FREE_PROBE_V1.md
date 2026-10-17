# BINRAT × Bitquery — free-tier A/B probe V1

**Execution status:** LIVE PROBE **NOT RUN**. Source, transport and comparator were only tested offline.
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

The file \`.github/workflows/binrat-bitquery-ab-once.yml\` is wired only to the **first CREATE** of \`bench/bitquery-ab-grant-20261017.txt\` on branch \`experiment/binrat-mcp-local-forensics-v01-20261017\`. That commit must contain exactly the new grant file and the exact message \`test(benchmark): owner grant single free Bitquery A-B probe\`; its content must be \`BINRAT_AB_20261017_ONE_SHOT\`. The workflow refuses reruns at run_attempt > 1 and re-edits of the grant file. It is intentionally not yet triggered. Once the owner has securely installed the token secret, this single file can be created via the existing connected GitHub tools to trigger the bounded attempt. On first terminal result: STOP. No second live attempt without a new owner grant.

## Acceptance and truthful verdicts

\`FIELDS_MATCH\` or \`FIELDS_CONFLICT\`: same exact event became observable on both sources; still not a full product-vs-product evaluation.
\`NOT_COMPARABLE\`: Bitquery free realtime lacks the historical event; cannot score the same job.
\`NOT_RUN\`: authentication, schema, network, budget or other preflight gate failed.

The long-term fair head-to-head requires two providers with the same observed time window, identical user questions, agreed evidence fields, and measured requests/credits. There is **no demonstrated Bitquery-versus-BINRAT performance winner** from this prototype.
