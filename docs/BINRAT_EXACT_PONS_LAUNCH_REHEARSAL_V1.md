# BINRAT Exact Pons Launch Rehearsal V1

Status: read-only rehearsal implementation; exact owner inputs remain unresolved. This is not live launch authority.

## ABI provenance

The machine-readable artifact is `PONSVault_PRODUCTION_UI_ABI_V1.json`; the typed viem ABI is in `src/launchConfig/ponsVaultLaunchAbi.ts`. It is classified `PINNED_PRODUCTION_UI_ABI`, sourced from the production PonsVault launch surface at deployment `dpl_3GqtGP7hXYxb4sBTYSiwpaGPMHsb`. The bundle `/_next/static/chunks/10opw2r9zotbj.js` hashes to `580d679b7163dbfae91300ea0b2c7c9ba8dd8f8e9268c8383660f351c60a7b53`. Its `launchWithVault` signature yields selector `0x969e6741`.

The historic transaction fixture at `docs/fixtures/PONSVault_RWA_LAUNCH_TX_V1.json` is a real RWA launch to `0x1770…3dBA`, with `0.0005 ETH` value. Its calldata round-trips exactly through the pinned UI ABI. This proves the shared launcher interface and is not Staking launch evidence. The attestation records its synthetic Staking simulation results and constraints, but does not include the original calldata. `PONSVault_SYNTHETIC_STAKING_CALL_V1.json` is therefore a static representative calldata fixture, not that recorded call. It uses `staking`, native ETH, zero buyback, 100 bps synthetic tax, a 32-byte explicit salt and the attested `0.1 ETH` payout floor; none of those fixture values set BINRAT owner inputs.

## Runtime and current authority

The selected target is `0x1770c356eB9312079b9A00e26a8CF4b0a1473dBA`. The distinct `0xD948EDCDB832529bB3458B0463F5E02Bb448888e` deployment is never a fallback. Runtime hash evidence is `0x5a6baeade01d8119231385e1a6f38c50388b2f30063d3c6c3e5736e590ad12a0` at block `79428213`; it is checked for drift. Each actual simulation must also first use `PONS_PREFLIGHT_V1` and its fresh pinned block/hash, graph and receipt digest. That block is not treated as forever-current.

The deployed Solidity source/runtime binding remains `LAUNCHER_SOURCE_RUNTIME_BINDING = UNRESOLVED`. This gate does not stop a blocked-input report or a rehearsal result. It permanently prevents this appliance from setting `launchAuthorized` true.

## Value, salt, recipient

The ABI cannot encode transaction value. The pinned production bundle reads the current Pons V2 `launchFeeWei`; where an optional initial buy exists, the UI adds its quote amount for native ETH pairs. The observed RWA transaction’s `0.0005 ETH` and matching factory fee are evidence for that transaction only. The recovered bundle does not provide a proven universal `launchWithVault` value formula, so V1 requires explicit `transactionValueWei` and includes it in the exact `eth_call`. No value is inferred or silently defaulted.

The UI’s `randomLaunchSalt()` uses 32 bytes from `crypto.getRandomValues`; this appliance never generates randomness and requires an explicit salt. For the Staking UI path, the bundle predicts a vault address from creator, factory, a sequentially selected vault salt, pair token and vault config, choosing the first unused prediction as `creatorFeeRecipient`. This caller-side computation is not embedded in `launchWithVault` and needs an exact-call recipient input until independently bound to the current execution path. Do not use the historical Arc project-fee address.

## Input policy and simulation

The deterministic builder fixes chain `4663`, launcher and Pons factory to the plan, native pair to zero address, template to `bytes32("staking")`, creator tax to zero, buyback false, and opening buy to zero. `openingBuyWei = 0` states that the rehearsal adds no separate initial-buy action; it is not a `launchWithVault` argument and is not `msg.value`. It ABI encodes `vaultConfig = abi.encode(uint256 minimumFeesBeforePayoutWei)`.

Null exact-call fields are returned as `BLOCKED_OWNER_INPUTS`. Social keys must be present, but may be empty strings. Metadata fields are required values. Treasury and WORKING RAT threshold are not exact-call inputs and do not block this rehearsal. Read-only simulation uses `eth_call`, decodes token then vault, and rejects malformed, zero or equal addresses. No signer client, signing or broadcast path is present.

`docs/fixtures/PONS_PREFLIGHT_V1_CURRENT.json` records a successful fresh `PONS_PREFLIGHT_V1` at block `79447264` with launcher hash `0x5a6b…12a0`; its receipt digest and graph are included in the rehearsal receipt. `docs/BINRAT_EXACT_PONS_LAUNCH_REHEARSAL_V1_RECEIPT.json` records the blocked V1 state. Nulls explicitly indicate exact owner inputs not yet supplied; they do not stand in for observed authority. Simulation requires this current preflight again and rechecks the launcher runtime pin.
