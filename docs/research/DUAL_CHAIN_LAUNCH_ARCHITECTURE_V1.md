# BINRAT — dual-chain launch research contract V1

Decision recorded: 2026-09-25. Owner direction: BINRAT's PUBLIC INTELLIGENCE product should meaningfully support both Arc mainnet (5042) and Robinhood Chain mainnet (4663) at the intended BINRAT token launch, with additional chains considered later. This is a planning / research contract, not an assertion that Robinhood ingestion currently works, a production roadmap merge, or authority to deploy, market or launch a token.

## One token rail, two evidence rails

- Planned BINRAT token: one conditional Pons V2 direct-factory candidate on Robinhood Chain 4663, not an Arc token, bridged BINRAT asset or second issuance.
- Public evidence: existing ArcPad/Arc 5042 plus a **new, genuine Pons/Robinhood 4663 research indexer**. Do not launch a fake Robinhood page that only displays our future token, RPC explorer links or static fixtures.
- One research product: chain-filtered launch discovery, per-chain Creator Files, public receipts, basic activity timelines, basic Watch and factual Replay/observation coverage when independently available.
- A user can benefit from both evidence rails without buying BINRAT. Optional *later activated* 4663 token-holder eligibility can unlock greater service capacity on either chain, but never modify raw receipts, adjudication, filtering methodology or truthful public coverage. Ordinary paid research seats should be independently testable.
- Extra chains are **future extensions**, not an unbounded V0 commitment. Expansion is conditional on user demand, independently verifiable launch-source contracts, normalized provenance and controlled marginal infrastructure cost.

## Current architecture audit — exact inspected source, NOT a feature promise

The PR #35 base ('f1411ab83eddb25ed18c88584b6e26e75e86f163') still contains:
- Arc-only LaunchSourceKind = 'ARCPAD' in src/core/types.ts and ArcPad-specific launch/event hash prefixes in src/core/identity.ts. Old launch IDs and receipt digests are immutable: DO NOT silently redefine them when adding Pons source IDs.
- Arc-only PublicBag.source = 'ARCPAD' and one chain-level PublicFeed. Multi-chain presentation must combine separately verified per-chain feeds rather than pretend two independent block heights form one point-in-time snapshot.
- ArcPadLaunchSource, ArcObservationSource, ArcRatRadarSource are the existing actual ingest/observation adapters. A new Robinhood Pons source is NOT present in this inspected tree; the current Pons read-only launch receipt, candidate SIWE/holder probes and discovery documentation are different capabilities.
- Rat Radar receipt syntax assumes V3 Swap(address indexed sender, address indexed recipient, ...) and a V3 pool token0/token1 ordering. The Pons launch curve, Pons-specific launch events and any V4 graduation/exit mechanism require **distinct verified event schemas**. Never synthesize V3 recipient receipts from a fundamentally different trade log.
- D1RatWatchStore subscriptions identify chatId + creator address but omit chainId. Identical 20-byte addresses on different EVM chains must not silently share subscriptions, offsets or alert deduplication.
- Rat Radar D1 store and receipt IDs already carry chainId; reuse this separation while auditing every row key, cursor, projection, route and join. The current free ranking is per feed and should remain per chain until phase-normalized evidence and comparable coverage are established.
- Existing Arc evidence remains independently useful if Robinhood RPC/indexing is degraded. A Robinhood failure must not mutate historical Arc receipts or report a combined 'healthy' status.

## V0 user journey — actual two-chain coverage, not cosmetic dual branding

| Public workflow | Arc 5042 | Robinhood 4663 before BINRAT token launch | Acceptance |
| --- | --- | --- | --- |
| Chain-filtered launch discovery | Existing ArcPad receipts, subject to real coverage | Genuine newly indexed Pons launch receipts from **verified currently deployed Pons V2 authority**, not hypothetical BINRAT metadata | Per-row chain, source, token, tx, launch block/hash, verified observed role; independent freshness and coverage |
| Creator Files | Existing source-reported ArcPad creator address/history | Only if verified Pons launch events expose a comparable factual role; label contract role exactly, else UNKNOWN | Per-chain historical recurrence; cross-chain repeated hex address may be displayed as an address match but NEVER 'same person' |
| Activity / Radar | Verified supported V3 pool swaps with current source caveats | Real Pons curve activity under its own schema; post-graduation V4 only after separately verified pool and event adapters | At least useful receipts and recurrence per chain; missing phase = PARTIAL; no fabricated trader, P&L, SMART MONEY or SAFE claim |
| Basic Rat Watch | Arc on-chain follow-up and creator recurrence | Robinhood Pons creator-role/launch follow-up, chain-scoped cursor and delivery | User picks Arc / Robinhood / both; dedup keys include chainId; no cross-chain accidental triggers |
| Replay / maturity | Existing Arc 5m/1h/24h receipts | Real block-pinned launch/phase timeline and supported maturity fields; unavailable price/liquidity fields remain UNKNOWN | One real reproducible historical launch per chain; no synthetic maturity, future leakage or cross-chain block equivalence |

Minimum launch acceptance: the **first four workflows must be genuinely useful on BOTH chains** before describing BINRAT as a two-chain launch-intelligence product. Replay may have phase-specific evidence and partial fields but must not be represented as equivalent if Robinhood samples are immature or unsupported. A front-end chain tab, static Pons token preview or a successful SIWE prototype by itself does NOT pass.

A read-only Robinhood research MVP may be independently deployed before the BINRAT token exists; token execution and marketing retain their distinct fail-closed legal/owner/security gates. If Robinhood collection cannot pass the minimum acceptance, the correct public status is "Arc live / Robinhood building", not a misleading dual-chain launch claim.

## Adapter model and identity invariants

1. A versioned ChainRegistry declares numeric chainId, chain-specific genesis/reference, explorer, RPC health, native denomination, observation policy and per-chain adapters; each chain's current launchpad contracts must be pinned and verified against live deployed bytecode/event receipts. One project-wide constant for chain identity is insufficient.
2. SourceEvent adapters derive immutable source-namespaced IDs from numeric chainId + verified emitter + txHash + logIndex + protocol source + source schema version. Keep historical ArcPad hash and digest formats intact; Pons introduces a NEW namespace and independently frozen fixture evidence. Pool and token addresses alone are insufficient cross-chain identity.
3. Per-chain ChainCheckpoints and observed block number/hash govern snapshots, backfill and canonicality. Use an independently justified chain-specific finality/reorg policy; no shared scalar 'as-of block' across Arc and Robinhood. Replay stages use elapsed source-chain time, not assumed equal blocks-per-minute.
4. Source-role provenance: 'ArcPad-reported creator' versus precise verified Pons creator/deployer/fee-recipient roles. Only events and contract reads support roles; no presumed human identity, common controller or transferable reputation across chains.
5. Different trade/phase schemas: ArcPad V3 receipts remain V3 receipts; Pons curve events, graduation event and any verified post-graduation V4 receipts use separate versioned schemas. A normalized public envelope can expose chain/source/phase/block/hash/tx/evidenceDigest/role/coverage while optional phase-specific facts remain discriminated.
6. No mixed-chain global Radar ranking in V0. Display two honest chain-filtered lists; opt-in cross-chain research queries may show same-hex observations separately, with coverage/sample-size caveats. A later global aggregate requires a preregistered normalization/holdout evaluation.
7. D1 migration must scope any creator watch, subscription, alert ID, start cursor and source authority by chainId. Add duplicate, reorg, address-collision and partial-source tests before any old consumer is pointed at a multi-chain store. Separate source freshness/lag/health and paid API budgets by chain.

## Implementation: isolated slices; separate authority from PR #35

A. **Pons source verification and offline fixture**: read-only pin current 4663 factory/launch-emitter bytecode and ABIs, source launch event, emitted creator role, curve trade and graduation transitions using real, independently verified chain receipts; enumerate incompatible versions. A live token-launch simulation receipt is NOT an ingest implementation. Pass: deterministic archive/replay tests, explicit unsupported fields and observed factory-epoch evidence.

B. **Robinhood ingest/backfill candidate**: append-only chain-scoped events/checkpoints + bounded RPC windows, overlap dedup/reorg recovery, guard stale/failed provider; independently backfill ≥3 verified Pons launches where genuinely available. No production D1 write without separate review and deployment authority.

C. **Common projection and migration**: versioned multi-chain read DTO; preserve legacy Arc receipts/IDs; chain-scope Watch migration and public routes; run historical Arc regression alongside Robinhood fixtures and cross-chain alias attack cases. One chain outage fails only its own capability, never yields empty "safe" results.

D. **Evidence parity smoke**: verify independently ≥3 real indexed launches per chain, their actual factual creator-role provenance (if supported), observable activity receipts, per-chain top-five or candid insufficient-evidence state, and actual subscription/delivery dry smoke. Replay one mature real launch per chain or disclose explicit phase/availability exceptions. Compare public API/website/Telegram statements only after both consuming branches incorporate the versioned capability schema.

E. **Expansion gate**: after two-chain launch, consider third-chain adapters one at a time only if observed users request them and marginal cost can be budgeted. Starting candidates should be selected by actual relevant launch density + auditable contracts + archive/RPC economics + user demand, NOT token hype alone.

## Funding consequences / stop-loss

Doubling chains does not necessarily double costs, but creates two independent RPC/backfill/monitoring paths and larger D1 read/write, alert and support capacity. Preserve the existing synthetic $600 model only as a one-chain *lean research assumption*, NOT the committed dual-chain operating budget. Before activation meter real per-chain daily events, backfill rows and D1 writes, RPC requests, alert emissions, retained storage and failure retries. Stress fixed monthly costs at $1,200 / $2,000 / $5,000, with token fees and paid subscriptions independently settable to zero. No token trading revenue is required to keep free receipts available under bounded usage and cost caps; if funds run short, lower replay/alert frequency and freeze expensive backfill rather than fabricate live freshness.

No launch/pricing authority, contract deployment, token sale, merge, D1 migration, Worker write, live alert activation or frontend/TG branch modification occurs by adopting this research contract. Promote into the canonical roadmap only after rebasing against the independently active PR #31, which also edits docs/ROADMAP_V0.md.

Sources checked: current BINRAT GitHub branch files listed above; Robinhood official chain docs https://docs.robinhood.com/chain/connecting/ (4663 mainnet); third-party Pons pages with differing factory eras/names are NOT sufficient authority to override BINRAT's pinned Pons V2 receipt without fresh direct chain checks.
