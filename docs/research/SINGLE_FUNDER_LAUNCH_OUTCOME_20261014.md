# BINRAT — one verified funding recipient → Pons launch outcome (fresh preregistration)

**Registered:** 2026-10-14; **status before requests:** FROZEN / NOT_EXECUTED. New standalone read-only microprobe, not a continuation of closed experiments or old PR #147 cohort. Exact parent evidence: draft PR #188 at `8c2f007889faf9729c50747e2e3f9d74f9044fd5`, live terminal `FUNDING_VERIFIED` provided by owner 2026-10-14. No selection changes or replacement if outcome is absent.

## Locked subject and pre-outcome evidence

Chain Robinhood 4663; Pons V2 factory `0x7ed598bcef8bd9edd8c97a195c6d13f40801ec7e`. `TokenLaunched(address,address,address,address,uint256,uint256)`: topics[0] = keccak256 of that signature, topics[3] = indexed deployer padded to 32 bytes. Frozen funder `0x9bc462bce2acd6fbe2ef5470d55b439453451083`, **one selected recipient** `0xef8cbc4444d505b32198061884cf902e9307fd59`, frozen transfer hash `0x952a185b94feec5649e5e9064186cf7aa763cc5b864db9c28b53879762189488`, block **81,505,114** (`0x4dbab5a`), block hash `0x06e4b5633c8eade32195ffc657db00312f6ad3088474a26731ac35ecc2ec068a`, transaction index 7, first verified funding block timestamp **1791276881 UTC seconds**, value **2380074468070616 wei**. None are chosen based on later Pons outcome.

Time horizon: **600 / 3600 seconds strictly after funding**; same-block launch excluded. Fixed maximum outcome ceiling **81,756,562** inherited from old cohort; no dynamic head/extension.

## Frozen execution and budgets

Use existing *connected Alchemy app* to perform only read-only `eth_getBlockByNumber`, `eth_getLogs`, `eth_getTransactionReceipt`, and optionally full `eth_getBlockByNumber` for positive confirmation. Do not run `eth_getCode`, rerun source selection, scan other wallets, sign, broadcast, message or write to production. One chain-header recheck of funding block (must match pinned number/hash/time) and at most **nine strictly consecutive chunks of at most 4096 blocks** from fundingBlock+1. For each chunk: header at chunk upper bound BEFORE log query, `eth_getLogs` filtered to exact factory, signature and recipient topic, and same header AFTER to catch drift; require exact number/hash/parent/timestamp agreement, monotonically increasing chunk-end timestamps, canonical log fields and explicit empty/nonempty response. Stop scanning once upper-bound header timestamp >= funding timestamp + 3600 seconds. A timestamp that does not mature before cap/ceiling results `INCOMPLETE_COVERAGE`, never negative.

Where events are returned, process earliest exact matching launch event by increasing block and logIndex; require strictly later block than funding, exact Pons event signature/topics, independent canonical block lookup (same hash and provider timestamp), successful exact tx receipt containing the matching log, no `removed`, and recheck of that block header if within budget. Reject conflicting logs or duplicate event identity, impossible timestamps and drift. Compute exact delay from chain block timestamps. Classify positive <=600s and <=3600s separately. A later qualifying launch beyond 3600s does not count in 60-minute numerator, and a provider-empty fully covered 3600s interval is only a **bounded provider-reported negative**.

**Total hard cap: 32 RPC requests for this new experiment**: one funding header; up to nine chunks × three RPC calls = 28; up to three candidate confirmation calls = 31. No retries/fallbacks. No new paid plan or secret. Historic monthly Alchemy budget last known $10; no per-request USD proof available. Record all requests/count/failure/coverage in final result; if an RPC body is inaccessible or truncated, stop `BLOCKED_SOURCE_OR_PROVIDER`. Enforce request budget before each call.

## Stopping and evidence language

Possible verdict: `VERIFIED_LAUNCH_WITHIN_10_MIN`, `VERIFIED_LAUNCH_WITHIN_60_MIN`, `PROVIDER_NEGATIVE_60_MIN`, `LAUNCH_AFTER_60_MIN` (if verified beyond window), `BLOCKED_SOURCE_OR_PROVIDER` or `INCOMPLETE_COVERAGE`.

This is **N=1, nonrepresentative, retrospectively selected and baseline-repeated**, so it **cannot establish population yield, prediction, causal funder control, profitability, launch quality, user usefulness, WTP, or Graph Sniffer improvement**. Exact same-address relation is already handled by deterministic BINRAT `SAME FUNDING SOURCE` logic. On completion write one sanitized outcome and STOP. Any broader cohort requires independent fresh preregistration/owner grant. Do not merge/deploy this evidence branch.
