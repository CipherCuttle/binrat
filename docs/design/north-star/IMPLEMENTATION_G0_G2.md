# BINRAT — North Star G0/G2 implementation slice

Status: isolated draft candidate. Merge/deploy authority: NONE.

## Purpose

Stage the exact owner-approved master artwork and implement an independent, fail-closed, read-only recipient-activity transport boundary for the bounded Home → Radar → recipient file → public evidence slice.

## Art G0: SOURCE STAGED, DERIVED LAYERS NOT APPROVED

The four PNGs copied into this directory are the exact existing Git blobs from `design/binrat-north-star-v1`, not compressed approximations or regenerated replacements. These reference images are NOT production-ready transparent layers. The Home and Radar mockups contain illustrative factual text and must not be shipped as background canvases under dynamic HTML.

Production G0 requires owner-approved cleaned world, rat/dumpster foreground, empty Radar housing and paper frame. Preserve the original character anatomy, eye orientation and sunset dither. Until then, do not replace the working Home or Radar layouts, and do not ship these masters into web-v2/public or the production asset bundle.

## Recipient G2: IMPLEMENTED TRANSPORT, NOT YET A WIRED SCREEN

`web-v2/src/recipientActivity.ts` validates the independent Arc 5042 address-activity projection and each public activity record against the exact selected recipient and activity checkpoint. It enforces unique activity IDs, launch IDs, block/hash/address fields, token-side/delta consistency and exact evidence digest shape. It performs GET-only requests and has no fixture fallback.

The browser adapter checks structural consistency only; it does NOT independently recompute cryptographic evidence digests or establish human identity. Empty indexed activity and unavailable endpoint remain different states. Feed, Radar and recipient-activity checkpoints must be shown independently after integration.

Run `pnpm test` at repo root for `test/frontendRecipientActivity.test.ts` along with the existing suite. This candidate does not add npm dependencies, token or wallet operations, auth changes or production infrastructure actions.

## Remaining within this SAME draft PR, after G0 asset acceptance

1. Integrate responsive approved world/Home with `/` distinct from phone task-first `/dumpster`.
2. Build empty first-party illustrated Radar machine and paper recipient dossier; retain semantics and existing M1 navigation.
3. Wire the new on-demand activity adapter for exact ranked and valid out-of-shortlist recipient deep links.
4. Add exact public-activity evidence sheet, copy IDs, scoped checkpoints, loading/failure states.
5. Decouple Feed and Radar failure isolation without synthetic LIVE fallback.
6. Extend browser smoke at 320/360/390/430/768/1024/1440, mocked LIVE failures, reduced motion, and check a real Android phone.
7. One hostile review; fix Critical/High, one targeted rereview; close only after owner visual acceptance.

Excluded: Rive rigging, PixiJS, token launch, Holder Gate, real-money actions, merge and deploy.
