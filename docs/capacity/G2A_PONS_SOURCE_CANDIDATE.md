# G2A — Robinhood/Pons source candidate (offline, no deployment)

Parent: PR #37 exact foundation head `114b0572de3f3d153d24a155b8cfbbea07f38670`.
Pons upstream source inspected: `ponsdotdev/pons-labs@162310fbd1217717e2f5e4cde794d6a11322b469`, `contractsV2/src/v2/PonsV2LaunchFactory.sol`, `PonsV2BondingCurve.sol` and `interfaces/ILaunchpadV2.sol`.

## Source-derived contract

Factory `0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e` emits `TokenLaunched(token indexed, curve indexed, deployer indexed, pairToken, launchConfigId, graduationThreshold)`. The indexed `deployer` is `originalDeployer`, including trusted forwarded launches. It does **not** emit initial `creatorFeeRecipient`; the source-derived launch record deliberately marks that field `NOT_IN_LAUNCH_EVENT`. The factory's `getLaunchedToken(token)` tuple may yield this role with an independent archival read at the launch block in a later reviewed slice.

Curve `CurveBuy` and `CurveSell` distinguish trader from recipient and quote asset, with quoted fees/taxes. Factory `LaunchSwept` is phase 1; `PoolGraduated` is phase 2. A swept launch has **not** proved the V4 pool exists; `Rescued` is another terminal phase. These event definitions are exported as separately typed ABI items but are NOT yet an operational activity or V4 indexer.

This isolated adapter pins numeric chain 4663 and requires an **explicit operator-confirmed historical factory bytecode hash**. The checked-in Pons source commit and repo factory address alone do not establish currently deployed on-chain bytecode or immutable factory epoch. The adapter refuses missing code pins, wrong chain, code hash drift, noncanonical block hashes, >500-block default ranges, malformed logs, duplicate ID conflicts and mid-scan reorgs. Arc IDs, Arc projections, D1 schemas, Worker and Telegram code are unchanged.

## Evidence gate before operational 4663 claims

1. Obtain one independent Robinhood RPC/archive provider, check eth_chainId and pinned factory historical bytecode at the precise launch blocks, record expected code hash and source epoch.
2. Obtain **three different genuine** real Pons V2 TokenLaunched transaction receipts with immutable block number/hash/tx/log index. Re-derive source record from eth_getLogs and cross-check the factory emitter and event topic. Synthetic tests in this PR do not satisfy this.
3. Verify getLaunchedToken(token) at **launch block** for initial fee recipient and phase. Collect genuine curve buy/sell, LaunchSwept and PoolGraduated receipts where available. Verify the V4 PoolManager/hook + pool key independently before reporting V4 trades.
4. Only then add a separate 4663 checkpoint, replay fixture and non-production backfill path with tested reorg rollback, retry, per-chain health and Chain-scoped Watch. All absent fields remain UNKNOWN / PARTIAL rather than zero or success.

No live RPC was invoked by this PR. No production D1 writes, queue activation, 4663 coverage claim, token launch, merge or deployment.

Hostile review #5316888726: every touched event block is now revalidated at scan end and its historical factory code checked independently. A provider with unchanged endpoint hashes but a changed interior block fails closed. This does not replace real-chain receipt verification or finality policy.
