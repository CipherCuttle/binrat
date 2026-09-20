# HOT GARBAGE 72H V0

## Objective

Test whether ArcPad alone produces enough new-launch activity, and enough creator-address history to make BINRAT's TRASH TRAIL useful, before building the landing page or launching `$BINRAT`.

This is an observation experiment only. It authorizes no token launch, trading, signing, private keys, transaction submission, or capital deployment.

## Preregistered window

The immutable start receipt is `docs/experiments/hot-garbage-v0-start.json`.

- started at: `2026-09-17T18:09:12.623Z`
- duration: 72 hours
- nominal end: `2026-09-20T18:09:12.623Z`
- Arc chain id: `5042`
- ArcPad launcher: `0x24196cd6e534cfce8f480b53e70809b68ea86f29`
- start block: `21368003`
- start block hash: `0x8f744c7fda8a6958af94eb0e0c58ac3bd712b2c6b18161d99e48e7a91bd5eed9`

ArcPad independently reported chain head `21368003`, launch cursor `21368001`, block lag `2`, and `indexerGaps=0` when the receipt was captured.

## Reconstruction

The finalizer does not depend on a continuously running daemon.

At or after maturity it:

1. verifies the preregistered start block hash is still canonical;
2. finds the last Arc block whose second-resolution timestamp is at or before the exact 72-hour end instant;
3. replays ArcPad `TokenCreated` events from `startBlock + 1` through that end block into a temporary SQLite/WAL database;
4. derives creator-address provenance using the same evidence spine merged in PR #2;
5. waits, bounded, until ArcPad reports `launchesTo >= endBlock`, chain `5042`, `ok=true`, and `indexerGaps=0`;
6. fetches every ArcPad `/api/tokens` page;
7. reconciles the exact window token-address set against onchain truth;
8. uses pre-window ArcPad API history only as `LAUNCHPAD_INDEXER` evidence to measure whether new launches already have a TRASH TRAIL;
9. emits one JSON result.

Transient RPC/network failures are retried with bounded exponential backoff. Chain-id drift, launcher drift, malformed source/API records, identity conflicts, cursor cycles, deep reorgs, indexer non-catchup, and window leakage fail closed.

Run after maturity:

```bash
ARC_RPC_URL=https://rpc.arc-scan.org pnpm experiment:finalize > hot-garbage-v0-result.json
```

`BINRAT_EXPERIMENT_ALLOW_EARLY=1` exists only for implementation smoke tests; an early result is not valid experiment evidence.

## Metrics

Onchain window metrics:

- ArcPad launches in the exact 72-hour window;
- unique ArcPad-reported creator addresses;
- creator addresses appearing more than once inside the window;
- launches associated with those repeated addresses;
- maximum launches from one reported creator address;
- website/X/Telegram metadata presence.

TRASH TRAIL opportunity (`LAUNCHPAD_INDEXER` evidence):

- window creator addresses with at least one prior pre-window ArcPad launch;
- window launches whose creator address already had prior ArcPad history;
- total prior launches associated with those window creator addresses;
- maximum prior launches for one window creator address.

Reconciliation reports both directions:

- onchain capture relative to ArcPad API;
- ArcPad API capture relative to onchain;
- set agreement against the union;
- exact token addresses missing on either side.

## Frozen decision rule

The candidate volume decision remains preregistered:

- `>=25` launches: `CONTINUE_ARCPAD_ONLY`
- `10-24` launches: `ADD_SECOND_SOURCE`
- `<10` launches: `ARCPAD_ONLY_TOO_SPARSE`

Engineering reconciliation gate: both directional capture rates must be at least `99%`.

If that gate fails, the overall verdict is **`EVIDENCE_GATE_FAILED`** regardless of launch count. The volume decision is retained only as a diagnostic candidate and must not be treated as the experiment verdict.

## Claim boundary

"Repeated creator address" means only that multiple ArcPad `TokenCreated` events report the same onchain `creator` address. It does not establish human identity, EOA ownership, coordinated control, or the ultimate deploying actor.
