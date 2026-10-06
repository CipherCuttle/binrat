# Exact Pons launch authority — frozen implementation contract

## Scope and current state

Chain 4663, Pons V2, native ETH pair, **PonsVault Staking required**. Creator tax 0%, opening buy 0 ETH, native buyback OFF; no presale, discount or hidden team inventory. Working Rat is PLANNED and production entitlement is false. The Staking vault is created and verified by the launch transaction; entitlement activation is a separate later transition. No new launch rail, economics, chain, presentation work, Sniffer, Comms, Den, Genesis or referrals.

The composed candidate includes #115/#116 and the sibling #117/#118 deltas. Original evidence snapshots remain historical, including `docs/fixtures/PONS_PREFLIGHT_V1_CURRENT.json`: its filename does not make it current authority. The new diagnostic and readiness receipts are blocked. Green tests do not grant owner or legal authority.

## Artifact and trust boundary

1. **Semantic manifest:** canonical JSON/SHA-256 binds wallet/account assumption, all reviewed contract code/controllers, bindings, verified read-plan digest, metadata, complete ten-field economics and digest, configuration including anti-snipe terms, fixed policies, allocation declarations, Staking creation/configuration/lock rule, distinct assets, recipient/deployer roles, proven prediction derivations and postconditions. Gas, wallet nonce and fee-market parameters belong to the envelope.
2. **Final unsigned envelope:** exact chain/from/nonce/to/calldata/value/gas/EIP-1559 fees, approved maximum fee cost and expiry. Value equals the verified current launch fee, with no opening buy. Any payload change after approval requires explicit re-arm. Signing is external; `bindSignedEnvelope` attaches already signed bytes and their local transaction hash to the authorized envelope digest. Signature attachments never change the authorized unsigned digest.
3. **Behavior and risk:** every critical behavior requires independently reproducible evidence, a content digest and reproduction instructions. Per-contract source inventory distinguishes matched, unavailable and available/unmatched source. If authoritative source is obtainable, match it before arming. Unavailable source alone can be a bounded residual risk after verified behavior. Only source unavailability, shared-beacon upgrades, disclosed controller powers and lack of completed third-party audit are acceptable residual categories. The frozen Staking rail requires disclosure of its shared upgrades, controller powers and lack of a completed third-party audit; unavailable source adds its own category. Unknown calldata/value, ownership, creation/binding, economics, funds flow, roles, assets, payout/lock, principal safety or post-launch authority cannot be waived.
4. **Approvals:** EIP-191 signatures are verified; this code does not create owner or counsel signatures. Each artifact binds the exact manifest, relevant envelope, scope, conditions digest, references and validity. Owner arm approval binds legal/risk/behavior review, budget, exact rehearsal and phase-gate digests. The owner confirms wallet quiescence. Trusted private approval-state storage must reject missing, revoked or unmet approvals, and maintain one active envelope per chain/wallet. Re-arm replaces that active digest and invalidates the old envelope. No generic GRANTED owner boolean authorizes launch.
5. **Legal privacy:** the private integration provides opaque artifact ID, digest, exact manifest, scope, conditions, validity/revocation. Counsel identity and privileged memo text are unnecessary in public facts. Legal execution and publication scopes remain distinct, fail-closed dependencies. Engineering validates the interface, not legal classification.

The mandatory authority inventory includes factory, launcher, registry, Staking factory/beacon/implementation, launch deployer, meme hook, fee escrow, locker and graduation executor. Any ERC20 representation in the asset fields also requires its contract authority/codehash. Fresh reads cover these bindings and controllers; unavailable getters or incompatible ABI/layouts block pending verified evidence. This inventory is a required baseline, not permission to omit another dependency discovered in the exact deployed path.

## Phases

`DRAFT → PREFLIGHTED → ARMED → BROADCAST → CONFIRMED → VERIFIED → PUBLIC`

Gate IDs are preserved. `requiredAt` defines phases; the old `blocksLaunchAuthorization` is only a PRE-ARM compatibility projection. Runtime phase receipts bind the exact manifest/envelope and evidence digests. Transition evaluation also requires the corresponding mechanical/approval proof; arbitrary SATISFIED JSON is insufficient.

- PRE-PREFLIGHT: coherent upstream mechanics, semantic inputs, freshness and exact no-broadcast simulation.
- PRE-ARM: exact owner/legal/risk approvals plus reviewed mechanical, product-status and allocation declarations. **No future transaction receipt.**
- PRE-BROADCAST: freshly matching critical state, active exact envelope, current scoped approvals, unused durable journal.
- POST-BROADCAST: canonical successful exact transaction, allocation and creation verification.
- PRE-PUBLIC: finalized verification, consistent canonical facts, legal and owner publication approval bound to those facts.
- POST-LAUNCH: Working Rat principal binding, threshold and actual capacity activation. Production remains FREE throughout this sprint.

Pre-send ambiguity aborts. A possible send or confirmed mismatch enters ABORT/RECONCILE and cannot become VERIFIED/PUBLIC.

## Freshness, providers and wallet quiescence

`deriveFreshnessBudget` takes measured block intervals, RPC latency, signing-workflow duration, critical read batches, runtime age limit and upstream mutation notice. It derives an observed workflow horizon, capped by runtime/timelock limits, and rejects an infeasible budget. There is no 30-second default. Measurements and the result are owner-approved through the exact arm references. Untimelocked upstream mutation remains a disclosed controller power; freshness never guarantees future immutability.

Primary reads use one approved pinned block and canonical hash rechecks. A separately backed provider must agree when serving that exact state. If it cannot serve that block/hash, it is UNAVAILABLE. Different critical results at the same block/hash block. UNAVAILABLE needs a reviewed reproducible fork/trace artifact bound to the precise observations, not a bare digest or an independence claim.

Immediately before signing, use `preSendRevalidation`; before sending, the journal invokes it again with newly collected reads. Verify chain/head/hash, caller and wallet canLaunch, enabled config, economics, graph, code/controllers, wallet code/type, nonce and balance covering value plus maximum fee cost. Wallet nonce or pending nonce drift aborts: never choose another nonce. No unrelated transaction is permitted from the wallet while armed. This operational exclusivity is required in the signed owner approval and active-envelope registry; code cannot prevent another wallet application from violating it, so nonce/code/balance guards are mandatory.

The Staking factory's CREATE nonce is different. Its predicted vault is PROVISIONAL. Neither calldata nor roles nor downstream permission/entitlement/accounting may depend on that literal address. Freeze factory/path/token binding/assets/configuration/controllers instead. Token and curve predictions are immutable only with independent deterministic derivation proof; state-dependent predictions must be provisional too.

## Rehearsal, journal and verification

The exact rehearsal binds the complete envelope, fresh snapshot and reproducible trace to one pinned block. It requires successful eth_call with the actual wallet/value/gas/fees/nonce, no state overrides, correct token/vault return decoding and full observed creation postconditions: factory/path, token binding, beacon/implementation, roles, distinct assets, payout/lock, metadata and economics/configuration. The reviewed V1 ABI encodes one uint256 payout threshold; bytes must match that declared value exactly. A different configuration layout requires verified source/ABI evidence and cannot pass this encoder. UI ABI, canary calls, RWA history and synthetic fixtures cannot supply launch approval. Payout floor is verified contract behavior, never the UI's suggested 0.1 ETH floor.

The send journal captures reviewed inputs, trusted identities/callbacks, exact signed bytes and the sender callback before awaiting other work. It checks the signed bytes against the authorized envelope and recovered sender, durably stores signed bytes/hash and SEND_INTENT under an exclusive chain/wallet/nonce filename, and fsyncs file and directory. After persistence it revalidates fresh state, repeats the exact pinned eth_call, rereads latest/pending wallet nonce, balance and code, and checks expiry/freshness against its own clock after all awaits. Only then can one retry-free transport invocation occur. SEND_INTENT means a send **may** have occurred; a crash or pre-send abort does not prove submission. Never delete the intent, retry, bump fees, replace the transaction or select a new nonce automatically. Reconciliation queries the known hash. NOT_FOUND or a timeout does not authorize another send.

Verification checks the exact successful transaction, canonical block/finality, launcher/factory events, actual factory creation trace, token/curve/vault bindings and code, controllers, metadata/supply, tax/buyback, roles, assets, payout/lock, frozen economics/configuration and every postcondition. Upstream code, controllers and graph bindings must match at both the launch block and the observed finalized block. Initial supply must be evidenced in that transaction's logs; later public trades in the same block are not an opening buy. A nonce-advanced vault may pass only with identical creation semantics. Semantic mismatch or RPC uncertainty returns ABORT_RECONCILE, never VERIFIED. Confirmation and verification handles cannot be manufactured by deserializing status JSON.

## Canonical facts and Codex 1 boundary

`verified execution → canonical launch-facts JSON + digest`

Use `generateLaunchFacts` only with a fresh issued verifier result; `persistLaunchFacts` writes once and rejects a conflicting overwrite. Public facts include chain/token/curve/actual vault, transaction/block/hash, factory, role/economic/configuration authority, tax/buyback/opening buy, manifest/verification/risk digests, and verified launch state. `assets` contains distinct `pairQuoteAsset`, `vaultQuoteAsset`, `feeAccountingAsset`, `rewardAccountingAsset`, `claimAsset`, each with its own verified representation and evidence digest. Unknown is UNKNOWN in diagnostic evidence and blocks verified launch facts for these critical fields. Never infer WETH from website prose.

**DEPENDENCY FOR CODEX 1:** expose/consume this artifact and digest across web, Telegram, X and CASE:$BINRAT; map each asset field literally, show Staking separately from Working Rat PLANNED/entitlement false, use actual verified addresses only, and disclose the specifically accepted upstream risks. C2 implements no public route and no manual address-copy workflow. Presentation smoke receipts must bind the same final manifest/facts. Publication still requires its scoped approvals.

## Operator commands and remaining inputs

- `pnpm verify:pons-launch-authority`: blocked readiness inspection; no RPC required.
- `pnpm verify:pons-upstream-evidence`: bounded read-only diagnostic; never an arm receipt.
- `pnpm exec tsx scripts/pons-launch-authority.ts collect|rehearse bundle.json`: approved primary archive URL through `BINRAT_ROBINHOOD_ARCHIVE_RPC_URL`; separately backed confirmation URL through `BINRAT_ROBINHOOD_CONFIRMATION_RPC_URL` when available. Supply reviewed provider IDs/backing IDs, exact manifest/envelope/read plan/budget, and applicable behavior/trace/corroboration artifacts.
- `pnpm exec tsx scripts/pons-launch-authority.ts verify bundle.json [local-facts-path]`: later verification of an already authorized execution using signed envelope, deployment proof/review and trusted private approval registry. Emits no publication authority. The registry must remain private and owned by the operator; missing or invalid entries fail closed.
- `pnpm recompute:pons-launch-authority`: regenerate blocked planning projections and schemas; preserves historical execution evidence. Never grants authority or inserts owner values.

For reproducible rehearsal, first collect the authority snapshot, produce the independently reviewed trace at that exact state, then provide `pinnedBlock: {number, hash}` in the rehearsal bundle. Collection rechecks that canonical block instead of silently selecting a new one; the resolved time/block freshness budget still applies. Final pre-send collection selects the current head and must never reuse the rehearsal snapshot as fresh evidence.

Remaining owner inputs: exact exclusively operated wallet/funding, metadata, allocation declarations, verified payout/lock choice if supported, acceptance of fresh existing economics/controller powers, bounded risk declaration, measured freshness policy, exact envelope fee/expiry authorization, and later scoped publication approval. Working Rat threshold and unconditional treasury input are deferred. Legal approval and trace/source/runtime evidence remain external prerequisites.

## Bounded acceptance and stop

Five acceptance groups in `test/ponsLaunchAuthority.test.ts`: phase/legal/product separation; fresh reads/provider semantics; exact manifest/envelope/rehearsal; quiescence/single-send/recovery; factory nonce race/verifier/facts. Fixtures and ephemeral signatures are TEST ONLY and never deployed evidence.

After implementation: existing required CI, one bounded hostile review, Critical/High repairs, one targeted rereview, STOP. No live arm, real signing, broadcast, deployment or publication is performed by this sprint.

Closure is recorded in `BINRAT_PONS_LAUNCH_REVIEW_V1.json` and `BINRAT_PONS_LAUNCH_SPRINT_RECEIPT_V1.json`. The bounded review is a self-review, not an independent third-party audit. Its one Critical and three High findings were repaired and checked by one targeted rereview. Local checks do not substitute for future exact-head GitHub CI or the missing launch authority/evidence.
