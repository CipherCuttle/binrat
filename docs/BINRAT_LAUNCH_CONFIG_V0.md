# BINRAT Launch Configuration V0

This document renders the owner-frozen policy in `BINRAT_LAUNCH_CONFIG_V0.json`. The JSON and its deterministic digest `f631e43287a3bcb6a6da6a7f405d1ad2e3b17c9648b5928dc7c8a3a32890e1f8` are canonical; this companion is explanatory.

## Frozen rail and authority roles

- Chain: Arc mainnet, chain ID `5042`.
- Rail: ArcPad Arc-mainnet USDC standard creator-rewards mode.
- Launch Mechanics receipt digest: `aff37d6d82cced00a34284453c0327bb51e5624b5761b621264f55602e8245e6`.
- `TREASURY`: `0xab063A9b53a2Ab832a941aE5890ea05c1672339D`.
- `PROJECT_FEE_RECIPIENT`: `0xba5Ee49734b50Cf62d0B538584fbaC0eFFB79866`.

The two wallets are distinct, checksum-preserved owner declarations. They are not the ArcPad protocol treasury or launcher owner. Configuration does not prove custody, past activity, a deployed-token role, or launch execution, and the roles are not interchangeable.

## Owner policy

- Private presale: `NONE`.
- Discounted insider round: `NONE`.
- Hidden team allocation: `NONE`.
- Privileged same-transaction creator first buy: `DISABLED`.
- Founder/project privileged launch allocation: `NONE`.
- Founder/project launch-block privileged purchase: `NONE`.
- Founder/project ordinary public-market purchase at launch: `NOT_PLANNED_FOR_LAUNCH`.

This is `OWNER POLICY`, not `POST-LAUNCH ON_CHAIN_VERIFICATION`. The later execution receipt must verify what actually happened.

## Inactive production handoffs

The BINRAT token is `NOT_LAUNCHED`; its address is `NOT_YET_CREATED`. Launch transaction, launch block, observed token-related inflows, and observed token-related outflows are not yet available. A zero-entry pre-launch ledger means no token observations can exist yet; it is not a promise that future flows will remain zero.

Dumpster Ledger can display both configured future authorities, but accounting stays disabled until the actual token address and effective launch block exist, the selected mechanics receipt remains bound, and the reviewed observer is explicitly activated.

Holder Gate may display the two declared roles, but production eligibility remains `TOKEN_AUTHORITY_NOT_CONFIGURED`. Activation additionally requires the actual token address, a reviewed ERC-20 balance source, a frozen absolute raw threshold, a policy version, and an effective block/time.

## Allocation disclosure boundary

Owner policy declares no presale, discounted insider round, hidden team allocation, privileged creator first buy, or founder/project privileged launch-block purchase. An ordinary founder/project public-market purchase at launch is not planned. Treasury token inventory is `ZERO_NOT_YET_CREATED`, meaning no token exists from which inventory could be held; it is not a claim about future inventory.

## Execution receipt

`BINRAT_LAUNCH_EXECUTION_RECEIPT_V0.template.json` deliberately cannot validate as an executed launch. PASS requires the real token, transaction, block/hash, supply, pool, position, locker, bound authority roles, this configuration digest and mechanics digest, allocation verification, founder/project purchase observation, and execution timestamp.

## Authority boundary

- `launchAuthorization = BLOCKED`
- `launchAuthorized = false`
- `marketingAuthorized = false`
- `tokenState = NOT_LAUNCHED`
- explicit owner launch authority: `NOT_GRANTED`
- legal/compliance: `NOT_SATISFIED`

No token is created, no transaction is signed or broadcast, no funds move, and no production Holder Gate is enabled by this configuration.
