# BINRAT Pons Preflight V1

Status: read-only preflight implementation
Authority base: `integration/binrat-pons-launch-canonical-v1`
Chain: Robinhood Chain 4663

## Purpose

`PONS_PREFLIGHT_V1` proves the current upstream Pons / PonsVault Staking control graph at one pinned block without signing, broadcasting, creating a vault, or guessing unresolved BINRAT launch inputs.

It is deliberately narrower than the final launch rehearsal.

Run:

```bash
BINRAT_ROBINHOOD_ARCHIVE_RPC_URL=... pnpm verify:pons-preflight
```

The command prints a machine-readable JSON receipt to stdout.

## Live checks

At one block/hash the preflight verifies:

1. chain ID is 4663;
2. Pons V2 factory runtime code still matches its pinned hash;
3. PonsVault registry runtime code still matches its pinned hash;
4. launcher, staking factory, beacon and staking implementation all have runtime code and their current hashes are recorded as baseline observations;
5. launcher points to the expected Pons factory and registry;
6. registry `bytes32("staking")` points to the expected staking factory;
7. registry and staking factory owners are the expected upstream owner;
8. staking factory points to the expected beacon and implementation;
9. staking factory template is literally `staking`;
10. at least one staking vault exists;
11. beacon owner is the staking factory and beacon implementation matches the expected implementation;
12. the upstream owner address still has no runtime code (EOA);
13. the pinned launcher capability probe reports `canLaunch = true`;
14. a known live native-ETH staking vault still supports `quoteAsset()`, `totalStaked()`, and `stakedOf(address)`, with `stakedOf <= totalStaked`.

Any mismatch throws and produces no PASS receipt.

## Code-hash baseline rule

The Pons factory and registry already have reviewed code-hash pins and must match them.

The launcher, staking factory, beacon and staking implementation hashes are recorded by this first preflight as `OBSERVED_BASELINE`; this implementation does **not** silently promote a newly observed hash into trusted authority.

After one reviewed live receipt, a separate bounded pinning change may promote those exact observed hashes into expected values. Future preflights must then fail closed on drift.

## Exact launch simulation boundary

The current launch plan intentionally leaves several owner inputs unresolved. The exact Pons launch-call simulation is blocked only by inputs that materially affect that call or its assertions:

- `launchConfigId`;
- `expectedEconomics`;
- `minimumFeesBeforePayoutWei`;
- `launchWalletAddress`;
- `tokenMetadata`.

`workingRatMinStakeRaw` and `treasuryAddress` remain required before the final launch manifest/authorization, but they do not artificially block an atomic Pons Staking launch simulation.

Therefore V1 currently reports:

`exactManifestSimulation.status = BLOCKED_OWNER_INPUTS`

It does not substitute the older synthetic Staking dry call or invent placeholder BINRAT values.

When those owner inputs are frozen, this baseline preflight intentionally fails with `PONS_PREFLIGHT_EXACT_SIM_REQUIRED` rather than pretending it is the final rehearsal. The next bounded launch-appliance slice must consume the exact reviewed manifest and simulate those exact inputs.

## Safety boundary

This command:

- makes read-only RPC calls only;
- never requests a private key;
- never signs;
- never sends a transaction;
- never deploys a token or vault;
- never grants marketing authority;
- never grants launch authority.

A PASS receipt proves only the observed upstream graph and stake-read interface at its pinned block.
