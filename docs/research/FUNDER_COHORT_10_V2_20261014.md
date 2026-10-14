# BINRAT — New 10-recipient historical funding → launch pilot, v2

**Registered:** 2026-10-14. **State:** DESIGN_FROZEN / NO V2 RPC AUTHORIZED YET. This is a *new* cohort protocol, not a retry, continuation, or additional allowance for the stopped 2026-10-06 cohort V1. The existing October 14 one-recipient microprobe is closed at `PROVIDER_NEGATIVE_60_MIN`. Its subject and 60m result are previously observed, not held-out evidence.

## Research question

Among the **first ten different non-self recipient addresses** receiving externally indexed, positive native ETH transfers from one preselected source, how often does each exact recipient subsequently appear as the indexed deployer in Pons V2 `TokenLaunched` within 10 and 60 minutes? Do verified relations generate **new useful information** beyond the existing deterministic funding-recurrence/Case readers?

This is a small historical source-specific feasibility pilot, not a randomized control, causality test, expected returns/alpha predictor, or willingness-to-pay study. The source was picked because of earlier same-source examples (selection bias). One of the first five recipients was previously examined and was negative; all results must disclose this fact, and `N=10` may not be portrayed as independent holdout evidence.

## Frozen subject and selection (prior to any v2 lookups)

- Chain ID: 4663, Robinhood mainnet. Pons V2 factory `0x7ed598bcef8bd9edd8c97a195c6d13f40801ec7e`.
- Exact preselected source: `0x9bc462bce2acd6fbe2ef5470d55b439453451083`.
- Locator window **81,504,001 to 81,704,000** (inclusive); **maximum outcome ceiling 81,756,562**. These overlap earlier researched data by design; no independent holdout claim.
- Exactly **four ascending indexed native-transfer pages maximum**, each up to five records, `category=['external']`, `excludeZeroValue=true`, `withMetadata=false`, `order='asc'`. Select first **10 distinct non-self recipients** and their **earliest** returned transfer in provider order. Do not prefer big amounts, prior profitable wallets, subsequent launch matches, or apparently active addresses. No replacement after freezing the recipient list; repeated/self transfers count against bounded pages but not selected denominator.
- Save the selected recipient, tx hash, transfer block and value, exact page-key chain, selection digest, and source request/response hashes in a **durably fsynced checkpoint before any launch-outcome query**. Do not copy a frozen V1 journal or reuse its capture ID.
- Candidate transferred amounts are locator evidence until full block and receipt verification; no selective omission of a failed recipient. If fewer than **10** valid distinct recipients are selected or all cannot be verified, stop `INCOMPLETE_NO_YIELD_DECISION` (do not report a smaller positive-only denominator).

## Evidence and outcomes

- Validate each selected funding transaction against **full canonical block transaction membership**, sender/recipient/value, chain ID 4663, tx index, matching block hash and successful matching tx receipt. Recheck block number/hash after receipt to detect drift. Missing large block, historic-read permission, timeout, reorg or contradictory data = `BLOCKED_EVIDENCE`, never assumed negative. No receipt-only or explorer-only fallback.
- All funding timestamps come from verified blocks. Define outcomes as exact factory `TokenLaunched` logs with indexed topic[3] == each selected recipient, **strictly after funding block and timestamp**.
- Search only a **finite, contiguous covering block interval** from earliest selected funding block + 1 to a confirmed timestamp ≥ (latest selected funding timestamp + 3600 seconds), bounded by the pinned ceiling. **Do not let a future event change recipient selection or funding anchor.** An event for a recipient prior to its funding is not that recipient's outcome.
- Use a single OR topic[3] covering the 10 frozen recipients per 4096-block chunk. For every chunk, read the last header **before and after** the `eth_getLogs` query. Require number, hash, parent and timestamp agreement, monotonic time, exact topic0, factory address, topic3 membership, and no duplicate/removed logs. Do not assume provider logs are consensus-complete.
- If candidate launches are returned: verify the earliest strictly later event for each recipient with exact canonical launch block membership, successful receipt containing that event, expected factory and same-number hash recheck. If any selected candidate has contradictory or unverified evidence, halt without a scored yield. Count 0 < elapsed ≤600 and ≤3600 seconds using block timestamps, with ties/late events reported explicitly. Do not fabricate launch outcomes.
- Any missing scan chunk or incomplete 60m time maturity => **`INCOMPLETE_COVERAGE`**, never zero. A full provider-empty window is a **provider-reported bounded negative**, never evidence of chain-wide absence.

## Baseline and evaluation

**Baseline A**: existing deterministic case/deployer history and `SAME FUNDING SOURCE` exact-address recurrence (no NetworkX/PyOD/LLM). **Candidate B**: temporal funded-recipient → later Pons launch within 10/60min. Report source-backed `found by B but unavailable to A at the alert timestamp`, if demonstrable; otherwise novelty **0 / unproven**. Same-funder relationships are already available to A. Keep separate fields for raw event rates, validated novelty, usefulness hypothesis, and actual WTP (UNKNOWN).

Report cohort: 10 selected and all verification outcomes (not only positives), 10m/60m counts, denominator, delays, candidate/confirmed counts, exact RPC cost/attempts, capped pagination, block coverage and source/receipt hashes. A positive from the previously inspected recipient may not be counted as held-out evidence. Pilot thresholds are *exploratory only*: ≥2/10 launches in 10m may justify a separate prospective, genuinely blinded trial; <2/10 in both windows suggests deferring this particular source/horizon. No automatic activation on either result.

## Operational budget and authority gates

- Before live calls: implement **pure replay**, deterministic selection and proof validators; adversarial tests (pagination, duplicate recipient, cross-chain, reorg, incomplete logs, wrong recipient, wrong hash, unsafely retried request, overlarge block, time boundary, stale source); one hostile review and single targeted rereview if warranted; successful CI at exact SHA.
- Fresh one-use signed-off registration with unique capture ID and output path, no resume/retry/rerun. Max **144 RPC attempts**, at most **one attempt per request**, **15s timeout**, **1,000,000 bytes/response**, ten-minute or separately justified 20-minute wall clock limit, no hidden retries or fallback. Request budget enforced *before* dispatch; append-only reservations durable before transport; failure halts.
- Only existing pinned providers; no plan upgrades, paid subscriptions, new secrets, exchange connections or key exposure. Respect owner's existing Alchemy $10 monthly cap; verify current usage before any call; per-experiment USD usage must be measured independently if claimed. If required historical reads need unapproved spend or cannot fit the cap, `BLOCKED_BUDGET`.
- **No authorization to dispatch this V2 cohort has yet been exercised in this registration commit.** Never expose GitHub secrets or trigger broad pipeline jobs by pushing; do not merge, deploy, publish alerts, sign/broadcast transactions, or write production.
- Preserve stopped original V1 and closed October 14 microprobe, no modification/renaming of their recorded receipts.

**Stopping policy:** `PLAN → CHANGESET → VERIFY → VERDICT`, one hostile review, Critical/High repairs once, targeted rereview, STOP. If archive/index/raw evidence is still unavailable after this bounded implementation, `PARK` rather than pursuing endless transport fixes.


## Single bounded execution grant — 2026-10-14

The owner agreed in this conversation to proceed with the newly registered 10-recipient historical pilot. The exact-message Actions workflow was separately introduced at commit `adbaa5c9d10b51c34d0ad3b751e6ada9bb7371b5` and its ordinary push triggered an **observe: skipped** job (not a live run). The V2 implementation at commit `b15b76c91ccc2a2e87ac85bfd94f1acec4e67b2c` passed all offline CI tests, including nine new V2 test groups. The fresh run repeats offline checks on its own exact triggering checkout before any secret injection.

This grant is exclusively for **one** first-attempt read-only GitHub Actions execution under the 144-attempt, 1MB/body, one-use-source/checkpoint and 20-minute runtime bounds frozen above, using the preexisting archive Actions credential. Owner's Alchemy monthly cap remains $10; authenticated usage last read: $0.93 used and $9.07 remaining (2026-10-14 UTC). No second workflow rerun, budget extension, second funder, source/window change, automatic publication, model calls, on-chain transaction, merge or deployment is authorized. The execution receipt determines actual outcome; this grant is not a finding.

## Terminal V2 experiment receipt — 2026-10-14

**Run:** [GitHub Actions 38602349860](https://github.com/CipherCuttle/binrat/actions/runs/38602349860), first attempt, event `push`, exact execution SHA `ea6924193820618998a1b8f40821602476b3382c`. Job **SUCCESS**; offline validation, one V2 live cohort step and artifact upload each **SUCCESS**. This is the **only** authorized V2 execution and is **TERMINAL**; no reruns, continuation or widened window.

**Outcome:** `COMPLETE`, `stage=COMPLETE`, `error=null`. **Ten selected and independently funding-verified recipients; zero of ten launched via the pinned Pons V2 factory's `TokenLaunched` event in 10 minutes; zero of ten in 60 minutes.** Verdict from the frozen auditor: `DEFER_FUNDER_PRELAUNCH_STRATEGY`. This is a provider-bounded historical result for **this funder and selected period**, **not** a finding that funder watching never works or that no launch occurred later.

### Evidence integrity and adversarial reinspection

- Exact **84 / 144 RPC attempts**: 84 `COMPLETE`, 0 failed, 0 pending, no retried calls. Raw request-method counts: 55 `eth_getBlockByNumber`, 15 `eth_getLogs`, 10 `eth_getTransactionReceipt`, 2 `alchemy_getAssetTransfers`, 1 `eth_chainId`, 1 `eth_getCode`.
- The first two five-record ascending transfer pages yielded exactly 10 distinct non-self recipients. **Source enumeration did not end** (`pageEnded=false`, `CAPPED_ASCENDING_PREFIX`); there is no claim of full source-history coverage or an independently randomized sample. Selection was sealed at call sequence **7**, before canonical funding checks and all future-event queries.
- Offline reinspection of the actual GitHub Actions ZIP `binrat-funder-cohort10-v2-20261014` verified **all 6 SHA256SUMS entries**, the exact artifact ZIP digest, all **ten original full-block transaction memberships** matched with corresponding successful receipts, correct funding sender/recipient/value/chain/index and block hashes, and the **15 actual raw event-log RPC responses were all `[]`**.
- The fifteen topic-filtered factory log queries used the exact 10-address OR filter on indexed `deployer`, and covered **61,440 contiguous blocks** 81,505,115–81,566,554 inclusive, strictly after the earliest funding block. Both the endpoint-header checks and the auditor's canonical coverage receipts succeeded. Latest selected funding timestamp **1791279492** and final scan-bound timestamp **1791283198**: the endpoint is **3,706 seconds** after the latest funding, beyond its 60-minute maturity bound.
- Previously checked one-recipient case `0xef8cbc4444d505b32198061884cf902e9307fd59` was included as the first selected recipient. Do not count all 10 as an independent holdout.
- The selected funder was chosen because of earlier historical examples. Zero positives here provides **no evidence of predictive lift** relative to other funders; the existing deterministic `SAME FUNDING SOURCE` Case reader remains the baseline. No Graph Sniffer/NetworkX or AI framework has been promoted.
- Verified ZIP artifact digest `sha256:439ca66b893d2155c9256dc3d72e5757cb1a5da18b9184777dd7a0e94c9778d6`; `raw-receipts.json` SHA256 `241396c7ef427d910994e67395e1c054096a296681ea9cefd2e159f417de1edb`; `audit.json` SHA256 `533650dc036610623fe6877e28932621e3945442221bffce1a138398828c6c06`; `summary.json` SHA256 `b2620ffa35c651ffe86f9bd2d603ff1a3c1f8e9a3d76d51aed657ed8657cd172`. Original evidence artifact [GitHub artifact 11913573636](https://github.com/CipherCuttle/binrat/actions/runs/38602349860/artifacts/11913573636) retained by Actions (30-day retention). The ZIP contains provider receipts and must not be used as proof of independently validated chain consensus.
- No production changes, token actions, trades, Telegram alerts or merges. No new paid plan or API key. Latest observed Alchemy monthly usage summary was **$0.93 used of $10, $9.07 remaining** (snapshot 2026-10-14 17:03 UTC); this is an aggregate balance and **not** a per-run billing receipt.

### Frozen decision / next product action

`FUNDER_COHORT_V2 = CLOSED_NEGATIVE_0_OF_10`. **DEFER** this single-funder 10/60-minute prelaunch-alert strategy; do not repeat or extend this source's run, install a new graph engine, or reframe funding events as imminent-launch alpha. The incremental product value over deterministic Case reading is **not demonstrated**.

Reprioritize BINRAT's customer-facing **persistent WATCH / Tripwire ownership loop** with receipts, bounded jobs, observable delivery and cancel/reopen, rather than another ad hoc wallet scan. Any future funder analysis would require a different independent research hypothesis, prospective samples and an explicit customer-value baseline. This experiment itself is terminal. No production activation authority is granted by this decision.
