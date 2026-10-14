# Pons V2 low-cost collection, normalization and publishing plan

**Stage:** proposal with verified narrow factory source, not a production deployment. **Objective:** maximize verifiable reuse and product value from *free/bounded* data access before paying for external APIs or operating a full-chain indexer.

## What is already established versus unproven

On 2026-09-25 draft [PR #40](https://github.com/CipherCuttle/binrat/pull/40) recorded independently verified **three distinct** Pons V2 `TokenLaunched` receipts on Robinhood 4663 using SolidRPC public archive access, Tenderly public gateway and Robinscan. Factory `0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e` at verified epoch with pinned runtime hash and upstream source. The source identifies `originalDeployer` and token/curve; **fee recipient remains unknown in these event records**. The sample does not establish funders, historical swap completeness, token outcomes, V4 pools, running ingestion or live alert capability. The official Blockscout transaction UI produced one inconsistent record during independent collection; preserve such discrepancies and independently verify important history with receipts.

## Architecture: collect → normalize → analyze → publish

1. **Collect:** known Pons V2 factory launch logs, per-launch known curve logs, distinct `LaunchSwept`/`PoolGraduated` events, verified selected funding transactions and relevant V4 pool logs **only after pool identity proof**. Capture immutable block/hash, transaction/log index, raw payload, provider receipt and discovered role. Bounded per-source windows/checkpoints and reorg handling; no RPC inside a public feed request.
2. **Normalize:** append-only source event and role schema with `chainId=4663`, protocol phase, source schema version, addresses by factual roles, quote asset and confidence/coverage. Immutable provenance: independent source fact IDs and evidence hashes; current canonical chain checkpoint; correction and reorg records never quietly edit historical digest identity.
3. **Analyze once:** source-linked direct transfers and justified upstream relationships; sequence of observed launches by funding source; duplicate/trader identification with role limitations; curve reconstruction; selected V4 history; age-normalized outcomes, distributions and visibility of unknowns. Recompute cached projections when genuinely new facts arrive, not per page view or watcher.
4. **Publish small:** versioned per-token, per-funder and per-watch-finding JSON snapshots with source links, as-of, completeness and appropriate TTL. Same projection feeds Svelte and Telegram. Public evidence read links free; personalized high-work research goes through metered bounded queue.

## Free/open tools: status, role, limitations

| Tool | Proposed job | Condition before adoption |
|---|---|---|
| Existing [viem](https://github.com/wevm/viem) + TypeScript | Event ABI decode, block-pinned contract reads, verification, replay | Use existing dependency; maintain pinned Pons ABI and multiple provider checks |
| Robinhood [official RPC](https://docs.robinhood.com/chain/connecting/) | Current blocks/basic proofs | Official public RPC is not unlimited production throughput |
| [SolidRPC](https://rpc.solidrpc.io/public/evm/4663) and [Tenderly public gateway](https://robinhood-chain.gateway.tenderly.co) | Independent historical proof when reachable | Retention/rate limits change; agreement is limited to exact sampled fields |
| [Blockscout API](https://docs.blockscout.com/devs/apis) + [Blockscout MCP](https://github.com/blockscout/mcp-server) | Address history, native transfer candidates, traces and AI-assisted exceptional investigation | Confirm Robinhood API reachability, quotas, pagination and commercial terms; don't treat an explorer result alone as immutable proof |
| [WhatsABI](https://github.com/shazow/whatsabi) | Best-effort unknown ABI analysis | Inferred signature never proves behavior, safety or complete events |
| [Ponder](https://github.com/ponder-sh/ponder) | Disposable alternative to custom event collection | PostgreSQL and provider requirements versus measured benefit |
| [rindexer](https://github.com/joshstevens19/rindexer) | Higher-throughput Rust candidate | Defer until TypeScript collector fails on measured throughput/maintainability |
| [Uniswap v4-subgraph](https://github.com/Uniswap/v4-subgraph) | Technical donor/reference for pool, swap and Robinhood adapter | Verify actual Robinhood public deployment, pricing config and applicable GPL terms before copying or shipping |
| Envio / SQD | Alternative fast data services | Verify free-tier API tokens, current 4663 source coverage and long-term cost; no assumed unlimited free dependency |
| [SQLite](https://sqlite.org/) | Local operational collection/checkpoints and proof inventory | Existing repo foundation; separate from busy public service stores |
| [DuckDB](https://duckdb.org/) + [Apache Parquet](https://parquet.apache.org/) | Reproducible age-normalized cohorts, price/trading history, compressed data | Selective scans; preserve source/projection versions; no browser bundle for normal feed |
| Cloudflare D1 / R2 / Worker caching | Small public snapshots, chain/account bounded records, archived evidence | Recheck current quotas and observed usage; don't move all raw history to D1 |
| DuckDB-Wasm | Optional premium client-side historical research | Defer to later power-user UX; bound browser memory and downloads |

**MCP is for agent/operator research**, not a production policy allowing an LLM to fire unlimited provider calls. No automated rotation to evade free-service rate limits. Public API product access and self-hosted software licence are separate questions. Provider prices and free-tier figures must be reverified at the point of adoption, not copied uncritically from this snapshot.

## How to make medium/high-cost features cheap

- **Funding:** start only from verified Pons launch roles, find direct relevant incoming native-ETH/ERC-20 transfers, reuse an address's earlier cached investigation. Normal ETH transfers don't emit ERC-20 `Transfer` logs, so use bounded indexed address history or limited selected block/trace queries; independently verify important receipts. Service/exchange wallet detection and UNKNOWN are mandatory.
- **Hops:** direct transfers for each launch; justify any preceding hop by an observed repeated funding pattern or explicit customer research request. Per-root branching and request budgets stop network explosion. Count actual visible transfers; no assumption on how many hops founders use or what hides ownership.
- **Price:** replay verified `CurveBuy`/`CurveSell` and the phase-specific reserve model **once** per curve into cached historical observations. Do not assume every event implies a complete market or can be sold at observed peak. A meaningful ATH requires verified quote asset, supply/circulation or clearly labeled FDV, observation window and curve plus graduated pool if available.
- **V4:** follow only proven Pons-graduated pool IDs and correct PoolManager event schema. The pool is not logically established merely by a sweep or a token's address. Track source completeness and separate "swept awaiting V4" phase. Existing Uniswap subgraph is reference, not automatic production service.
- **Lifespan:** compute a versioned first sustained 80% drawdown from qualified peak with declared sampling/sustain window; classify mature/ongoing/missing separately. Select equal token-age comparisons, maintain full denominator and contemporaneous Pons baseline; avoid hindsight-derived trades.
- **Wallet activity:** derive recurring early buyers and monitored large buy events from **already collected** trade history when roles are verified; avoid separate wallet RPC polling for every subscriber.
- **Watch fanout:** one canonical event → one shared finding → N bounded eligible deliveries. Chain-scoped dedup, subscription rules, queue, 429 backoff, digest, latency/freshness reporting; no instant claims.
- **API economics:** immutable public receipts and highly cached popular summaries; authenticated customized work is queued and usage-credited; limit concurrency per account/chain/source and globally. Leave payment checkout disabled until independently reviewed.

## Bounded proof-of-Rat: sample and controls

A. Reproduce PR #40's proof offline and independently; establish a **consecutive complete event range containing at least 30 Pons V2 launches** rather than picking only success cases. Source log queries must cover the full chosen block interval, include empty windows, checkpoint/reorg tests and record exactly which tokens are excluded and why. The existing three receipts are anchors, not proof the entire neighboring range is already indexed.

B. For each launch, investigate verified pre-launch direct funding and one additional justified link if necessary under a capped request budget. Include **unknown and service-wallet** outcomes. Record absolute incoming source, transfer time, pair asset and transaction evidence; do not infer a shared human controller.

C. Collect and reconcile per-token curve events, phase transitions and one eligible genuinely verifiable postgraduation V4 pool if found; otherwise report V4 coverage as unverified. Build first quote-asset price history, then optional verified USD conversion. Calculate complete-sample same-age outcomes and median/survival summaries under declared rules.

D. Publish deterministic projection fixtures, sample source receipt hashes and a reproducible local analysis command. Measure **RPC requests, explorer credits, elapsed collection time, missing history, bytes/rows, invalid provider replies, reorg retries and estimated 30-day production costs**. Compare one disposable alternative indexer only after baseline works.

**Draft pilot operating limits:** no paid API subscriptions, local SQLite/DuckDB, provider-specific daily quotas and backoff, no indefinite traces/network crawling, bounded snapshot refresh. An illustrative <=500 indexed explorer calls/day is an initial **experiment ceiling**, not a guaranteed free entitlement or complete coverage. Stop rather than bypass 429s. "$0 paid APIs" excludes operator time, existing hardware/electricity and any optional infrastructure overages.

**Pass condition:** prove a useful real funding/trading history exists with reproducible receipts and known missing-data rate, and the measured costs fit a written ceiling. If the history is too sparse, ship the cheaper Funding Detective first; postpone or downgrade historical thermometer claims. A technically reproduced historical pattern still is not a proven predictive trading edge.

## Performance and operational alignment

Existing repo research has **proposed**, not validated, targets of 10K DAU, 1K simultaneous open clients, 100 mixed RPS sustained 30 minutes and 300 burst RPS 5 minutes. Avoid extrapolating a free-only 30-launch research pilot to those public-load numbers. Run isolated cost-bounded load tests with realistic cache hit/miss, public API cache, per-source queue limits, source lag and Telegram backpressure; separate chain evidence and account/entitlement writes if production architecture warrants. Protect source integrity and cached free receipts before expensive custom analysis.

Sources: [Pons proof manifest](https://github.com/CipherCuttle/binrat/blob/feat/binrat-g2a-a1-pons-receipt-proof-v1/evidence/pons/4663/2026-09-25/manifest.json), [source contracts](https://github.com/ponsdotdev/pons-labs/tree/162310fbd1217717e2f5e4cde794d6a11322b469/contractsV2/src/v2), [capacity research](https://github.com/CipherCuttle/binrat/blob/research/pons-gates-holder-econ-v1/docs/research/SCALABLE_LAUNCH_10K_V1.md).
