# G2A A1 — Real-receipt collection runner, still candidate only

Parent: G2A PR #38 at exact reviewed head `a6f03dd3191dbeb9309d1af5d49608dfcc965fc2`.
This isolated branch does **not** change Arc, the Worker, Telegram, production D1,
the BINRAT launch plan, the 4663 checkpoint, or Pons's upstream contract pins.

## Actual evidence versus the offline fixture

The predecessor's eight adapter tests were synthetic. A Pons 4663
`TokenLaunched` source is not live merely because factory ABI and a GitHub
source commit match. This runner collects a bounded sample with no private key,
transaction broadcasting, paid service, scheduler or cloud deployment.

The 4663 factory is pinned to `0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e`
from `ponsdotdev/pons-labs@162310fbd1217717e2f5e4cde794d6a11322b469`.
Robinhood's publicly documented RPC is
`https://rpc.mainnet.chain.robinhood.com`; a historical-code-capable archive
RPC may be needed and should be treated as a separate dependency.

## Operator procedure — EXPLICIT manual invocation ONLY

1. Independently establish V2 factory deployment epoch and identify a *post-deployment*
   historical block. Do not substitute the old V1 factory from pons v1 docs.
2. Inspect historical bytecode at that block with two independent RPC/archive
   endpoints and compare with a verified-source explorer record:

   ```sh
   pnpm exec tsx scripts/pons-proof.ts probe --block <POST_DEPLOYMENT_BLOCK>
   ROBINHOOD_RPC_URL=https://YOUR_SECOND_ARCHIVE_RPC pnpm exec tsx scripts/pons-proof.ts probe --block <SAME_BLOCK>
   ```

   `UNCONFIRMED_HISTORICAL_PIN` is *not* a verified result. Do not paste a
   probe's keccak output into a trusted configuration until independent
   deployed-code and epoch verification. The codehash is never guessed from
   a Solidity source commit.
3. Collect exactly three **different transaction** launch receipts within
   an explicit maximum 6,000-block post-deployment window, at least 64 blocks
   behind the sampled head:

   ```sh
   pnpm exec tsx scripts/pons-proof.ts collect \
     --from <START_BLOCK> --to <END_BLOCK> \
     --code-hash 0x<INDEPENDENTLY_CHECKED_64_HEX> \
     --max-windows 12 --window-blocks 200 \
     --out .local/pons-4663-three-receipts.json
   ```

   Set `--window-blocks` at or below the provider's documented filtered-log
   limit (maximum 500). Re-run with a different archive RPC for independent comparison. The
   output file is create-only, mode 0600 and is **never** auto-imported into
   Worker, D1, Telegram or a strategy; keep private RPC credentials in environment.
   A new output must be compared by event ID, block hash, tx hash, raw receipt
   log, role data and historical factory code hash.
4. Only after those external gates: check `getLaunchedToken(token)` at the
   historical launch block for the creator-fee-recipient role, locate one
   genuine curve buy/sell and independently inspect phase-1 `LaunchSwept`,
   phase-2 `PoolGraduated` and V4 pool/hook receipts if they exist.

## What the collector proves — and what it deliberately cannot

- Verifies chain id 4663; historical factory codehash at every scanned window
  and touched event block; per-block canonicality (including late reread).
- Crosschecks `eth_getLogs` and `eth_getTransactionReceipt` against the
  pinned six-field ABI, exact block/tx/log identity, successful tx status,
  distinct launch tokens and distinct transactions.
- Stops at three samples, with at most 12 × 500-block read-only scan windows.
  Insufficient receipts, missing archive bytecode, reorg, wrong chain or
  inconsistent RPC fail the entire batch without producing a PASS bundle.
- The emitted label is
  `SINGLE_PROVIDER_CONSISTENT_NOT_INDEPENDENT`. Two reads from one RPC are
  not two providers. A 64-block buffer is not L1 finality. Bytecode hash alone
  does not prove equivalence to published source. Real fee recipient and
  graduated V4 pool are outside this slice.
- No actual mainnet RPC verification was possible from the authoring runtime;
  unit tests are mock-provider tests. The proof file and any real coverage
  claim remain pending until an operator runs the bounded collector from a
  network-enabled environment and checks independent sources.

**Authority:** offline candidate code/test/docs only; no merge, deploy,
production D1 write, paid staging, checkout, token launch, or Watch activation.
