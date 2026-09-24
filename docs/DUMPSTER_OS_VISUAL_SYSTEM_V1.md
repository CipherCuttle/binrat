# BINRAT — DUMPSTER OS VISUAL SYSTEM V1

**Status:** design/implementation contract; assets and dependencies listed here are *proposed*, not shipped by this document.  
**Owner direction:** 2026-09-24 — the PC preview aesthetic was liked; earlier phone critique was explicitly withdrawn because it referred to PC mode. Actual-phone approval remains separate.  
**Current work:** draft PR #24 (`feat/binrat-frontend-mobile-m1`) based on draft PR #23.  
**Related authorities:** [ROADMAP_V0](./ROADMAP_V0.md), [ASSET_PRODUCTION_BRIEF_V1](./ASSET_PRODUCTION_BRIEF_V1.md), [PRODUCT_SURFACE_V1](./PRODUCT_SURFACE_V1.md), [CAPABILITY_MANIFEST_V0](./CAPABILITY_MANIFEST_V0.json).

## 0. Objective and non-negotiable boundaries

**Dumpster OS:** a cursed forensic salvage terminal operated by BINRAT's approved cyborg rat. Desktop is the **forensic control terminal**; phone is the **field scavenger device**. Their information density differs, but the source facts, semantics, URL identity and brand assets are shared.

First-impression goal: identifiable without a wordmark because its salvaged industrial forms, rust/bone/oxidized materials, torn receipt treatment, micrographics and distinctive rat fragments belong to the same visual system. The application must still be usable when all decoration and motion are disabled.

- Preserve the approved `web/assets/binrat-hero.webp` subject: rat species, ear damage, dark fur, eye construction and attitude; derive fragments from it rather than invent a new mascot.
- Grime belongs on frames, backgrounds, decor, inactive rails and large artifact illustrations — never underneath critical body text, source addresses, block numbers, proof identifiers, button labels or focus rings.
- A pleasing success animation is not evidence. BINRAT must continue distinguishing source-reported **creator**, observed **V3 recipient**, verified backend *receipt existence*, frontend schema validation, coverage and unavailable facts.
- Do not label an observed source claim `PROVEN` merely because it has a green icon. `OBSERVED/NOTED/UNKNOWN` are fact states; `COMPLETE/PARTIAL/UNVERIFIED` are history coverage; `MISSING` belongs to Replay horizon availability. Keep `DEMO` and `LIVE` plainly visible.
- Saved is local-only; it is never an accepted Watch. Do not offer Radar-recipient subscriptions until a real supported backend receipt exists. No scores, trading advice, human-identity inference or token-launch implications.
- No backend/API changes, paid asset procurement, wallet/fund interaction, token marketing, production deployment or merge is authorized by this visual specification.

## 1. Technology decision and size limits

**Utility backbone:** `@tabler/icons-react`, installed in `web-v2` *when the implementation changeset begins*, pinned to a reviewed version in `pnpm-lock.yaml`. Direct named imports only; no giant icon registry, dynamic all-icons import, second utility family or icon font. Official package uses ES modules/tree shaking, 24×24 geometry and MIT licensing: https://github.com/tabler/tabler-icons/tree/main/packages/icons-react . Keep third-party notices.

**BINRAT nouns and material:** first-party, optimized SVG/React components. Exact icons listed below must be original art or approved-mascot derivatives, not repainted stock icons. Never use decorative marks as unlabelled semantic status.

**Motion:** native CSS for minor presses; Motion for purposeful React layout transitions *after* static composition passes. Rive is later and contingent on actual approved layered art and a working `.riv`; prior CSS/Canvas prototypes are *not* a shipped Rive runtime.

**Typography:** continue existing Plex Condensed for display and Plex Mono for proof/meta, with a highly legible normal-size text style for descriptions. Distress is a large-title or image treatment, not a font applied to paragraphs.

**Initial payload budgets (targets, not claims of current measurements):** first-screen decorative assets ≤80 KB compressed total on mobile; no full-screen autoplay shaders; individual inline icon SVG path complexity bounded; mascot fragments are reused instead of shipping repeated full-size art. Profile and record actual bundle/paint sizes before release.

### Material token source

Proposed `web-v2/src/visual/tokens.css` creates aliases to existing palette; do not silently fork `styles.css` and `MobileExperience.module.css` into conflicting parallel truth.

| Token | Starting value | Use |
|---|---:|---|
| `--binrat-asphalt` | `#101210` | Background and negative space |
| `--binrat-oxidized` | `#263b35` | Sheet housing |
| `--binrat-dark-steel` | `#1c201c` | Mechanical rails |
| `--binrat-bone` | `#e4ddcc` | Primary text and paper |
| `--binrat-receipt` | `#cec6b5` | Paper artifact background |
| `--binrat-rust` | `#cf9567` | Source stamps and worn metal |
| `--binrat-fault-red` | `#ff3948` | Operator/action or error, always text-labeled |
| `--binrat-seam` | `#596154` | Bolts and edges |
| `--binrat-led-idle` | `#a8b795` | Ambient hardware light, never a safety grade |

The existing M1 mobile palette is an accepted starting point for this exploration, **not proof of actual-phone acceptance**. Do not force a universal single shade across all panels.

## 2. Icon production contract

### Shared geometry and accessibility

- `24×24` viewBox for product icons; baseline `1.75–2px` stroke; rounded joins only when representing wire/cable. Core silhouette remains intelligible at 16 px, single-color, without texture.
- Icons must survive dark asphalt, oxidized green and light receipt-paper backgrounds. Use `currentColor` for monochrome versions; explicit secondary color only in larger optional illustrations. Prefer shape + adjacent visible text for semantic meaning.
- Interactive action targets ≥48×48 CSS px in the phone shell; icon graphics generally 20–24 px. Never equate 16 px graphic size to touch size.
- Keep **a consistent rat eye/ear side**, cropping anchor and cyber-eye orientation derived from approved art. Do not create conflicting eye-side marks.
- Export SVG masters with paths outlined; include a 16/24/32 one-color contact sheet and path-count/perceptual review. Decorative rust/scratches off for ≤24 px. Add SVG titles only if informative and otherwise `aria-hidden`.

### A. Utility icon mapping — Tabler only

| User action | Exact Tabler component | Placement |
|---|---|---|
| Search | `IconSearch` | Discover search box |
| Filter | `IconFilter` | Feed/Radar filter sheet |
| Copy | `IconCopy` | Addresses, activity IDs, receipts |
| External source | `IconExternalLink` | Verifiable source links |
| Close | `IconX` | Modal/sheet |
| Back | `IconArrowLeft` | Case navigation |
| Next | `IconChevronRight` | Secondary row affordance |
| More | `IconMenu2` | Four-tab shell; if retained |
| Refresh | `IconRefresh` | Revalidate visible data |
| Share | `IconShare3` | Direct dossier share |
| Info | `IconInfoCircle` | Coverage definitions |
| Warning | `IconAlertTriangle` | Error context, with text |

Do not let utility icon styling or Tabler license text leak into first-party brand artwork.

### B. First-party BINRAT icon pack — 24 exact names

All are proposed masters under `web-v2/src/visual/icons/binrat/`. `P0` means first production batch; `P1` means extend after the first contact sheet passes.

| ID | Component | Distinct silhouette / SVG master recipe | Correct use | Batch |
|---|---|---|---|---|
| B01 | `RatHeadIcon` | Three-quarter head cutout, damaged-ear notch, one square eye port | Shell brand bug and stamped ownership | P0 |
| B02 | `CyborgEyeIcon` | One angular socket; offset two-piece lens and short whisker circuit | Scan / load *decoration*, never proof by itself | P0 |
| B03 | `DumpsterIcon` | Trapezoid body, offset lid hinge, two rivets | Discover / empty container | P0 |
| B04 | `BagDossierIcon` | Folded metal folder with torn hanging bag tag | Bag overview / local dossier | P0 |
| B05 | `CreatorFileIcon` | Source label card with address-line slits, not a human silhouette | Source-reported creator destination | P0 |
| B06 | `ObservedRecipientIcon` | Receiving tray at end of incoming chain trace, distinct from B05 | Radar V3 observed recipient | P0 |
| B07 | `RadarPingIcon` | Radial scope notch, asymmetric sensor arc, no crosshair over a person | Radar navigation and scan state | P0 |
| B08 | `RecurrenceScarIcon` | Three offset slash marks passing through one launch notch | Distinct indexed recurrence | P0 |
| B09 | `ReplaySpoolIcon` | Two unequal tape/receipt rollers joined by a bent ribbon | Replay / fixed horizon | P0 |
| B10 | `ReceiptTearIcon` | Rectangular receipt with twin perforated edges and cut corner | Open exact evidence receipt | P0 |
| B11 | `LedgerSlabIcon` | Bolted ledger spine with stacked entry cuts | Accounting and ledger page | P0 |
| B12 | `WatchTripwireIcon` | Tension wire across three pins with central latch | **Real** supported Watch only | P0 |
| B13 | `SavedScrapIcon` | Dog-eared scrap clipping with one securing pin | **Local** bookmark, never Watch | P0 |
| B14 | `SourceLinkIcon` | Two distinct source tabs linked by a physical wire | Source provenance and source URL | P1 |
| B15 | `CheckpointPinIcon` | Stationary block index plate with one bolted line | Checkpoint *not freshness inference* | P1 |
| B16 | `ObservedFactIcon` | Eye aperture plus a single captured dash | `OBSERVED` fact with text label | P1 |
| B17 | `NotedFactIcon` | Torn note corner with underlined dash | `NOTED` fact, not independently observed | P1 |
| B18 | `UnknownEvidenceIcon` | Cut cable ending before an unfilled square | `UNKNOWN` fact; text mandatory | P1 |
| B19 | `PartialCoverageIcon` | Six-slot plate with exactly two intentionally missing holes | `PARTIAL` history coverage | P1 |
| B20 | `UnverifiedCoverageIcon` | Outline plate and broken lower baseline, no checkmark | `UNVERIFIED` history coverage | P1 |
| B21 | `MissingStageIcon` | Empty spool spindle with exposed feed slot | `MISSING` Replay stage | P1 |
| B22 | `ReceiptAuthorityIcon` | Receipt plus tiny square seal and explicit companion authority text | Display *recorded* backend receipt ID only | P1 |
| B23 | `ErrorWireIcon` | Severed insulated wire with two unequal ends | Read/adapter error, not a moral judgement | P1 |
| B24 | `RatPawStampIcon` | Mechanical three-toe paw print with one hex fastening | Operator/brand decorative seal | P1 |

No generic shield, dollar coin, candlestick, moon, “good wallet” star, police suspect silhouette or person glyph in the domain set.

## 3. Micrographics inventory — 20 reusable primitives

Folder proposal: `web-v2/src/visual/micrographics/`. Each is either a simple `<svg>`, a CSS pseudo-element or a **single optional** texture overlay. A product icon describes an object; a micrographic is framing/material language. Avoid turning every panel into an asset collage.

| ID | Name / API value | SVG/CSS recipe | Placement | Density / safe rule |
|---|---|---|---|---|
| M01 | `rivet-corner` | 2 unequal rings plus angled L-plate inside 24px corner | Desktop primary panels | ≤2 corners/panel |
| M02 | `welded-bracket` | 16px hard L with 3 interrupted weld ticks | Dossier title / section edge | No text overlap |
| M03 | `bent-plate-edge` | Cut triangular sheet edge plus short shadow stroke | Selected panels | Large only |
| M04 | `claw-notch` | 3 tiny offset V cuts / negative-space gouges | Section chapter start | Not an affordance |
| M05 | `weld-seam` | Uneven dashed line with sparse crossing burrs | Desktop rail divider | 1 section divider |
| M06 | `receipt-perforation` | Repeated small round subtractions at equal spacing | `ReceiptSheet` edge | Keep proof text clear |
| M07 | `hazard-stripe` | Repeating 12px angled red/rust strokes + 18px gap | Fault/maintenance zone | Never behind text |
| M08 | `cable-conduit` | Double line with 90° elbows and one termination dot | Navigational connective motif | Not real data flow |
| M09 | `bolt-marker` | Hexagon/square bolt with center void | Bullet/rail hardware | ≤4 per screen |
| M10 | `servo-led` | 5px square status diode and rectangular bezel | Shell's actual state indicator | Color + visible label |
| M11 | `whisker-bracket` | 2 thin angled whiskers flanking a heading edge | Selected dossier heading | Rat fragment, subtle |
| M12 | `barcode-tick` | 7 uneven vertical slits and 2 short checksum bars | Non-semantic case decoration | Never encode fake ID |
| M13 | `oxide-bloom` | Sparse alpha rust dots bounded to 1 corner | Outer card / sidebar | Static, ≤8% contrast |
| M14 | `scratched-enamel` | 3–6 irregular hairline diagonal strokes | Card border / dead space | Off at small sizes |
| M15 | `thermal-paper-noise` | Fine CSS noise or one tiled SVG at ≤3% opacity | Receipt *margin* only | Exclude code blocks |
| M16 | `oil-fingerprint` | Broken eccentric arcs with a blurred alpha mask | Large decorative desktop backing | Never under facts |
| M17 | `corrosion-gauge` | 8 ticks on rough semicircular meter, no score color | Decorative field instrument | Must not imply rating |
| M18 | `recurrence-cutout` | Repeated 16px die-punched slots, only occupied if data-backed | Launch recurrence row | No fabricated counts |
| M19 | `field-unit-serial` | BR / unit slot / 2 punched holes / static separator | Header + artifact framing | Avoid fake receipt-like IDs |
| M20 | `fault-cut-wire` | Severed cable and sparse short electrical warning stroke | Error/partial shell illustration | No strobing |

**Texture limits:** max one material texture per primary panel; at phone widths at most one decorative corner or notch per card; at desktop permit a frame + one texture + one stamp per major region. SVG masters have a monochrome “clean” mode; visual noise never replaces visible source/coverage labels.

## 4. Component contracts and proposed React API

Implementation path: `web-v2/src/visual/components/`, with barrel `index.ts`. All existing evidence state types should be **imported from `../types` / `evidenceIntegrity`**, not forked. Prefer CSS Modules for each component and pure SVGs for icons. A shared desktop + mobile presentation is the target; allow different compositions where density differs.

### Component ownership and prop contract

| Component | Minimal props and behavior | Required invariants |
|---|---|---|
| `BinratIcon` | `name: BinratIconName`; `size?: 16 \| 20 \| 24 \| 32`; `title?: string`; `decorative?: boolean` | Only B01–B24; `aria-hidden` if decorative; never dynamic untrusted component lookup |
| `UtilityIcon` | `name: UtilityIconName`; `size?: 20 \| 24` | Explicit Tabler import map, no all-icons bundle; optional icon title |
| `Micrographic` | `kind: MicrographicKind`; `tone?: "steel" \| "rust" \| "bone"`; `density?: "quiet" \| "expressive"` | `aria-hidden`, `pointer-events:none`; cannot carry data state alone |
| `ScrapCard` | `as?: "article" \| "section" \| "div"`; `variant: "steel" \| "paper" \| "oxide"`; `density?: "field" \| "bench"`; `children` | No semantic result implied by material, responsive size to viewport |
| `EvidenceStamp` | Discriminated `scope: "fact" \| "coverage" \| "replay"`; `state` restricted to that scope | Visible text always; fact and coverage never conflated; colors are redundant |
| `ReceiptSheet` | `title`, `receiptId?: string`, `checkpoint?: string`, `source?: string`, `mode: DataMode`, `children` | `receiptId` copied in full; `DEMO` not chain proof; no fake verified badge |
| `RustRail` | `orientation: "horizontal" \| "vertical"`; `items`, `compact?: boolean` | Each real signal must have validated source/meaning; no decorative “LIVE” pulse |
| `CreatorTag` | `address`, `sourceLabel`, `checkpoint?`, `onOpen?` | Header reads “SOURCE-REPORTED CREATOR”; no human/profile claim |
| `ReplaySpool` | `stages: Record<ReplayHorizon, ReplayStage>`; `active`, `onChange` | Existing `REPLAY_HORIZONS`, `MISSING` unchanged, no autoplay or future leakage |
| `ScrapBookmark` | `item: Bookmark`; `saved: boolean`; `onToggle` | Label says “Saved on this device”; no Watch/Telegram claim |
| `RadarSignalCard` | `candidate: RadarCandidate`; `checkpoint`; `coverage`; `onOpen` | Evidence-linked observed role; counts/labels never derived from decorative marks |
| `RatPresence` | `state: RatState`; `size: "stamp" \| "panel" \| "hero"`; `fallbackSrc` | Approved art only, alt supplied by host if informative; Rive is optional and state-driven |
| `SewerDivider` | `kind?: "weld" \| "paper" \| "cable"` | Decorative, no tab or navigation meaning |

### TypeScript starter signatures (contract, not an implemented library)

```tsx
import type { ReactNode } from "react";
import type { Bag, CoverageState, EvidenceState, RadarCandidate, RatState } from "../types";
import type { ReplayHorizon, ReplayStage } from "../evidenceIntegrity";
import type { DataMode } from "../data";
import type { Bookmark } from "../mobile/MobileExperience";

export type EvidenceStampProps =
  | { scope: "fact"; state: EvidenceState }
  | { scope: "coverage"; state: CoverageState }
  | { scope: "replay"; state: ReplayStage["state"] };

export type ScrapCardProps = {
  as?: "article" | "section" | "div";
  variant: "steel" | "paper" | "oxide";
  density?: "field" | "bench";
  children: ReactNode;
};

export type ReceiptSheetProps = {
  title: string;
  mode: DataMode;
  receiptId?: string;
  checkpoint?: string; // exact source-specific checkpoint; do not merge with others
  source?: string;
  children: ReactNode;
};

export type ReplaySpoolProps = {
  stages: Record<ReplayHorizon, ReplayStage>;
  active: ReplayHorizon;
  onChange: (next: ReplayHorizon) => void;
};

export type ScrapBookmarkProps = {
  item: Bookmark;
  saved: boolean;
  onToggle: (item: Bookmark) => void;
};

export type RadarSignalCardProps = {
  candidate: RadarCandidate; // observed recipient, NEVER source-reported creator
  checkpoint: string;
  coverage: CoverageState;
  onOpen: (address: string) => void;
};

export type RatPresenceProps = {
  state: RatState;
  size: "stamp" | "panel" | "hero";
  fallbackSrc: string;
  decorative?: boolean;
};

export type CreatorTagProps = {
  address: Bag["reportedCreatorAddress"];
  sourceLabel: string;
  checkpoint?: string;
  onOpen?: (address: string) => void;
};
```

For receipt authority, make proof verification a *separate* explicit contract when backend evidence actually provides it; do not smuggle it into `EvidenceStamp` with a generic checkmark.

### Integration rules

- `MobileExperience.tsx` is a working M1 composition. Extract reusable components **incrementally**; do not rewrite the file wholesale merely to change appearance.
- Keep existing `Primitives.tsx` `CopyButton`, `CoverageStamp`, `Receipt` and `CheckpointRail` working until audited replacements pass equivalent tests.
- Desktop and mobile share product icons, material tokens, status vocabulary and state-driven mascot fragments. Desktop can combine dense evidence rows with an adjacent dossier; mobile has a single active dossier and four thumb destinations.
- Imported SVG paths are reviewed/static. Do not render raw untrusted launch metadata as SVG/HTML, build URLs from artist metadata or infer live evidence from visual motion.

## 5. Mascot map and motion grammar

### Source image and crop hierarchy

- **One approved source:** `web/assets/binrat-hero.webp` and *owner-approved derivative masters*. Produce `rat-head`, `cyborg-eye`, `paw-and-receipt`, `tail-cable`, `whisker-bracket` crops with identical anatomy/eye side.
- **Full art (rare):** About/onboarding, full-screen empty state, specific celebratory proof event only if validated.
- **Fragments (often):** small shell/operator badge, sidebar stamp, Radar eye, Bag clipped corner, Saved pin, Replay receipt feeder, error cut-wire.
- **Micro glyph (frequent but quiet):** eye lens, ear-notch negative space, paw stamp, cable-tail connector. If the user notices ornament before they can locate the next action, reduce it.

| UI moment | Mascot fragment / behavior | Trigger source | Motion rule |
|---|---|---|---|
| App idle | Small head stamp, dim eye | Stable validated state | Still first, optional tiny blink |
| Loading | Paws sorting paper | Request genuinely in flight | Loop stops on completion/error |
| Evidence available | Eye points at receipt | Validated result exists | One-shot, never “cryptographically proved” |
| Repeated reported address | Multiple bag tags | Source-backed recurrence | Count must match current coverage |
| Empty | Rat with empty tray | Validated zero result | Still fallback required |
| Error | Severed wire, eye fault | Genuine failed request | One-shot, no flashing |
| Replay horizon | Tail cable turns spool | User changed active stage | Never auto-advance evidentiary time |
| Save | Paw pins paper | Local bookmark completed | Never suggests Telegram subscribed |

**Duration guide** (targets only): 80–120 ms mechanical press, 160–240 ms tray slide, 300–380 ms noncritical stamp; reduced-motion = no spatial transform and no autoplay. Motion may respond to an actual state transition but must not create success, proof, or Watch state. Defer production Rive export/licensing until actual art and budgets are approved.

## 6. Screen recipes: desktop workbench vs phone field scanner

| Screen | Desktop workstation | Phone field scanner | Rat/material signature |
|---|---|---|---|
| Discover | Evidence rows and preview dossier side-by-side | First indexed Bag in first view; search/filter; single vertical list | Rat badge, 1 corrosion corner on flagship card |
| Radar | Ranked recurrence matrix + independently scoped address evidence | Selected recipient first; larger metrics, inspectable reasons and receipt sheet | Eye scope and punched recurrence cuts |
| Bag / Creator | Source-reported Creator file, receipt and history in dense separated panels | Essential identity/facts first, next action obvious, proof expanded deliberately | Scrap folder, source tag, paw-edged paper |
| Replay | Timeline instrument beside readout | Four accessible tabs + one large readout; missing stage visible | Physical receipt spool, no autoplay |
| Saved | Compact local casebook | Finger-sized saved cards | Scrap pin; explicit local/no-sync copy |
| More / Ledger | Dense authority ledger allowed | Single task per route, legible long IDs, copy action | Worn paper and ledger slab, texture outside text |

Phone body copy target 14–16 px where practical and action targets ≥48×48 CSS px; some pure technical metadata may be smaller but must remain readable without pinch zoom. Account for safe areas, browser Back and long 40/64-character strings. On desktop, density is useful but must not turn into low-contrast “terminal wallpaper.”

## 7. File plan / implementation batch

Proposed new paths (not present until their implementation PR):

```text
web-v2/src/visual/
  tokens.css
  icons/
    utility.tsx                # explicit named Tabler imports, 12-action whitelist
    binrat/
      index.ts                 # only reviewed first-party component exports
      B01-RatHeadIcon.tsx      # follow pack numbering consistently
      ...                      # P0 first, P1 after small-size acceptance
  micrographics/
    index.tsx
    motifs.tsx                # clean monochrome SVG paths
    textures.css              # bounded optional overlays, no required images
  components/
    ScrapCard.tsx
    ScrapCard.module.css
    EvidenceStamp.tsx
    ReceiptSheet.tsx
    ReplaySpool.tsx
    CreatorTag.tsx
    ScrapBookmark.tsx
    RadarSignalCard.tsx
    RatPresence.tsx           # only once approved fragments exist
    index.ts
  __screenshots__/             # deterministic contact sheets, if repo policy permits
```

**Batch D0 — design authority / no dependency:** 24-icon specification (this file), 20-micrographic specification, token map and initial four rendered contact sheets: icons on dark at 16/24 px, icons on paper at 16/24 px, 20-motif density sheet, mascot crop placement sheet. Owner selects master direction from screenshots, not CSS-only rationale.

**Batch D1 — one bounded implementation changeset:** choose first **13 P0 icons**, first **8 motifs (M01–M08)**, Tabler 12 utility whitelist and **five** signature components: `ScrapCard`, `EvidenceStamp`, `ReceiptSheet`, `ScrapBookmark`, `SewerDivider`. Apply to one representative desktop Discover + phone Discover, then Radar + Bag *within the same accepted style contract*; avoid an independent redraw of each route. No Rive dependency yet.

**Batch D2 — polish only after D1 approval:** remaining first-party icons/motifs with real usage, `ReplaySpool`, `CreatorTag`, `RadarSignalCard`, state-driven `RatPresence`, selective Motion, optional Rive-ready layered assets. Promote approved variants only; leave unused motifs as source art, not shipped JS.

## 8. Acceptance and red-team kill conditions

1. **Brand:** Five-second recognition without logo, but the screen still answers “what is indexed, what is observed, what can I inspect next?” No generic bubble map, stock cyberpunk gradients, shield/coin semantics or faux police suspect labels.
2. **Visual budget:** all icons readable at 16 px one-color; no texture behind addresses, receipt IDs, checkpoint, body copy, control labels, keyboard focus or screen-reader-only text. Decorative layers disable with `prefers-reduced-motion` where relevant.
3. **Semantic integrity:** exact role distinction, no fabricated proof/synchronization; DEMO and LIVE conspicuous; `MISSING` unchanged; Saved ≠ Watch; backend receipt authority not upgraded by UI.
4. **Responsive:** 320 / 360 / 390 / 430 phone; 768 tablet; 1024 / 1440 desktop; Android Back, scale-up font, long unbroken IDs, copy/share, offline/stale and 503. Check actual phone separately; desktop enthusiasm is not actual-phone acceptance.
5. **Engineering:** deterministic reference screenshots, Playwright layout and task-flow checks, keyboard/axe tests, measured first-screen bundle and render performance; no new dependency unless its exact job and license are documented.
6. **Review process:** one independent visual hostile review, fix Critical/High, one targeted rereview only if required. Do not spin into repeated cosmetic PRs.
7. **Authority:** keep `web/` production and M1 GitHack demo independent; no cutover, merge, spending, token, Watch activation or wallet authority from this document.

**Definition of done:** a single coherent, reusable first-party art/component language visible on both desktop and phone, evidenced by contact sheets + actual rendered screenshots + passing existing evidence tests, *followed* by explicit owner visual acceptance.
