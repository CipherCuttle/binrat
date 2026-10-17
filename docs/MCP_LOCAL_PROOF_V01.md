# BINRAT MCP V0.1 — Pinned offline forensic prototype

**Status:** EXPERIMENT / NOT LIVE / NOT PAID / NOT DEPLOYED.
**Branch base:** \`integration/binrat-a1-3-visual-gate\` commit \`160ab9c4fbb2f9cebd4a45cc20f5e75d85f57302\`.
**Code generation:** owner-approved GitHub changes; Pocket Codex1/2 **text-only design + hostile review** at private phone-bridge issues #28 and #29. Neither phone agent edited or executed repository code.

## User job and evidence

Proof that an MCP-capable LLM can ask for known, source-bounded Pons launch observations and a **genuinely validated 20-record historical Case**, without obtaining RPC, spending money or inventing forensic evidence. The pinned source is from \`docs/receipts/sprint-a1/{public-feed,public-status}.json\`, historical 20-launch snapshot on Robinhood Chain 4663. Exact pinned Git blob hashes are checked at startup and response metadata records SHA-256 for both sources.

A second pinned real capture at \`docs/receipts/sprint-a1-2-contract/old-case-envelope.json\` contains a complete 20-record canonical **Case envelope** for one of the recorded launches, but its publication and checkpoint are **different and later** than the discovery feed. The \`scripts/binrat-mcp-case-offline.ts\` entrypoint verifies all canonical identities, source and provenance receipts through BINRAT's original \`verifyCaseEnvelope\` and then exposes a bounded, metadata-stripped summary of the 20 records. **Complete envelope validation does not mean complete chain history.**\n\n**Recorded \`FRESH_VERIFIED\` does not mean fresh today.** The MCP \`source_status\` always says \`UNKNOWN\` for current health. There is **no real network access or source polling**, no public HTTP endpoint, no company billing, no OpenRouter calls, no external competitor API request, no Telegram, no Watch, no launch or trading authorization.

### Available read-only tools

- \`source_status({})\`: captured checkpoint and source descriptor, present freshness \`UNKNOWN\`.
- \`get_case({"case_id":"64 lowercase hex"})\`: the legacy \`.mjs\` discovery-only entrypoint returns only a card and an honest UNKNOWN. **The new \`.ts\` Case entrypoint** returns \`OK\` for the single fully verified historical Case, with all 20 evidence references and a recomputable Case digest. It always labels historical coverage PARTIAL and live freshness UNKNOWN. Other IDs remain UNKNOWN; no fabricated Cases.
- \`investigate_deployer({"address":"0x + 40 lowercase hex","limit":1..4})\`: exact address matching within the captured latest-20 launch window, not complete-chain address history. No human wallet identity or predictive claims; missing matches remain UNKNOWN.
- \`compare_cases\`: **not implemented**. Gate on evidence envelopes and a same-checkpoint comparison, not synthetic extrapolation.

Each result has \`status, reason, data, provenance, freshness, coverage\`. Input is schema-bounded, 32 KiB inbound/outbound envelope budget and at most four matches per lookup. Untrusted token metadata is excluded from tool outputs. Unsupported tools fail before execution.

### Local run (offline)

From this exact repository checkout root:

\`\`\`sh
node --test test/mcpOffline.test.mjs
pnpm install --frozen-lockfile
pnpm exec tsx --test test/mcpCaseOffline.test.ts
pnpm exec tsx scripts/binrat-mcp-case-offline.ts
\`\`\`

The last command starts the historical full-Case **stdio MCP server**; it waits for newline-delimited JSON-RPC messages from an MCP client. Configure the client to run this command with the BINRAT working directory as its cwd. Nothing is transmitted until the client provides a request on stdin. Only JSON-RPC responses go to stdout.

Supported MCP methods: \`initialize\`, \`tools/list\`, \`tools/call\`, \`ping\`; incoming notifications do not get responses. This is a bounded protocol subset, not a hosted OAuth MCP service.

### Acceptance and limits

1. Real captured feed + status match pinned hashes, schemas, chain, checkpoint, feed digest and field identities.
2. An independently pinned, captured complete Case envelope is canonically verified (20 records, 19 historical precedents). The MCP projection is bounded, contains actual provenance refs and includes explicit partial-history/current-freshness UNKNOWN; missing Case/deployer stays UNKNOWN.
3. Wrong hashes, mismatched independent publications, mutated Case authorities, malformed arguments, unknown tools, forged identity, oversized result limits and >32 KiB JSON-RPC frames fail closed.
4. JSON-RPC handshake/list/call/notification/error paths and stdout isolation pass an actual child-process test.
5. No external requests, model calls, RPC, agent execution, UI write, database mutation or spend.

**Benchmark gate:** There is no Bitquery comparator fixture and no real dual-provider head-to-head result yet. Do **not** say this prototype beat Bitquery. Before commercial promotion, capture a frozen, permitted same-task comparison set with independent answer grading and measured provider costs.

## Owner review and stop

This validates **MCP transport plus actual canonical validation of one recorded historical Case**. It does not prove BINRAT improves an LLM over Bitquery, that a public source is healthy, or that anyone will pay. Next experimental gate is a fair, same-case live comparator run with an authorized Bitquery account and measured costs; do not invent unavailable comparison evidence. No merge, deployment, token work, secrets, subscriptions or payment collection is authorized by this experiment.

## Head-to-head comparison status

**NOT RUN — NO AUTHENTICATED BITQUERY CAPTURE.** The official Bitquery Pons API outside its IDE requires a provider account/token. Its hosted MCP uses a free-account OAuth sign-in. Do not read or publish tokens in GitHub, switch to paid archive, or assume identical history windows. Freeze five comparable tasks against this exact Case (current launch identity, reported deployer, known earlier launches, per-launch transaction references, explicitly incomplete history). Test the same user question with the same LLM and bounded tool-call/time limits. A valid comparator must include provider access/grant, query schema, exact result/status, observed coverage, request/response digests, capture time, verified source scope and charged credits; redact credentials. An incomplete or not-yet-provided comparator is **NOT_RUN**, never a win for BINRAT. The same-checkpoint claim cannot be made across independently captured publications.
