# BINRAT Brand V1 — Composition Receipt

**Status:** `BRAND V1 COMPOSED / PASS`  
**Scope:** Brand V1 composition only; no product-runtime change, merge to `main`, deploy, or production cutover.  
**Composed artifacts commit:** `5c6f6bb6441e0a079d4a6535dbf3616a1b15f2ed`

## Authority and inputs

| Role | Branch | SHA |
| --- | --- | --- |
| Frozen Brand authority | `design/binrat-brand-system-v1` | `770c7aa8741236ee5d8fc8ddd6411bc2addfdade` |
| Copy Library | `design/binrat-copy-library-v1` | `91cee9f12563f2d4286736155400910ad1ca1cb5` |
| Social Production | `design/binrat-social-production-v1` | `568b0a3c7214e3252e3c7278ba35c2c382955814` |
| Motion Identity | `design/binrat-motion-identity-v1` | `0b96eead965a788f4b14d9c714692f995b090545` |
| Export Pack | `design/binrat-export-pack-v1` | `de0fa94edbe4412054fc6bbd388f7c66165fc747` |

Composition used narrow, ordered content application from the exact authority tree: Copy → Social → Motion → Export. Authority-owned palette/token files and the authority README won conflicts caused solely by the workers' older common base; no worker history was merged into the composition branch.

## Post-review Motion delta

Reviewed commits after the prior hostile-review pin `c92b2d4feed2c6ebc5d4a42a57e5f57e10cfda53`:

- `e96b8e8e00354ddf324b7a459180f93d069b92a9` pins the two Social V1 raster inputs and Ubuntu 24.04 FFmpeg/libx264 packages in `SOURCE_LOCK.json`, and fails closed on drift.
- `0b96eead965a788f4b14d9c714692f995b090545` regenerates the locked proof receipt.

Verdict: no Brand V1 violation. The changes add provenance and deterministic-render protection only; they do not alter Rat identity, palette, typography, social family, evidence semantics, or motion grammar.

## Integrated proof run

GitHub Actions run [`37065886563`](https://github.com/CipherCuttle/binrat/actions/runs/37065886563) on the composition branch completed **successfully**.

| Gate | Result |
| --- | --- |
| Brand palette | PASS |
| Copy Library validator | PASS |
| Canonical Social V1 render / no frozen-proof drift | PASS |
| Social Production proof and evidence-state accessibility | PASS |
| Motion source lock, render-twice determinism, reduced motion | PASS |
| Export Pack render and verify | PASS |
| Export same-run determinism | PASS |
| Rat Zero/source provenance | PASS |

The matrix used Ubuntu 24.04, Playwright 1.55.0 and the Motion lock's FFmpeg `7:6.1.1-3ubuntu5` / libx264 `2:0.164.3108+git31e19f9-1`, rather than accepting host-browser or host-encoder drift.

## Deterministic receipts

- Rat Zero: `43541a9b469fbe46a9b54dccb227cfb21c7fcfade1d96656410b124ded2d3edc`
- Rat Zero avatar proof, 32/48/128: `f38aebb0e8f7389a2b8397b8ae407f66c951d2bc9c3fd7529bed46cebd5474f5`, `fb54dbba0ec873daa0af533baa8e151923272f2685e7113835d30879b7ef3db0`, `db91ead6cc65c770e5f43fc2339fa838f94ef51e6abe823dc68dbcc300fd0e1c`
- Frozen Social V1 wide receipt / Rat-found: `bfebd161f7ca5bfcab6ac764bc7a473f152f5d49d4aa539d6cf36fa18722a6c0`, `1bff41abbfbca66e9432ef2c24af631909925f85853bed568e5f215ee698932c`
- Motion source lock / MP4 / manifest: `bd82c7b0eb1ac9fda0f761c01045c5b016ab8430855743adfa617abd9c200266`, `9bcc12723208b2dcd232edb56dbcd614e68b27d91e2ca3fe0aeb77b143d0fece`, `ba04138f1cc6f75b16f46fe23226bac1c82d5e021b6b5d09e52ddc0dbdd4f3ff`
- Social Production contact wide / square: `9d9cb95b69d5e240b4836b735eb0e917cbd6cc8824b1554bc00c2224484d7a7d`, `7696578dd3c1667b0fc085a2b54d80f2524d3f001be6bcdb903903ff2b7ca12e`
- Export manifest (27 records): `08cfdeb576d9e862f9194f39e925a58d2789905720732e7a772b2694a7d27d13`
- Pressure-test contact sheet: `c41fd74829a138fa5f1e57069352cb3870e177aa52ba6dc022d0b922b91acb26`

## Pressure test and candidates

The generated pressure-test sheet covers Rat/avatar small crops, X-style avatar/header, Telegram media/profile, generic square/wide social cards, OpenGraph composition, wordmark light/dark contexts, long/short copy and literal evidence states. Reduced motion resolves to the canonical static `RAT FOUND SOMETHING` proof and is source-hash checked.

Still candidate, not canonical: 32/48 favicon use, X header crop geometry, default OpenGraph unfurl geometry, and the exact Motion proof MP4. No candidate platform geometry was promoted by this composition.

## Findings and deviations

- **Critical:** none.
- **High:** none open. The prior high Motion near-black drift was already resolved on the Motion worker by binding the canvas/pad to Brand V1 Ink `#101210`.
- **Intentional deviations:** none. The composition preserves authority conflicts, retains all evidence-state distinctions, and leaves Pons funding / Case intelligence untouched.

## Verdict

**BRAND V1 COMPOSED / PASS**
