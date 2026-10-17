# BINRAT MCP V0.1 — Pinned offline forensic prototype

**Status:** EXPERIMENT / NOT LIVE / NOT PAID / NOT DEPLOYED.
**Branch base:** \`integration/binrat-a1-3-visual-gate\` commit \`160ab9c4fbb2f9cebd4a45cc20f5e75d85f57302\`.
**Code generation:** owner-approved GitHub changes; Pocket Codex1/2 **text-only design + hostile review** at private phone-bridge issues #28 and #29. Neither phone agent edited or executed repository code.

## User job and evidence

Proof that an MCP-capable LLM can ask for known, source-bounded Pons launch observations from a **recorded** snapshot, without obtaining RPC, spending money or inventing forensic evidence. The pinned source is from \`docs/receipts/sprint-a1/{public-feed,public-status}.json\`, historical 20-launch snapshot on Robinhood Chain 4663. Exact pinned Git blob hashes are checked at startup and response metadata records SHA-256 for both sources.

**Recorded \`FRESH_VERIFIED\` does not mean fresh today.** The MCP \`source_status\` always says \`UNKNOWN\` for current health. There is **no real network access or source polling**, no public HTTP endpoint, no company billing, no OpenRouter calls, no external competitor API request, no Telegram, no Watch, no launch or trading authorization.

### Available read-only tools

- \`source_status({})\`: captured checkpoint and source descriptor, present freshness \`UNKNOWN\`.
- \`get_case({"case_id":"64 lowercase hex"})\`: returns matching **recorded launch card** if in the snapshot, with \`status:UNKNOWN\` and \`FULL_CASE_EVIDENCE_NOT_CAPTURED\`. Full Case envelope is **not** available in this fixture; the caller must not represent this as a complete investigation.
- \`investigate_deployer({"address":"0x + 40 lowercase hex","limit":1..4})\`: exact address matching within the captured latest-20 launch window, not complete-chain address history. No human wallet identity or predictive claims; missing matches remain UNKNOWN.
- \`compare_cases\`: **not implemented**. Gate on evidence envelopes and a same-checkpoint comparison, not synthetic extrapolation.

Each result has \`status, reason, data, provenance, freshness, coverage\`. Input is schema-bounded, 32 KiB inbound/outbound envelope budget and at most four matches per lookup. Untrusted token metadata is excluded from tool outputs. Unsupported tools fail before execution.

### Local run (offline)

From this exact repository checkout root:

\`\`\`sh
node --test test/mcpOffline.test.mjs
node scripts/binrat-mcp-offline.mjs
\`\`\`

The second command starts a local **stdio MCP server**; it waits for newline-delimited JSON-RPC messages from an MCP client. Configure the client to run this command with the BINRAT working directory as its cwd. Nothing is transmitted until the client provides a request on stdin. Only JSON-RPC responses go to stdout.

Supported MCP methods: \`initialize\`, \`tools/list\`, \`tools/call\`, \`ping\`; incoming notifications do not get responses. This is a bounded protocol subset, not a hosted OAuth MCP service.

### Acceptance and limits

1. Real captured feed + status match pinned hashes, schemas, chain, checkpoint, feed digest and field identities.
2. A known captured Case maps to one launch but cannot fabricate a full Case or claim current freshness. Missing Case/deployer stays UNKNOWN.
3. Wrong hashes, malformed arguments, unknown tools, forged identity, oversized result limits fail closed.
4. JSON-RPC handshake/list/call/notification/error paths and stdout isolation pass an actual child-process test.
5. No external requests, model calls, RPC, agent execution, UI write, database mutation or spend.

**Benchmark gate:** There is no Bitquery comparator fixture and no real dual-provider head-to-head result yet. Do **not** say this prototype beat Bitquery. Before commercial promotion, capture a frozen, permitted same-task comparison set with independent answer grading and measured provider costs.

## Owner review and stop

This validates **MCP transport plus narrowly scoped recorded-data retrieval**. It does not prove a real forensic investigation improves an LLM, that a public source is healthy, or that anyone will pay. Next experimental gate is authenticated, source-bound full Case responses and an actual bounded comparison with existing providers. No merge, deployment, token work, secrets, subscriptions or payment collection is authorized by this experiment.
