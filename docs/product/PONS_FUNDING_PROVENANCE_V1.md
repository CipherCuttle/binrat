# Pons funding provenance V1

Status: engineering design + live-chain reconnaissance.  
Chain: Robinhood Chain `4663`.  
Evidence boundary: exact addresses and direct native transfers only.

## Product goal

Add one new deterministic Rat Radar primitive:

> A source address sent native ETH directly to the exact Pons-reported deployer before that deployer's launch.

This primitive may later support presentation such as:

- `SAME FUNDING SOURCE`;
- `WATCH FUNDER`;
- funding-source recurrence as one transparent reason for HOT GARBAGE.

It does **not** establish:

- common human identity;
- common beneficial ownership;
- common team/control;
- insider status;
- profitability, safety, intent, or recommendation.

A source address may be an EOA, exchange, bridge, router, service, contract or other address. V1 does not infer which.

## V1 evidence contract

For one canonical Pons launch:

1. use the exact `TokenLaunched.deployer`;
2. search only direct `external` native transfers whose recipient is that exact deployer;
3. consider transfers only through `launchBlock - 1`;
4. select the latest qualifying transfer;
5. independently re-read the canonical transaction and require exact:
   - sender;
   - recipient;
   - value;
   - transaction hash;
   - block number;
6. bind canonical launch and transfer block hashes;
7. fail closed on reorg or mismatch;
8. emit no negative receipt when no transfer is observed.

The receipt is append-only evidence. It never rewrites canonical launch authority.

## Recurrence contract

`SAME FUNDING SOURCE` requires:

- the exact same source address;
- at least two distinct source-reported deployer addresses;
- at least two distinct Pons launches;
- one verified pre-launch native inbound receipt for each included launch.

Multiple launches from one deployer are not sufficient to create the relation.

## Provider contract

The initial source may use Alchemy's `alchemy_getAssetTransfers` only as a bounded candidate locator:

- `toAddress = deployer`;
- `category = ["external"]`;
- `excludeZeroValue = true`;
- `order = "desc"`;
- `maxCount = "0x1"`;
- `fromBlock = "0x0"`;
- `toBlock = launchBlock - 1`.

The candidate is not trusted by itself. Standard canonical transaction and block reads verify it before receipt construction.

Internal transfers are deliberately excluded from V1. Trace-derived funding may be evaluated later under a separate evidence version.

## Live Robinhood reconnaissance — 2026-10-02

This reconnaissance was read-only and was not persisted as BINRAT evidence.

### Confirmed launch A

Pons launch transaction:

`0x259bd408520b99864a7a069896dcf6868fe0ed18a3bbce95ff32f02fd9ab06d7`

- launch block: `0x4a315ba`;
- exact Pons-reported deployer:
  `0xaf70c00d8d252fc9fe68f00525b8df4e4fdcfcb8`;
- factory `TokenLaunched` log independently contains that deployer.

Latest observed direct native inbound before launch:

- source:
  `0x9bc462bce2acd6fbe2ef5470d55b439453451083`;
- transfer transaction:
  `0xcb29fa5271340288f12d79fba9adcd783a6d789e4dc043bd299812620511e9e2`;
- transfer block: `0x4a31047`;
- value: `0.012681852309631219 ETH`;
- observed transfer timestamp: `2026-10-02T00:13:53Z`.

### Confirmed launch B

Pons launch transaction:

`0x800584ff77c8362c62ebbfe9a69ff319fa2fa960e20e093fc62b407b051d756a`

- launch block: `0x4a305ac`;
- exact Pons-reported deployer:
  `0x720da24e4d6193d8618f2e1d79e7ece34628e3c2`;
- factory `TokenLaunched` log independently contains that deployer.

Latest observed direct native inbound before launch:

- source:
  `0x9bc462bce2acd6fbe2ef5470d55b439453451083`;
- transfer transaction:
  `0xd39de406f8f67197ab5a035d3969efec28db554290a6e8c3242c069f702e9df4`;
- transfer block: `0x4a2f334`;
- value: `0.01388763085742769 ETH`;
- observed transfer timestamp: `2026-10-02T00:01:23Z`.

This is a real example of the V1 recurrence relation:

> the same exact source address directly funded two distinct Pons-reported deployer addresses before two distinct confirmed Pons launches.

It is **not** evidence that the deployers or source address belong to the same person or team.

## Product language

Preferred:

- `SAME FUNDING SOURCE`
- `Funded this deployer before launch.`
- `Same source funded 2 deployers before their launches.`
- `WATCH FUNDER` may be used as compact action copy only if the detail view preserves the exact-address evidence boundary.

Avoid:

- same team;
- insider;
- owner;
- coordinated wallets;
- linked humans;
- smart money;
- farm;
- serial scammer.

## Explicit non-scope for the core PR

- no D1 migration;
- no runtime cycle;
- no production writes;
- no Mini App/Web/Telegram rendering;
- no Watch mutation;
- no HOT ranking change;
- no O2/O3 changes;
- no token/holder/trading action;
- no deploy;
- no merge authorization.

## Next bounded slice

After the receipt/source core passes review:

1. add an additive funding-receipt store;
2. run a default-OFF bounded collector against launches already in canonical D1;
3. canary at one launch/cycle;
4. measure coverage and provider cost;
5. only then expose a read-only recurrence projection to HOT/Radar;
6. implement `WATCH FUNDER` under a separate future-only subscription gate.
