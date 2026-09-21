# Rat Radar Product Surface V1 Freeze

Status: FROZEN

Rat Radar V1 is now the reference implementation for Product Surface V1 forensic surfaces.

## Authority

- **Branch:** `feat/binrat-radar-final-v1`
- **Base:** `73c0b016cb265e892ea220b820f5ed7f2f45bfff`
- **Frozen implementation commit:** `0aae6b955d1bfed1b08380bf23145f1a4f20134e`.
- **Visual authority:** `docs/design/north-star/binrat-radar-north-star.png`, with `binrat-world-background.png`, `binrat-character-master.png`, and `NORTH_STAR_IMPLEMENTATION_SPEC_V1.md` as the authoritative source material. Canonical sources are not runtime-editable design inputs.

## Material and composition law

The persistent pixel-sunset world remains visible around a dense, dark teal recipient machine. The selected recipient anchors a cream, worn-paper case file beside it at approximately a 60/40 desktop machine/evidence balance. Orange and cream mark action and physical edges; teal communicates machine/status structure. The character is composed as a secondary field presence, never evidence or a data claim.

The page’s factual authority is the validated Rat Radar watchlist and its bounded public activity receipts. It shows observed swap-recipient recurrence only: no human-identity conclusion, ownership attribution, score, trade recommendation, or synthetic evidence.

## Frozen Radar semantics

- Recurrence scars are damaged physical marks for distinct indexed launch recurrence: at most 8–10 marks render, the exact count remains textual, and excess is shown as `+N`. They are not risk, price, performance, or trading signals.
- A case file is the selected observed recipient record, its coverage/method boundaries, bounded reasons, and selected public receipt detail—not a person dossier.
- The evidence footer retains explicit identity and recommendation boundaries.
- Recipient Tripwire remains unavailable: Radar observes swap-recipient addresses while current Rat Watch tracks reported creator addresses. It has no local arming, backend connection, or implied subscription.
- DEMO is conspicuously labeled. LIVE either validates public data or fails closed; it never falls back to demo data.

## Interaction and responsive law

Search and sort affect only visible ranked records. Selected rows and receipts use native buttons with logical keyboard order and explicit selected state. Address, activity ID, and transaction-hash copy controls report a visible, temporary result and accessible status; unavailable clipboard access reads `COPY UNAVAILABLE`.

Desktop and tablet retain the side-by-side workbench while legible. On mobile the selected case summary, primary facts, and Tripwire boundary deliberately precede ranked recipients; receipts and deeper proof follow. Long identifiers truncate deterministically while retaining title/full-copy access. Reduced motion removes nonessential animation without removing information.

## Reusable survivors

- `AppWorldBackground`
- `AppHeader`
- `CoverageStamp`
- `RecurrenceMarks`
- `CheckpointRail`
- case-paper and physical receipt styling
- bounded copy-state pattern
- proof-boundary language treatment

These primitives may be reused by Bag and Replay. The Radar workbench composition, ranking controls, and case-file arrangement remain page-specific and are not generalized here.

## Runtime asset record

| Canonical source | Source SHA-256 | Dimensions | Runtime derivative | Derivative SHA-256 | Dimensions | Size change |
| --- | --- | --- | --- | --- | --- | --- |
| `binrat-world-background.png` | `51b307c91740a28fbfda370d034727e6d2dfa9b108eb521a81e926348dd9a4d2` | 1920×1080 | `web-v2/src/assets/north-star/binrat-world-background.webp` | `f4a74fcb44e5c0e4c9b026419fae39116f119038f581db693eaf684adca44d73` | 1920×1080 | 2,148,526 B → 126,826 B |
| `binrat-character-master.png` | `6f22821dfad44309638dd0d08b0dfba8b08d74f324abf89795188d4dbed275fe` | 1254×1254 | `web-v2/src/assets/north-star/binrat-character-master.webp` | `81399b3d28ae2454d4adf778c66a4b25da8c834ec446302d2161f84e29d9a62c` | 1254×1254 | 3,328,127 B → 181,040 B |

The browser render was checked with these WebP derivatives. The canonical PNGs under `docs/design/north-star/` remain unchanged.

## Intentionally deferred

- recipient-watch capability and backend
- holder-gated, identity, or recommendation surfaces
- production frontend migration
- Bag and Replay implementations
