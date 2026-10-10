# Pons Tripwire V1 — completion and owner review

The existing `feat/pons-tripwire-v1` worktree was resumed at production authority
`30564864f5d406414f0c09c4d2ba2be5d1e79ab8`. Its interrupted implementation was
preserved. This is a completed, default-off local candidate, not a live Telegram
delivery receipt. No production deployment, migration, configuration change,
RPC request, real Telegram message, transaction, or token operation occurred.

The draft PR targets `integration/binrat-a1-3-visual-gate`, whose existing head is
that exact authority. Targeting `main` would include hundreds of unrelated A1
files. The final commit SHA is recorded in the PR and final handoff; executable
source hashes are recorded in [verification.json](verification.json).

## Changes and reuse

| Files | Result |
| --- | --- |
| `src/cloudflare/ponsTripwire.ts` | Pons-only evidence validation, five durable deployer slots, latest-head consent boundary, bounded matching, durable notification admission and one-attempt delivery. |
| `src/cloudflare/ponsTripwireHttp.ts`, `worker.ts` | Signed Telegram Mini App owner authentication, Case-derived address, authenticated status/cancellation, bounded bot start payload and exact Case Mini App handoff. |
| `src/cloudflare/syncQueue.ts` | Dedicated default-off poll after a successful caught-up Pons publication; separate owner and delivery gates. |
| `cloudflare/migrations/20261010_pons_tripwire_v1.sql`, `schema.sql`, `d1Schema.ts` | Additive Pons watch/outbox/budget tables; pending notifications cancelled on launch deletion. No production application. |
| `web-v2/src/PonsCasePreview.tsx`, `PonsTripwireWatch.tsx`, `ponsTripwireClient.ts`, `pons-tripwire.css` | Approved V3 Case controls, explicit consent, authenticated save/reopen/cancel, stale and uncertain states. No dashboard. |
| `test/ponsTripwire*.test.ts`, `test/support/ponsTripwireFixture.ts`, captured fixture | Canonical captured launch replay and adversarial regressions. |
| `web-v2/checks/{serve-pons-tripwire-local.ts,pons-tripwire-browser.cjs}`, offline workflow | Compiled browser journey with local SQLite, simulated clock and mock Telegram; exact-head CI without production bindings. |

New code is the Pons adapter, its separate storage, the three HTTP actions and
Case controls. Reused code includes `D1Store`, runtime/publication authority,
canonical launch/event identity and provenance builders, `assertPrincipal`,
`verifyTelegramInitData`, `robinhoodWatchSource`, `D1SyncLeaseStore`,
`D1TelegramLedger`, and the existing text-card client/keyboard renderer. The
outbox uses the established atomic CAS, invariant-guard and UNKNOWN patterns.
Legacy Arc storage/matching and Den/workforce components were not repurposed.
The earlier implementation inventory is in
[REUSE_AND_PRODUCTION_EVIDENCE.md](REUSE_AND_PRODUCTION_EVIDENCE.md).

## Verification

Final executable source checks:

- `pnpm exec tsc --noEmit`: exit 0.
- Focused Tripwire/Worker/autonomous/read-only/legacy Watch suite: **60/60**, zero failures.
- `pnpm check`: **609/609**, zero failures; build and web invariants pass.
- `pnpm --dir web-v2 check`: evidence, visual, build and separation gates pass.
- `pnpm --dir web-v2 build:frontdoor-candidate`: compiled V3 package, 36 files.
- Native pinned Playwright 1.56.1 / Chromium 141: **19 assertions**, no page errors.
- Native pinned Wrangler 4.135.0 local workerd routing: **209 assertions**.
- `git diff --check`: exit 0.

[Browser assertion receipt](ui/browser-proof.json) records bundle hashes, actual
HTTP requests, watch persistence across SQLite reopen, and the single mock
notification. Viewports are 1440, 390, **320**, 430 and 1024 pixels, with no
horizontal overflow. Screenshots include [desktop saved Watch](ui/watch-saved-1440.png),
[390px saved Watch](ui/watch-saved-390.png), [320px saved Watch](ui/watch-saved-320.png),
[stale 320px controls](ui/watch-stale-320.png), [authentication rejection](ui/phone-auth-rejected.png),
and [exact Case return](ui/phone-case-return.png).

Browser tests cover unauthenticated Telegram handoff, forged-auth rejection by
the real local Worker, explicit consent, unavailable/malformed status, lost
mutation reply, durable reopen, historical suppression, later recurrence,
duplicate queue replay, exact returned evidence and durable cancellation.
Backend tests additionally cover wrong owner/chat/chain/source, stale/reorged
authority, pending cancellation, exhausted budgets and crash-after-send.

Both captured launch identities and digests are real production evidence. The
local consent/source timestamps and future scenario are explicitly simulated:
these launches were already historical at capture. Browser text describes
their real indexed identities; screenshots are local replay evidence, not a
production subscription or prediction. No captured canonical block timestamps
exist. [Local routing proof](local-routing.json) verifies the real handler and
compiled SPA routing with all IO disabled; provider routing for a future
candidate remains unverified. CI results, when available, belong to the PR's
exact head and must not be inferred from these local results.

## One hostile review and one targeted rereview

The single review covered the requested attack surfaces. Three High findings
were fixed before the targeted rereview:

| Finding | Fix and regression |
| --- | --- |
| H1: `/start pons_…` could send a Case handoff with delivery disabled. | Handoff now requires the separate delivery flag before any ledger/transport work. Default-off regression asserts zero sends and zero receipts. |
| H2: Queue polls lacked the configured owner gate, allowing old-owner subscriptions to continue after rotation. | Missing/malformed owner fails before source/DB work; matching and pending selection bind both owner and private chat. Regression covers missing owner, rotation, existing pending work, wrong chat and disabled delivery. |
| H3: Opt-in lease expiry used a time captured before awaited RPC verification. | SQL admission now reads the current clock after verification and checks the exact unexpired lease token. Slow-source regressions cover expiry alone and cancellation winning after expiry. |

Targeted rereview inspected those gates, the authenticated call path and atomic
send admission. All 60 focused assertions and the final compiled browser run
pass. No unresolved Critical/High finding remains in the bounded local candidate.
No further review cycle was started.

| Attack surface | Evidence / assessment |
| --- | --- |
| Auth bypass, cross-user access | Existing HMAC verifier with 300-second expiry; exact owner gate; no client address/chat authority; owner-bound reads and cancellation. Forged, expired, different-owner and oversized inputs fail closed. |
| Historical leakage, same address on wrong chain/source | Latest canonical source head plus block time after consent; canonical 4663/PONS_V2/factory and reported-deployer provenance checks. Indexing time grants no chronology authority. |
| Cancellation and in-flight races | Owner mutation lease and fresh fence; cancellation invalidates PENDING work; atomic ACTIVE check at SENDING admission. Already admitted transport may arrive after cancellation, now disclosed in UI. REORG watches can be durably cancelled. |
| Duplicate delivery, queue replay, crash after send | Unique owner/event admission, generation binding, CAS and durable quota transaction; one transport attempt; SENDING recovery becomes UNKNOWN, never retried. Actual injected failure after successful mock send is covered. |
| Reorg and stale checkpoint | Fresh runtime/publication binding, source checkpoint/start/event hashes, tip recheck and launch-deletion trigger. Reorg/stale evidence cannot authorize new transport. A reorg after send cannot recall an already delivered message. |
| Cost/work exhaustion | Five total slots including cancelled watches, 20 candidates/cycle, five pending notifications, five daily attempts, ten-minute per-watch interval, 30-second work checks. Source RPC uses existing 8-second timeout/no retries; an in-progress bounded call may finish after the work threshold. |
| Production guard/Arc activation | Read-only guard retains all legacy suppression, with only explicitly enabled Tripwire routes/poll allowed. Scanner performs no Tripwire RPC itself. Default flags and production config are unchanged. |
| Case links / synthetic truth | Full 32-byte start payload round-trips; original launch identity supplies saved watch handle; new canonical launch identity supplies notification link. Browser resolves the exact return Case and receipts. Fixture provenance is explicit. |
| Migration/backward compatibility | Additive idempotent SQLite migration applies twice over prior schema; legacy launch row remains byte-equivalent; existing deployer range index is used. Native production D1 migration is not applied or claimed verified. |

## Production compatibility, prerequisites and disable path

Last captured authority is Worker **106**, version
`28ebc65b-bb14-4862-b677-cbe74b6aad2b`, SHA `30564864f5d406414f0c09c4d2ba2be5d1e79ab8`,
with `BINRAT_PONS_READ_ONLY=true` and legacy autonomous/public flags false.
The previous capture is a timestamped receipt, not a claim that configuration
cannot have changed. This continuation made no production requests or writes.

Before any live owner pilot, separately authorize and verify all of:

1. Review this draft and its exact commit. Re-read active Worker/asset identity,
   guard flags and two consecutive healthy Pons snapshots before a release.
2. Apply only the additive migration to the intended candidate D1 under separate
   authorization; verify the existing launch/provenance numeric index.
3. Release the reviewed Worker and compiled V3 assets to the intended candidate
   under separate authorization. Preserve `BINRAT_PONS_READ_ONLY=true`; route
   `/api/*` and `/telegram/*` through the Worker.
4. Configure `BINRAT_PONS_TRIPWIRE_ALLOWED_USER_ID` to the owner's positive safe
   Telegram integer ID. Configure the existing bot token, valid webhook secret
   (including rotation if used), webhook routing and a bounded Pons 4663 RPC.
5. Explicitly authorize `BINRAT_PONS_TRIPWIRE_ENABLED=true`. Watches and prepared
   notifications may persist with delivery disabled. Legacy Arc Watch,
   autonomous Rat/public, A2 outcome, funding and other consumers stay off.
6. Separately authorize `BINRAT_PONS_TRIPWIRE_DELIVERY_ENABLED=true` for any real
   Telegram message, including the Case authentication handoff. None is sent by
   this work. Verify the supported inline Mini App flow in the owner's private
   bot chat: website → bounded `/start` → exact `web_app` Case → signed initData →
   explicit checkbox → saved Watch. Reopen the Mini App when credentials expire.
7. Verify live canonical block timestamps, future recurrence and actual delivery
   under a separately approved bounded pilot. Local mock evidence cannot satisfy
   that live delivery gate. Do not switch owner IDs while old watches are active.

The authentication mechanism follows Telegram's documented
[inline Mini App and signed initData flow](https://core.telegram.org/bots/webapps).
The ordinary browser receives no fabricated authentication or saved-state
success. The currently deployed public web cannot provide this default-off
candidate journey until the separately authorized release/handoff is available.

Disable delivery first by setting `BINRAT_PONS_TRIPWIRE_DELIVERY_ENABLED=false`;
this stops new handoffs and recurrence transports. Cancel watches through the
authenticated Case controls before closing the pilot if desired. Then set
`BINRAT_PONS_TRIPWIRE_ENABLED=false` to suppress routes, scheduling and replayed
Tripwire queue polls. Already sending messages cannot be recalled. Leave the
additive tables intact; no destructive rollback is needed. Re-enabling delivery
can release still-valid PENDING work, so cancel unwanted watches first. If a
release rollback is separately authorized, use the recorded Worker 106 and
matching asset authority; never disable the Pons read-only guard as a rollback.

All PASS values below refer to the verified local candidate. Live activation,
public Telegram authentication and real delivery remain pending prerequisites.

```text
PONS_TRIPWIRE_VERTICAL = PASS
PERSISTENT_WATCH = PASS
FUTURE_ONLY_MATCHING = PASS
AUTHENTICATION = PASS
DELIVERY_SAFETY = PASS
CASE_RETURN = PASS
PRODUCTION_ISOLATION = PASS
OWNER_PILOT_READY = NO
```
