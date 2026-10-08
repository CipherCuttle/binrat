# Real Pons Case runtime proof V1

2026-10-08. Branch `feat/binrat-pons-case-preview-v1`, PR #168. Starting head
`635dd437f842cfcf8fa9a7afe4d08d2737aefbe5`. Visual authority: PR #166 and the V3
freeze. This experiment has no production, deployment, merge or transaction authority.

## PLAN → CHANGESET → VERIFY → VERDICT

First identify a deployed Pons source, validate its actual public response using
existing validators, then connect the isolated V3 preview. A fixture, HTTP 200
or build alone cannot establish a real Case. Production diagnosis is bounded to
one pass. Implementation ended after one hostile review, two High fixes and one
targeted rereview; remaining engineering work is delivery and exact-head CI.

## Source discovery and release limits

The documented Worker configuration names `binrat-edge-v0`. The production site
and that Worker both returned `/health` 200 reporting old source
`53325fd0806765578ed6921428ad55f15a9728f1`. Their `/api/status` and
`/api/launches/latest` requests each exhausted a 15-second deadline. No current
503/1102 response was captured; previous 1102 receipts cannot substitute for
these timeouts. There were no retries or infrastructure repairs.

A deployed candidate provides the usable **public indexed Pons source**:

`https://binrat-read-plane-stability-candidate.pettevik.workers.dev`

Both read endpoints returned 200. Supported schemas are
`binrat.latest-launches/0.1` and `binrat.public-status/0.1`, chain **4663**.
`adaptLatestLaunches`, `verifyFeedBinding`, `bindingMatches` and
`validatePublicStatus` checked every displayed source field, digest and binding.
The feed contains 20 actual returned launches with `PARTIAL` history coverage.
The captured status is **STALE_VERIFIED**, reporting `SYNC_UNKNOWN_ERROR`.
This proves a stale verified Case journey, not fresh production operation or
release acceptance with two consecutive healthy publications.

Observed candidate source SHA: `e34a94cf1702340582266852495e28423728add0`.
Observed build ID:
`8e920ed18db6761fbe8b5b2825ed489050448ce9c8d6878af202a11208ac96b1`.
`/health` reported Worker revision `1f68b4d6-3a57-4022-bb3b-c4496b864bcb`.
These match the preserved provider/build receipts from
[deployment CI run 37673392606](https://github.com/CipherCuttle/binrat/actions/runs/37673392606).
Feed/status release headers agree. The candidate health response nevertheless
reports `sourceBinding=UNVERIFIED`, `observedManifestDigest=null`, and
`deploymentBinding=REQUIRES_DEPLOYMENT_RECEIPT`. No current provider token/account
was available, so a current active-deployment API readback was not performed.
Reported release identity and previous provider corroboration must not be
promoted to fully verified current production provenance.

[Discovery requests and response hashes](receipts/pons-runtime-v1/source-discovery.json).

## Selected real Case and exact snapshot receipts

The following identifiers came from the final desktop browser's actual public
response. The same Case was explicitly selected at desktop, mobile and tablet;
no request was intercepted in those journeys.

| Field | Actual source value |
|---|---|
| Launch/Case ID | `86e98458f2171f34cd707b228de04d9297ebd42a31214d5198f3b497fa9585a9` |
| Token | `0xf238e122b91f39cf6a76d6720e88f15e574bd495` |
| Reported deployer | `0x54a002576ef7e03fd6af4b8df304a8584538ffd0` |
| Launch transaction | `0x42e8d2c04a5810a3400c54a21e48f3e46504a75860fdeb33b708b54ee99fb93b` |
| Launch block | `83540796` |
| Verified checkpoint | `83541188` |
| Checkpoint block hash | `0x128a30929f30750c8d62f3c5ac2a38bfe143e5f711973aa01b27a70b6231e513` |
| Recomputed feed SHA-256 | `e12ed7dde88331d91ffd3143720087b652938a3f8e802e00ae009dd8026a29a4` |
| Publication version | `5509` |
| Prior indexed launch count | `0` |
| Coverage | `PARTIAL` |

WHY: this is a Pons-reported canonical indexed launch in the bounded latest feed.
Zero earlier indexed matches does not establish a clean history. No earlier
individual history records, money flows, shared human ownership, intent,
profitability, safety or future result are inferred.

Missing real fields: name, symbol, image URI and social metadata are empty strings.
The UI uses a token address prefix and explicitly states missing metadata.
Optional intelligence/replay and earlier records are not loaded. A canonical
snapshot digest matching status is **not independent RPC execution verification**.
The checkpoint hash is verified against the status/feed binding, not by a new RPC
block read. Watch is unavailable here, Watch is not Tripwire, Tripwire remains
BUILDING, Sniffer PROVING, and Working Rat PLANNED with inactive entitlement.

[Actual feed plus public response headers](receipts/pons-runtime-v1/1440x900-api-launches-latest.json)
and [actual status plus public response headers](receipts/pons-runtime-v1/1440x900-api-status.json).

## Browser proof

Unmodified Playwright 1.56.1 and its Chromium captured these screenshots from the
actual public response. Screenshot hashes and origin classifications are in the
[catalog](receipts/pons-runtime-v1/screenshot-catalog.json).

- [Desktop 1440 × 900](receipts/pons-runtime-v1/desktop.png)
- [Mobile 390 × 844](receipts/pons-runtime-v1/mobile.png)
- [Tablet 768 × 1024](receipts/pons-runtime-v1/tablet.png)
- [Real TRAIL](receipts/pons-runtime-v1/trail.png)
- [Expanded real RECEIPTS](receipts/pons-runtime-v1/receipts.png)
- [Real NEXT](receipts/pons-runtime-v1/next.png)
- [SIMULATED unavailable control](receipts/pons-runtime-v1/SIMULATED-unavailable.png)

The source was stale in the real captures. Finds therefore say INDEXED FINDS,
and the headline says INDEXED SCRAP. These are not fabricated fresh screenshots.
All 18 required real viewport/stage captures, adverse captures, and default-lab
regressions are also preserved by the exact-head CI browser artifact.

Verification: 31 browser groups PASS; main three viewports cover correct art
loading, primary action within the first viewport, heading/art separation,
page overflow, actual Case WHAT values, supported TRAIL, expanded bound receipts,
truthful NEXT, keyboard stages and GET-only network. Supplementary 320/360/430/1024
checks cover overflow only. The 320px CTA limitation from the freeze is not marked
fixed. Reduced motion is exercised in the adverse controls. Default synthetic
V3 lab: 17 browser groups PASS, no API calls. Canonical raster assets and
`VisualLab.tsx` were not changed. Owner visual approval remains PENDING.

Adverse browser controls are explicitly simulated from a recorded transport:
wrong chain, altered digest, checkpoint hash mismatch, missing snapshot, initial
503, future timestamp, expired freshness, verified stale, healthy empty,
missing history/intelligence/replay, rapid selection, initially and explicitly
selected Case disappearance, stale retention after 503, same-checkpoint conflict,
hidden expiry, throttled resume, and name present with symbol absent. They are
not real-source proof and are stored separately from `real/` CI screenshots.

[Browser results, all errors and measurements](receipts/pons-runtime-v1/browser-proof.json).
[Network request log](receipts/pons-runtime-v1/network-requests.json).
Real journeys recorded zero page/console/network errors. The negative controls
recorded two expected HTTP 503s and their two browser resource-error messages;
these are retained in the error log. No browser request was a mutation. Routing
unit tests separately try non-GET methods against an injected local mock; none
are forwarded upstream.

Local performance observations (unthrottled desktop machine, not phone/Safari
performance acceptance): image bytes 1,170,314 desktop/tablet and 653,264 mobile;
4 desktop/tablet blur layers and 2 mobile. LCP observations 136/116/184 ms,
CLS approximately 0.026/0.072/0.226 for desktop/mobile/tablet. The tablet loading
shift is a retained limitation. Real devices, Safari and Firefox remain unverified.

## Changes and verification

- `web-v2/checks/pons-preview-proxy.mjs` and declaration: fixed candidate origin,
  exact two-route GET allowlist, redirects rejected, 15-second deadline, 100KB
  response bound, no incoming credentials or upstream cookies forwarded.
- `web-v2/vite.config.ts`: opt-in `BINRAT_PONS_PREVIEW=1` local dev/preview plugin;
  disables the legacy local proxy only in this opt-in tooling mode. Production
  build output contains no proxy. Normal lab and old adapter are unchanged.
- `web-v2/src/pons-readonly-preview.mjs` and declaration: preserve canonical
  validators, reject checkpoint/publication regressions and same-block conflicts.
- `web-v2/src/PonsCasePreview.tsx`: pin exact selection, stale truth, source/limits,
  metadata absence, current Rat stages, expiry on visibility/pageshow.
- `web-v2/src/visual-lab.css`: only Pons-scoped rail/receipt/footer handling.
  The demonstrated 20-launch rail overlap and page overflow were corrected.
- `web-v2/checks/check-pons-readonly-preview.mjs`,
  `check-pons-preview-proxy.mjs`, `check-visual-lab.mjs`,
  `pons-runtime-browser.cjs`: transition, routing and real/adverse acceptance.
- `.github/workflows/ci.yml`: PR #168 branch-only browser proof, explicit head SHA
  checkout, pinned native runner and preserved artifacts. No deploy workflow added.
- This document and `docs/receipts/pons-runtime-v1/`: public receipts/screenshots.

Commands actually run: `pnpm install --frozen-lockfile`, `pnpm check` (548/548
repository tests plus build and web/share/launch invariants), `pnpm --dir web-v2
check` (11 adapter groups, 2 proxy groups, existing evidence/visual gates and
TypeScript/Vite build), pinned native `pons-runtime-browser.cjs` (31/31) and
`visual-lab-browser.cjs` (17/17), `git diff --check`.
The local browser receipt explicitly records the starting SHA and `sourceDirty=true`:
it verifies the working changes, not an unmodified starting commit. The final
commit SHA is PR #168's delivered head; exact committed browser verification is
provided by the `pons-case-runtime-proof-<head SHA>` CI artifact. CI results must
be read for that SHA, never inferred from this local build or the starting head's CI.

## One hostile review and one targeted rereview

This is a bounded hostile self-review, not independent third-party approval.
A–G were challenged: source chain/authentic indexed feed, Case-to-record identity,
supported claims, preserved assets/direction, Rat capability gates, read-only
routing and freshness failure behavior.

| Finding | Severity | Falsification and repair |
|---|---|---|
| H1: resumed page could retain an expired fresh badge before its timer fires | High | A simulated clock jump without timer execution followed by visibilitychange left FRESH_VERIFIED after expiry. [Failing receipt](receipts/pons-runtime-v1/hostile-expiry-before.json). Add visibilitychange and pageshow clock checks; regression proves STALE_VERIFIED on resume. |
| H2: name absence inferred from symbol absence | High | A supported nonempty name with empty symbol contradicted the old visible assertion that both were missing. Render each field's own value/absence; the named adverse regression passes. |

Critical: 0. High: 2, repaired. One targeted rereview tested H1/H2 plus original
source, UI and fail-closed gates: 31/31 browser groups and isolated checks PASS.
No additional feature/refactor pass followed. Tablet loading CLS and owner/device
visual acceptance remain limitations; no subjective approval is asserted.

## Reproduction and rollback

```sh
pnpm install --frozen-lockfile
pnpm --dir web-v2 check
BINRAT_PONS_PREVIEW=1 pnpm --dir web-v2 exec vite preview --host 127.0.0.1 --port 4188
# In a second terminal:
npm install --prefix /tmp/binrat-pons-proof-runner --no-save --no-package-lock playwright@1.56.1
node /tmp/binrat-pons-proof-runner/node_modules/playwright/cli.js install chromium
NODE_PATH=/tmp/binrat-pons-proof-runner/node_modules BINRAT_PREVIEW_URL=http://127.0.0.1:4188 node web-v2/checks/pons-runtime-browser.cjs
# Open http://127.0.0.1:4188/?visual=lab&ponsPreview=1
# Default synthetic lab: http://127.0.0.1:4188/visual-lab
```

A later healthy empty feed or removed Case cannot reproduce this exact historical
Case from the current bounded live feed. The preserved response and screenshots
remain inspectable; replays are not current live proof. If the source becomes
unavailable, the runner fails and the UI fails closed.

Rollback from this proof commit: `git revert HEAD` (replace HEAD with the delivered
proof SHA if later commits exist). Stop the local preview and omit
`BINRAT_PONS_PREVIEW` to restore ordinary local routing. No production rollback
or Cloudflare mutation is required or authorized.

```text
PONS_SOURCE_VERDICT = VERIFIED
REAL_CASE_VERDICT = PASS
EVIDENCE_INTEGRITY = PASS
BROWSER_VERDICT = PASS
VISUAL_VERDICT = PRESERVED
PRODUCTION_AUTHORIZATION = FALSE
```

These verdicts cover the read-only candidate's stale verified snapshot journey.
Production availability/freshness and complete active release provenance remain
unverified. No production acceptance, merge, deploy, Watch creation, employment,
DNS mutation, signing, broadcast, trading, subscription or fund movement occurred.
