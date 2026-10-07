# WORKING RAT L2 V1 — active stake read

L2 reads `stakedOf(wallet)` from an explicitly supplied PonsVault staking vault on Robinhood Chain 4663. It samples one block and records its number and hash, requires deployed vault code, checks `quoteAsset() == address(0)`, and checks `stakedOf(wallet) <= totalStaked()` before returning a raw stake amount.

L2 proves only the reported active stake at that observed block for that wallet and vault. A `VERIFIED` zero is distinct from `UNAVAILABLE`, `STALE`, `CHAIN_MISMATCH`, and `AUTHORITY_MISMATCH`; failed reads never carry a numeric stake. The explicit vault address is input authority for this reader. Callers must source it from reviewed launch/vault evidence; the read alone does not prove that an arbitrary supplied address belongs to a BINRAT launch.

L2 does not prove wallet control, entitlement, token balance, USD value, price, APY, reward, lock, reputation, or launch/marketing authority. It does not sign or broadcast transactions.

WORKING RAT policy is a separate L3 decision. `workingRatMinStakeRaw` remains `null` and unresolved. The boundary helper returns `NOT_CONFIGURED` for null or nonpositive thresholds and cannot grant access from a positive L2 balance alone. When the owner freezes the threshold, L3 can consume only a `VERIFIED` receipt and compare its raw amount to that configured threshold; unavailable or stale evidence remains unqualified.

RPC/interface failures must not become zero because zero is a factual stake observation, while a failed request contains no verified balance. Treating failure as zero would erase the distinction and could make downstream policy reason from fabricated evidence.

Freshness is explicit: a caller-pinned block is rechecked against the canonical block hash; optional `maxBlockAge` enforces a head-age bound. Without that bound, the receipt records `UNKNOWN` freshness even when the block hash is coherent.
