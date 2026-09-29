# BINRAT token prelaunch control plane V1

Canonical machine control: [`BINRAT_LAUNCH_CONTROL_V1.json`](./BINRAT_LAUNCH_CONTROL_V1.json). It is deliberately `PREFLIGHT_BLOCKED`; it grants no signing, spending, broadcast, publication, deployment, merge, or holder-activation authority.

## Current facts

- The deployed product provenance is `b286f68f09494e58ecbba113c393679210eb2af1`; release documentation `5cbedcc2704ca29bf66b749c1f46f4198ce8a6b0` is its direct child.
- Token rail: Robinhood Chain `4663`, Pons V2 factory `0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e`. Arc `5042` is a separate research-evidence authority, not a token rail.
- A fresh read-only check on 2026-09-29 found both public providers on 4663 and matching factory code hash. The primary current snapshot was block `75674390`; it is an observation, not a preflight pass and expires for execution purposes.
- `$BINRAT` is not live. There is no official contract address. No holder entitlement is active.

## Historical extraction matrix

| Donor PR | Classification | Extracted conclusion | Not carried forward as launch-day fact |
| --- | --- | --- | --- |
| #26 canonical selection | PORT CONCEPT | 4663/Pons V2, native pair, no presale/hidden allocation/founder opening buy; preserve Arc V0 as historical | null role inputs, config snapshot, old launch authority |
| #27 balance probe | PORT TEST | finalized-block, chain-before/after-read, canonical-hash, stale/reorg fail-closed requirements | fixture threshold and any candidate access decision |
| #28 SIWE candidate | PORT CONCEPT | exact origin/domain/purpose, chain-bound nonce/expiry/replay control; never migrate Arc sessions | EOA-only candidate or FREE-only D1 tables as production implementation |
| #29 Worker routes | REIMPLEMENT | default-off exposure, rate bounds and origin checks belong in later production holder work | candidate endpoints and environment flags |
| #30 cutover candidate | PORT CONCEPT | Arc records stay immutable; Pons must have a separate successor/receipt | its metadata/status cutover or any runtime authority |
| #32 discovery consistency | REUSE AS-IS (doctrine) | one canonical identity, no placeholder CA, no unverified socials | provisional description and donor listing document |
| #35 launch gates/economics | PORT CONCEPT | two-phase authorization, legal gate, free facts/capacity-only utility, no revenue projection | 2026-09-25 Pons observations, illustrative thresholds/economics |
| #38 source candidate | PORT TEST | event/factory relation, role field limits, bounded scans and code pin checks | source commit as on-chain provenance |
| #40 receipt proof | PORT TEST | independent provider/proof binding and raw receipt derivation | block `72448xxx` proof as a current state |

Old factory/config assumptions include a 1bn/18-decimal config-0 supply, 0.0005 ETH fee, 1% curve fee, a 3-second 9900-bps opening tax, protocol/share settings, hook/deployer addresses and bytecode. They are *expected values to reread*, never promises. The historical Arc V0 fee roles and chain `5042` are specifically prohibited from becoming 4663 roles by copy.

## State machine

`PREFLIGHT_BLOCKED → PREFLIGHT_ELIGIBLE → EXECUTION_AUTHORIZED → EXECUTED_UNVERIFIED → PUBLICATION_ELIGIBLE → TOKEN_LIVE → HOLDER_ACTIVATION_ELIGIBLE → HOLDER_ACTIVE`

| Transition | Objective evidence | Authority required |
| --- | --- | --- |
| blocked → eligible | fresh pinned Pons preflight, verified identity/roles, legal permitted state, explicit preflight review | none beyond read-only review |
| eligible → execution authorized | one unexpired manifest digest, nonce/calldata/fee cap reviewed | explicit owner execution authority only |
| execution authorized → executed unverified | observed submitted transaction only | no publication authority implied |
| executed unverified → publication eligible | independent verifier derives success, canonical token, factory relation, supply, roles, economics and no launch-and-buy | verifier pass |
| publication eligible → token live | one atomic consistent fan-out from verifier receipt | separately authorized publication |
| token live → holder activation eligible | finalized token/threshold/policy, wallet-proof system and read-only end-to-end acceptance pass | activation review |
| holder activation eligible → holder active | explicit owner holder-activation authority | explicit owner authority |

Tests cannot create `EXECUTION_AUTHORIZED`. A submitter-provided contract address cannot create `PUBLICATION_ELIGIBLE`.

## Hard stops

Abort when the factory, hook, deployer or config code drifts; chain/fee/economics differ; either RPC materially disagrees; the signer, nonce, calldata, identity, legal record, or wallet role differs; ETH is insufficient for fee plus gas cap; simulation fails; metadata is inconsistent; a placeholder/unverified CA appears publicly; or the manifest expires. There is no "probably fine" path.

## Owner actions only

- [ ] Configure and prove control of `binrat.tech`.
- [ ] Confirm final X handle/control, Telegram bot control, Telegram community and which Telegram URL enters metadata.
- [ ] Approve final logo and token description.
- [ ] Supply public 4663 deployer, treasury, creator-fee-recipient and personal-buyer addresses; decide whether treasury equals fee recipient.
- [ ] Approve capacity-only utility doctrine and later threshold recommendation.
- [ ] Close the legal/classification record with the required documents and permitted status.
- [ ] Review the one exact frozen manifest and give explicit execution authority only at launch time.

Never provide a seed phrase, private key, signed raw transaction, or private salt to the repository or chat.

## Hostile review and targeted rereview

Critical: the legacy Arc configuration contains real-looking role addresses and could be mistaken for Pons custody. Fixed by a new canonical 4663 role record with all Pons roles null/unverified and a historical-only Arc pointer.

High: historical Pons observations could be read as current launch settings. Fixed by labeling them expected/reread values, recording only a dated fresh observation, and requiring a new pinned preflight and unexpired manifest.

High: a founder launch-and-buy or a submitted fake CA could bypass fairness/publication checks. Fixed by an explicit `NONE` policy and verifier-first publication contract. Targeted rereview confirmed that the new state machine has no transition from tests, simulation, or a submitter address to token-live/holder-active.
