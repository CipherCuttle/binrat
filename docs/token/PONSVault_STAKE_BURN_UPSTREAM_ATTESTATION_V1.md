# BINRAT PonsVault Stake & Burn upstream attestation V1

Status: **PARTIAL / BLOCKED_UPSTREAM_VERIFICATION**  
Observed: 2026-10-03  
Chain: Robinhood Chain 4663  
Purpose: L1 dependency proof for the planned $BINRAT Stake & Burn launch path.

This document is not a launch authorization and does not assert that PonsVault is audited or immutable.

## Executive verdict

The current PonsVault Stake & Burn path is real and sufficiently concrete to begin **read-only POC integration**, but it is **not yet acceptable as a satisfied launch-mechanics gate**.

What is proven strongly enough for POC:

- the Pons V2 factory address is the existing BINRAT source/codehash-pinned factory;
- the documented PonsVault launcher, registry and Stake & Burn factory are live on chain;
- the launcher reports the expected Pons V2 factory and PonsVault registry;
- the Stake & Burn factory reports a shared beacon and a current vault implementation;
- the beacon reports the same vault implementation;
- the beacon is owned by the Stake & Burn factory;
- the Stake & Burn factory and registry report the same controlling owner;
- that controlling owner currently has no runtime contract code and therefore behaves as an EOA at the observed state.

What remains unresolved for launch authorization:

- PonsVault documentation claims source is on GitHub, but no public repository containing the named V2 contracts was discoverable through GitHub search on 2026-10-03;
- therefore the deployed PonsVault bytecode has **not** been source-matched by BINRAT;
- full launcher/factory/vault ABI authority has not been independently source-verified;
- the exact open-sweep call path described by PonsVault docs is not yet reproduced from source + deployed bytecode;
- exact Stake & Burn fee split, immutable parameter storage, stake accounting and claim logic still need live-vault reproduction;
- PonsVault's own documentation states the vault contracts have not completed a third-party audit;
- the current upgrade-control chain remains active and must be treated as upstream authority, not immutability.

## Canonical addresses

| Role | Address | Evidence class |
| --- | --- | --- |
| Pons V2 factory | `0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e` | official Pons source/docs + existing BINRAT live codehash |
| PonsVault launcher | `0x1770c356eB9312079b9A00e26a8CF4b0a1473dBA` | PonsVault docs + live contract |
| PonsVault registry | `0xaA9C86049A258D4A076d3eF367F69C231C9746D5` | PonsVault docs + live contract |
| Stake & Burn factory | `0x537483c5B33e2192CfB202d7C50d58975524B047` | PonsVault docs + live contract |
| Stake & Burn beacon | `0xf72b3b54220a2e64ee87895d570a2c72a00a3fe4` | live `beacon()` read |
| Stake & Burn vault implementation | `0xf0453c814cf6a76a8e3507f8fafffe359f28b6cb` | live factory `implementation()` + beacon `implementation()` reads |
| Current registry/factory control owner | `0x897ac30f73ba92e1efbc1df1e67f8b5f4b3ecd2b` | live `owner()` reads |

## Live read receipts

The following read-only calls were reproduced against Robinhood Chain through the connected Alchemy app.

### Launcher wiring

`factory()` on launcher:

`0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e`

`registry()` on launcher:

`0xaA9C86049A258D4A076d3eF367F69C231C9746D5`

This proves the documented launcher is currently wired to the expected Pons V2 factory and PonsVault registry.

### Registry control

`owner()` on registry:

`0x897ac30f73ba92e1efbc1df1e67f8b5f4b3ecd2b`

Registry runtime code hash observed through a successful account proof:

`0x0818f2fd53a4ccaf9edcb34a9fc7b0980f659dfa99862439c813e0719caaa93f`

### Stake & Burn factory

`owner()`:

`0x897ac30f73ba92e1efbc1df1e67f8b5f4b3ecd2b`

`beacon()`:

`0xf72b3b54220a2e64ee87895d570a2c72a00a3fe4`

`implementation()`:

`0xf0453c814cf6a76a8e3507f8fafffe359f28b6cb`

### Beacon

`owner()` on beacon:

`0x537483c5B33e2192CfB202d7C50d58975524B047`

`implementation()` on beacon:

`0xf0453c814cf6a76a8e3507f8fafffe359f28b6cb`

Observed authority chain:

`EOA 0x897a... -> StakeBurnFactory 0x5374... -> Beacon 0xf72b... -> vault implementation 0xf045...`

Therefore existing Stake & Burn vault behavior may change if the controlling authority changes the beacon implementation. BINRAT must not describe these vaults as immutable while this chain remains active.

### Controlling address

The controlling address currently returns no runtime bytecode. Account proof code hash:

`0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470`

That is the empty-code hash. Treat the current controlling address as an EOA, not a multisig or immutable contract, unless a later read proves otherwise.

## Pons core authority

Existing BINRAT Pons work already pins:

- chain id 4663;
- Pons V2 factory `0x7eD5...EC7e`;
- runtime code hash `0x89a27da6f703e0a7cdd4f233e7cb57604ff75b164530962d3ff7cf8483a67d84`.

Official Pons V2 source is public in `ponsdotdev/pons-labs`.

Pons documentation additionally requires reading enabled launch configs and `previewLaunchEconomics` immediately before launch and checking `canLaunch(address)`. Those become launch-appliance preflight requirements rather than cached planning facts.

## PonsVault public claims retained as claims, not promoted to source proof

Current PonsVault docs state:

- Stake & Burn is live;
- half of fees buy/burn while the remaining share goes to stakers;
- staking rewards are actual pairing-asset fees rather than newly minted token;
- per-staker lock period and minimum-fee run threshold are fixed at vault creation;
- PonsVault launcher must launch the Pons token because only the recorded Pons deployer/protocol fee recipient can initiate the fee sweep;
- the launcher exposes a permissionless sweep/run path;
- vaults use a shared upgradeable beacon;
- the beacon owner can later renounce upgrade control;
- vault contracts have not completed a third-party audit.

Until source/ABI matching or independently reproduced live behavior closes each item, these stay **platform claims corroborated only where noted by live state**.

## Source availability discrepancy

PonsVault docs currently link a GitHub organization and state that contract source is on GitHub.

On 2026-10-03, GitHub repository search for:

- `PonsV2StakeBurnVaultFactory`;
- `PonsV2VaultLauncher`;
- `PonsV2VaultRegistry`;
- PonsVault/Stake & Burn Robinhood terms

returned no public repository containing the source.

This is not evidence that source does not exist. It is evidence that BINRAT has **not obtained authoritative public source** yet.

Launch gate remains blocked until this is resolved or the owner explicitly accepts a different verification standard after hostile review.

## Additional discrepancy to resolve

Robinhood Blockscout currently labels the Stake & Burn factory address with an "Implementation" address `0x65b2eAaA7ae4eCC144494070aD6F2A3AD13A47d9`, while a direct `implementation()` call on the same address returns `0xf0453c814cf6a76a8e3507f8fafffe359f28b6cb`.

These may represent different layers (factory implementation vs vault implementation), but BINRAT must not guess. L1 remains open until the relationship is explained from source or equivalent authoritative bytecode/proxy analysis.

## L2 permission

This partial attestation authorizes only the following engineering direction:

- build a pure **read-only** StakeSource interface;
- use deterministic fixtures;
- optionally reproduce reads against an existing live Stake & Burn vault once a live vault address/ABI is independently resolved;
- keep production entitlement inactive.

It does **not** authorize:

- launch;
- staking BINRAT;
- public token marketing;
- production WORKING RAT activation;
- writing to PonsVault;
- approving or depositing user tokens.

## L1 closure requirements

To change the launch-mechanics gate from `BLOCKED_UPSTREAM_VERIFICATION`:

1. resolve authoritative PonsVault source or equivalent verified deployed-source artifact;
2. source-match or otherwise strongly attest launcher, registry, Stake & Burn factory, beacon and vault implementation;
3. freeze the ABI subset BINRAT uses;
4. independently reproduce `vaultOf(token)`, deployer/sweep authority, stake balance, total stake, claimable reward and immutable lock/minimum settings against at least one live Stake & Burn vault;
5. document the exact fee split from executable/source authority, not marketing copy alone;
6. record current owner/beacon/implementation state and launch-time recheck rules;
7. record audit status at launch time;
8. rerun one hostile review.

Verdict: **POC READS MAY PROCEED / PUBLIC TOKEN LAUNCH REMAINS BLOCKED.**
