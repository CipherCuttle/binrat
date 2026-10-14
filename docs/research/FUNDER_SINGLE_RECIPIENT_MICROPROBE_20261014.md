# BINRAT — single-recipient historical funder microprobe (preregistered)

Date: 2026-10-14. Scope: read-only, exploratory, NOT a rerun of the stopped cohort V1, and NOT a production capability. This registration precedes the first subject-selection query. Existing archive Actions parity run 38590415526 already PASS; this new probe uses the **connected Alchemy app**, not the GitHub Actions secret. Do not infer credential identity from this experiment.

## Hypothesis and sampling
Can the connected archive provider supply source-backed, time-correct Pons funding-to-later-launch outcome data for one uncherry-picked funding recipient, without requiring a large historical scan?

Fixed chain 4663. Pinned Pons V2 factory `0x7ed598bcef8bd9edd8c97a195c6d13f40801ec7e`; event `TokenLaunched(address,address,address,address,uint256,uint256)`, deployer indexed as topic[3]. Funder `0x9bc462bce2acd6fbe2ef5470d55b439453451083` is inherited from preexisting historical research, NOT a random wallet or control. Locator window inclusive **81,504,001–81,704,000**, outcome ceiling **81,756,562**; all dates/targets fixed before requests.

Selection: exactly one ascending provider `alchemy_getAssetTransfers` page, at most five `external` positive native transfers `fromAddress=funder`, no zero-value, no metadata. Select **the first non-self transfer** in returned ascending page with a distinct recipient (one only); do not inspect outcome before selection; do not replace subject if malformed/unavailable. If none, return `NO_SUBJECT`. Report pagination/selection coverage as incomplete if pageKey remains. Persist exact source address, recipient, transfer hash/block/value, selection order after lookup.

Funding proof: canonical `eth_getBlockByNumber(fullTransactions=true)` of selected funding block plus `eth_getTransactionReceipt`. Require tx hash/from/to/value/chain/block membership and successful receipt, verify matching block hash. On inconsistency, stop `BLOCKED_EVIDENCE` with no outcome query. A live proof includes the selected funding record, not proof of wallet ownership or causal launch intent.

Time horizon: use the funding block's timestamp and independent header queries to find a safe block bound for **60 minutes** after funding (mature before fixed ceiling). Explore only canonical blocks after funding; same-block excluded. Search `eth_getLogs` on the pinned Pons factory with topic[3] == selected recipient, in contiguous chunks of at most 4,096 blocks from fundingBlock+1 to bounded horizon. Any missing/failed chunk => `INCOMPLETE_COVERAGE`, not zero. If launch logs appear, validate the exact factory event, transaction receipt and block hash before admitting a positive; no token prediction or ownership inference. For a verified positive, classify <=600 seconds and <=3600 seconds based on block timestamps. For provider-reported full negative, report `NO_PROVIDER_LOGS_IN_COVERED_WINDOW`, not global negative; if 60-minute maturity fails, report `INCOMPLETE`.

**Budget and stop:** maximum **32 connected Alchemy requests** total after this registration, no retries or fallbacks, no gas/transaction/signer methods, no model calls, no messages or alerts. Current authenticated Alchemy usage before this experiment: 0.93 USD used of 10 USD monthly plan cap, 9.07 USD remaining (usage snapshot 2026-10-14 15:42 UTC). No guarantee of a per-run USD cap from RPC responses; enforce the 32-call upper bound and respect account's separate $10 monthly cap. Abort on provider errors, insufficient source coverage or likely quota issues. Existing closed cohort receipts remain untouched. No production deploy/merge or token actions.

## Evaluation and claim gate
This is N=1, selected, historically retrospective, and therefore **cannot estimate funder yield**, useful-wallet precision, predictive lift, profitability, or willingness to pay. It is a transport/evidence microprobe to determine whether a properly registered >=10-recipient study is feasible. Even one positive would be only a descriptive historical relationship; graph novelty must be judged against existing `SAME FUNDING SOURCE` baseline.

Single final outcome: `ONE_SUBJECT_POSITIVE_VERIFIED`, `ONE_SUBJECT_PROVIDER_NEGATIVE_BOUNDED`, `NO_SUBJECT`, `BLOCKED_SOURCE_OR_PROVIDER`, or `INCOMPLETE_COVERAGE`. Record exact request count and bounded caveats; STOP after one pass.


## Closed execution receipt — 2026-10-14

**Verdict:** `BLOCKED_SOURCE_OR_PROVIDER` / `BLOCKED_EVIDENCE`. No cohort yield or launch inference.

- Source read 1: one archive `alchemy_getAssetTransfers` page succeeded for frozen funder/window, five direct native transfer candidates in ascending order, **pageKey present** (non-exhaustive). Selected **first** non-self recipient, without outcome substitution:
  - recipient `0xef8cbc4444d505b32198061884cf902e9307fd59`
  - funding hash `0x952a185b94feec5649e5e9064186cf7aa763cc5b864db9c28b53879762189488`
  - funding block `0x4dbab5a`
  - locator raw value `0x874aa453554d8` wei; candidate only, not fully admitted as proven funding
- Read 2: `eth_getBlockByNumber(0x4dbab5a,true)` through the connected Alchemy tool returned a large block response that was truncated by the tool output channel. The relevant transaction membership therefore **could not be parsed and verified**. In the first attempted summary the block and transaction fields were unavailable because of response truncation, **not because the transaction is absent**.
- Read 3: `eth_getTransactionReceipt` for the selected transaction succeeded: `status=0x1`, `blockNumber=0x4dbab5a`, `blockHash=0x06e4b5633c8eade32195ffc657db00312f6ad3088474a26731ac35ecc2ec068a`, zero logs. This is a valid receipt but does not substitute for exact full-block membership.
- Read 4: one attempted direct parse of the full block was again truncated; JSON parse failed. No further attempt was admitted.
- **Provider requests: 4 total** (one transfer page, two full-block reads, one receipt), <=32 registered cap. No retry of the original frozen cohort. No Pons event-log queries, no confirmed launch, no validated funding path, and no user-visible autonomous Rat capability.
- **Reason:** connected-app transport cannot expose a whole >8 KB full block for deterministic canonical membership verification within this chat. Response size/transport limitation, not proof of missing chain data or a failed on-chain predicate.
- **Cost:** request-level USD unavailable; Alchemy usage summary just before the trial reported **$0.93 of the $10 monthly cap used**, with **$9.07 remaining** at its reported time. No exact incremental cost or restored usage check established.
- **Safety:** no model calls, production writes, deployment, merge, token action, Telegram delivery or credential disclosure.

**Next bounded action (newly scoped, not a continuation):** use the existing local Codex/Node historical cohort evidence checker with a verified full-body RPC transport and a hard 1 MB response ceiling, then verify the *same preselected transaction* (never substitute a later recipient) through exact block membership, receipt and hash consistency. Any later launch examination requires a separate fresh registration and cap. Do not pretend a transaction or receipt-only shortcut satisfies the frozen proof contract.
