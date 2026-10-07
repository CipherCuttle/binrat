# BINRAT public truth candidate — execution and acceptance

## Candidate and boundaries

Branch: `integration/binrat-public-truth-launch-v1`.
Base: PR #122 `fa23aa77b8c0cf15ca5f3e0f5d5f5638f1da9cd1`.
Worktree: `/home/swirky/binrat-public-truth-launch-v1`.

C1 owns public evidence integrity, deterministic presentation, the existing Pons
frontdoor, Telegram terminology and local acceptance. C2 owns the canonical
capability/launch plan/gate documents, Pons authority, wallet roles, economics,
exact launch manifest, vault authority and all post-broadcast facts. Imported C2
documents are byte-for-byte inputs; see `C1_C2_PUBLIC_INPUT_RECONCILIATION_V1.md`.
`src/launchConfig/walletPresentation.ts` is untouched in the original checkout.
No staking threshold or entitlement activation is required for C1.

Working Rat selection: PLANNED post-launch; production entitlement inactive.
PonsVault Staking may exist at token launch without public Working Rat entitlement.
The public projector has no transaction, employment, gate or activation authority.

## Ordered changesets and ownership

| Order | Owner | Files / responsibility |
|---|---|---|
| CS01 | C1 | `test/readPlane.test.mjs`, `test/publicReadPlaneStability.test.ts`: nine defects reproduced before fixes; regression receipt retained. |
| CS02 | C1 | `src/cloudflare/publicSnapshot.ts`, `web/snapshot-contract.js`, `web/data-source.js`, `web/read-plane.js`: canonical material, full binding, fail-closed publication conflicts, retained stale evidence, expiry while hidden. |
| CS03 | C1 | `src/cloudflare/publicCaseReadModel.ts`, bounded Worker routes, `src/public/releaseIdentity.ts`, `scripts/build-public-release.mjs`, `scripts/diagnose-public-runtime.mjs`, candidate packaging workflow: routing, bounded Case reads, source/artifact/revision identity. |
| C2 facts | C2 input | Canonical capability manifest, Pons launch plan, Pons gate matrix at `ccc677985ce07f438648a2499611e72c36729491`; owner-confirmed Working Rat selection. No C1 edits to their values. |
| CS04 | C1 | `src/public/productProjection.ts`, `src/public/snapshotContract.ts`, Worker capabilities/funding: one deterministic projection; unsupported state becomes UNVERIFIED. |
| CS05 | C1 | Existing `web/index.html`, `frontdoor.js`, `frontdoor.css`, `app.js`, `product-contract.js`, share/read adapters: #122 frontdoor, current journey, future workforce boundary, derived crew stages. |
| CS06 | C1 | `src/telegram/rat.ts`, `voice.ts`, `config.ts`, `ui/cards.ts`, Mini App copy: bounded API consumers, shared statuses, existing access/media/deep-link contracts. |
| CS07 | C1 | `scripts/lib/public-acceptance.mjs`, `verify-public-release.mjs`, browser fixture generator/checks, `.github/workflows/ci.yml`, acceptance tests and receipts. |
| Review | C1 | One hostile review, Critical/High fixes, one targeted rereview, STOP. |

## Exact public stage sources

| Public stage | Canonical evidence / rule |
|---|---|
| RAT ZERO · SCOUT · LIVE | Validated `binrat_public_snapshots` canonical material plus `/api/status` matching chain 4663, checkpoint, checkpoint hash and feed digest. Snapshot availability and runtime freshness are separate. |
| TRIPWIRE · WATCHER · BUILDING | `capabilities.ratWatchV0.engineeringStatus === ENGINEERING_PASS`. No durable workforce admission or employment action is inferred. |
| SNIFFER · TRAIL HUNTER · PROVING | Existing pinned audit bytes SHA-256 `3f242a4e230fe911c57256768d273496956b5d0114040c5346e65338e838ba5b`; recomputed handoff digest; funding matches handoff; exhausted terminal result with null finding/Case diff/notification. No predictive claim. |
| WORKING RAT · PLANNED · POST-LAUNCH | Owner-confirmed frozen C2 selection plus `currentPonsLaunchConfiguration.chainId`, scope, `currentLaunchPlan.chainId`, `holderGateV0.productionHolderEligibilityActive === false`, `walletAuthStatus === DISABLED_BY_DEFAULT`. Contradictory Working Rat fields revoke this projection. |
| DEN · PLANNED · POST-LAUNCH | `ratDenV0.engineeringStatus === PLANNED`, `phase === POST_LAUNCH`, `publicStatus === NOT_PUBLIC_LIVE_AUTHORIZED`. |
| ????? ×2 · LOCKED | Undisclosed/unavailable slots in the frozen launch-facing mapping. No action. |

Current Pons Watch audience is established only by the existing enabled/private
runtime flags and a valid configured tester principal. Otherwise audience is
UNVERIFIED. The legacy `/watch` store's delivery cycle targets Arc: it cannot arm
a current Pons subscription. Its list/unwatch behavior remains, and the existing
gated Pons Watch path is preserved. This is separate from future Tripwire jobs.

Today's journey: DISCOVER → OPEN CASE → CHECK RECEIPTS.
Future workforce direction: FIND → EMPLOY → LEAVE → RETURN.
Roadmap: SNIFF → REMEMBER → WATCH → HUNT → ORGANIZE → AUTONOMOUS RAT.

## P0 gates

1. Full canonical snapshot digest verified before FRESH_VERIFIED. Both same-block
   hash conflicts and digest conflicts fail closed. No cached or pending newer
   status can lend freshness to older evidence. Retries preserve stale evidence.
2. Snapshot row metadata and embedded JSON agree; conditional SQL publication
   rejects conflicting concurrent writes and checkpoint regression.
3. `/api/status`: two bounded database reads; `/api/launches/latest`: one.
   Case: three bounded base reads, latest twenty existing same-deployer launches
   through the target; no invented history or added research. Deployer summary:
   existing latest-four verified contract. Intelligence/replay may additionally
   read existing per-Case observations, bounded by the verified checkpoint.
4. Unknown routes return before full projection. Historical Arc public Radar
   routes return 410 before any current index lookup. No current fallback to Arc.
5. Source SHA + source-file catalog digest → generated release/build ID → hashed
   packaged Worker → final deployed version → observed manifest digest and actual
   public responses. A dirty source catalog is useful locally but cannot pass
   production acceptance. SHA environment strings alone cannot establish this.
6. Current revision comes from Cloudflare's version metadata binding, with a
   separate read-only active-deployment readback. Candidate workflow sets secrets
   before the final upload; no later revision mutation is permitted.

[Version metadata binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/version-metadata/)
and [read-only schedule API](https://developers.cloudflare.com/api/resources/workers/subresources/scripts/subresources/schedules/methods/get/)
define the provider receipts. Their configuration changes are prepared locally;
no workflow or deployment was run in this implementation session.

## 1102 diagnostic and unresolved production gate

Bounded GET-only diagnostic reproduced `/api/status` HTTP 503 / Cloudflare 1102,
CF-Ray `a468221eefdc084f-ARN`, after approximately 6.05 seconds.
`/health` returned HTTP 200, release SHA
`53325fd0806765578ed6921428ad55f15a9728f1`, no new build identity.
Sampling stopped on the first nonretryable 1102. This does not prove all routes
are broken, nor distinguish CPU from memory exhaustion. The referenced old
source lacked the #121 status route and could enter full projection; public GETs
cannot prove that this is the actual active revision. Candidate routing tests
and packaging pass locally; live routing/revision/error receipts remain required.

Diagnostic receipt: `.artifacts/public-truth/site-runtime-diagnostic.json`.
Production acceptance currently UNVERIFIED. No deployment or Cloudflare changes
are authorized by this implementation instruction. No generic optimization work.

## Local checks

```sh
pnpm check
pnpm exec tsx scripts/create-public-browser-fixtures.ts
NODE_PATH=/path/to/pinned/playwright-1.56.1/node_modules CHROME_EXECUTABLE=/path/to/chrome node scripts/check-frontdoor-browser.cjs
NODE_PATH=/path/to/pinned/playwright-1.56.1/node_modules CHROME_EXECUTABLE=/path/to/chrome node scripts/check-read-plane-browser.cjs
```

CI uses pinned Playwright 1.56.1 and its installed Chromium. Local checks use
headless Chrome, capture page errors and requests, and make no remote writes.
Browser fixtures are generated through the actual Worker handlers against local
synthetic D1 data. Their receipts explicitly say synthetic; they are not a real
production launch, Telegram smoke or comprehension result.

Viewports: LIVE 390/430/1024/1440; separate synthetic fixture journey
320/360/390/430/768/1024/1440. Keyboard, Case/Crew/Den/back navigation, first-screen
CTAs, no horizontal overflow, stale retention, digest tampering, conflicting
binding, retry, hidden-tab expiry and unavailable state are checked.
Mini App unauthenticated entry remains a private preview. Existing Telegram
deep link `receipt_<32 hex>` is retained, within Telegram's existing payload
limit; no new URL scheme or share receipt semantics is introduced. Access gates,
callback principals and approved mood-art fallback tests remain in the suite.

## Production acceptance input and cadence

`node scripts/verify-public-release.mjs <acceptance-input.json>` performs bounded
public GETs only and writes `.artifacts/public-truth/production-acceptance.json`.
Missing inputs, a dirty build, a mismatched source/Worker/manifest, stale evidence,
nonretryable 1102 or missing human/channel checks return UNVERIFIED, exit 1.

Read-only provider access uses `CLOUDFLARE_ACCOUNT_ID` and a scoped
`CLOUDFLARE_API_TOKEN` in process memory. Missing access fails closed. The current
implementation environment has no such provider access. Active deployment is
read via GET both before and after publication observations, and final health
metadata is rebound; secret/config revisions cannot reuse an old identity.

Input fields:

- `origin`: explicit allowlisted production/candidate origin; never a redirect.
- `reviewedSha`: immutable reviewed candidate head, 40 lowercase hex characters.
- `artifact`: preserved `{release, workerSha256, main}` packaging receipt. Upload
  the exact packaged JavaScript with no rebundle; preserve source-file catalog.
- `provider`: final read-only receipt with `origin`, `workerName`,
  `workerRevisionId`, `activeVersions: [{id,percentage:100}]`, `sourceSha`,
  `buildId`, `workerSha256`, `assetsDigest`, `readbackSource: CLOUDFLARE_READ_ONLY`,
  `capturedAtMs`, `cronReadback`, `runtimeSemantics`. Candidate workflow creates
  this from Wrangler deployment/version readbacks and GET schedules. Production
  routing/configuration must be independently read back by the authorized owner.
- `browser`: deployed browser receipt bound to origin/build ID, PASS, required
  four widths, zero console errors and zero public employment controls, plus
  actual visible `customerText` (include crew detail, help/token/roadmap text).
- `telegram`: deployed smoke PASS bound to build ID, `gatesPreserved: true`,
  `mediaFallbacksPreserved: true`. Requires separately authorized live messaging.
- `comprehension`: PASS bound to build ID, at least three independent readers,
  `todayFutureDistinguished: true`. Readers see the first screen for about ten
  seconds and explain today's action, live versus future Rats, receipts versus
  staking. Local visual inspection is not this test.

Resolved source semantics: cron `* * * * *` = 60,000 ms; status shared cache
5,000 ms; latest feed shared cache 60,000 ms; freshness ceiling 180,000 ms
from both the verified publication and runtime update. Future timestamps cannot
establish freshness.
Observe again after `max(publication interval, status TTL, feed TTL) + 1,000 ms`
= **61,000 ms**. The second publication must advance BOTH publicationVersion and
verifiedAtMs, with complete bindings still valid. Two reads of one cached success
do not count. Same-checkpoint advancement is allowed only with the same hash and
digest. Re-resolve actual deployed cron, response headers and effective freshness
configuration; unresolved or changed semantics fail closed. No arbitrary
15-second production acceptance polling. The observer is bounded to two samples,
15-second request deadlines and a 90-second maximum interval.

## Required negative assertions

Current product/funding projection and level-one visible customer language have
no Arc chain 5042 authority, copied historical Arc treasury/project-fee roles,
HOLDER / PRO, Rat Credits launch utility, active Working Rat staking, Sniffer
NEXT, Den BUILDING, Intelligence V1, Dumpster Ledger, Rat Den V0, Rat Watch V0
or public employment controls. Historical metadata may remain only under explicit
historical scope. Internal canonical capability keys are not customer labels.

## Dependencies and STOP

DEPENDENCY FOR CODEX 2: reconcile the exact pinned canonical document digests with
the final C2 head and retain the already confirmed Working Rat PLANNED / inactive entitlement / vault
staking independence. Supply any changed current Pons authority,
wallet or exact launch-manifest facts as authoritative inputs. C1 selects none.
No C1 dependency on a stake threshold, entitlement activation or labor-admission
policy. C1 does not alter C2 launch/gate semantics or the shared wallet seam.

Implementation stops after local checks, one hostile review, Critical/High fixes
and one targeted rereview. Production stays UNVERIFIED while deployment identity,
real fresh Pons → Case, deployed Telegram smoke and comprehension receipts are
absent. No commit, PR write, publish, deploy, broadcast, economics change, V2
replacement, new research evidence, autonomous Comms Rat or workforce feature.
Optional new Case links, richer share text and enrichment were not added.
