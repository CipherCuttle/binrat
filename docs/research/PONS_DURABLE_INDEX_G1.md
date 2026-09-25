# BINRAT Pons G1 — durable read plane, isolated from Arc
Date: 2026-09-25. Working draft PR #31. Implementation only; no remote D1 mutation or deployment authorization.

## Data and source law
- Chain 4663, fixed Pons V2 factory \`0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e\`, exact reviewed runtime hash and factory epoch 26841846, same pinned identity as SENTRY.
- Use a **separate PONS_DB binding**, never Arc DB or tables; \`cloudflare/pons-schema.sql\` is **not** auto-applied to any production database.
- \`bootstrapPonsWindow\` explicitly chooses at most 8192 recent blocks and stores the preceding anchor. It cannot claim factory-epoch history. \`collectOneConfirmedRange\` advances one contiguous <=64-block range at <=16 factory-event rows (+checkpoint + receipt); reduce dense ranges, refuse to drop >16 logs in one block. Empty ranges also advance.
- HTTP is the authority for ingestion and finality. Chain ID, exact factory bytecode hash at confirmed target, log event address/filter, each observed block hash, target anchor and previous checkpoint are checked. 12 confirmations. SENTRY #77 measured WS discovery earlier than its own 5-second HTTP poll on 31 matched events; WS is a future **wake-up hint**, not an alternate finality authority in this slice. No continuous service is wired yet.
- Event identity follows SENTRY \`PONS_V2_EVENT_V1\` (factory+tx hash+log index); immutable fork-specific fact ID also incorporates block hash. Append-only fact triggers reject UPDATE/DELETE; checkpoint and receipt advance atomically. A deep reorg detected at the prior confirmed checkpoint writes an alert and **halts** publication. No automatic ancestor recovery or deletion is disguised as success.
- This slice uses exact factory event fields only. No direct-call metadata enrichment, factory state readback, trade-flow receipts or native ETH funding traces are persisted yet. Such fields are UNKNOWN rather than inferred. Unknown historical coverage never becomes a clean-wallet finding.

## Public contract and authority
- Worker routes are \`/api/pons/health\`, \`/api/pons/feed?limit=1..100\`, \`/api/pons/launch/:id\` and \`/api/pons/creator/:address\`. All GET-only and chain-exclusive, cache up to ten seconds when fresh. Outputs carry a checkpoint number/hash, window start, timestamp, staleness and explicit uncollected-funding status. No Arc fallback.
- Requires BOTH a separately provisioned PONS_DB and explicit \`BINRAT_PONS_PUBLIC_API_ENABLED=true\`. Default worker and published GitHack pilot are unchanged; no production service has been activated.
- A separate bootstrapped collector process / queue / cron, RPC resiliency, capacity tuning and HTTP-vs-WS reconciliation require independent readiness evidence and deployment authorization.
- Next milestone after G1 readiness: explicitly sourced direct-factory calldata, full SENTRY launch-record parity, a bounded 2-hop Robinhood native ETH/verified-token funding tracer with exchange/service UNKNOWN handling, and only then a 5–9-node transaction-backed graph. Never claim a link merely from common exchange funding.

## Tests and release gates
- Unit/contract regression: identity, chain isolation, insert replay collision, atomic checkpoint and empty-range commit, reorg halt, never-visible-on-halt API, disabled-by-default worker, bad addresses and metadata.
- Exact-head root and Vite CI required. Independent RPC run and production PONS_DB creation NOT authorized by this commit. Do not republish static preview as evidence of a live Pons API.

