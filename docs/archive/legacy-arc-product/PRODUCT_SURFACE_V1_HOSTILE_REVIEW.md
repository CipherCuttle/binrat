# BINRAT PRODUCT SURFACE V1 — HOSTILE REVIEW

Review target: architecture documents and isolated `web-v2/` demo.
Review count: one hostile review, followed by one targeted rereview because High findings required changes.

## Critical

None found.

The demo does not mutate backend state, replace `web/`, activate Holder Gate, assert token launch authority, or use ranking as a recommendation. Canonical token state is not changed.

## High

### H1 — Tablet navigation erased destination labels

**Attack:** At 768–1050 px the first implementation collapsed inactive navigation items to numbers. This made the persistent shell cryptic precisely where the desktop rail had already narrowed but the mobile bottom navigation had not activated.

**Fix:** The tablet rail is now 110 px and retains every text label at a compact size. The mobile text-labeled bottom navigation still begins at 720 px.

**Targeted rereview:** PASS at 768×1024. All five destination labels are rendered, and document width equals viewport width.

### H2 — Radar Watch looked actionable but did nothing

**Attack:** An inert `WATCH THIS ADDRESS` control would make the flagship’s next-action hierarchy cosmetic and undermine the intended Radar → Watch loop.

**Fix:** The thin demo now has explicit local interaction state and changes to `WATCH ARMED ✓`. It does not pretend to create a production subscription or receipt.

**Targeted rereview:** PASS. Interaction changes state only in the demo; no backend request or subscription claim is made.

### H3 — Client navigation did not move assistive focus

**Attack:** Visual route changes without focus transfer can leave keyboard/screen-reader users operating against the preceding page context.

**Fix:** The route state now focuses the stable `main#content` landmark without forcing scroll.

**Targeted rereview:** PASS by code inspection and accessible main target. Production routing should additionally announce human-readable route titles.

## Medium

- **Live validator depth:** The demo’s `?source=live` adapter validates schema version, chain, and arrays but is intentionally shallower than `web/data-source.js`. It must not become the production adapter until complete field/receipt validation is ported.
- **Incomplete destination implementation:** Watch, Creator, Ledger, Replay index, and `$BINRAT` routes are architecture placeholders. This is within thin-demo scope but prevents full loop acceptance.
- **Native-link behavior:** Demo navigation uses buttons plus History API. Production routes should use real links so open-in-new-tab, copy-link, and browser semantics are native.
- **Radar evidence paths:** The demo exposes receipt identifiers rather than opening the public activity endpoints. Production Radar requires a dedicated receipt view/link.
- **Runtime status:** Demo checkpoint and counts are explicitly marked schema-matched demo data. Screenshots or distribution copy must preserve that label.

## Low

- The current favicon is only a 64×64 PNG; a complete app-icon family is missing.
- The single approved mascot image is cropped responsively and cannot communicate all state changes visually; text state remains the accessible fallback.
- Vite copies the full shared public asset directory, including font license and all font faces. This is acceptable at current size but can be narrowed during production packaging.

## Threat checks

| Risk | Result |
|---|---|
| Generic Web3 drift | PASS — no gradient/glass/coin/component-kit visual language |
| Product ambiguity | PASS for demo screens; placeholder destinations remain Medium |
| Hidden backend capabilities | PASS in architecture; Radar/Bag/Replay are demonstrated |
| Weak next action | PASS after Radar Watch fix |
| Mobile scroll dump | PASS — dedicated screens and bottom nav; Bag is long by evidence necessity |
| Decorative evidence semantics | PASS — states include labels, markers, coverage, and boundaries |
| Radar implies BUY signal | PASS — neutral/orange ranking and repeated non-recommendation language |
| Wallet identity overclaim | PASS — role/address language is explicit |
| Decorative Rive | PASS — no fake Rive; state contract maps to product events |
| Asset inconsistency | PASS for current demo; missing family is documented |
| Frontend duplicates/invents backend truth | PASS for demo labeling; full production validators remain Medium |
| Dependency bloat | PASS — no router, chart, UI kit, icon set, or motion runtime |
| Migration complexity | PASS — isolated app, unchanged APIs, unchanged production frontend |
| Accidental token claims | PASS — `NOT_LAUNCHED`; no holder activation or contract claim |

## Review verdict

No Critical or unresolved High findings remain. Medium items are explicit acceptance work for a production migration, not blockers to the bounded direction demo.
