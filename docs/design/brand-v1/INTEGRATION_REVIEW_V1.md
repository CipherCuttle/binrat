# BINRAT Brand V1 — Hostile Integration Review

**Date:** 2026-10-02  
**Mode:** read-only integration review plus bounded worker fix; no merge, no deploy, no production cutover.

## Claim under test

> BINRAT now has one coherent, distinctive, reproducible Brand V1 system that can survive X, Telegram, web, social graphics and motion without mascot drift, evidence ambiguity, generic crypto aesthetics, accessibility failures, production slop or contradictions between worker branches.

## Pinned heads

| Workstream | Branch | Head |
| --- | --- | --- |
| Brand authority | `design/binrat-brand-system-v1` | `770c7aa8741236ee5d8fc8ddd6411bc2addfdade` |
| Export pack | `design/binrat-export-pack-v1` | `de0fa94edbe4412054fc6bbd388f7c66165fc747` |
| Social production | `design/binrat-social-production-v1` | `568b0a3c7214e3252e3c7278ba35c2c382955814` |
| Motion identity | `design/binrat-motion-identity-v1` | `c92b2d4feed2c6ebc5d4a42a57e5f57e10cfda53` |
| Copy library | `design/binrat-copy-library-v1` | `91cee9f12563f2d4286736155400910ad1ca1cb5` |

## Dedicated proof receipts

- Export Pack: run `37042445567` — **SUCCESS**.
- Social Production Proof: run `37041076350` — **SUCCESS**.
- Motion Identity Proof after palette alignment: run `37051994592` — **SUCCESS**.
- Copy Library: run `37042531038` — **SUCCESS**.

The unrelated `rat-radar-candidate-deploy.yml` failures triggered by design branches are outside this brand review and are not evidence against the dedicated brand proofs.

## Hostile findings

### 1. Mascot drift — PASS

Rat Zero remains the identity anchor. The export pack uses deterministic Rat Zero crops; Social Production uses the same approved Rat artwork; Motion composes already-approved raster social assets and does not redraw, mirror or vectorize the mascot.

No worker introduces a competing rat identity.

### 2. Typography drift — PASS

All reviewed production-facing work stays on the frozen Geist roles:

- Geist Sans for human-facing brand/copy;
- Geist Mono for evidence/metadata;
- no worker introduces a replacement display/terminal font;
- Geist Pixel remains optional seasoning rather than body/evidence copy.

### 3. Palette drift — PASS after one bounded fix

Hostile review found a real motion drift: `render-motion-proof.sh` used `0x060606`, a pre-freeze near-black outside the Brand V1 token system.

Fixed on the Motion worker:

- neutral motion canvas/pad → Brand V1 Ink `#101210`;
- Motion Grammar now cites current palette authority;
- dedicated Motion proof reran green.

The other public-facing proofs use the frozen Brand V1 color values. Social Production diagnostic chrome may use diagnostic scaffold colors, but the actual card renderer remains on the frozen social palette.

### 4. Evidence ambiguity — PASS

Social Production fails closed on evidence semantics:

- coverage is explicit;
- source state is explicit;
- `PARTIAL`, `UNKNOWN`, `MISSING`, `UNVERIFIED` stay distinct;
- color is never the only carrier;
- recurrence cannot become skill/profitability/safety/human identity;
- cards reject buy/sell/ape language and unsupported role upgrades.

The worker parameterizes `social-v1/social.js`, but the six frozen source proof PNGs and manifest remain byte-identical to Brand V1. This is implementation hardening, not a visual redesign.

Integration condition: after composition, rerun the canonical Social V1 proof and require those approved outputs to remain unchanged unless an explicit brand decision says otherwise.

### 5. Copy-system contradiction — PASS

Copy Library explicitly mirrors the Social Production envelope:

- RECEIPT headline: 38 chars;
- CASE FILE headline: 42 chars;
- RAT FOUND SOMETHING headline: 24 chars;
- same literal-copy budgets;
- rendered-card CTA allowlist exactly:
  - `OPEN RECEIPTS →`
  - `OPEN CASE →`
  - `DIG DEEPER →`

The broader CTA library is explicitly scoped to non-card product surfaces, so there is no hidden CTA conflict.

The banned-language layer rejects trading imperatives, fake alpha language, unsupported human identity, capability-status upgrades and missing-evidence optimism.

### 6. Motion identity — PASS as grammar, proof remains prototype

Motion Grammar is coherent with Brand V1:

- evidence moves because something happened;
- Rat moves because he noticed;
- raster authority is preserved;
- no mirrored Rat Zero;
- no generic glitch / CRT / casino motion;
- reduced motion is a first-class static composition;
- current proof is deterministic H.264, 1200×676, 30 fps, 6.4s, no audio.

The rendered MP4 remains correctly marked `PROTOTYPE_NOT_CANON`. Do not promote that exact video to permanent brand canon merely because the grammar passed.

### 7. Export/distribution — PASS

Export Pack V1 is deterministic and authority-bound:

- 27 manifest records;
- Rat Zero hash pinned;
- Geist commit pinned;
- Brand V1 palette/token sources included;
- X profile preset 400×400;
- X header 1500×500;
- Telegram profile 512×512;
- OG candidate 1200×630;
- generic social wide/square exports;
- same-run deterministic hashes;
- no font binaries shipped;
- no SVG mascot/vector substitutes.

Platform presets that are still marked `candidate` remain candidate until validated on the actual surface.

### 8. Generic crypto aesthetic — PASS

Across the reviewed outputs there is no purple-gradient crypto skin, fake Bloomberg terminal, Matrix/glitch layer, meme-token split-color logo, generic AI imagery or “alpha engine” framing.

The distinction remains:

> serious evidence system inhabited by a slightly feral rat.

## Remaining integration conditions

These are not Brand V1 design blockers, but they must be satisfied before any merge of the combined work:

1. Compose from current Brand authority `770c7aa...`, not from the historical common base.
2. Bring Copy Library first because it is docs/validator-only and defines the language guardrail.
3. Bring Social Production next; rerun its validator/contact sheets and the frozen Social V1 proof.
4. Bring Motion Identity next; require the palette-aligned Motion proof to pass.
5. Bring Export Pack last and regenerate the full distribution manifest from the composed tree so every source hash reflects the final integrated sources.
6. Run one integration matrix containing:
   - Brand palette gate;
   - canonical Social V1 proof;
   - Social Production proof;
   - Copy Library validator;
   - Motion proof;
   - Export Pack render + verify + same-run determinism.
7. Stop if any previously frozen Rat/social/logo artifact changes without an explicit owner decision.

## Candidate assets that remain intentionally non-canonical

- 32/48 favicon use until real browser validation;
- X header geometry until real-profile crop validation;
- default OG composition until real unfurl validation;
- Motion proof MP4 itself.

Their underlying Rat, lockup, type, palette and copy contracts are frozen; only the platform geometry/proof status remains open.

## Kill criteria

Stop integration if any of these occur:

- Rat Zero is mirrored/redrawn/replaced;
- canonical social proof hashes drift unexpectedly;
- a worker reintroduces IBM Plex or another competing brand typeface;
- red/green becomes a safety/risk verdict system;
- missing evidence becomes positive evidence;
- a rendered social CTA falls outside the three-card allowlist;
- motion meaning depends on animation and fails reduced-motion equivalence;
- export output is non-deterministic;
- a candidate platform asset is silently labeled canonical without real-surface validation.

## Verdict

**PASS — no Critical/High cross-worker Brand V1 contradiction remains at the pinned heads.**

The one concrete visual contradiction found during hostile review—the Motion near-black outside the frozen palette—was fixed and re-verified.

**State:** READY FOR A FRESH COMPOSITION BRANCH.  
**Not authorized here:** merging workers, merging to main, deployment, production cutover.
