# BINRAT Pons launch readiness receipt V0

Status: engineering/read-only. This tool does **not** authorize a token launch, token marketing, signing, or broadcasting.

## Objective

Produce a replayable snapshot of the current Pons V2 launch surface on Robinhood Chain before any signing authority is introduced.

The command is:

```bash
pnpm pons:launch-receipt
```

With owner-supplied launch inputs:

```bash
pnpm pons:launch-receipt -- \
  --deployer 0x... \
  --fee-recipient 0x... \
  --salt 0x<64 hex> \
  --out evidence/binrat-pons-launch-readiness.json
```

Environment equivalents are `BINRAT_PONS_DEPLOYER`, `BINRAT_PONS_FEE_RECIPIENT`,
`BINRAT_PONS_SALT`, and optionally `ROBINHOOD_RPC_URL`.

## Frozen candidate policy

- chain: Robinhood Chain, chain ID 4663;
- Pons V2 factory: `0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e`;
- native ETH pair;
- launch config 0;
- creator tax: 0 bps;
- buyback: disabled;
- direct factory `launchToken` path;
- no extra snipe-tax exemptions;
- no founder opening buy.

The tool pins the reviewed Pons factory runtime bytecode hash already exercised by the SENTRY
Pons adapter and refuses a silent factory epoch change.

## The 18 checks

1. Robinhood chain ID.
2. Factory runtime bytecode hash.
3. Launch-config count.
4. Config 0 exact economics.
5. Launch fee.
6. Creator-tax ceiling.
7. Snipe-tax start/window.
8. Meme-hook address and runtime bytecode hash match the reviewed SENTRY/Pons hook authority.
9. Current fee policy matches the reviewed candidate terms.
10. Launch-deployer address and runtime bytecode hash match the reviewed SENTRY/Pons template authority.
11. Launch-deployer factory binding points back to the pinned factory.
12. Public-or-whitelisted launch access for the supplied deployer.
13. Supplied deployer can cover the launch fee.
14. BINRAT economic policy is fixed locally at creator tax 0 bps and buyback disabled.
15. Creator-fee recipient is nonzero and distinct from both launcher and Pons protocol fee recipient.
16. Direct launch path carries no additional exemption list and no founder opening buy.
17. Current `previewLaunchEconomics(0, address(0))` is captured and pinned into calldata.
18. Full `launchToken` is simulated with `eth_call`; the returned token and curve addresses are
    captured without persisting state.

All contract reads and the simulation bind to one explicit block where the RPC method supports it.

## 2026-09-22 live read: updated anti-snipe authority

The first public snapshot at Robinhood block `69,767,635` verified all reviewed
factory, hook, launch-deployer, launch-config-0 and fee-policy values, but found
`snipeTaxSeconds = 3`, not the 15-second source-code initializer previously
pinned by this checker. It also observed `launchEnabled = true` at **that block**,
although Pons's prose still described public launches as closed. Treat the live
contract as authoritative for its state at a specific block, not as a promise
that these owner-controlled settings will remain unchanged.

The reviewed read-only candidate now pins the **observed three-second decay**
and retains fail-closed drift checks; accepting this value for observation does
**not** establish anti-bot effectiveness, waive Pons's outstanding audit risks,
or authorize launch. The shorter window increases the importance of our no
founder opening buy / no additional exemption policy.

Initial live receipt: https://github.com/CipherCuttle/binrat/actions/runs/35748482334

## Fail-closed behavior

Without deployer, fee-recipient, or salt, the receipt returns `OWNER_INPUT_REQUIRED`.
The fee recipient must be a dedicated nonzero address distinct from the launcher and Pons protocol
fee recipient, and the owner-supplied salt must be nonzero. A mismatched chain, bytecode epoch,
external launch-deployer template, config, fee policy, access gate, balance, invalid owner input,
or failed simulation returns `BLOCKED`.

A `PASS` receipt means only:

> these exact read-only launch inputs simulated successfully against this exact Pons/Robinhood
> state snapshot.

It does not change the canonical BINRAT capability manifest. Legal/compliance, explicit owner
launch authority, marketing authority, and any future signing/broadcast implementation remain
separate gates.

## Security boundary

The implementation deliberately contains no wallet client, private-key loader, `writeContract`,
`sendTransaction`, signing API, or raw transaction broadcast path. Tests scan both the module
and CLI for those surfaces.

The simulation uses `eth_call` only. Its returned CREATE2 token/curve addresses are evidence of
the simulated launch path, not an executed deployment.

## Upstream source-integrity note

The current public Pons factory source references salt-based CREATE2 prediction while a matching
public `PonsV2LaunchDeployer` snapshot has lagged that interface. BINRAT therefore does not infer
prediction semantics from repository prose. It obtains the would-be token and curve addresses by
simulating the live factory entrypoint itself and fails closed if that call cannot execute.
