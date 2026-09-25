# Pons V2 chain 4663 independent three-receipt proof

Verdict: `INDEPENDENTLY_VERIFIED_THREE_RECEIPTS` for the narrow
`TokenLaunched` source contract only.

Two independent archive RPC gateways returned the same deployment boundary,
historical runtime code hash, canonical receipt headers and raw event logs. A
separate explorer rendered each transaction, block, created token/curve and
raw `TokenLaunched` topics/data. Run `node scripts/verify-pons-evidence.mjs`
to verify the checked-in package without network access.

The indexed `deployer` field is named `originalDeployer` in the pinned Pons
source. It is not a verified human identity and is not necessarily the current
creator fee recipient. The event does not contain the fee recipient, so the
package records it as `null`. A zero pair token is native ETH; the second
sample is deliberately classified only as `NON_NATIVE_TOKEN`.

## Independent replay

```sh
node --import tsx scripts/pons-proof.ts probe \
  --block 26841847 \
  --rpc https://rpc.solidrpc.io/public/evm/4663

node --import tsx scripts/pons-proof.ts probe \
  --block 26841847 \
  --rpc https://robinhood-chain.gateway.tenderly.co

node --import tsx scripts/pons-proof.ts collect \
  --from 72448800 --to 72448999 \
  --code-hash 0x89a27da6f703e0a7cdd4f233e7cb57604ff75b164530962d3ff7cf8483a67d84 \
  --max-windows 1 --window-blocks 200 \
  --rpc https://rpc.solidrpc.io/public/evm/4663 \
  --out .local/pons-solidrpc-replay.json

node --import tsx scripts/pons-proof.ts collect \
  --from 72448800 --to 72449299 \
  --code-hash 0x89a27da6f703e0a7cdd4f233e7cb57604ff75b164530962d3ff7cf8483a67d84 \
  --max-windows 1 --window-blocks 500 \
  --rpc https://robinhood-chain.gateway.tenderly.co \
  --out .local/pons-tenderly-replay.json
```

Public gateways are rate-limited and may change their retention policy. Their
availability is not part of this proof. The raw immutable receipt fields are.
The official Blockscout transaction UI returned an unrelated record for one
hash during collection; that conflict is preserved in `manifest.json` rather
than silently treated as agreement.

This package does not establish curve trades, graduation, V4 state, creator
fee-recipient ownership, production indexing capacity, or permission to enable
alerts.
