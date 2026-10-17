# BINRAT portable positive-event Tripwire V1 — OFFLINE CANDIDATE

**Status:** DORMANT / OFFLINE-TESTED ONLY. **Not a live Watch, source-qualified verifier, Telegram alert, production collector, deployment or DNS cutover.** Prepared 2026-10-17.

## Authority and source

Base is the **incomplete remote handoff** `handoff/tripwire-portable-source-20261015` from the founder's migration worktree. The authoritative local worktree `/home/swirky/DevHub/worktrees/binrat-survival-v1` and reported local commit `a269d8272ec93e41b00ebfcf6c528074a2c4c898` remain inaccessible from GitHub. Do **not** merge or cherry-pick blindly into `main` or the local migration branch; reconcile WIP first.

The existing `src/portable/liveSourceV2.ts` polls every 60 seconds and is economically incompatible with the founder's retained 100/day shared BINRAT forward-ledger ceiling. Its old canary, 180-second grant, V3/V4/V5 evidence and the separate `pons-paper.service` remain unchanged.

## Concrete implementation

- `src/portable/persistentTripwireBudget.ts`: fixed *model* of 11 setup/teardown request slots, six per candidate proof, 100/day **across** already-used BINRAT slots; up to 12 candidate jobs, 10,000 modeled CU and $0.01 modeled cap per future grant. Model includes 2,949.12 CU reserved stream envelope plus 860 setup CU and 400 per candidate (13 previously spent + 11 + 6x12 = 96; 3,809.12 + 400x12 = 8,609.12 modeled CU). **Models are not actual provider invoices or permission to spend.**
- `src/portable/persistentTripwireWatch.ts`: inert SQLite hint journal with immutable grant scope (one owner/deployer/chain/consent boundary, max 24 hours), exact factory and provided topic-0 + indexed deployer filter, idempotent tx/log event identities, removed/reorg/drift invalidation, 32-hint bound, 12-candidate cap and fail-closed crash recovery. Its `reserveProof` consumes six *upfront* slots in an injected **existing shared ForwardBudgetLedger**. If a reservation partially fails or crashes, the row becomes UNKNOWN and already consumed debits are retained. It does **not** execute any RPC: no byte accounting or payment can arise from this module itself.
- `test/portablePersistentTripwireWatch.test.ts`: real disposable in-memory SQLite engine with a fake existing ledger; 14 tests: canonical source-pin rejection, quiet 24h, exact hint, duplicates, unrelated/old hints, removed/reorg, crash, partial budget, scope drift, expiry and cap.
- `.github/workflows/binrat-positive-event-offline.yml`: scoped offline-only runner. No GitHub secret, network provider call, deploy, RPC or Telegram messaging.

## Critical boundaries

A reported hint is **UNVERIFIED**, regardless of subscription health. `PROOF_SLOTS_RESERVED` means only that request-budget slots were debited; it does not mean a candidate was canonically verified, persisted as a Case, published, or eligible for notification. Quiet, disconnected, late and missing periods are **UNKNOWN**. No periodic catch-up or absence claims.

The grant's `tokenLaunchedTopic0` is now **checked** against `toEventSelector(ponsTokenLaunchedEvent)` from the existing canonical ABI, and the accepted factory, chain and expected factory-code-hash are exported from `src/pons/chain.ts`. This binds the **offline admission** to the canonical Pons identity, but is **not** on-chain verification: future live integration MUST independently query factory code and verify its hash, exact receipt-root proof, block finality/reorg stability, complete log-set equality, consent and replay. The existing `src/portable/forwardSource.ts` and `src/portable/forwardReceiptRoot.ts` are donors, not yet wired here. A real RPC transport requires separate cost byte accounting and reservation-consumption semantics: **do not reserve the same physical requests a second time or send against untrusted reserved slots**.

The scope boolean `setupBoundOutsideThisModule` records only a caller assertion. It is **not** a secure, separately issued live grant or proof that the initial 11 requests/CU were reserved. Before any live use, the owner-approved grant admission must be durable, replay-resistant, byte/CU/USD capped, tied to original owner/watch and the exact shared ledger, and reconciled across UTC boundaries, reconnects and process crashes.

Not implemented: WebSocket subscription, hint subscription authentication, source adapter, canonical proof, SQLite Case materialization, owner principal/watch API, alerts/outbox, lifecycle service, offsite backup, VM production acceptance, Rat Zero global launch ingestion and public cutover.

## Offline acceptance

With Node 22.16 / TypeScript 5.8 installed:

```sh
tsc --module NodeNext --moduleResolution NodeNext --target ES2022 --outDir dist --rootDir . --strict --types node --skipLibCheck --noEmitOnError false src/portable/persistentTripwireBudget.ts src/portable/persistentTripwireWatch.ts test/portablePersistentTripwireWatch.test.ts
node --experimental-sqlite --test dist/test/portablePersistentTripwireWatch.test.js
```

This typechecks just the three files in an isolated compilation environment. The branch snapshot is **not** the complete tested local migration and a full repository `pnpm check` need not pass. CI uses the pinned existing `tsx` and Node experimental SQLite feature to execute these tests without invoking the runtime.

**Next** after one bounded hostile review and any Critical/High targeted correction: reconcile exact local source and WIP. Only then implement canonical proof adapter and run one founder-authorized, cost-bounded positive-event canary. No merge/deploy/RPC/Telegram/token transactions authorized here.
