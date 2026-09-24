# Pons holder balance probe V1 — read-only engineering candidate

This is the next bounded slice after the Pons selection PR. It is **not** the production holder gate and is intentionally **not wired into the Worker, Telegram, website or live entitlement resolver**.

## Why this slice exists
Existing `src/cloudflare/holderAuth.ts` issues SIWE challenges on **Arc 5042**, and the existing `src/holder/eligibility.ts` deliberately returns FREE for every production user because its ERC-20 balance source has not been reviewed. Merely swapping the holder token address in an env var does **not** provide Robinhood entitlement and would mix up two authorities.

This candidate proves a separate **Robinhood 4663** balance-inspection boundary can be exercised without changing the deployed Arc research plane:
- validate exact token network, nonzero checksummed address, nonzero raw threshold, policy id and effective block;
- refuse RPC chain 5042 or unknown network;
- query a **finalized** Robinhood block (never latest/pending fallback) and reject blocks over five minutes old or more than 30 seconds in the future relative to the caller's supplied clock;
- verify canonical block hash both before and after ERC-20 `balanceOf` at that block and recheck the RPC's chain ID after the read;
- fail closed for incomplete configuration, reorgs, RPC failure, malformed balance and insufficient finality;
- report a *candidate threshold observation* while **always granting FREE**, even when the threshold is met.

The production selection document still has `token.address=null`, `minimumRawBalance=null` and `effectiveBlock=null`. Test fixtures supply fictional values to validate behavior. These are not a live BINRAT token or verified deployed contract.

## What must happen before any production holder gate
1. Independently verify the **actual** Pons launch transaction, deployed token address, chain and on-chain supply/allocations after separate explicit launch authorization.
2. Freeze the real raw threshold, versioned entitlement policy, effective block and verified Robinhood RPC/balance source.
3. Migrate SIWE from Arc-only to chain-bound Robinhood challenges and **bind the issued session to that same network and policy**, including reviewing D1 schema/migration and policy invalidation. Never accept an old Arc/fixture HOLDER session under the new policy.
4. Integrate a reviewed Robinhood balance reader with existing fail-closed production resolver, first against isolated fixtures then at verified block checkpoints.
5. Explicitly activate only after review, rate limits, reorg/stale handling, public receipt parity and owner authorization.

Do not gate public receipts or use token holdings to decide investigative truth. Nothing here requires token launch or wallet signing/broadcast.

## Verification
`pnpm check` includes `test/ponsBalanceProbe.test.ts`; check exact PR head CI. Existing tests for Arc holder sessions must remain green. Test status and live network readiness must not be conflated.
