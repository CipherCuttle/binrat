# BINRAT Launch Execution Rehearsal V0

Status: `PREPARATION_ONLY / OWNER_INPUT_REQUIRED / NOT_EXECUTED`

This rehearsal constructs and validates the future unsigned call shape without requesting a private key, signing, broadcasting, creating `$BINRAT`, or moving funds.

## Current rail

- Chain: Arc mainnet, `5042`.
- Launcher: `0x24196CD6e534cfCE8F480B53E70809b68Ea86F29`.
- Function: `createToken(string,string,(string,string,string,string),bytes32)`.
- Selector: `0xce5798cd`.
- Selected mode: `STANDARD_CREATOR_REWARDS`.
- First buy: disabled; the launch transaction must carry `msg.value = 0`.
- Launch Mechanics digest: `aff37d6d82cced00a34284453c0327bb51e5624b5761b621264f55602e8245e6`.
- Launch Config digest: `f631e43287a3bcb6a6da6a7f405d1ad2e3b17c9648b5928dc7c8a3a32890e1f8`.
- Gate Matrix digest: `d244d4b8d19d17679adee0e995dbbf4845f321702ea91bfcc646497e6f2ce73b`.

The four call parameters are the token name, token symbol, a four-string metadata tuple (`imageURI`, `website`, `twitter`, `telegram`), and a `bytes32` salt. No unresolved name, symbol, URI, links, or salt is invented by the rehearsal.

## Authority and signer boundary

The deployed launcher emits `TokenCreated(..., creator, ...)` with the transaction sender as creator in all three verified historical launches. The launcher call has no project-fee-recipient argument. The selected project-fee role therefore requires the future `msg.sender` to be the owner-supplied project-fee wallet, or a separately reviewed post-launch redirect would be needed.

`OWNER_SIGNER_ADDRESS_REQUIRED_BEFORE_FINAL_DRY_RUN` remains active. The treasury is not inferred to be the signer. The ArcPad launcher owner remains an external protocol authority and is not BINRAT owner authority.

## Funds and simulation

Arc chain gas is denominated in native USDC with 18 decimals, not ETH. With first buy disabled:

- launch value: `0` native units;
- USDC ERC-20 approval: none;
- permit: none;
- ETH required: `0`;
- native USDC gas: unresolved until the final signer-bound estimate.

The current unsigned intent is produced by:

```sh
pnpm exec tsx scripts/prepare-binrat-launch-dry-run.ts
```

It returns `OWNER_INPUT_REQUIRED`, leaves `from`, nonce, calldata, and gas estimate unresolved, and marks creation `NOT_EXECUTED`.

A historical no-first-buy calibration was simulated against real pre-launch state for TITCOIN at block `21704357`:

- `eth_call`: pass;
- `eth_estimateGas`: `6226309`;
- transaction value: `0`;
- observed gas price: `20240792727` native units per gas;
- calibration cost only: `126025429923254643` native units.

This is not a BINRAT launch simulation. The future BINRAT call remains `SIMULATION_NOT_POSSIBLE_WITHOUT_SIGNER_AND_OWNER_METADATA` until those owner inputs exist.

## Address prediction

No independent CREATE2/nonce derivation with matched deployed init code is frozen. Historical calls prove the post-execution event path across MoonCat, TITCOIN, and EMPTYOT, but do not authorize guessing a future BINRAT address.

`TOKEN_ADDRESS_ONLY_AVAILABLE_AFTER_EXECUTION`.

## Read-only reconciliation

The future reconciler is:

```sh
pnpm exec tsx scripts/reconcile-binrat-launch.ts <future-launch-transaction-hash>
```

It accepts only a successful transaction to the frozen launcher and requires:

- the verified selector and decodable metadata;
- sender equal to the selected project-fee role;
- zero `msg.value` and no USDC/first-buy flow;
- `TokenCreated`, Uniswap `PoolCreated`, and locker `PositionLocked` events;
- matching token/pool/creator/locker authorities;
- no unknown token allocation recipient;
- complete supply, pool, position, locker, block/hash, allocation, and timestamp fields.

It rejects unrelated transactions, wrong launchers, wrong fee-recipient senders, first buys, missing events, contradictory pools, and privileged allocations. It does not run automatically and has not been run against a nonexistent BINRAT launch.

## Post-launch dependency order

1. Reconcile the Launch Execution Receipt.
2. Verify allocation and absence of the privileged first buy.
3. Bind the actual token address in a Launch Config successor.
4. Activate the Dumpster Ledger observer only after reviewed configuration.
5. Freeze the Holder Gate absolute raw threshold.
6. Bind the reviewed ERC-20 balance source.
7. Activate HOLDER eligibility.
8. Repeat Telegram and status consistency smoke.
9. Update the gate matrix.
10. Consider explicit owner launch authority only after every mandatory condition permits it.

No step in this rehearsal changes `launchAuthorization`, `marketingAuthorized`, or `tokenState`.
