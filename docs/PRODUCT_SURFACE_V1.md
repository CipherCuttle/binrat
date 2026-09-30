# BINRAT PRODUCT SURFACE V1

Status: proposed V1 application architecture; thin demo implemented in `web-v2/`.
Invariant: **DEGEN DECIDES ATTENTION. RECEIPTS DECIDE TRUTH.**

## Product promise

BINRAT is launch memory, not a prediction terminal. It records what launched, which address a source reported, what else that address appeared beside, what could be observed at each horizon, and which receipts support the record.

The daily return loop is:

`see what launched → open a bag → follow creator history → replay what changed → inspect recurrence → arm a watch`

Every evidence screen must answer: what is this object, where did it come from, as of which checkpoint, how complete is coverage, and what can I inspect next?

## Sitemap

| Route | Product job | Primary next action |
|---|---|---|
| `/` | Brand story plus current live proof | Enter Dumpster or Radar |
| `/dumpster` | Scan/search/filter indexed launches | Open Bag dossier |
| `/bag/:id` | Inspect launch evidence and downstream paths | Creator File, Replay, Watch, Share |
| `/creator/:address` | Durable reported-address dossier | Open associated Bag or Watch |
| `/replay/:id` | Point-in-time launch reconstruction | Inspect evidence receipt or Creator File |
| `/radar` | Rank observed recipient addresses by reproducible recurrence/timing | Inspect address evidence or Watch |
| `/radar/address/:address` | Address activity dossier | Open public receipt or Watch |
| `/watch` | Manage future-only evidence tripwires | Open watched Creator/Bag |
| `/ledger` | Financial transparency and funding receipts | Inspect entry/authority receipt |
| `/binrat` | Current token state, existing/planned utility, treasury, launch facts | Verify canonical contract/status |
| `/method` | Evidence and ranking method | Return to evidence object |

`/creator/:address` explicitly means the address reported by the source launchpad. It is not a human-profile route. `/radar/address/:address` explicitly means an observed on-chain role such as V3 swap recipient; it must not collapse into Creator File semantics.

## Global shell

Desktop uses a compact left rail with DUMPSTER, RADAR, WATCH, REPLAY, and LEDGER. Home remains reachable through the BINRAT mark; `$BINRAT` is a separate status item. Mobile uses a text-labeled bottom rail with the same five destinations.

A top status rail persists:

- Arc network and chain ID;
- index readiness;
- authoritative checkpoint;
- history/evidence coverage;
- fixture/demo/live mode when applicable;
- `$BINRAT` state, with wallet state later only when authorized.

The shell never invents runtime state. It consumes validated `/api/health`, feed receipts, capability manifest projection, and token-status authority. If those sources disagree or are unavailable, the surface fails closed.

## Home

Home is acquisition story plus proof—not the entire product. The headline is `THE RAT REMEMBERS.` with `HOT GARBAGE` retained as the launch-feed name. Above the fold states the literal utility and immediately offers ENTER THE DUMPSTER and OPEN RAT RADAR.

Below the fold shows only three objects:

1. newest indexed bag with reported creator and prior-bag count;
2. Rat Radar recurrence snapshot;
3. the daily return proposition: latest bag, creator history, replay, watch.

## Dumpster

Dumpster is a fast launch browser with newest-first scanning, search, bounded evidence filters, and compact coverage. Each row is a real link to `/bag/:id`. Desktop uses a dense table; mobile turns each launch into a short two-column record and does not carry unrelated homepage sections below it.

Filters describe evidence availability or source fields. They do not label quality, safety, or investment merit.

## Bag dossier

The Bag dossier is the central product object and share target. It contains:

- token and launch-source facts;
- launch block/transaction and receipt;
- ArcPad-reported creator address with identity boundary;
- explicit evidence states;
- observation maturity and coverage;
- Creator File preview and chronological Trash Trail;
- interactive Replay entry;
- Share Receipt and Watch Creator actions.

The top action hierarchy is: inspect evidence, follow creator history, replay, then watch/share. A WATCH action means future-only subscription from the current checkpoint and must show its delivery/state receipt.

## Creator File

Creator File is a durable dossier for one reported creator address. It shows indexed launch count, complete known chronology through the checkpoint, evidence coverage, source attribution, and associated Bag links. The title remains `REPORTED CREATOR ADDRESS`; it never becomes a person name or wallet-owner claim.

The principal visualization is a recurrence strip: chronological indexed launches, gaps, and evidence maturity. It is not a performance chart.

## Replay Lab

Replay makes `LAUNCH → 5m → 1h → 24h` explicit as selectable frozen stages. Each stage shows:

- available/unavailable status;
- observation block/time;
- facts captured at that horizon;
- changes from the preceding available stage;
- stage receipt and coverage.

No future value may fill an earlier stage. Missing or immature stages remain visible as missing, not interpolated. Replay defaults to LAUNCH and never autoplays in a way that hides the stage boundary.

## Rat Radar

Rat Radar is the flagship intelligence instrument. The free screen shows the bounded public watchlist from `/api/rat-radar/watchlist` with:

- ranked **observed recipient addresses**;
- distinct indexed launch recurrence;
- median and earliest first-entry block delta;
- acquisition receipt count;
- sample/coverage counts;
- deterministic inclusion reasons;
- public evidence receipts;
- explicit address-role and recommendation boundaries.

The visual is an evidence terminal/dossier split. The left side is a sortable recurrence matrix; the selected row opens a paper-like evidence dossier on the right. Ranking color remains neutral/orange and never grades an address green/red. `rank` is inspection order, not safety or opportunity.

Future holder access may reveal the full ranked universe, richer decomposition, filters, active views, and watch capacity. It cannot hide the public receipts needed to verify factual claims.

## Rat Watch

Watch becomes a contextual action on Bag, Creator File, and Radar address dossiers. `/watch` manages active tripwires and receipt-backed delivery state. V1 watches are future-only and bounded to supported facts:

- reported creator recurrence;
- Creator File update;
- matured 5m/1h/24h observation;
- supported Telegram delivery.

The UI must say what is watched, from which checkpoint, where alerts go, and whether the subscription was accepted. No generic “follow wallet” wording.

## Dumpster Ledger

Ledger is financial transparency, not system-status prose. It separates:

- configured authority roles;
- on-chain proof availability;
- accounting-active state;
- inflow/outflow chronology;
- utility capability states;
- receipt/checkpoint.

Pre-launch zero activity is shown as `NOT_YET_AVAILABLE`/zero entries with the reason, never as implied clean performance.

## $BINRAT

The `$BINRAT` destination has five visually separated ledgers:

1. current token state and canonical address state;
2. utility live now;
3. utility building/planned;
4. treasury and project-fee roles;
5. launch authorization and anti-scam contract surface.

Planned utility cannot be styled as active. No visual polish, holder-gate UI, or wallet component changes launch authority. Until the canonical state changes, the dominant label remains `NOT_LAUNCHED` and no token contract is published.

## Evidence semantic model

V1 components accept closed vocabularies:

- evidence item: `OBSERVED`, `NOTED`, `UNKNOWN`;
- coverage: `COMPLETE`, `PARTIAL`, `UNVERIFIED`;
- availability may use source-defined missing/immature states but cannot coerce them to a favorable state.

Every semantic chip includes text plus a non-color marker. Green means observed/complete evidence state, not safe. Orange means noted/partial, not risky. Purple/neutral means unknown/unverified, not benign.

The persistent receipt rail contains checkpoint, coverage, receipt ID, projection/source authority, and a copy/open-evidence control.

## Data architecture

`web-v2` consumes existing public schemas through typed adapters. API paths remain unchanged. Components receive validated product objects and never reconstruct backend authority from incidental fields.

The demo defaults to deterministic, visibly labeled schema-matched data. `?source=live` uses `/api/feed` and `/api/rat-radar/watchlist`, validates schema identity/chain/basic structure, and fails closed. Production acceptance requires full validators equivalent to `web/data-source.js` before replacing the live frontend.

## Motion contract

Motion communicates product state. The future Rive adapter accepts:

```ts
type RatState =
  | 'idle'
  | 'indexing'
  | 'digging'
  | 'evidence_found'
  | 'repeat_creator'
  | 'empty'
  | 'error'
  | 'receipt_verified';
```

Inputs come from validated frontend state transitions, never invented timers: request start, validated evidence arrival, explicit recurrence, empty projection, adapter error, and verified receipt. The approved `web/assets/binrat-hero.webp` is the fallback and current demo asset. `prefers-reduced-motion` disables transforms/loops while preserving state labels.

## Migration boundary

V2 remains isolated until route-by-route acceptance. Production `web/` stays deployable. A later migration should first share schema validators and evidence-semantic tests, then candidate-deploy V2 without changing the Worker API. No backend rewrite, token action, wallet activation, or production cutover is part of Product Surface V1 demo.
