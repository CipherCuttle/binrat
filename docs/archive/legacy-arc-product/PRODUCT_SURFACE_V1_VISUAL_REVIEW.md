# BINRAT PRODUCT SURFACE V1 — VISUAL REVIEW

Date: 2026-09-21  
Baseline: `77e0d2b3f965e89dde6e4b148e672d9e15d0c345`  
Scope: Home, Rat Radar, Bag Dossier + Replay in isolated `web-v2/`  
Viewports inspected: 1440×900, 1024×768, 430×932, 390×844

Status: `PRODUCT SURFACE V1 VISUAL DIRECTION / ACCEPTED CANDIDATE`  
Flagship surfaces: Home; Rat Radar; Bag Dossier + Replay  
Next lane: `ASSET PRODUCTION + RIVE`

## Baseline findings before polish

### Hierarchy

Home had a strong headline and clear CTA pair, but the composition split cleanly into a copy rectangle and a mascot rectangle. The image won attention without explaining the evidence product. The proof modules began below a 630 px hero and were barely visible at common laptop height.

Radar led with an oversized title, then four detached metric tiles. The core recurrence evidence was visually subordinate and encoded as an ordinary progress bar. The selected address file was secondary to the matrix even though opening that file is the screen's product moment.

Bag gave the token title appropriate weight, but its launch evidence and creator history read as equal SaaS panels. Replay sat below both and had no visual pull in the first viewport.

### Personality

The palette, condensed type, copy, and approved mascot were recognizably BINRAT. The underlying UI grammar was less specific: progress bars, metric tiles, tabs, and bordered panels could belong to many dark crypto dashboards. The mascot looked commissioned for the brand but placed beside the interface rather than working inside it.

### Product clarity

Home explained “memory” but did not explicitly state all four jobs together: watch Arc launches, remember source-reported creator history, preserve receipts, and expose recurring evidence.

Radar could be understood after reading the supporting sentence, but the progress bar invited a strength/performance interpretation. “Rank” and orange emphasis could be mistaken for alpha ordering without the boundary copy. Acquisition receipt authority and recurrence were split across several areas.

### Interaction

Buttons had hover affordance, but implemented navigation used button-only History API behavior. That removed native open-in-new-tab, copy-link, and link preview behavior. Radar selection was clear on desktop but the file opened below the full list on mobile. Watch changed local state correctly but looked like another generic outline action.

### Evidence semantics

Text labels for `OBSERVED`, `NOTED`, `UNKNOWN`, `COMPLETE`, `PARTIAL`, and `UNVERIFIED` were present and not color-only. However, coverage often appeared at the edge of a panel like metadata. Receipt authority, checkpoint, and proof boundary were not consistently composed as the structural frame around a claim.

### Density

Desktop density was disciplined, but much of it came from many similarly weighted rectangles. Radar approached a spreadsheet; Bag approached a standard two-column detail page. Receipt IDs looked like values inside boxes rather than physical proof objects.

### Mobile

The text-labeled bottom navigation was intentional and successful. Home stacked a 505 px copy block over a 390 px image, delaying product proof until well past the first screen. Radar showed several tall list cards before the opened dossier. Bag preserved semantics but the long token hash and evidence rows made the first viewport feel administrative. The Watch label wrapped awkwardly at 390 px.

### Asset dependence

The approved mascot is the only finished illustrative asset. Live type stands in for the rat-head mark and wordmark. CSS rectangles stand in for evidence receipts, recurrence marks, watch/tripwire state, ledger stamps, token iconography, and trash-bag product objects. The current interface can establish composition and behavior, but those objects need a coherent production asset family before final brand acceptance.

## Direction taken

- Integrated the existing mascot as the hero environment, with a dark evidence field, crop, status fragments, and case labels over the scene. No new rat art was generated.
- Replaced the generic recurrence bar with irregular chronological “launch scars”: one physical mark per distinct indexed launch, with unfilled slots visibly different.
- Turned the selected Radar address into an opened case file with its recurrence, observed role boundary, reasons, receipt object, checkpoint, coverage, and tripwire action in one reading path.
- Reframed Bag around an exact launch receipt and a source-reported Creator File; the Trash Trail now reads oldest to current.
- Replaced the Replay tab appearance with a developing evidence strip. Each horizon is a frozen sheet with explicit state, and the selected sheet redraws only what was knowable then.
- Promoted checkpoint, coverage, receipt authority, and proof boundaries into reusable structural primitives.
- Converted implemented navigation to native anchors while retaining client-side focus transfer and reduced-motion behavior.

## Acceptance observations after polish

At 1440×900, Home now resolves headline → literal product promise → dominant CTA → evidence fragments, with the mascot occupying the same field instead of a separate card. Product proof begins within the first viewport.

At 1024×768, the image crop and copy remain legible, persistent navigation retains labels, and proof begins immediately below the hero. Radar changes to a vertical workbench without overflow. Bag collapses to one case column while keeping creator/address semantics distinct.

At 430×932 and 390×844, the hero is a composed poster rather than two full screens, all nav destinations retain text labels, controls remain reachable, long hashes wrap, and no horizontal overflow was observed. Radar list rows retain order, scars, timing, and receipt count without adopting red/green trading semantics.

## Residual limits

The interface still uses CSS-rendered stand-ins for the product-object art described in `ASSET_PRODUCTION_BRIEF_V1.md`. Watch is deliberately local demo state and does not claim a subscription receipt. Architecture placeholders remain placeholders. Those are explicit scope boundaries, not hidden completeness claims.
