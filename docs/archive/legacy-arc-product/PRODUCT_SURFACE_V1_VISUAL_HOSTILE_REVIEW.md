# PRODUCT SURFACE V1 — HOSTILE VISUAL / PRODUCT REVIEW

Date: 2026-09-21  
Review count: one hostile review; one targeted rereview because High findings were corrected  
Scope: Home, Rat Radar, Bag Dossier, embedded Replay

## Critical

None.

The candidate does not present a wallet, token interaction, launch claim, safety score, or production subscription. Demo authority remains visible. The production frontend and backend are outside the changeset.

## High findings

### H1 — Mobile Radar buried the opened evidence file

**Attack:** The first mobile composition showed the ranked rows before the selected dossier. A user could understand the list but miss the flagship interaction: opening the address file. It also made Radar feel closer to a trading screener.

**Fix:** At phone widths the selected dossier now follows the method/coverage block and precedes the full candidate list. The selected address, launch scars, address role, and evidence reasons establish inspection before scanning alternatives.

**Targeted rereview:** PASS at 430×932 and 390×844. The opened file is visible in the initial product sequence and the list remains available below it.

### H2 — Mobile Watch action arrived after too much evidence

**Attack:** In the initial polished pass, `WATCH ADDRESS` followed reasons, receipt IDs, coverage, and checkpoint. On mobile it was effectively hidden, weakening the promised inspect → watch next action.

**Fix:** The future-only tripwire control now follows the observed-role boundary and recurrence evidence. Detailed reasons and receipts remain immediately below. Armed state is explicit text plus shape/check state and remains local demo behavior.

**Targeted rereview:** PASS. Watch is visible as the next action without being mistaken for a buy action or an already-created production subscription.

### H3 — Replay strip caused 390 px horizontal overflow

**Attack:** Two mobile evidence sheets retained min-content width from their semantic labels, expanding the 390 px document to 417 px. This broke the no-overflow requirement in the deepest signature interaction.

**Fix:** Replay columns now use `minmax(0, 1fr)` and each sheet explicitly permits intrinsic shrinkage.

**Targeted rereview:** PASS. Document width equals viewport width at 390 px on Bag/Replay.

## Medium observations

- The approved mascot image necessarily contains its own full scene and prop detail. Cropping and overlays integrate it convincingly, but a future layered mascot/environment master would allow finer responsive art direction.
- CSS receipt, tripwire, stamp, and scar shapes establish the component language but are production stand-ins. The asset brief defines the P0 replacement family.
- Radar evidence IDs remain display-only in this bounded demo. A production migration should link each receipt to its public authority route.
- Replay is embedded in the Bag dossier rather than implemented as a standalone index, intentionally matching the requested scope.

## Threat checks

| Attack | Result |
|---|---|
| Generic crypto dashboard | PASS — no trading chart, glass gradient, coin, or score grammar |
| Too many undifferentiated rectangles | PASS — panels now resolve into file, receipt, rail, scar, boundary, and tripwire roles |
| Mascot pasted on | PASS — scene is the hero field; copy, evidence fragments, crop, and overlays occupy the same composition |
| Poor hierarchy | PASS — promise → dominant CTA → live proof on Home; recurrence → opened file on Radar; receipt → history → Replay on Bag |
| Radar resembles trading alpha | PASS — inspection-order copy, neutral/orange marks, role boundary, and no red/green performance semantics |
| Evidence labels become decoration | PASS — labels are attached to receipts, checkpoint rails, stage states, and proof boundaries |
| Mobile density | PASS after H1/H3 fixes; long evidence is sequential rather than horizontally compressed |
| Weak Watch CTA | PASS after H2 fix |
| Creator/address boundary unclear | PASS — `REPORTED CREATOR ADDRESS` and `V3_SWAP_RECIPIENT` are structurally distinct |
| Replay looks like tabs | PASS — torn evidence sheets develop across a chronological strip with explicit frozen states |
| Missing personality | PASS — mascot environment, launch scars, receipt teeth, case labels, and Trash Trail form a specific BINRAT grammar |
| Missing next action | PASS — Home, Radar, and Bag each expose a dominant contextual next action |

## Verdict

No Critical or unresolved High findings remain. Remaining Medium items are asset-production and production-migration work, not blockers to accepting the bounded visual direction.
