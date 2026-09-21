# Launch Mechanics V0 Hostile Review

Review date: `2026-09-21`
Scope: launcher freshness, deployment binding, proxy/admin authority, liquidity claims, source matching, fee routing, allocation, creator first buy, wallet-cap semantics, mutable configuration, receipt integrity, and launch-status escalation.

Exactly one hostile review was performed. Critical/High fixes triggered one targeted rereview.

## Findings and disposition

### Critical

1. **Sample authority addresses were not bound exactly.** Early draft receipt entries expanded abbreviated research notes into syntactically valid but incorrect MoonCat creator/pool and TITCOIN/EMPTYOT pool addresses. This could have made the receipt point at unrelated contracts despite passing address-format validation.
   - Fixed by re-reading each launch receipt's transaction sender and Uniswap V3 `PoolCreated` log, replacing all inferred values with the exact emitted addresses, and correcting the MoonCat creator-buy raw output from the token transfer log.
   - Added `scripts/verify-launch-mechanics-rpc.ts` to bind all three transaction senders, token and pool addresses, blocks, position IDs, position custody, and total supplies to current RPC evidence.

### High

1. **Old doctrine overclaimed a permanent lock.** It did not separate non-withdrawal from perpetual existence or perpetual in-range activity.
   - Fixed in the receipt, doctrine, and roadmap. The bounded position can become out of range and economically inactive.
2. **ArcPad launcher-owner fee authority was omitted.** The locker permits the current launcher owner to redirect future creator quote-fee accrual.
   - Fixed as an explicit external trust dependency and owner-visible risk.
3. **Platform fee wording did not match contract behavior.** The creator receives half of quote-side fees; launch-token-side fees go to the dead address.
   - Fixed with two observed fee-collection transactions and exact routing language.
4. **Platform wallet-cap timing was misleading.** The application said approximately two minutes; the deployed token enforced exactly 1,200 blocks, observed at about ten minutes.
   - Fixed as a block-based per-recipient cap with explicit multi-wallet bypass and no Sybil-resistance claim.
5. **Creator first-buy privilege could be mistaken for ordinary later market access.** It can execute in the launch transaction before third parties can order a transaction after it.
   - Fixed with exact same-transaction semantics and an unresolved owner decision.
6. **“Full supply in liquidity” was too absolute.** No-dev-buy samples left `326357976` raw token units at the launcher.
   - Fixed with raw-unit accounting and a qualified allocation disclosure.
7. **ArcPad source could be mistaken for verified source.** Explorer source was unverified and embedded compiler metadata could not be retrieved as a bytecode-matched source package.
   - Fixed by keeping ArcPad contract conclusions `ON_CHAIN_VERIFIED` or `PLATFORM_CLAIM`; only the official Uniswap deployment binding is `SOURCE_VERIFIED`.

### Medium

1. ArcPad may change the application router or replace a launcher before BINRAT acts. The receipt is dated and requires a pre-authorization refresh.
2. Historical transaction lookups from the public Arc RPC are intermittently load-balanced across nodes with different receipt availability. The read-only verifier retries boundedly and fails if evidence remains unavailable.
3. The alternative holder-rewards product mode was visible but was not independently reconstructed. It is excluded from the candidate standard-mode receipt.

### Low

1. The launcher's banned-name configuration is mutable by its owner. This affects launch acceptance, not token economics after creation, and is recorded in administration findings.

## Targeted rereview

The single targeted rereview ran after all Critical/High corrections.

`pnpm verify:launch-mechanics:rpc` returned `PASS` at `2026-09-21T00:29:59.921Z` and bound:

- chain ID `5042`;
- five runtime bytecode authorities and hashes;
- three authority creation transactions;
- three launch transactions, senders, blocks, emitted pools/tokens, position IDs, locker custody, and total supplies;
- the official Uniswap deployment manifest at repository commit `37936185dee7decf681360ec799c124e0e034672`;
- receipt digest `aff37d6d82cced00a34284453c0327bb51e5624b5761b621264f55602e8245e6`.

No Critical or High finding remained after the targeted rereview. Medium and Low findings are retained as explicit qualifications and do not authorize launch.
