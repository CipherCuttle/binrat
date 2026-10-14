# BINRAT — frozen selected-funding full-block verifier

**Status:** review-only, offline-tested Node CLI; **NOT YET LIVE-EXECUTED**. Independent research step after the closed 2026-10-14 N=1 microprobe; do not resume that experiment or substitute the recipient.

## Frozen target and source

Original registration: `docs/research/FUNDER_SINGLE_RECIPIENT_MICROPROBE_20261014.md` (closed at commit `bf74d22802036ab8bc1e63ca4b81c18fb1f240b2`).

- Robinhood Chain 4663 / public RPC `https://rpc.mainnet.chain.robinhood.com`
- Earlier indexed locator: funder `0x9bc462bce2acd6fbe2ef5470d55b439453451083`
- First selected non-self recipient: `0xef8cbc4444d505b32198061884cf902e9307fd59`
- Selected funding transaction: `0x952a185b94feec5649e5e9064186cf7aa763cc5b864db9c28b53879762189488`
- Block `0x4dbab5a`; prior successful receipt block hash `0x06e4b5633c8eade32195ffc657db00312f6ad3088474a26731ac35ecc2ec068a`
- Locator-reported native amount `0x874aa453554d8` wei

These inputs are frozen; changing any target requires a separate experiment.

## Scope / operation

Script: `scripts/verify-selected-funding-block.mjs`. Uses **only** read-only public `eth_getBlockByNumber(block,true)` followed by `eth_getTransactionReceipt(tx)`. **At most two HTTP JSON-RPC requests, no retries/fallback**, 15-second timeout and 1,000,000-byte maximum per response, redirect denied. No Alchemy key required and no paid Alchemy billing for these two public-RPC reads.

Before any read, the script refuses existing output paths and fsyncs a PENDING receipt. On completion, it writes an immutable sanitized `final.json` containing exact request count, source/recipient/value/chain/block/transaction-index match, outcome, and unknown request cost. No raw full block, secrets or model content persisted. Missing/contradictory/oversize provider responses **fail closed**; no launch outcomes are queried.

From the BINRAT repository checkout at this branch head:

```bash
node --test test/verifySelectedFundingBlock.test.mjs
node --check scripts/verify-selected-funding-block.mjs
# Only after offline tests pass; single real read-only proof:
node scripts/verify-selected-funding-block.mjs --out /home/swirky/DevHub/artifacts/binrat-selected-funding-block-20261014
```

**No `pnpm`, Node addon, private key, Alchemy subscription or Docker required by this standalone script.** It uses Node 20+ built-ins only. The output directory must not already exist. A failed/PENDING output is terminal; do not rerun automatically under a new name.

## Acceptance

- `FUNDING_VERIFIED`: the full provider-reported block includes the exact selected hash with matching funder/recipient/value/chain/block/index and the independent successful matching receipt. This is bounded provider-backed evidence, **not an independent consensus proof**, shared-wallet ownership proof, Pons launch proof, or Sniffer product value.
- `BLOCKED_EVIDENCE`: missing, oversized, malformed or inconsistent provider evidence. Preserve receipts and STOP.
- Never count this as a new future launch or denominator in the stopped cohort. Next decision (separately authorized): if verified, register a fresh finite, receipt-bound Pons launch outcome experiment; if blocked, repair the specific transport issue only.

## Frozen phase rule

`PLAN → CHANGESET → VERIFY → VERDICT`; one hostile review, fix Critical/High, one targeted rereview if needed, STOP. No merge, deploy, GitHub workflow dispatch, production write, credential change, watch activation or token authority.
