# BINRAT Intelligence V1

Status: IMPLEMENTATION ACTIVE  
Base: `de06b9cb4cd5b0c4de1d007c00a4d8466af21f0e`  
Branch: `feat/binrat-intelligence-v1`  
Merge authority: NONE

## Objective

Turn the working ArcPad launch terminal into a memory/evidence product without rebuilding the working ingestion or frontend.

The pre-token V1 target is deliberately bounded:

1. deeper ArcPad launch history;
2. Creator Files / Trash Trails;
3. deterministic 5m / 1h / 24h on-chain observations;
4. a derived WHAT CHANGED timeline;
5. a small presentation-only animation island.

Anything that does not materially improve creator memory, longitudinal evidence, or presentation is roadmap work.

## Operating contract

`PLAN -> CHANGESET -> VERIFY -> VERDICT`

Bounded completion for this branch:

`IMPLEMENT ALL V1 SLICES -> TEST -> ONE INDEPENDENT HOSTILE REVIEW -> FIX CRITICAL/HIGH -> ONE TARGETED REREVIEW IFF REQUIRED -> CLOSE WHEN AUTHORIZED`

Do not create review loops between internal commits.

CI is the mechanical verifier while implementation is in progress. Independent hostile review happens once on the integrated V1 head.

## Permanent architecture rules

### 1. Raw observations are authority

Launch events, provenance facts, canonical observation receipts and their evidence digests are stored authority.

Creator Files and WHAT CHANGED are read projections. Do not create mutable derived-truth tables for them.

### 2. No future leakage

A future horizon may never appear in an earlier point-in-time projection.

Observation identity is bound to:

`observation_version + launch_id + horizon_ms`

Observation authority additionally records the actual canonical observation block/hash/timestamp.

### 3. Missing is not good

Provider failure, unsupported historical reads, immature horizons and unavailable facts remain `UNKNOWN`, `PARTIAL`, or `UNVERIFIED`.

Never convert absence into a clean/safe signal.

### 4. Donors are pinned specifications

Donor repositories are copied/adapted from exact commits. BINRAT has no runtime donor dependency and owes no upstream compatibility.

### 5. Product boundary

No trading, signing, wallet secrets, BUY/SELL decisions, safe/rug score, or probability model enters Intelligence V1.

## Observation V1

Frozen horizons:

- 5 minutes;
- 1 hour;
- 24 hours.

The first observation surface is deliberately on-chain and small:

- canonical block/hash/timestamp;
- pool bytecode presence;
- V3-style active-liquidity scalar when readable;
- V3-style sqrt price and tick when readable;
- creator token balance when readable;
- token total supply and decimals when readable.

These are raw facts, not claims of USD liquidity, holder count, market quality, safety, or common wallet ownership.

If an ArcPad pool does not expose the expected V3 read surface, the receipt remains partial/unverified and a later adapter can be added without changing observation identity semantics.

## Capability gate

Before the outcome collector is wired, run:

```bash
ARC_RPC_URL=... BINRAT_DB_PATH=./data/binrat.sqlite pnpm probe:observations
```

The probe selects the latest indexed launch and checks historical reads at its launch block. It does not persist evidence and does not mutate chain state.

Gate:

- if historical block + pool/token reads work, authorize historical reconstruction/backfill;
- if they do not, continue forward-only observation collection and ship Creator Files anyway;
- do not add a paid provider merely to satisfy this gate.

## Historical capability result

Gate executed on 2026-09-18 against Arc mainnet chain 5042 using the public RPC and a real indexed ArcPad launch.

Observed at launch block `21368989`:

- historical block/hash/timestamp read: PASS;
- pool bytecode: present;
- pool `slot0()`: PASS;
- pool `liquidity()`: PASS;
- creator token `balanceOf()`: PASS;
- token `totalSupply()` + `decimals()`: PASS.

Result: `historicalReconstructionSupported=true`.

The diagnostic workflow used to establish this result is intentionally removed after the gate so it does not become permanent CI/network debt.

## Deeper ArcPad history lane

The live checkpoint remains a forward-only availability cursor. Intelligence V1 uses a separate resumable historical cursor to scan from `ARCPAD_START_BLOCK` toward the live-window boundary in bounded batches.

Rules:

- historical backfill never moves the live checkpoint backward;
- exact overlap with already-indexed live launches is idempotent;
- each batch verifies launcher authority plus canonical batch/launch hashes before writes;
- the cursor advances only after launch/provenance persistence succeeds;
- a failed batch is replayed rather than skipped;
- public history coverage remains `UNVERIFIED` while the stronger completeness claim is not yet justified.

This closes the architectural gap where a resumed live checkpoint could advance forever without ever indexing older ArcPad launches.

## Planned implementation commits

1. contract + donor freeze + capability probe + observation ledger skeleton;
2. 5m/1h/24h historical/forward observation sync;
3. Creator File + WHAT CHANGED projections + additive API;
4. UI integration + small animation island + visible roadmap;
5. integrated verification and one hostile review.

This is one branch and one PR. Internal commits are checkpoints, not separate governance stages.

## Out of scope for pre-token V1

- graph database;
- Postgres migration for its own sake;
- multi-chain;
- generic candlestick/DEX terminal clone;
- full wallet clustering;
- funding-origin graph;
- Telegram/webhooks;
- user accounts;
- LLM judging;
- risk score;
- trading automation;
- token launch mechanics.

Serrata funding trails, Rektrace provider resilience, alerts, wallet overlap and distribution intelligence remain roadmap candidates after V1 proves useful.
